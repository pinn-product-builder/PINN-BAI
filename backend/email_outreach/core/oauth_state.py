"""State opaco e assinado para o OAuth dance.

Como o callback do Google não preserva a sessão do nosso backend (é uma
nova request HTTP), precisamos passar o ``org_id`` (e quem iniciou o fluxo)
dentro do parâmetro ``state``. Para evitar que alguém forje o callback e
conecte uma inbox em outra org, assinamos o payload com HMAC-SHA256.

Estrutura do state (antes da assinatura):
    {
        "org_id": "uuid",
        "user_id": "uuid",      # opcional — quem clicou em "Conectar"
        "provider": "gmail",
        "nonce": "hex16",
        "ts": 1715000000
    }

TTL padrão: 10 minutos.
"""
from __future__ import annotations

import base64
import hmac
import json
import os
import secrets
import time
from hashlib import sha256
from typing import Any

_STATE_TTL_SECONDS = 600


def _secret() -> bytes:
    """Chave HMAC. Fallback razoável: a própria EO_ENCRYPTION_KEY."""
    val = os.environ.get("EO_OAUTH_STATE_SECRET") or os.environ.get("EO_ENCRYPTION_KEY")
    if not val:
        raise RuntimeError("EO_OAUTH_STATE_SECRET (ou EO_ENCRYPTION_KEY) não configurada.")
    return val.encode("utf-8")


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(data: str) -> bytes:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def encode_state(payload: dict[str, Any]) -> str:
    payload = {
        **payload,
        "nonce": secrets.token_hex(8),
        "ts": int(time.time()),
    }
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig = hmac.new(_secret(), body, sha256).digest()
    return f"{_b64encode(body)}.{_b64encode(sig)}"


def decode_state(state: str) -> dict[str, Any]:
    try:
        body_b64, sig_b64 = state.split(".", 1)
        body = _b64decode(body_b64)
        sig = _b64decode(sig_b64)
    except (ValueError, Exception) as exc:  # noqa: BLE001
        raise ValueError("state malformado") from exc

    expected = hmac.new(_secret(), body, sha256).digest()
    if not hmac.compare_digest(sig, expected):
        raise ValueError("state com assinatura inválida")

    payload = json.loads(body.decode("utf-8"))
    ts = int(payload.get("ts", 0))
    if time.time() - ts > _STATE_TTL_SECONDS:
        raise ValueError("state expirado")

    return payload
