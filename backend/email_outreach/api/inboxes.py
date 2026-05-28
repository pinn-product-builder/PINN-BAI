"""Rotas de gestão de inboxes (CRUD + healthcheck on-demand).

Fluxos suportados nesta sprint (E1):
- GET    /email/inboxes              → lista inboxes da org
- POST   /email/inboxes/smtp         → cria inbox SMTP/IMAP (sem OAuth)
- PATCH  /email/inboxes/{inbox_id}   → editar display_name/daily_limit/status
- DELETE /email/inboxes/{inbox_id}   → remover
- POST   /email/inboxes/{inbox_id}/healthcheck → testar conexão agora

OAuth (Gmail/Outlook) vive em ``api/oauth.py`` (EO-003).
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response

from core.db import get_db
from email_outreach.core.crypto import encrypt_text_pg
from email_outreach.core.health import check_and_persist_inbox
from email_outreach.models import InboxOut, InboxUpdate, SmtpInboxCreate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email/inboxes", tags=["email-outreach:inboxes"])


# ── Helpers ──────────────────────────────────────────────────────────────────

_INBOX_PUBLIC_COLUMNS = (
    "id, org_id, provider, email, display_name, status, "
    "daily_limit, warmup_enabled, warmup_score, "
    "last_health_check_at, last_health_error, last_sent_at, "
    "oauth_expires_at, created_at, "
    "signature_name, signature_role, signature_company, "
    "signature_phone, signature_link, signature_html"
)


def _to_inbox_out(row: dict[str, Any]) -> InboxOut:
    return InboxOut.model_validate(row)


# ── Listagem ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[InboxOut])
async def list_inboxes(org_id: str = Query(..., description="UUID da organização")) -> list[InboxOut]:
    db = await get_db()
    res = await (
        db.table("eo_inboxes")
        .select(_INBOX_PUBLIC_COLUMNS)
        .eq("org_id", org_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_to_inbox_out(row) for row in (res.data or [])]


# ── Criar SMTP/IMAP ──────────────────────────────────────────────────────────

@router.post("/smtp", response_model=InboxOut, status_code=status.HTTP_201_CREATED)
async def create_smtp_inbox(body: SmtpInboxCreate) -> InboxOut:
    """Cria uma inbox via SMTP genérico. Senhas viram bytea criptografado."""
    db = await get_db()

    # TODO(E5): chamar adapters.smtp_imap.verify(...) antes de salvar.
    # Por ora confiamos no usuário; healthcheck rodará logo depois.

    row = {
        "org_id": body.org_id,
        "provider": "smtp",
        "email": str(body.email),
        "display_name": body.display_name or str(body.email),
        "smtp_host": body.smtp_host,
        "smtp_port": body.smtp_port,
        "smtp_username": body.smtp_username,
        "smtp_password_enc": encrypt_text_pg(body.smtp_password),
        "imap_host": body.imap_host,
        "imap_port": body.imap_port,
        "imap_username": body.imap_username or body.smtp_username,
        "imap_password_enc": encrypt_text_pg(body.imap_password or body.smtp_password),
        "daily_limit": body.daily_limit,
        "status": "active",
    }

    try:
        res = await db.table("eo_inboxes").insert(row).execute()
    except Exception as exc:  # supabase-py levanta APIError; capturamos genérico
        msg = str(exc)
        if "duplicate key" in msg.lower():
            raise HTTPException(status_code=409, detail="Já existe uma inbox com esse email nesta organização.") from exc
        logger.exception("Falha ao criar inbox SMTP")
        raise HTTPException(status_code=500, detail=f"Falha ao salvar inbox: {msg}") from exc

    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Inbox criada mas linha não retornada.")
    return _to_inbox_out(rows[0])


# ── Update ───────────────────────────────────────────────────────────────────

@router.patch("/{inbox_id}", response_model=InboxOut)
async def update_inbox(inbox_id: str, body: InboxUpdate) -> InboxOut:
    db = await get_db()

    patch: dict[str, Any] = {}
    if body.display_name is not None:
        patch["display_name"] = body.display_name
    if body.daily_limit is not None:
        patch["daily_limit"] = body.daily_limit
    if body.status is not None:
        patch["status"] = body.status
    if body.warmup_enabled is not None:
        patch["warmup_enabled"] = body.warmup_enabled
    # Campos de assinatura — string vazia ("") limpa o valor.
    for sig_field in (
        "signature_name",
        "signature_role",
        "signature_company",
        "signature_phone",
        "signature_link",
        "signature_html",
    ):
        val = getattr(body, sig_field, None)
        if val is not None:
            patch[sig_field] = val or None

    if not patch:
        raise HTTPException(status_code=400, detail="Nada para atualizar.")

    res = await (
        db.table("eo_inboxes")
        .update(patch)
        .eq("id", inbox_id).execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Inbox não encontrada.")
    return _to_inbox_out(rows[0])


# ── Delete ───────────────────────────────────────────────────────────────────

@router.delete("/{inbox_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_inbox(inbox_id: str) -> Response:
    db = await get_db()
    await db.table("eo_inboxes").delete().eq("id", inbox_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Healthcheck on-demand ────────────────────────────────────────────────────

@router.post("/{inbox_id}/healthcheck", response_model=InboxOut)
async def healthcheck_inbox(inbox_id: str) -> InboxOut:
    """Roda healthcheck on-demand:

    - Gmail: refresha access_token se necessário e chama
      ``users.getProfile``.
    - SMTP/Outlook: stubs por enquanto (próximos sprints).

    Sempre persiste o resultado em ``last_health_check_at`` /
    ``last_health_error`` / ``status``, depois devolve a inbox atualizada.
    """
    outcome = await check_and_persist_inbox(inbox_id)
    db = await get_db()
    res = (
        await db.table("eo_inboxes")
        .select(_INBOX_PUBLIC_COLUMNS)
        .eq("id", inbox_id).limit(1).execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Inbox não encontrada.")
    if not outcome["ok"]:
        # Não viramos 5xx — devolvemos 200 com a inbox em estado de erro
        # pra UI mostrar o motivo. Erros de configuração viram 4xx.
        logger.warning("Healthcheck falhou para %s: %s", inbox_id, outcome.get("detail"))
    return _to_inbox_out(rows[0])
