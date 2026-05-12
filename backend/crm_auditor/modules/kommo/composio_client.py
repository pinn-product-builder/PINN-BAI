"""
Cliente de integração Kommo exposto via Composio.

Toda chamada à Composio deve ficar aqui — não espalhar pelo restante do código.

TODO(composio):
- Definir `connected_account_id` / `entity_id` retornado após OAuth no Composio.
- Implementar execução da action/tool correta (ex.: composio.tools.execute) com httpx.
- Mapear respostas reais para os mesmos formatos de dict que o Kommo API v4 retorna
  (para reutilizar `mapper.py` sem alterações).
"""
from __future__ import annotations

import logging
from typing import Any, Protocol

import httpx

from crm_auditor.core.config import AuditorSettings, get_auditor_settings

logger = logging.getLogger(__name__)


class KommoRemoteClient(Protocol):
    """Contrato para fontes remotas (Composio ou Kommo direto)."""

    async def list_pipelines(self, tenant_id: str) -> list[dict[str, Any]]: ...
    async def list_stages(self, tenant_id: str) -> list[dict[str, Any]]: ...
    async def list_users(self, tenant_id: str) -> list[dict[str, Any]]: ...
    async def list_leads(self, tenant_id: str, page: int, limit: int) -> list[dict[str, Any]]: ...
    async def list_contacts(self, tenant_id: str, page: int, limit: int) -> list[dict[str, Any]]: ...
    async def list_companies(self, tenant_id: str, page: int, limit: int) -> list[dict[str, Any]]: ...
    async def list_tasks(self, tenant_id: str, page: int, limit: int) -> list[dict[str, Any]]: ...
    async def list_custom_fields(self, tenant_id: str) -> list[dict[str, Any]]: ...


def _mock_now() -> int:
    from datetime import datetime, timezone

    return int(datetime.now(tz=timezone.utc).timestamp())


def _mock_payload() -> dict[str, Any]:
    """Fixture mínima compatível com mapper (formato próximo ao v4)."""
    ts = _mock_now()
    pipeline_id = 5001
    stage_new = 6001
    stage_won = 6002
    stage_lost = 6003
    return {
        "pipelines": [
            {
                "id": pipeline_id,
                "name": "Funil Comercial (mock)",
                "is_active": True,
                "_embedded": {
                    "statuses": [
                        {"id": stage_new, "name": "Novo", "sort": 10, "type": 0},
                        {"id": stage_won, "name": "Ganho", "sort": 900, "type": 1},
                        {"id": stage_lost, "name": "Perdido", "sort": 910, "type": 2},
                    ]
                },
            }
        ],
        "users": [
            {"id": 9001, "name": "Ana Silva", "email": "ana@example.com", "is_deleted": False},
            {"id": 9002, "name": "Bruno Costa", "email": "bruno@example.com", "is_deleted": False},
        ],
        "leads": [
            {
                "id": 7001,
                "name": "Oportunidade Alpha",
                "price": 12000,
                "pipeline_id": pipeline_id,
                "status_id": stage_new,
                "responsible_user_id": 9001,
                "created_at": ts - 86400 * 10,
                "updated_at": ts - 86400 * 9,
                "closed_at": None,
                "_embedded": {"contacts": [{"id": 8001}]},
            },
            {
                "id": 7002,
                "name": "Oportunidade Beta",
                "price": 0,
                "pipeline_id": pipeline_id,
                "status_id": stage_new,
                "responsible_user_id": None,
                "created_at": ts - 86400 * 2,
                "updated_at": ts - 86400 * 1,
                "closed_at": None,
                "_embedded": {"contacts": [{"id": 8002}]},
            },
            {
                "id": 7003,
                "name": "Oportunidade Ganha",
                "price": 5000,
                "pipeline_id": pipeline_id,
                "status_id": stage_won,
                "responsible_user_id": 9002,
                "created_at": ts - 86400 * 30,
                "updated_at": ts - 86400 * 5,
                "closed_at": ts - 86400 * 5,
                "_embedded": {"contacts": [{"id": 8003}]},
            },
            {
                "id": 7004,
                "name": "Oportunidade Perdida",
                "price": 8000,
                "pipeline_id": pipeline_id,
                "status_id": stage_lost,
                "responsible_user_id": 9001,
                "created_at": ts - 86400 * 20,
                "updated_at": ts - 86400 * 3,
                "closed_at": ts - 86400 * 3,
                "loss_reason_id": 42,
                "_embedded": {"contacts": [{"id": 8004}]},
            },
        ],
        "contacts": [
            {
                "id": 8001,
                "name": "Contato Um",
                "custom_fields_values": [
                    {"field_code": "EMAIL", "values": [{"value": "dup@example.com"}]},
                    {"field_code": "PHONE", "values": [{"value": "+5511999990001"}]},
                ],
            },
            {
                "id": 8002,
                "name": "Contato Dois",
                "custom_fields_values": [],
            },
            {
                "id": 8003,
                "name": "Contato Três",
                "custom_fields_values": [
                    {"field_code": "EMAIL", "values": [{"value": "tres@example.com"}]},
                ],
            },
            {
                "id": 8004,
                "name": "Contato Quatro",
                "custom_fields_values": [
                    {"field_code": "EMAIL", "values": [{"value": "dup@example.com"}]},
                ],
            },
        ],
        "companies": [{"id": 3001, "name": "Empresa Demo"}],
        "tasks": [
            {
                "id": 4001,
                "entity_id": 7001,
                "entity_type": 2,
                "text": "Follow-up proposta",
                "is_completed": False,
                "complete_till": ts - 86400 * 2,
                "responsible_user_id": 9001,
            },
            {
                "id": 4002,
                "entity_id": 7002,
                "entity_type": 2,
                "text": "Ligar cliente",
                "is_completed": False,
                "complete_till": ts + 86400,
                "responsible_user_id": 9002,
            },
        ],
        "custom_fields": [],
        "notes": [
            {
                "id": 5001,
                "entity_id": 7001,
                "entity_type": 2,
                "note_type": "common",
                "text": "Nota de demonstração — follow-up registrado",
                "created_at": ts - 3600,
                "_auditor_scope_entity_type": "leads",
            },
            {
                "id": 5002,
                "entity_id": 8001,
                "entity_type": 1,
                "note_type": "common",
                "text": "Contato qualificado no mock",
                "created_at": ts - 7200,
                "_auditor_scope_entity_type": "contacts",
            },
        ],
        "events": [
            {
                "id": 90001,
                "type": "lead_status_changed",
                "entity_id": 7001,
                "entity_type": 2,
                "created_at": ts - 5000,
            },
            {
                "id": 90002,
                "type": "entity_responsible_changed",
                "entity_id": 7002,
                "entity_type": 2,
                "created_at": ts - 8000,
            },
        ],
        "conversations": [
            {
                "id": 12001,
                "contact_id": 8001,
                "status": "incoming",
                "last_message": "Cliente pediu proposta",
                "updated_at": ts - 4000,
            },
        ],
    }


