"""Cliente HTTP pro Mari Brain (endpoints /outbound/*).

Encapsula:
- base URL (env MARI_API_BASE — default produção)
- Bearer token (env MARI_API_TOKEN, mesmo A2A_TOKEN do brain)
- retry leve em falha de rede
- logging estruturado pra debug

Usado por todos os api/*.py do módulo. Backend BAI fica como proxy fino —
o trabalho pesado de campanha (templates, dispatch, schedule) acontece no
Brain. BAI só faz CRUD via REST.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


MARI_API_BASE = os.environ.get("MARI_API_BASE", "https://mari.pinnpb.com").rstrip("/")
MARI_API_TOKEN = os.environ.get("MARI_API_TOKEN", "")


class MariClientError(RuntimeError):
    """Erro do cliente Mari Brain — caller decide se vira 502 ou retry."""

    def __init__(self, message: str, status_code: int | None = None,
                  body: str | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body


def _headers() -> dict[str, str]:
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    if MARI_API_TOKEN:
        h["Authorization"] = f"Bearer {MARI_API_TOKEN}"
    return h


def _request(method: str, path: str, *,
                json_body: Any = None,
                params: dict[str, Any] | None = None,
                timeout: float = 20.0) -> Any:
    """Faz request síncrono pro Mari Brain. Lança MariClientError em falha.

    Retorna o JSON parseado (dict ou list).
    """
    url = f"{MARI_API_BASE}{path}"
    try:
        with httpx.Client(timeout=timeout) as client:
            r = client.request(method, url, headers=_headers(),
                                  json=json_body, params=params)
    except httpx.HTTPError as e:
        logger.warning("mari client network error",
                       extra={"method": method, "url": url, "err": str(e)[:200]})
        raise MariClientError(f"network: {e}") from e

    if r.status_code >= 400:
        body_preview = r.text[:500] if r.text else ""
        logger.warning("mari client HTTP %s on %s %s — %s",
                       r.status_code, method, path, body_preview)
        raise MariClientError(
            f"HTTP {r.status_code} on {method} {path}",
            status_code=r.status_code,
            body=body_preview,
        )

    try:
        return r.json()
    except ValueError:
        return {"raw": r.text}


# ─────────────────────────────────────────────────────────────────
# Endpoints específicos de outbound — pra facilitar uso nos api/*
# ─────────────────────────────────────────────────────────────────

def list_instances() -> list[dict[str, Any]]:
    """Lista instâncias Evolution + health (green/yellow/red)."""
    data = _request("GET", "/outbound/instances")
    return data.get("instances", []) if isinstance(data, dict) else []


def analytics_dashboard(days: int = 30) -> dict[str, Any]:
    """Pega payload completo do dashboard de analytics."""
    return _request("GET", "/outbound/analytics/dashboard", params={"days": days})


def list_campaigns() -> list[dict[str, Any]]:
    data = _request("GET", "/outbound/campaigns")
    return data.get("campaigns", []) if isinstance(data, dict) else []


def get_campaign(campaign_id: int) -> dict[str, Any]:
    return _request("GET", f"/outbound/campaigns/{campaign_id}")


def create_campaign(payload: dict[str, Any]) -> dict[str, Any]:
    data = _request("POST", "/outbound/campaigns", json_body=payload)
    return data.get("campaign", data) if isinstance(data, dict) else {}


def update_campaign(campaign_id: int, patch: dict[str, Any]) -> dict[str, Any]:
    data = _request("PATCH", f"/outbound/campaigns/{campaign_id}", json_body=patch)
    return data.get("campaign", data) if isinstance(data, dict) else {}


def list_templates(campaign_id: int,
                     touch_index: Optional[int] = None,
                     active_only: bool = False) -> list[dict[str, Any]]:
    params: dict[str, Any] = {}
    if touch_index is not None:
        params["touch_index"] = touch_index
    if active_only:
        params["active_only"] = "true"
    data = _request("GET", f"/outbound/campaigns/{campaign_id}/templates",
                       params=params or None)
    return data.get("templates", []) if isinstance(data, dict) else []


def create_template(campaign_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    data = _request("POST", f"/outbound/campaigns/{campaign_id}/templates",
                       json_body=payload)
    return data.get("template", data) if isinstance(data, dict) else {}


def update_template(template_id: int, patch: dict[str, Any]) -> dict[str, Any]:
    data = _request("PATCH", f"/outbound/templates/{template_id}",
                       json_body=patch)
    return data.get("template", data) if isinstance(data, dict) else {}


def delete_template(template_id: int) -> dict[str, Any]:
    return _request("DELETE", f"/outbound/templates/{template_id}")


def enroll_leads(campaign_id: int,
                   leads: list[dict[str, Any]],
                   start_at_iso: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"leads": leads}
    if start_at_iso:
        payload["start_at_iso"] = start_at_iso
    # Enroll é I/O-bound no Brain (uma inserção Supabase por lead, ~1s cada).
    # Pra lotes de 100-500 leads precisamos de timeout generoso — caso contrário
    # o BAI fecha a conexão antes de receber a resposta, devolvendo 502 mesmo
    # com o Brain processando até o fim (caso real 2026-05-26 com 312 leads).
    # 10min cobre lotes até ~600 leads na taxa atual.
    return _request("POST", f"/outbound/campaigns/{campaign_id}/enroll",
                       json_body=payload,
                       timeout=600.0)
