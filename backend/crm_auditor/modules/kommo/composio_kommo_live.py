"""
Sync real via Composio: executa tools KOMMO_* com connected account + user_id.

Requer: COMPOSIO_API_KEY, composio_connected_account_id, composio_user_id (ou tenant_id como user).
"""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from crm_auditor.core.config import AuditorSettings, get_auditor_settings
from crm_auditor.modules.kommo import composio_tool_map as T

logger = logging.getLogger(__name__)


class ComposioExecutionError(RuntimeError):
    pass


def _parse_inner_data(raw: Any) -> Any:
    if raw is None:
        return None
    if isinstance(raw, str):
        raw = raw.strip()
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw
    return raw


def _extract_embedded_list(payload: Any, *embedded_keys: str) -> list[dict[str, Any]]:
    if payload is None:
        return []
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if not isinstance(payload, dict):
        return []
    emb = payload.get("_embedded")
    if isinstance(emb, dict):
        for k in embedded_keys:
            items = emb.get(k)
            if isinstance(items, list):
                return [x for x in items if isinstance(x, dict)]
    for k in embedded_keys:
        items = payload.get(k)
        if isinstance(items, list):
            return [x for x in items if isinstance(x, dict)]
    return []


class ComposioKommoLiveClient:
    def __init__(
        self,
        *,
        connected_account_id: str,
        composio_user_id: str,
        settings: AuditorSettings | None = None,
    ) -> None:
        self._settings = settings or get_auditor_settings()
        if not self._settings.composio_api_key:
            raise ValueError("COMPOSIO_API_KEY é obrigatória para sync via Composio.")
        self._connected_account_id = connected_account_id.strip()
        self._user_id = composio_user_id.strip()
        self._base = self._settings.composio_execute_base_url.rstrip("/")
        self._pipelines_cache: list[dict[str, Any]] | None = None
        self._leads_cache: list[dict[str, Any]] | None = None
        self._contacts_cache: list[dict[str, Any]] | None = None
        self._companies_cache: list[dict[str, Any]] | None = None
        self._tasks_cache: list[dict[str, Any]] | None = None

    async def _execute(self, slug: str, arguments: dict[str, Any]) -> Any:
        url = f"{self._base}/tools/execute/{slug}"
        body: dict[str, Any] = {
            "connected_account_id": self._connected_account_id,
            "user_id": self._user_id,
            "arguments": arguments,
        }
        headers = {
            "x-api-key": self._settings.composio_api_key,
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, headers=headers, json=body)
        try:
            payload = resp.json()
        except json.JSONDecodeError as exc:
            raise ComposioExecutionError(f"Composio resposta inválida (HTTP {resp.status_code})") from exc

        if resp.status_code >= 400:
            raise ComposioExecutionError(
                f"Composio HTTP {resp.status_code}: {payload!s}"[:2000],
            )

        err_obj = payload.get("error")
        if err_obj:
            if isinstance(err_obj, dict):
                msg = err_obj.get("message") or err_obj.get("slug") or err_obj
                raise ComposioExecutionError(str(msg)[:2000])
            raise ComposioExecutionError(str(err_obj)[:2000])

        if payload.get("successful") is False:
            err = payload.get("message") or payload
            raise ComposioExecutionError(str(err)[:2000])

        return _parse_inner_data(payload.get("data"))

    async def list_pipelines(self, tenant_id: str) -> list[dict[str, Any]]:
        _ = tenant_id
        if self._pipelines_cache is not None:
            return list(self._pipelines_cache)
        data = await self._execute(T.LIST_PIPELINES, {})
        items = _extract_embedded_list(data, "pipelines")
        if not items and isinstance(data, dict) and "id" in data:
            items = [data]
        self._pipelines_cache = items
        logger.info("Composio Kommo: %s pipelines", len(items))
        return list(items)

    async def list_stages(self, tenant_id: str) -> list[dict[str, Any]]:
        _ = tenant_id
        out: list[dict[str, Any]] = []
        for p in await self.list_pipelines(tenant_id):
            pid = p.get("id")
            if pid is None:
                continue
            embedded = (p.get("_embedded") or {}).get("statuses")
            if isinstance(embedded, list) and embedded:
                for s in embedded:
                    if isinstance(s, dict):
                        row = dict(s)
                        row["_pipeline_id"] = str(pid)
                        out.append(row)
                continue
            raw = await self._execute(
                T.LIST_PIPELINE_STAGES,
                {"pipeline_id": int(pid)},
            )
            stages = _extract_embedded_list(raw, "statuses")
            if not stages:
                stages = _extract_embedded_list(raw, "items")
            for s in stages:
                row = dict(s)
                row["_pipeline_id"] = str(pid)
                out.append(row)
        return out

    def _chunk_from_payload(
        self,
        data: Any,
        embedded_keys: tuple[str, ...],
    ) -> list[dict[str, Any]]:
        for key in embedded_keys:
            chunk = _extract_embedded_list(data, key)
            if chunk:
                return chunk
        if isinstance(data, dict) and "id" in data and not (data.get("_embedded") or {}):
            return [data]
        return []

    async def _paginate_tool(
        self,
        slug: str,
        base_args: dict[str, Any],
        *embedded_keys: str,
        max_pages: int | None = None,
    ) -> list[dict[str, Any]]:
        keys = embedded_keys or ("items",)
        cap = max_pages if max_pages is not None else 999
        all_rows: list[dict[str, Any]] = []
        page = 1
        limit = 250
        while page <= cap:
            args = {**base_args, "page": page, "limit": limit}
            data = await self._execute(slug, args)
            chunk = self._chunk_from_payload(data, keys)
            if not chunk:
                break
            all_rows.extend(chunk)
            if len(chunk) < limit:
                break
            page += 1
        return all_rows

    async def list_users(self, tenant_id: str) -> list[dict[str, Any]]:
        _ = tenant_id
        users = await self._paginate_tool(T.LIST_USERS, {}, "users")
        logger.info("Composio Kommo: %s usuários", len(users))
        return users

    async def list_leads(self, tenant_id: str, page: int = 1, limit: int = 250) -> list[dict[str, Any]]:
        _ = tenant_id
        if self._leads_cache is None:
            self._leads_cache = await self._paginate_tool(
                T.LIST_LEADS,
                {"with_params": ["contacts"]},
                "leads",
            )
            logger.info("Composio Kommo: %s leads", len(self._leads_cache))
        start = (page - 1) * limit
        return self._leads_cache[start : start + limit]

    async def list_contacts(self, tenant_id: str, page: int = 1, limit: int = 250) -> list[dict[str, Any]]:
        _ = tenant_id
        if self._contacts_cache is None:
            self._contacts_cache = await self._paginate_tool(T.LIST_CONTACTS, {}, "contacts")
            logger.info("Composio Kommo: %s contatos", len(self._contacts_cache))
        start = (page - 1) * limit
        return self._contacts_cache[start : start + limit]

    async def list_companies(self, tenant_id: str, page: int = 1, limit: int = 250) -> list[dict[str, Any]]:
        _ = tenant_id
        if self._companies_cache is None:
            self._companies_cache = await self._paginate_tool(T.LIST_COMPANIES, {}, "companies")
            logger.info("Composio Kommo: %s empresas", len(self._companies_cache))
        start = (page - 1) * limit
        return self._companies_cache[start : start + limit]

    async def list_tasks(self, tenant_id: str, page: int = 1, limit: int = 250) -> list[dict[str, Any]]:
        _ = tenant_id
        if self._tasks_cache is None:
            self._tasks_cache = await self._paginate_tool(T.LIST_TASKS, {}, "tasks")
            logger.info("Composio Kommo: %s tarefas", len(self._tasks_cache))
        start = (page - 1) * limit
        return self._tasks_cache[start : start + limit]

    async def list_custom_fields(self, tenant_id: str) -> list[dict[str, Any]]:
        _ = tenant_id
        merged: list[dict[str, Any]] = []
        for et in ("leads", "contacts", "companies"):
            try:
                data = await self._execute(T.LIST_CUSTOM_FIELDS, {"entity_type": et})
                chunk = _extract_embedded_list(data, "custom_fields")
                if not chunk and isinstance(data, list):
                    chunk = [x for x in data if isinstance(x, dict)]
                for row in chunk:
                    tagged = dict(row)
                    tagged["_auditor_entity_type"] = et
                    merged.append(tagged)
            except ComposioExecutionError as exc:
                logger.warning("Composio custom_fields (%s): %s", et, exc)
        return merged

    async def fetch_extended_catalog(self) -> dict[str, Any]:
        """Fontes e motivos de perda cadastrados (catálogo Kommo) — enriquece auditoria."""
        out: dict[str, Any] = {"sources": [], "loss_reasons": []}
        try:
            data = await self._execute(T.LIST_SOURCES, {})
            out["sources"] = _extract_embedded_list(data, "sources") or _extract_embedded_list(data, "items")
        except ComposioExecutionError as exc:
            logger.warning("Composio LIST_SOURCES: %s", exc)
        try:
            data = await self._execute(T.LIST_LOSS_REASONS, {})
            out["loss_reasons"] = _extract_embedded_list(data, "loss_reasons") or _extract_embedded_list(
                data,
                "items",
            )
        except ComposioExecutionError as exc:
            logger.warning("Composio LIST_LOSS_REASONS: %s", exc)
        return out

    async def list_all_entity_notes(self, tenant_id: str, *, max_pages: int | None = None) -> list[dict[str, Any]]:
        _ = tenant_id
        mp = max_pages if max_pages is not None else self._settings.engagement_sync_max_pages
        merged: list[dict[str, Any]] = []
        for et in ("leads", "contacts", "companies"):
            rows = await self._paginate_tool(
                T.LIST_ENTITY_NOTES,
                {"entity_type": et},
                "notes",
                "items",
                max_pages=mp,
            )
            for r in rows:
                tagged = dict(r)
                tagged["_auditor_scope_entity_type"] = et
                merged.append(tagged)
        logger.info("Composio Kommo: %s notas (escopo leads/contatos/empresas)", len(merged))
        return merged

    async def list_all_events(self, tenant_id: str, *, max_pages: int | None = None) -> list[dict[str, Any]]:
        _ = tenant_id
        mp = max_pages if max_pages is not None else self._settings.engagement_sync_max_pages
        rows = await self._paginate_tool(
            T.LIST_EVENTS,
            {},
            "events",
            "items",
            max_pages=mp,
        )
        logger.info("Composio Kommo: %s eventos", len(rows))
        return rows

    async def list_all_conversations(self, tenant_id: str, *, max_pages: int | None = None) -> list[dict[str, Any]]:
        _ = tenant_id
        mp = max_pages if max_pages is not None else self._settings.engagement_sync_max_pages
        rows = await self._paginate_tool(
            T.LIST_CONVERSATIONS,
            {},
            "talks",
            "conversations",
            "items",
            max_pages=mp,
        )
        logger.info("Composio Kommo: %s conversas", len(rows))
        return rows
