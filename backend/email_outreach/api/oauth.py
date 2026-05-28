"""Rotas de OAuth para conectar inboxes (Gmail nesta sprint; Outlook em E5).

Fluxo (Gmail):
    1. Frontend chama GET /email/oauth/google/start?org_id=...
       → backend devolve { authorization_url, state }
    2. Frontend abre popup em authorization_url
    3. Google redireciona pra /email/oauth/google/callback?code=...&state=...
    4. Backend troca code por tokens, busca email do user, salva inbox
       criptografada, devolve HTML que envia postMessage('eo:oauth:success')
       pro window.opener e fecha o popup.

CSRF: o ``state`` é HMAC-assinado (ver core/oauth_state.py) e carrega o
``org_id`` original — assim alguém não consegue colar um callback de outra
org via JavaScript.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse

from core.db import get_db
from email_outreach.adapters import gmail as gmail_adapter
from email_outreach.core.crypto import encrypt_text_pg
from email_outreach.core.oauth_state import decode_state, encode_state
from email_outreach.models import OAuthStartResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email/oauth", tags=["email-outreach:oauth"])


# ── Google ───────────────────────────────────────────────────────────────────

@router.get("/google/start", response_model=OAuthStartResponse)
async def google_oauth_start(
    org_id: str = Query(..., description="UUID da organização"),
    user_id: str | None = Query(None, description="UUID de quem está conectando"),
) -> OAuthStartResponse:
    state = encode_state({"org_id": org_id, "user_id": user_id, "provider": "gmail"})
    url = gmail_adapter.build_authorization_url(state)
    return OAuthStartResponse(authorization_url=url, state=state)


@router.get("/google/callback", response_class=HTMLResponse)
async def google_oauth_callback(
    request: Request,
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
) -> HTMLResponse:
    """Callback do Google. Devolve uma página que comunica com o opener."""

    if error or not code or not state:
        return _popup_response(
            ok=False,
            error=error or "Callback sem code/state.",
        )

    try:
        payload = decode_state(state)
    except ValueError as exc:
        return _popup_response(ok=False, error=f"State inválido: {exc}")

    org_id = payload.get("org_id")
    user_id = payload.get("user_id")
    if not org_id:
        return _popup_response(ok=False, error="State sem org_id.")

    try:
        tokens = await gmail_adapter.exchange_code_for_tokens(code)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao trocar code por tokens")
        return _popup_response(ok=False, error=f"Falha na troca OAuth: {exc}")

    access_token = tokens.get("access_token")
    if not access_token:
        return _popup_response(ok=False, error="Google não retornou access_token.")

    try:
        email = await gmail_adapter.get_user_email(access_token)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao consultar userinfo")
        return _popup_response(ok=False, error=f"Falha ao identificar a conta: {exc}")

    expires_in = int(tokens.get("expires_in", 3600))
    expires_at = (datetime.now(tz=timezone.utc) + timedelta(seconds=expires_in)).isoformat()

    # Mantemos o refresh_token mesmo se Google não devolver desta vez
    # (acontece quando o usuário re-consente sem revogar antes). Nesse
    # caso, recuperamos o que já tínhamos guardado pra essa inbox.
    refresh_token = tokens.get("refresh_token")

    db = await get_db()
    if not refresh_token:
        existing = await (
            db.table("eo_inboxes")
            .select("oauth_tokens_enc")
            .eq("org_id", org_id)
            .eq("email", email)
            .limit(1)
            .execute()
        )
        existing_rows = existing.data or []
        if existing_rows and existing_rows[0].get("oauth_tokens_enc"):
            try:
                from email_outreach.core.crypto import decrypt_json

                prev = decrypt_json(existing_rows[0]["oauth_tokens_enc"])
                refresh_token = prev.get("refresh_token")
            except Exception:  # noqa: BLE001
                pass

    if not refresh_token:
        return _popup_response(
            ok=False,
            error=(
                "Google não devolveu refresh_token. Revogue o acesso em "
                "myaccount.google.com/permissions e tente novamente."
            ),
        )

    token_blob = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": tokens.get("token_type", "Bearer"),
        "scope": tokens.get("scope", ""),
        "id_token": tokens.get("id_token"),
    }

    upsert_row: dict[str, Any] = {
        "org_id": org_id,
        "provider": "gmail",
        "email": email,
        "display_name": email,
        "oauth_tokens_enc": encrypt_text_pg(json.dumps(token_blob)),
        "oauth_scopes": tokens.get("scope", ""),
        "oauth_expires_at": expires_at,
        "status": "active",
        "last_health_check_at": datetime.now(tz=timezone.utc).isoformat(),
        "last_health_error": None,
        "created_by": user_id,
    }

    try:
        await (
            db.table("eo_inboxes")
            .upsert(upsert_row, on_conflict="org_id,email")
            .execute()
        )
        res = await (
            db.table("eo_inboxes")
            .select("id,email,provider,status")
            .eq("org_id", org_id)
            .eq("email", email)
            .limit(1)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao salvar inbox OAuth")
        return _popup_response(ok=False, error=f"Falha ao salvar inbox: {exc}")

    inbox_row = (res.data or [None])[0]
    return _popup_response(ok=True, payload={"inbox": inbox_row})


# ── Helpers ──────────────────────────────────────────────────────────────────

def _popup_response(ok: bool, error: str | None = None, payload: dict | None = None) -> HTMLResponse:
    """HTML que roda no popup: posta resultado pro opener e fecha."""
    body = {"ok": ok}
    if error:
        body["error"] = error
    if payload:
        body.update(payload)

    safe = json.dumps(body).replace("</", "<\\/")
    html = f"""
<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="utf-8" />
<title>Conectando inbox…</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 32px; color: #1f2937; }}
  .ok {{ color: #047857; }} .err {{ color: #b91c1c; }}
</style></head><body>
<h2>{"Conectado!" if ok else "Falhou"}</h2>
<p class="{'ok' if ok else 'err'}">
  {error or "Você já pode fechar esta janela."}
</p>
<script>
  (function() {{
    var result = {safe};
    try {{
      if (window.opener) {{
        window.opener.postMessage(
          {{ type: 'eo:oauth:' + (result.ok ? 'success' : 'error'), result: result }},
          '*'
        );
      }}
    }} catch (e) {{ /* opener fechou */ }}
    setTimeout(function() {{ window.close(); }}, 800);
  }})();
</script></body></html>
"""
    return HTMLResponse(html, status_code=200)
