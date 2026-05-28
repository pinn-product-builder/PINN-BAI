"""Endpoints de tracking público (E2 — Brick F).

Públicos (sem auth) — chamados pelo cliente de email do recipient quando
ele abre/clica/cancela:

- GET /email/track/open/{message_id}       → 1x1 GIF transparente
- GET /email/track/click/{message_id}?u=…  → 302 redirect pra URL real
- GET /email/unsubscribe/{message_id}/{token} → página + grava opt-out
- POST /email/unsubscribe/{message_id}/{token}?List-Unsubscribe=One-Click
       → RFC 8058 (Gmail/Outlook nativo)

Side-effect em cada hit: grava ``eo_message_events`` + atualiza
``eo_campaign_leads`` se a campanha tiver ``stop_on_*`` ativo.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response

from core.db import get_db
from email_outreach.tracking import verify_unsubscribe_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email", tags=["email-outreach:tracking"])


# GIF 1x1 transparente — 43 bytes pré-construídos.
PIXEL_GIF = bytes([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    0x00, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3B,
])


async def _record_event(
    message_id: str,
    event_type: str,
    metadata: dict[str, Any] | None = None,
    request: Request | None = None,
) -> dict[str, Any] | None:
    """Grava evento + retorna a row da eo_messages (pra side-effects).

    Não levanta — tracking nunca pode quebrar a UX do recipient.
    """
    try:
        db = await get_db()
        msg = await (
            db.table("eo_messages")
            .select("id, campaign_lead_id, org_id")
            .eq("id", message_id)
            .limit(1)
            .execute()
        )
        rows = msg.data or []
        if not rows:
            return None

        evt = {
            "message_id": message_id,
            "event_type": event_type,
            "metadata": metadata or {},
            "user_agent": (request.headers.get("user-agent") if request else None) or "",
            "ip_address": (request.client.host if request and request.client else None),
        }
        await db.table("eo_message_events").insert(evt).execute()
        return rows[0]
    except Exception:
        logger.exception("Falha ao gravar evento %s pra msg %s", event_type, message_id)
        return None


async def _maybe_stop_sequence(message_id: str, reason: str, status: str) -> None:
    """Se a campanha tiver flag stop_on_*, marca campaign_lead com status final."""
    try:
        db = await get_db()
        msg = await (
            db.table("eo_messages")
            .select("campaign_lead_id, eo_campaign_leads(campaign_id, eo_campaigns(stop_on_reply, stop_on_click))")
            .eq("id", message_id)
            .limit(1)
            .execute()
        )
        rows = msg.data or []
        if not rows or not rows[0].get("campaign_lead_id"):
            return
        row = rows[0]
        cl = row.get("eo_campaign_leads") or {}
        camp = cl.get("eo_campaigns") or {}
        flag = "stop_on_reply" if status == "replied" else "stop_on_click"
        if not camp.get(flag):
            return
        await (
            db.table("eo_campaign_leads")
            .update({
                "status": status,
                "status_reason": reason,
                "finished_at": datetime.now(tz=timezone.utc).isoformat(),
            })
            .eq("id", row["campaign_lead_id"])
            .execute()
        )
    except Exception:
        logger.exception("Falha em stop_sequence pra msg %s", message_id)


# ── Open pixel ──────────────────────────────────────────────────────────────


@router.get("/track/open/{message_id}")
async def track_open(message_id: str, request: Request) -> Response:
    await _record_event(message_id, "open", request=request)
    return Response(
        content=PIXEL_GIF,
        media_type="image/gif",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma": "no-cache",
        },
    )


# ── Click redirect ──────────────────────────────────────────────────────────


@router.get("/track/click/{message_id}")
async def track_click(
    message_id: str,
    request: Request,
    u: str = Query(..., description="URL destino (encoded)"),
) -> RedirectResponse:
    # Mínima validação: precisa ser http(s).
    parsed = urlparse(u)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="URL inválida.")

    await _record_event(message_id, "click", metadata={"url": u}, request=request)
    await _maybe_stop_sequence(message_id, f"clicked: {u[:200]}", "finished")
    return RedirectResponse(url=u, status_code=302)


# ── Unsubscribe ─────────────────────────────────────────────────────────────


_UNSUBSCRIBE_PAGE = """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Cancelar inscrição — Pinn BAI</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{max-width:420px;background:#fff;padding:32px;border-radius:12px;
        box-shadow:0 1px 3px rgba(0,0,0,.08);text-align:center}
  h1{font-size:20px;margin:0 0 8px;color:#111827}
  p{color:#6b7280;font-size:14px;margin:0 0 16px;line-height:1.5}
</style></head><body><div class="card">
<h1>Inscrição cancelada</h1>
<p>Você não receberá mais emails desta conta da Pinn.</p>
<p style="font-size:12px;opacity:.6">Se foi engano, basta responder o último email recebido.</p>
</div></body></html>"""


async def _process_unsubscribe(message_id: str, token: str, request: Request, source: str) -> None:
    if not verify_unsubscribe_token(message_id, token):
        raise HTTPException(status_code=400, detail="Token inválido.")

    try:
        db = await get_db()
        msg = await (
            db.table("eo_messages")
            .select(
                "id, to_email, org_id, campaign_lead_id, "
                "eo_campaign_leads(lead_id, campaign_id)"
            )
            .eq("id", message_id)
            .limit(1)
            .execute()
        )
        rows = msg.data or []
        if not rows:
            return

        row = rows[0]
        org_id = row["org_id"]
        email = row["to_email"]
        cl = row.get("eo_campaign_leads") or {}

        # Marca evento.
        await db.table("eo_message_events").insert({
            "message_id": message_id,
            "event_type": "unsubscribe",
            "metadata": {"source": source},
            "user_agent": request.headers.get("user-agent") or "",
            "ip_address": request.client.host if request.client else None,
        }).execute()

        # Marca lead como unsubscribed (dedup ON CONFLICT).
        await db.table("eo_unsubscribes").upsert({
            "org_id": org_id,
            "lead_id": cl.get("lead_id"),
            "email": email,
            "source": source,
            "campaign_id": cl.get("campaign_id"),
            "user_agent": request.headers.get("user-agent") or "",
        }, on_conflict="org_id,email").execute()

        # Atualiza eo_leads status.
        if cl.get("lead_id"):
            await db.table("eo_leads").update(
                {"status": "unsubscribed"}
            ).eq("id", cl["lead_id"]).execute()

        # Para todos os enrollments deste lead.
        if cl.get("lead_id"):
            await (
                db.table("eo_campaign_leads")
                .update({
                    "status": "unsubscribed",
                    "status_reason": f"unsubscribed via {source}",
                    "finished_at": datetime.now(tz=timezone.utc).isoformat(),
                })
                .eq("lead_id", cl["lead_id"])
                .in_("status", ["enrolled", "paused"])
                .execute()
            )

        # Suppression global.
        await db.table("eo_suppressions").upsert({
            "org_id": org_id,
            "email": email,
            "kind": "unsubscribe",
            "reason": source,
        }, on_conflict="org_id,email,kind").execute()
    except Exception:
        logger.exception("Falha ao processar unsubscribe pra msg %s", message_id)


@router.get("/unsubscribe/{message_id}/{token}", response_class=HTMLResponse)
async def unsubscribe_page(message_id: str, token: str, request: Request) -> HTMLResponse:
    await _process_unsubscribe(message_id, token, request, source="one_click")
    return HTMLResponse(content=_UNSUBSCRIBE_PAGE)


@router.post("/unsubscribe/{message_id}/{token}")
async def unsubscribe_post(message_id: str, token: str, request: Request) -> dict:
    """RFC 8058 — endpoint chamado pelo Gmail/Outlook quando o usuário
    clica em "Cancelar inscrição" no header nativo do cliente."""
    await _process_unsubscribe(message_id, token, request, source="list_unsubscribe_header")
    return {"ok": True}


# ── Reply event from poller ─────────────────────────────────────────────────


@router.post("/track/reply/{message_id}")
async def track_reply_internal(message_id: str, metadata: dict[str, Any] | None = None) -> dict:
    """Endpoint interno chamado pelo reply_poller quando detecta resposta.

    Não autenticado por enquanto (mesmo nível dos outros tracking endpoints).
    """
    msg = await _record_event(message_id, "reply", metadata=metadata or {})
    if msg:
        await _maybe_stop_sequence(message_id, "lead respondeu", "replied")
    return {"ok": bool(msg)}