class ComposioKommoClient:
    """
    Implementação MVP: mock local ou chamada HTTP genérica à API Composio (stub).

    Quando COMPOSIO_MOCK_SYNC=false, ainda não executa integração real — loga aviso e retorna mock
    até `COMPOSIO_API_KEY` + action estarem definidos.
    """

    def __init__(self, settings: AuditorSettings | None = None) -> None:
        self._settings = settings or get_auditor_settings()
        self._mock = _mock_payload()

    async def list_pipelines(self, tenant_id: str) -> list[dict[str, Any]]:
        await self._maybe_warn_composio(tenant_id, "list_pipelines")
        return list(self._mock["pipelines"])

    async def list_stages(self, tenant_id: str) -> list[dict[str, Any]]:
        """
        No Kommo, estágios vêm embutidos em cada pipeline.
        Este método achata todos os status de todos os pipelines (mock).
        """
        await self._maybe_warn_composio(tenant_id, "list_stages")
        stages: list[dict[str, Any]] = []
        for p in self._mock["pipelines"]:
            pid = str(p["id"])
            for s in (p.get("_embedded") or {}).get("statuses") or []:
                row = dict(s)
                row["_pipeline_id"] = pid
                stages.append(row)
        return stages

    async def list_users(self, tenant_id: str) -> list[dict[str, Any]]:
        await self._maybe_warn_composio(tenant_id, "list_users")
        return list(self._mock["users"])

    async def list_leads(self, tenant_id: str, page: int = 1, limit: int = 250) -> list[dict[str, Any]]:
        await self._maybe_warn_composio(tenant_id, "list_leads")
        items = list(self._mock["leads"])
        start = (page - 1) * limit
        return items[start : start + limit]

    async def list_contacts(self, tenant_id: str, page: int = 1, limit: int = 250) -> list[dict[str, Any]]:
        await self._maybe_warn_composio(tenant_id, "list_contacts")
        items = list(self._mock["contacts"])
        start = (page - 1) * limit
        return items[start : start + limit]

    async def list_companies(self, tenant_id: str, page: int = 1, limit: int = 250) -> list[dict[str, Any]]:
        await self._maybe_warn_composio(tenant_id, "list_companies")
        items = list(self._mock["companies"])
        start = (page - 1) * limit
        return items[start : start + limit]

    async def list_tasks(self, tenant_id: str, page: int = 1, limit: int = 250) -> list[dict[str, Any]]:
        await self._maybe_warn_composio(tenant_id, "list_tasks")
        items = list(self._mock["tasks"])
        start = (page - 1) * limit
        return items[start : start + limit]

    async def list_custom_fields(self, tenant_id: str) -> list[dict[str, Any]]:
        await self._maybe_warn_composio(tenant_id, "list_custom_fields")
        return list(self._mock["custom_fields"])

    async def fetch_extended_catalog(self) -> dict[str, Any]:
        return {"sources": [], "loss_reasons": []}

    async def list_all_entity_notes(self, tenant_id: str, *, max_pages: int | None = None) -> list[dict[str, Any]]:
        _ = max_pages
        await self._maybe_warn_composio(tenant_id, "list_all_entity_notes")
        return [dict(x) for x in self._mock.get("notes", [])]

    async def list_all_events(self, tenant_id: str, *, max_pages: int | None = None) -> list[dict[str, Any]]:
        _ = max_pages
        await self._maybe_warn_composio(tenant_id, "list_all_events")
        return [dict(x) for x in self._mock.get("events", [])]

    async def list_all_conversations(self, tenant_id: str, *, max_pages: int | None = None) -> list[dict[str, Any]]:
        _ = max_pages
        await self._maybe_warn_composio(tenant_id, "list_all_conversations")
        return [dict(x) for x in self._mock.get("conversations", [])]

    async def _maybe_warn_composio(self, tenant_id: str, op: str) -> None:
        if self._settings.composio_mock_sync:
            logger.debug("Kommo sync mock (%s) tenant=%s", op, tenant_id)
            return
        if not self._settings.composio_api_key:
            logger.warning(
                "COMPOSIO_API_KEY ausente — retornando dados mock para %s (tenant=%s). "
                "Configure Composio para dados reais.",
                op,
                tenant_id,
            )
            return
        # TODO(composio): substituir mock por chamada real autenticada.
        logger.warning(
            "COMPOSIO_MOCK_SYNC=false mas execução HTTP ainda não implementada (%s, tenant=%s). "
            "Usando mock.",
            op,
            tenant_id,
        )


