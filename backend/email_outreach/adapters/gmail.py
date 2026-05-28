"""Adapter Gmail — OAuth + Gmail API.

Sprint 1 (E1): só o OAuth flow e healthcheck (getProfile).
Sprint 3 (E2): adiciona ``send_message`` (users.messages.send).
Sprint 6 (E4): adiciona ``list_threads_modified_since`` p/ reply detection.

Escopo OAuth:
- gmail.send       → enviar mensagens
- gmail.readonly   → ler INBOX (replies, bounces)
- gmail.modify     → marcar como lido / mover de aba (warmup, E8)
- userinfo.email   → identificar a conta conectada no callback
"""
from __future__ import annotations

import logging
import os
from typing import Any
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile"

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]


def _client_id() -> str:
    val = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    if not val:
        raise RuntimeError("GOOGLE_OAUTH_CLIENT_ID não configurada.")
    return val


def _client_secret() -> str:
    val = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
    if not val:
        raise RuntimeError("GOOGLE_OAUTH_CLIENT_SECRET não configurada.")
    return val


def _redirect_uri() -> str:
    """URI exato registrado no Google Cloud Console.

    Default aponta pro callback do próprio backend FastAPI, que devolve
    um HTML que fecha o popup e devolve sinal pro frontend (postMessage).
    """
    return os.environ.get(
        "GOOGLE_OAUTH_REDIRECT_URI",
        "http://localhost:8000/email/oauth/google/callback",
    )


# ── OAuth dance ──────────────────────────────────────────────────────────────

def build_authorization_url(state: str) -> str:
    """Monta a URL de consent. ``state`` é assinado/aleatório pelo caller."""
    params = {
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": " ".join(GMAIL_SCOPES),
        "access_type": "offline",          # pra receber refresh_token
        "prompt": "consent",                # garante refresh_token mesmo se já consentiu antes
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_tokens(code: str) -> dict[str, Any]:
    """Troca o code recebido no callback pelo conjunto de tokens.

    Retorna o JSON do Google: ``access_token``, ``refresh_token``,
    ``expires_in``, ``token_type``, ``scope``, ``id_token``.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": _client_id(),
                "client_secret": _client_secret(),
                "redirect_uri": _redirect_uri(),
                "grant_type": "authorization_code",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> dict[str, Any]:
    """Renova o access_token usando o refresh_token."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "refresh_token": refresh_token,
                "client_id": _client_id(),
                "client_secret": _client_secret(),
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        return resp.json()


# ── Profile / Healthcheck ────────────────────────────────────────────────────

async def get_user_email(access_token: str) -> str:
    """Retorna o email da conta autenticada (userinfo.email)."""
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        data = resp.json()
        email = data.get("email")
        if not email:
            raise RuntimeError("userinfo respondeu sem email.")
        return email


async def get_gmail_profile(access_token: str) -> dict[str, Any]:
    """Chama gmail.users.getProfile — healthcheck barato."""
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            GMAIL_PROFILE_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json()


GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
GMAIL_LIST_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
GMAIL_GET_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/{}"


async def list_messages(
    access_token: str,
    query: str = "in:inbox newer_than:1d",
    max_results: int = 50,
) -> list[dict[str, Any]]:
    """Lista IDs de mensagens recentes que casam com a query Gmail.

    Query default: ``in:inbox newer_than:1d`` — pega tudo na inbox do
    último dia (inclusive replies a cold emails que enviamos).
    """
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            GMAIL_LIST_URL,
            params={"q": query, "maxResults": max_results},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code >= 400:
            logger.warning("Gmail list falhou [%s]: %s", resp.status_code, resp.text[:300])
            return []
        return resp.json().get("messages") or []


async def get_message_headers(
    access_token: str,
    msg_id: str,
    header_names: list[str] | None = None,
) -> dict[str, str]:
    """Pega só os headers (não body) — barato pra match de In-Reply-To."""
    params = {"format": "metadata"}
    headers_to_fetch = header_names or [
        "In-Reply-To", "References", "From", "Subject", "Date",
        "Auto-Submitted", "X-Failed-Recipients",
    ]
    for h in headers_to_fetch:
        params.setdefault("metadataHeaders", h)
    # httpx aceita lista em params via tuple-of-tuples — refaz como tuples.
    param_pairs = [("format", "metadata")] + [("metadataHeaders", h) for h in headers_to_fetch]
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            GMAIL_GET_URL.format(msg_id),
            params=param_pairs,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code >= 400:
            logger.warning("Gmail get falhou [%s]: %s", resp.status_code, resp.text[:300])
            return {}
        payload = resp.json().get("payload") or {}
        return {h["name"]: h["value"] for h in payload.get("headers") or []}


def build_rfc5322_message(
    *,
    from_email: str,
    from_name: str | None,
    to_email: str,
    to_name: str | None,
    subject: str,
    body_html: str,
    body_text: str | None = None,
    in_reply_to: str | None = None,
    references: str | None = None,
    message_id_domain: str = "pinnpb.com",
    extra_headers: dict[str, str] | None = None,
) -> tuple[str, str]:
    """Constrói payload MIME RFC 5322 base64url-encoded p/ Gmail API.

    Retorna ``(message_id, raw_b64)``. ``message_id`` é o cabeçalho Message-ID
    gerado localmente (precisa pra threading e reconciliação com replies).
    """
    import base64
    import uuid
    from email.message import EmailMessage
    from email.utils import format_datetime
    from datetime import datetime, timezone

    msg = EmailMessage()
    msg["From"] = f'"{from_name}" <{from_email}>' if from_name else from_email
    msg["To"] = f'"{to_name}" <{to_email}>' if to_name else to_email
    msg["Subject"] = subject
    message_id = f"<{uuid.uuid4()}@{message_id_domain}>"
    msg["Message-ID"] = message_id
    msg["Date"] = format_datetime(datetime.now(timezone.utc))
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = references or in_reply_to

    if extra_headers:
        for k, v in extra_headers.items():
            msg[k] = v

    # Plain text fallback (essencial pra deliverability).
    if not body_text:
        # Strip tags simplório — bom o suficiente como fallback.
        import re

        body_text = re.sub(r"<[^>]+>", "", body_html).strip()

    msg.set_content(body_text)
    msg.add_alternative(body_html, subtype="html")

    raw_bytes = msg.as_bytes()
    raw_b64 = base64.urlsafe_b64encode(raw_bytes).decode("ascii")
    return message_id, raw_b64


async def send_message(
    access_token: str,
    raw_b64: str,
    thread_id: str | None = None,
) -> dict[str, Any]:
    """Envia via gmail.users.messages.send.

    Se ``thread_id`` for fornecido, anexa à thread existente (continuation).
    """
    payload: dict[str, Any] = {"raw": raw_b64}
    if thread_id:
        payload["threadId"] = thread_id

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GMAIL_SEND_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            json=payload,
        )
        if resp.status_code >= 400:
            logger.error("Gmail send falhou [%s]: %s", resp.status_code, resp.text[:500])
            resp.raise_for_status()
        return resp.json()  # {"id": "...", "threadId": "...", "labelIds": [...]}
