"""
Adapter Kommo — implementa CRMAdapter para a API v4 do Kommo (ex-amoCRM).

Docs de referência: https://www.kommo.com/developers/content/crm-platform/api-reference/
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

from core.crm.base import CRMAdapter
from core.crm.registry import register_adapter
from core.crm.types import (
    NormalizedActivity,
    NormalizedAppointment,
    NormalizedContact,
    NormalizedDeal,
)

logger = logging.getLogger(__name__)

# ── Mapeamentos ────────────────────────────────────────────────────────────────

# task_type_id → status normalizado
_TASK_STATUS_MAP: dict[bool, str] = {
    False: "scheduled",
    True: "completed",
}

# Kommo event type → tipo de atividade normalizado
_EVENT_TYPE_MAP: dict[str, str] = {
    "incoming_call": "call",
    "outgoing_call": "call",
    "call": "call",
    "contact_noted": "note",
    "note": "note",
    "email": "email",
    "task": "meeting",
    "meeting": "meeting",
}

# IDs de task_type que representam reuniões no Kommo
_MEETING_TASK_TYPE_IDS: frozenset[int] = frozenset({2})  # 1=call, 2=meeting
_ALL_TASK_TYPE_IDS: frozenset[int] = frozenset({1, 2, 3})


# ── Helpers internos ───────────────────────────────────────────────────────────

def _ts(unix: int | None) -> datetime | None:
    """Converte Unix timestamp para datetime UTC. Retorna None se ausente."""
    if unix is None or unix == 0:
        return None
    return datetime.fromtimestamp(unix, tz=timezone.utc)


def _ts_required(unix: int) -> datetime:
    """Converte Unix timestamp obrigatório. Lança ValueError se inválido."""
    if not unix:
        raise ValueError(f"Timestamp inválido: {unix!r}")
    return datetime.fromtimestamp(unix, tz=timezone.utc)


def _extract_custom_field(
    custom_fields: list[dict] | None,
    field_code: str,
) -> Optional[str]:
    """Extrai o primeiro valor de um custom field pelo seu field_code (ex: 'EMAIL', 'PHONE')."""
    if not custom_fields:
        return None
    for field in custom_fields:
        if field.get("field_code") == field_code:
            values = field.get("values") or []
            if values:
                return str(values[0].get("value", "")).strip() or None
    return None


# ── Adapter ────────────────────────────────────────────────────────────────────

@register_adapter("kommo")
class KommoAdapter(CRMAdapter):
    """
    Adapter para o CRM Kommo (ex-amoCRM).

    Credenciais esperadas:
        access_token (str): Bearer token OAuth2
        subdomain   (str): subdomínio da conta, ex: "minhaempresa"
    """

    def __init__(self, tenant_id: str, credentials: dict) -> None:
        super().__init__(tenant_id, credentials)
        self._token: str = credentials["access_token"]
        self._subdomain: str = credentials["subdomain"]
        self._base: str = f"https://{self._subdomain}.kommo.com"

    # ── HTTP helpers ───────────────────────────────────────────────────────────

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._base,
            headers=self._headers(),
            timeout=30.0,
        )

    async def _paginate(
        self,
        client: httpx.AsyncClient,
        path: str,
        embedded_key: str,
        params: dict | None = None,
    ) -> list[dict]:
        """
        Percorre todas as páginas de um endpoint Kommo paginado.

        O Kommo usa _page (1-indexed) e _limit (máx 250).
        Paginação termina quando o response não contém _links.next.
        """
        results: list[dict] = []
        base_params: dict = {**(params or {}), "_limit": 250}

        for page in range(1, 1000):  # limite de segurança: 999 páginas
            resp = await client.get(path, params={**base_params, "_page": page})

            if resp.status_code in (204, 404):
                break  # sem dados nesta página

            resp.raise_for_status()
            body = resp.json()

            items: list[dict] = (
                (body.get("_embedded") or {}).get(embedded_key) or []
            )
            if not items:
                break

            results.extend(items)

            # Kommo indica próxima página via _links.next
            if "next" not in (body.get("_links") or {}):
                break

        return results

    # ── get_contacts ──────────────────────────────────────────────────────────

    async def get_contacts(
        self,
        since: Optional[datetime] = None,
    ) -> list[NormalizedContact]:
        params: dict = {}
        if since:
            params["filter[updated_at][from]"] = int(since.timestamp())

        async with self._client() as client:
            raw_contacts = await self._paginate(
                client, "/api/v4/contacts", "contacts", params
            )

        contacts: list[NormalizedContact] = []
        for c in raw_contacts:
            try:
                custom = c.get("custom_fields_values") or []
                contacts.append(
                    NormalizedContact(
                        external_id=str(c["id"]),
                        name=c.get("name") or "",
                        email=_extract_custom_field(custom, "EMAIL"),
                        phone=_extract_custom_field(custom, "PHONE"),
                        created_at=_ts_required(c["created_at"]),
                        raw=c,
                    )
                )
            except (KeyError, ValueError) as exc:
                logger.warning("Kommo: contato ignorado (id=%s): %s", c.get("id"), exc)

        return contacts

    # ── get_appointments ──────────────────────────────────────────────────────

    async def get_appointments(
        self,
        since: Optional[datetime] = None,
    ) -> list[NormalizedAppointment]:
        """
        Mapeia Tasks do Kommo para NormalizedAppointment.

        Kommo não possui um conceito nativo de "agendamento" separado de tarefas.
        Buscamos todas as tasks (tipo call + meeting) e normalizamos.
        """
        params: dict = {}
        if since:
            params["filter[created_at][from]"] = int(since.timestamp())

        async with self._client() as client:
            raw_tasks = await self._paginate(
                client, "/api/v4/tasks", "tasks", params
            )

        appointments: list[NormalizedAppointment] = []
        for t in raw_tasks:
            scheduled_at = _ts(t.get("complete_till"))
            if scheduled_at is None:
                continue  # tarefa sem data agendada — não é um agendamento

            is_completed: bool = bool(t.get("is_completed", False))
            status = _TASK_STATUS_MAP.get(is_completed, "scheduled")

            # Descobrir o contact_id da task (entity vinculada)
            entity_id: str | None = None
            entity_type: int = t.get("entity_type", 0)
            if entity_type == 1:  # 1 = contacts
                entity_id = str(t.get("entity_id", ""))

            try:
                appointments.append(
                    NormalizedAppointment(
                        external_id=str(t["id"]),
                        contact_id=entity_id or "",
                        scheduled_at=scheduled_at,
                        status=status,
                        raw=t,
                    )
                )
            except KeyError as exc:
                logger.warning("Kommo: task ignorada (id=%s): %s", t.get("id"), exc)

        return appointments

    # ── get_deals ─────────────────────────────────────────────────────────────

    async def get_deals(
        self,
        contact_id: str,
    ) -> list[NormalizedDeal]:
        """
        Busca leads (negócios) do Kommo vinculados a um contato.

        O Kommo chama negócios de 'leads'. Filtramos por contact_id.
        O campo 'stage' usa o status_id numérico — resolução de nome de estágio
        requer chamada adicional à API de pipelines (feita no Sync Engine).
        """
        params = {"filter[contacts_id][]": contact_id, "with": "contacts"}

        async with self._client() as client:
            raw_leads = await self._paginate(
                client, "/api/v4/leads", "leads", params
            )

        deals: list[NormalizedDeal] = []
        for lead in raw_leads:
            try:
                deals.append(
                    NormalizedDeal(
                        external_id=str(lead["id"]),
                        contact_id=contact_id,
                        stage=str(lead.get("status_id", "")),
                        value=float(lead.get("price") or 0),
                        created_at=_ts_required(lead["created_at"]),
                        closed_at=_ts(lead.get("closed_at")),
                        raw=lead,
                    )
                )
            except (KeyError, ValueError) as exc:
                logger.warning(
                    "Kommo: lead ignorado (id=%s): %s", lead.get("id"), exc
                )

        return deals

    # ── get_activities ────────────────────────────────────────────────────────

    async def get_activities(
        self,
        contact_id: str,
    ) -> list[NormalizedActivity]:
        """
        Busca eventos (feed de atividades) vinculados a um contato no Kommo.

        Kommo Events API: /api/v4/events?filter[entity][]=contacts&filter[entity_id][]={id}
        """
        params = {
            "filter[entity][]": "contacts",
            "filter[entity_id][]": contact_id,
        }

        async with self._client() as client:
            raw_events = await self._paginate(
                client, "/api/v4/events", "events", params
            )

        activities: list[NormalizedActivity] = []
        for ev in raw_events:
            raw_type: str = str(ev.get("type") or "").lower()
            activity_type = _EVENT_TYPE_MAP.get(raw_type, "note")

            happened_at = _ts(ev.get("created_at"))
            if happened_at is None:
                continue

            try:
                activities.append(
                    NormalizedActivity(
                        external_id=str(ev["id"]),
                        contact_id=contact_id,
                        type=activity_type,
                        happened_at=happened_at,
                        raw=ev,
                    )
                )
            except KeyError as exc:
                logger.warning(
                    "Kommo: evento ignorado (id=%s): %s", ev.get("id"), exc
                )

        return activities

    # ── handle_webhook ────────────────────────────────────────────────────────

    async def handle_webhook(self, payload: dict) -> None:
        """
        Processa webhooks do Kommo.

        O Kommo pode enviar payloads em dois formatos:
        1. JSON — chaves como 'contacts', 'leads', 'tasks'
        2. Form-encoded — chaves como 'contacts[add][0][id]' (parseadas pelo FastAPI)

        Esta implementação espera o payload já normalizado para dict pelo FastAPI.
        O Sync Engine (C4) vai chamar os métodos de upsert no Supabase.
        """
        logger.info(
            "Kommo webhook recebido (tenant=%s): chaves=%s",
            self.tenant_id,
            list(payload.keys()),
        )

        # Contatos
        for action in ("add", "update", "delete"):
            contacts_changed = (payload.get("contacts") or {}).get(action) or []
            for c in contacts_changed:
                logger.debug(
                    "Kommo webhook: contact %s id=%s", action, c.get("id")
                )

        # Leads / Deals
        for action in ("add", "update", "status", "delete"):
            leads_changed = (payload.get("leads") or {}).get(action) or []
            for lead in leads_changed:
                logger.debug(
                    "Kommo webhook: lead %s id=%s", action, lead.get("id")
                )

        # Tasks / Appointments
        for action in ("add", "update", "delete", "complete"):
            tasks_changed = (payload.get("task") or {}).get(action) or []
            for task in tasks_changed:
                logger.debug(
                    "Kommo webhook: task %s id=%s", action, task.get("id")
                )

        # TODO (C4 — Sync Engine): chamar upsert no Supabase para cada entidade alterada

    # ── verify_credentials ────────────────────────────────────────────────────

    async def verify_credentials(self) -> bool:
        """
        Valida as credenciais fazendo GET /api/v4/account.
        Retorna True se o token é válido, False em caso de 401/403.
        """
        try:
            async with self._client() as client:
                resp = await client.get("/api/v4/account")
            if resp.status_code == 200:
                logger.info(
                    "Kommo: credenciais OK (tenant=%s, subdomain=%s)",
                    self.tenant_id,
                    self._subdomain,
                )
                return True
            logger.warning(
                "Kommo: credenciais inválidas (tenant=%s, status=%d)",
                self.tenant_id,
                resp.status_code,
            )
            return False
        except httpx.RequestError as exc:
            logger.error(
                "Kommo: erro de conexão ao verificar credenciais (tenant=%s): %s",
                self.tenant_id,
                exc,
            )
            return False