async def verify_composio_reachable() -> bool:
    """Smoke check opcional (não expõe tokens)."""
    settings = get_auditor_settings()
    if not settings.composio_api_key:
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(settings.composio_base_url.rstrip("/") + "/health")
        return r.status_code < 500
    except httpx.RequestError:
        return False


def build_kommo_remote_client(
    connection_row: dict[str, Any] | None,
    settings: AuditorSettings | None = None,
) -> KommoRemoteClient:
    """
    - COMPOSIO_MOCK_SYNC=true → dados fictícios (MVP).
    - COMPOSIO_MOCK_SYNC=false, com conexão Composio → tools KOMMO_* (connected account + user_id).
    - COMPOSIO_MOCK_SYNC=false, com access_token + subdomain → HTTP direto ao Kommo.
    """
    s = settings or get_auditor_settings()
    row = dict(connection_row or {})
    creds = dict(row.get("credentials") or {})

    if s.composio_mock_sync:
        return ComposioKommoClient(s)

    connected = row.get("composio_connected_account_id") or creds.get("composio_connected_account_id")
    user_id = creds.get("composio_user_id") or creds.get("user_id") or row.get("tenant_id")

    if connected and user_id:
        if not s.composio_api_key:
            raise ValueError(
                "Conexão Composio configurada (connected_account_id + user), mas COMPOSIO_API_KEY está ausente no .env."
            )
        from crm_auditor.modules.kommo.composio_kommo_live import ComposioKommoLiveClient

        return ComposioKommoLiveClient(
            connected_account_id=str(connected),
            composio_user_id=str(user_id),
            settings=s,
        )

    token = creds.get("access_token") or creds.get("accessToken")
    sub = creds.get("subdomain")
    if token and sub:
        from crm_auditor.modules.kommo.kommo_http_client import KommoHttpClient

        return KommoHttpClient(str(token), str(sub))

    raise ValueError(
        "Sync real: (1) Composio — preencha composio_connected_account_id (coluna ou credentials), "
        "composio_user_id em credentials (ou use só tenant_id como user_id), e COMPOSIO_API_KEY no .env; "
        "ou (2) Kommo direto — credentials.access_token + subdomain. "
        "Ou COMPOSIO_MOCK_SYNC=true para demo."
    )


__all__ = [
    "KommoRemoteClient",
    "ComposioKommoClient",
    "build_kommo_remote_client",
    "verify_composio_reachable",
]
