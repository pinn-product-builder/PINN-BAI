"""Criptografia simétrica para segredos do Email Outreach.

Usamos Fernet (AES-128-CBC + HMAC-SHA256) com chave única vinda do env
``EO_ENCRYPTION_KEY`` (32 bytes url-safe base64). Tudo o que vai pro
banco como ``*_enc bytea`` passa por aqui antes.

Como rotacionar:
    1. Gere uma nova chave: ``python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"``
    2. Defina ``EO_ENCRYPTION_KEY_NEW`` (sem remover a antiga).
    3. Rode o script de re-encrypt (a ser implementado quando necessário).
    4. Promova a nova pra ``EO_ENCRYPTION_KEY`` e remova a velha.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any

from cryptography.fernet import Fernet, InvalidToken


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = os.environ.get("EO_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError(
            "EO_ENCRYPTION_KEY não configurada. "
            "Gere com: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_text(plaintext: str) -> bytes:
    """Criptografa string → bytes (vai pra coluna bytea)."""
    return _fernet().encrypt(plaintext.encode("utf-8"))


def encrypt_text_pg(plaintext: str) -> str:
    """Criptografa e devolve no formato hex prefixado ``\\x...``.

    O PostgREST aceita esse formato para colunas ``bytea`` em INSERT/UPDATE
    de payload JSON. Use este wrapper sempre que for gravar via supabase-py.
    """
    return "\\x" + encrypt_text(plaintext).hex()


def decrypt_text(ciphertext: bytes | memoryview | str) -> str:
    """Decripta bytes (coluna bytea) → string original.

    Aceita ``str`` porque o Supabase REST devolve bytea como hex string
    (``\\x...``) ou base64 dependendo do encoding. Normalizamos aqui.
    """
    raw = _normalize_bytea(ciphertext)
    try:
        return _fernet().decrypt(raw).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError("Falha ao decriptar — chave errada ou dado corrompido.") from exc


def encrypt_json(payload: dict[str, Any]) -> bytes:
    return encrypt_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False))


def decrypt_json(ciphertext: bytes | memoryview | str) -> dict[str, Any]:
    return json.loads(decrypt_text(ciphertext))


def _normalize_bytea(value: bytes | memoryview | str) -> bytes:
    """Aceita bytes, memoryview ou string e devolve bytes.

    O Supabase REST tipicamente devolve bytea como string hex prefixada
    com ``\\x``. Convertemos pra bytes pra alimentar o Fernet.
    """
    if isinstance(value, memoryview):
        return bytes(value)
    if isinstance(value, bytes):
        return value
    if isinstance(value, str):
        if value.startswith("\\x"):
            return bytes.fromhex(value[2:])
        # Em alguns casos o supabase-py já devolve base64; tentativa fallback.
        try:
            import base64

            return base64.b64decode(value)
        except Exception:
            return value.encode("utf-8")
    raise TypeError(f"Tipo não suportado para bytea: {type(value).__name__}")
