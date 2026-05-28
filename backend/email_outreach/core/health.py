"""Healthcheck de inboxes — chamado on-demand e por job periódico.

Estratégia:
- Para inboxes Gmail/Outlook: garantir que o access_token está fresco
  (refresh se necessário) e bater no endpoint de profile do provider.
- Para SMTP: tentar conectar e fazer NOOP.
- Em qualquer falha, marcar ``status='error'`` (sem desconectar — o
  usuário decide).
- Se o refresh_token foi revogado, marcar ``status='disconnected'``.

Resultado é persistido em ``last_health_check_at`` / ``last_health_error``.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from core.db import get_db
from email_outreach.adapters import gmail as gmail_adapter
from email_outreach.core.crypto import decrypt_text, encrypt_text_pg

logger = logging.getLogger(__name__)

# Margem antes do expiry pra forçar refresh proativamente.
REFRESH_THRESHOLD_SECONDS = 5 * 60


async def check_and_persist_inbox(inbox_id: str) -> dict[str, Any]:
    """Roda healthcheck em uma inbox e persiste o resultado.

    Retorna ``{"ok": bool, "detail": str|None, "status": InboxStatus}``.
    """
    db = await get_db()
    res = await db.table("eo_inboxes").select("*").eq("id", inbox_id).limit(1).execute()
    rows = res.data or []
    if not rows:
        return {"ok": False, "detail": "inbox não encontrada", "status": "error"}

    inbox = rows[0]
    provider = inbox["provider"]

    try:
        if provider == "gmail":
            outcome = await _check_gmail(inbox)
        elif provider == "outlook":
            outcome = {"ok": False, "detail": "Outlook ainda não implementado (Sprint 7)", "status": "error"}
        elif provider == "smtp":
            outcome = {"ok": True, "detail": "SMTP check pendente (Sprint 5)", "status": inbox["status"]}
        elif provider == "ses":
            outcome = {"ok": True, "detail": None, "status": inbox["status"]}
        else:
            outcome = {"ok": False, "detail": f"provider desconhecido: {provider}", "status": "error"}
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha inesperada no healthcheck de %s", inbox_id)
        outcome = {"ok": False, "detail": str(exc), "status": "error"}

    now_iso = datetime.now(tz=timezone.utc).isoformat()
    update = {
        "last_health_check_at": now_iso,
        "last_health_error": None if outcome["ok"] else outcome["detail"],
    }
    # Só mexemos no status se a checagem trouxe veredicto explícito.
    new_status = outcome.get("status")
    if new_status and new_status != inbox["status"]:
        update["status"] = new_status

    await db.table("eo_inboxes").update(update).eq("id", inbox_id).execute()
    return outcome


# ── Gmail ────────────────────────────────────────────────────────────────────

async def _check_gmail(inbox: dict[str, Any]) -> dict[str, Any]:
    enc = inbox.get("oauth_tokens_enc")
    if not enc:
        return {"ok": False, "detail": "sem tokens OAuth", "status": "disconnected"}

    try:
        tokens = json.loads(decrypt_text(enc))
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": f"falha ao decriptar: {exc}", "status": "error"}

    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_at_raw = inbox.get("oauth_expires_at")

    needs_refresh = False
    if not access_token:
        needs_refresh = True
    elif expires_at_raw:
        try:
            exp = datetime.fromisoformat(expires_at_raw.replace("Z", "+00:00"))
            if exp - datetime.now(tz=timezone.utc) < timedelta(seconds=REFRESH_THRESHOLD_SECONDS):
                needs_refresh = True
        except ValueError:
            needs_refresh = True

    if needs_refresh:
        if not refresh_token:
            return {"ok": False, "detail": "access_token expirado e sem refresh_token", "status": "disconnected"}
        try:
            refreshed = await gmail_adapter.refresh_access_token(refresh_token)
        except httpx.HTTPStatusError as exc:
            body = exc.response.text if exc.response is not None else ""
            if "invalid_grant" in body:
                return {"ok": False, "detail": "refresh_token revogado pelo usuário", "status": "disconnected"}
            return {"ok": False, "detail": f"refresh falhou: {body[:200]}", "status": "error"}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "detail": f"refresh falhou: {exc}", "status": "error"}

        access_token = refreshed["access_token"]
        new_expires = (
            datetime.now(tz=timezone.utc)
            + timedelta(seconds=int(refreshed.get("expires_in", 3600)))
        ).isoformat()

        # Google só devolve refresh_token novo quando rotaciona (raro);
        # mantemos o antigo se não vier.
        token_blob = {
            **tokens,
            "access_token": access_token,
            "refresh_token": refreshed.get("refresh_token") or refresh_token,
            "token_type": refreshed.get("token_type", "Bearer"),
            "scope": refreshed.get("scope", tokens.get("scope", "")),
        }
        db = await get_db()
        await (
            db.table("eo_inboxes")
            .update({
                "oauth_tokens_enc": encrypt_text_pg(json.dumps(token_blob)),
                "oauth_expires_at": new_expires,
            })
            .eq("id", inbox["id"])
            .execute()
        )

    # Profile call de verdade.
    try:
        profile = await gmail_adapter.get_gmail_profile(access_token)
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code if exc.response is not None else 0
        if status_code == 401:
            return {"ok": False, "detail": "Gmail rejeitou o token (401)", "status": "disconnected"}
        return {"ok": False, "detail": f"Gmail HTTP {status_code}", "status": "error"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": f"falha ao consultar profile: {exc}", "status": "error"}

    detail = (
        f"emailAddress={profile.get('emailAddress')} "
        f"messagesTotal={profile.get('messagesTotal', 0)}"
    )
    return {"ok": True, "detail": detail, "status": "active"}


# ── Job periódico ────────────────────────────────────────────────────────────

async def check_all_inboxes(stale_seconds: int = 3600) -> dict[str, int]:
    """Roda healthcheck em todas as inboxes que não foram checadas
    recentemente. Chamado pelo scheduler do APScheduler.
    """
    db = await get_db()
    cutoff = (datetime.now(tz=timezone.utc) - timedelta(seconds=stale_seconds)).isoformat()

    # Pega inboxes que nunca foram checadas OU estão stale, exceto pausadas
    # explicitamente pelo usuário.
    res = await (
        db.table("eo_inboxes")
        .select("id, status, last_health_check_at")
        .neq("status", "paused")
        .or_(f"last_health_check_at.is.null,last_health_check_at.lt.{cutoff}")
        .execute()
    )

    rows = res.data or []
    ok = 0
    failed = 0
    for row in rows:
        outcome = await check_and_persist_inbox(row["id"])
        if outcome["ok"]:
            ok += 1
        else:
            failed += 1
        # Pequeno respiro pra não martelar o Google.
        await asyncio.sleep(0.2)

    logger.info("Healthcheck rodou em %d inboxes (ok=%d, fail=%d)", len(rows), ok, failed)
    return {"checked": len(rows), "ok": ok, "failed": failed}
