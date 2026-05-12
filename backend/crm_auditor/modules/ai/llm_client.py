"""Cliente HTTP mínimo para API compatível com OpenAI (sem SDK extra)."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from crm_auditor.core.config import get_auditor_settings

logger = logging.getLogger(__name__)


async def generate_json_report(system: str, user: str) -> dict[str, Any]:
    settings = get_auditor_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY não configurada")

    url = settings.openai_base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": settings.openai_model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, headers=headers, json=body)
    if resp.status_code >= 400:
        logger.error("LLM erro HTTP %s: %s", resp.status_code, resp.text[:500])
        resp.raise_for_status()
    data = resp.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise RuntimeError(f"Resposta LLM inesperada: {data!r}") from exc
    return json.loads(content)


def extract_json_object(text: str) -> dict[str, Any] | None:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
    return None


async def generate_json_report_relaxed(system: str, user: str) -> dict[str, Any]:
    """Tenta JSON estrito; se o provedor não suportar response_format, faz segunda passagem."""
    settings = get_auditor_settings()
    first_error: Exception | None = None
    try:
        return await generate_json_report(system, user)
    except Exception as exc:
        first_error = exc
        logger.warning("LLM primeira tentativa falhou: %s", exc)
    if not settings.openai_api_key:
        assert first_error is not None
        raise first_error
    url = settings.openai_base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": settings.openai_model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user + "\nResponda somente JSON."},
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, headers=headers, json=body)
    resp.raise_for_status()
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    parsed = extract_json_object(content)
    if not parsed:
        raise RuntimeError("Não foi possível parsear JSON do modelo")
    return parsed
