"""
Cliente HTTP direto à API v4 do Kommo (Bearer + subdomínio).

Use quando os tokens já estão disponíveis (OAuth Kommo grava `access_token` +
`subdomain` em `crm_auditor_connections.credentials`).
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from crm_auditor.core.config import get_auditor_settings

logger = logging.getLogger(__name__)


class KommoHttpClient:
    """Chamadas reais ao Kommo; respostas no formato bruto da API v4 (_embedded, etc.)."""

    def __init__(self, access_token: str, subdomain: str) -> None:
        self._token = access_token.strip()
        self._subdomain = subdomain.strip().lower().removesuffix(".kommo.com")
        self._base = f"https://{self._subdomain}.kommo.com"
        self._pipelines_cache: list[dict[str, Any]] | None = None
        self._leads_cache: list[dict[str, Any]] | None = None
        self._contacts_cache: list[dict[str, Any]] | None = None
        self._companies_cache: list[dict[str, Any]] | None = None
        self._tasks_cache: list[dict[str, Any]] | None = None

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._base,
            headers=self._headers(),
            timeout=60.0,
        )

    def _embedded_items(self, body: dict[str, Any], *keys: str) -> list[dict[str, Any]]:
        emb = body.get("_embedded") or {}
        for k in keys:
            items = emb.get(k)
            if isinstance(items, list) and items:
                return [x for x in items if isinstance(x, dict)]
        return []

    async def _paginate(
        self,
        client: httpx.AsyncClient,
        path: str,
        embedded_key: str,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        base_params: dict[str, Any] = {**(params or {}), "_limit": 250}
        for page in range(1, 1000):
            resp = await client.get(path, params={**base_params, "_page": page})
            if resp.status_code in (204, 404):
                break
            resp.raise_for_status()
            body = resp.json()
            items = self._embedded_items(body, embedded_key)
            if not items:
                break
            results.extend(items)
            if "next" not in (body.get("_links") or {}):
                break
        return results

    async def _paginate_multi(
        self,
        client: httpx.AsyncClient,
        path: str,
        embedded_keys: tuple[str, ...],
        params: dict[str, Any] | None = None,
        *,
        max_pages: int = 999,
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        base_params: dict[str, Any] = {**(params or {}), "_limit": 250}
        for page in range(1, max_pages + 1):
            resp = await client.get(path, params={**base_params, "_page": page})
            if resp.status_code in (204, 404):
                break
            resp.raise_for_status()
            body = resp.json()
            items = self._embedded_items(body, *embedded_keys)
            if not items:
                break
            results.extend(items)
            if len(items) < 250 or "next" not in (body.get("_links") or {}):
                break
        return results

    async def list_pipelines(self, tenant_id: str) -> list[dict[str, Any]]:
        _ = tenant_id
        if self._pipelines_cache is not None:
            return list(self._pipelines_cache)
        async with self._client() as client:
            self._pipelines_cache = await self._paginate(
                client, "/api/v4/leads/pipelines", "pipelines"
            )
        logger.info("Kommo HTTP: %s pipelines carregados", len(self._pipelines_cache))
        return list(self._pipelines_cache)

    async def list_stages(self, tenant_id: str) -> list[dict[str, Any]]:
        _ = tenant_id
        stages: list[dict[str, Any]] = []
        for p in await self.list_pipelines(tenant_id):
            pid = str(p["id"])
            for s in (p.get("_embedded") or {}).get("statuses") or []:
                row = dict(s)
                row["_pipeline_id"] = pid
                stages.append(row)
        return stages

    async def list_users(self, tenant_id: str) -> list[dict[str, Any]]:
        _ = tenant_id
        async with self._client() as client:
            users = await self._paginate(client, "/api/v4/users", "users")
        logger.info("Kommo HTTP: %s usuários", len(users))
        return users

    async def list_leads(self, tenant_id: str, page: int = 1, limit: int = 250) -> list[dict[str, Any]]:
        _ = tenant_id
        if self._leads_cache is None:
            async with self._client() as client:
                self._leads_cache = await self._paginate(
                    client,
                    "/api/v4/leads",
                    "leads",
                    {"with": "contacts"},
                )
            logger.info("Kommo HTTP: %s leads", len(self._leads_cache))
        start = (page - 1) * limit
        return self._leads_cache[start : start + limit]

    async def list_contacts(self, tenant_id: str, page: int = 1, limit: int = 250) -> list[dict[str, Any]]:
        _ = tenant_id
        if self._contacts_cache is None:
            async with self._client() as client:
                self._contacts_cache = await self._paginate(client, "/api/v4/contacts", "contacts")
            logger.info("Kommo HTTP: %s contatos", len(self._contacts_cache))
        start = (page - 1) * limit
        return self._contacts_cache[start : start + limit]

    async def list_companies(self, tenant_id: str, page: int = 1, limit: int = 250) -> list[dict[str, Any]]:
        _ = tenant_id
        if self._companies_cache is None:
            async with self._client() as client:
                self._companies_cache = await self._paginate(client, "/api/v4/companies", "companies")
            logger.info("Kommo HTTP: %s empresas", len(self._companies_cache))
        start = (page - 1) * limit
        return self._companies_cache[start : start + limit]

    async def list_tasks(self, tenant_id: str, page: int = 1, limit: int = 250) -> list[dict[str, Any]]:
        _ = tenant_id
        if self._tasks_cache is None:
            async with self._client() as client:
                self._tasks_cache = await self._paginate(client, "/api/v4/tasks", "tasks")
            logger.info("Kommo HTTP: %s tarefas", len(self._tasks_cache))
        start = (page - 1) * limit
        return self._tasks_cache[start : start + limit]

    async def list_all_entity_notes(self, tenant_id: str, *, max_pages: int | None = None) -> list[dict[str, Any]]:
        _ = tenant_id
        mp = max_pages if max_pages is not None else get_auditor_settings().engagement_sync_max_pages
        merged: list[dict[str, Any]] = []
        async with self._client() as client:
            for et in ("leads", "contacts", "companies"):
                try:
                    rows = await self._paginate_multi(
                        client,
                        "/api/v4/notes",
                        ("notes",),
                        {"filter[entity_type]": et},
                        max_pages=mp,
                    )
                except httpx.HTTPStatusError:
                    rows = []
                for r in rows:
                    tagged = dict(r)
                    tagged["_auditor_scope_entity_type"] = et
                    merged.append(tagged)
        logger.info("Kommo HTTP: %s notas", len(merged))
        return merged

    async def list_all_events(self, tenant_id: str, *, max_pages: int | None = None) -> list[dict[str, Any]]:
        _ = tenant_id
        mp = max_pages if max_pages is not None else get_auditor_settings().engagement_sync_max_pages
        async with self._client() as client:
            try:
                rows = await self._paginate_multi(
                    client,
                    "/api/v4/events",
                    ("events",),
                    None,
                    max_pages=mp,
                )
            except httpx.HTTPStatusError:
                rows = []
        logger.info("Kommo HTTP: %s eventos", len(rows))
        return rows

    async def list_all_conversations(self, tenant_id: str, *, max_pages: int | None = None) -> list[dict[str, Any]]:
        _ = tenant_id
        mp = max_pages if max_pages is not None else get_auditor_settings().engagement_sync_max_pages
        async with self._client() as client:
            try:
                rows = await self._paginate_multi(
                    client,
                    "/api/v4/talks",
                    ("talks",),
                    None,
                    max_pages=mp,
                )
            except httpx.HTTPStatusError:
                rows = []
        logger.info("Kommo HTTP: %s conversas (talks)", len(rows))
        return rows

    async def fetch_extended_catalog(self) -> dict[str, Any]:
        """Tenta carregar fontes e motivos de perda via API v4 (quando disponível)."""
        out: dict[str, Any] = {"sources": [], "loss_reasons": []}
        try:
            async with self._client() as client:
                src = await self._paginate(client, "/api/v4/leads/sources", "sources")
                out["sources"] = src
        except Exception as exc:
            logger.warning("Kommo HTTP sources: %s", exc)
        try:
            async with self._client() as client:
                lr = await self._paginate(client, "/api/v4/leads/loss_reasons", "loss_reasons")
                out["loss_reasons"] = lr
        except Exception as exc:
            logger.warning("Kommo HTTP loss_reasons: %s", exc)
        return out

    async def list_custom_fields(self, tenant_id: str) -> list[dict[str, Any]]:
        """Catálogo de campos custom de leads + contatos + empresas.

        Cada item é tagueado com `_auditor_entity_type` ('leads'|'contacts'|'companies')
        para o sync_service gravar com o entity_type correto. Sem isso, campos de contato
        (EMAIL/PHONE) nunca eram descobertos — só os de lead.
        """
        _ = tenant_id
        out: list[dict[str, Any]] = []
        for entity in ("leads", "contacts", "companies"):
            try:
                async with self._client() as client:
                    resp = await client.get(f"/api/v4/{entity}/custom_fields")
                if resp.status_code in (404, 204):
                    continue
                resp.raise_for_status()
                body = resp.json()
                emb = body.get("_embedded") or {}
                items = emb.get("custom_fields")
                if isinstance(items, list):
                    for it in items:
                        if isinstance(it, dict):
                            tagged = dict(it)
                            tagged["_auditor_entity_type"] = entity
                            out.append(tagged)
            except Exception as exc:
                logger.warning("Kommo HTTP custom_fields %s: %s", entity, exc)
        return out


def build_kommo_client(connection_row: dict[str, Any] | None) -> KommoHttpClient:
    """Constrói o cliente Kommo a partir de credentials.access_token + subdomain.

    Composio foi removido do sistema: a única fonte suportada é o token direto
    (OAuth Kommo grava access_token + subdomain em crm_auditor_connections.credentials).
    Sem credenciais, falha alto — nunca cai em mock/dado fictício.
    """
    creds = dict((connection_row or {}).get("credentials") or {})
    token = creds.get("access_token") or creds.get("accessToken")
    sub = creds.get("subdomain")
    if not (token and sub):
        raise ValueError(
            "Conexão Kommo sem credenciais: preencha credentials.access_token + "
            "credentials.subdomain (token de longa duração do Kommo)."
        )
    return KommoHttpClient(str(token), str(sub))
