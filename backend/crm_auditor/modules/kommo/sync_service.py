"""Orquestração de sync idempotente (upsert por tenant_id + external_id)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from crm_auditor.modules.kommo.kommo_http_client import build_kommo_client
from crm_auditor.modules.kommo import mapper

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


class AuditorSyncService:
    def __init__(self, db: Any, tenant_id: str, connection_row: dict[str, Any] | None = None) -> None:
        self.db = db
        self.tenant_id = tenant_id
        self.connection_row = connection_row or {}

    async def run(self) -> dict[str, Any]:
        synced_at = _now_iso()
        connection_id = self.connection_row.get("id")
        stats: dict[str, int] = {
            "pipelines": 0,
            "stages": 0,
            "users": 0,
            "leads": 0,
            "contacts": 0,
            "companies": 0,
            "tasks": 0,
            "custom_fields": 0,
            "notes": 0,
            "events": 0,
            "conversations": 0,
        }

        run_insert = (
            await self.db.table("crm_sync_runs")
            .insert(
                {
                    "tenant_id": self.tenant_id,
                    "connection_id": connection_id,
                    "status": "running",
                    "stats": {},
                }
            )
            .execute()
        )
        run_rows = run_insert.data or []
        if not run_rows:
            raise RuntimeError("Falha ao criar crm_sync_runs")
        run_id = run_rows[0]["id"]

        await self._set_connection_sync("syncing", None)

        try:
            client = build_kommo_client(self.connection_row)
            raw_pipelines = await client.list_pipelines(self.tenant_id)
            pipeline_rows = [mapper.map_pipeline_row(self.tenant_id, p, synced_at) for p in raw_pipelines]
            if pipeline_rows:
                await self.db.table("crm_pipelines").upsert(
                    pipeline_rows, on_conflict="tenant_id,external_id"
                ).execute()
            stats["pipelines"] = len(pipeline_rows)

            raw_stage_list = await client.list_stages(self.tenant_id)
            stage_rows: list[dict[str, Any]] = []
            for s in raw_stage_list:
                pid = str(s.get("_pipeline_id") or "")
                body = {k: v for k, v in s.items() if k != "_pipeline_id"}
                stage_rows.append(mapper.map_stage_row(self.tenant_id, pid, body, synced_at))
            if stage_rows:
                await self.db.table("crm_stages").upsert(
                    stage_rows, on_conflict="tenant_id,pipeline_external_id,external_id"
                ).execute()
            stats["stages"] = len(stage_rows)

            stage_index = mapper.build_stage_index(stage_rows)

            raw_users = await client.list_users(self.tenant_id)
            user_rows = [mapper.map_user_row(self.tenant_id, u, synced_at) for u in raw_users]
            if user_rows:
                await self.db.table("crm_users").upsert(
                    user_rows, on_conflict="tenant_id,external_id"
                ).execute()
            stats["users"] = len(user_rows)

            # Catálogo de motivos de perda precisa estar disponível antes do map dos leads
            # para resolver loss_reason_id -> nome textual (caso contrário lost_reason
            # acaba exibindo o ID cru, ex: "3503").
            extended_catalog: dict[str, Any] = {}
            fc = getattr(client, "fetch_extended_catalog", None)
            if callable(fc):
                try:
                    extended_catalog = await fc()
                except Exception as exc:
                    logger.warning("Catálogo estendido (fontes/motivos): %s", exc)
            loss_reasons_by_id = mapper.build_loss_reason_index(
                extended_catalog.get("loss_reasons") if isinstance(extended_catalog, dict) else None
            )

            page, all_leads = 1, []
            while True:
                chunk = await client.list_leads(self.tenant_id, page=page, limit=250)
                if not chunk:
                    break
                all_leads.extend(chunk)
                if len(chunk) < 250:
                    break
                page += 1

            value_config = self.connection_row.get("value_config") or {}
            lead_rows = [
                mapper.map_lead_row(
                    self.tenant_id, raw, stage_index, synced_at, loss_reasons_by_id, value_config
                )
                for raw in all_leads
            ]
            if lead_rows:
                await self.db.table("crm_leads").upsert(
                    lead_rows, on_conflict="tenant_id,external_id"
                ).execute()
            stats["leads"] = len(lead_rows)

            # ── Reconciliação: o cliente é a fonte autoritativa. Apaga do banco o que
            # não voltou da API (lead removido no Kommo, ou lixo de syncs antigas como o
            # pipeline fantasma 5001 do mock). Sem isso a contagem só cresce e nunca bate.
            stats["deleted_leads"] = await self._reconcile_simple(
                "crm_leads", {str(r["external_id"]) for r in lead_rows}
            )
            stats["deleted_pipelines"] = await self._reconcile_simple(
                "crm_pipelines", {str(r["external_id"]) for r in pipeline_rows}
            )
            stats["deleted_stages"] = await self._reconcile_stages(
                {(str(r["pipeline_external_id"]), str(r["external_id"])) for r in stage_rows}
            )

            page, all_contacts = 1, []
            while True:
                chunk = await client.list_contacts(self.tenant_id, page=page, limit=250)
                if not chunk:
                    break
                all_contacts.extend(chunk)
                if len(chunk) < 250:
                    break
                page += 1
            contact_field_map = await self._load_contact_field_map()
            contact_rows = [
                mapper.map_contact_row(self.tenant_id, c, synced_at, contact_field_map)
                for c in all_contacts
            ]
            if contact_rows:
                await self.db.table("crm_norm_contacts").upsert(
                    contact_rows, on_conflict="tenant_id,external_id"
                ).execute()
            stats["contacts"] = len(contact_rows)
            stats["deleted_contacts"] = await self._reconcile_simple(
                "crm_norm_contacts", {str(r["external_id"]) for r in contact_rows}
            )

            page, all_companies = 1, []
            while True:
                chunk = await client.list_companies(self.tenant_id, page=page, limit=250)
                if not chunk:
                    break
                all_companies.extend(chunk)
                if len(chunk) < 250:
                    break
                page += 1
            company_rows = [mapper.map_company_row(self.tenant_id, c, synced_at) for c in all_companies]
            if company_rows:
                await self.db.table("crm_companies").upsert(
                    company_rows, on_conflict="tenant_id,external_id"
                ).execute()
            stats["companies"] = len(company_rows)

            page, all_tasks = 1, []
            while True:
                chunk = await client.list_tasks(self.tenant_id, page=page, limit=250)
                if not chunk:
                    break
                all_tasks.extend(chunk)
                if len(chunk) < 250:
                    break
                page += 1
            task_rows = [mapper.map_task_row(self.tenant_id, t, synced_at) for t in all_tasks]
            if task_rows:
                await self.db.table("crm_tasks").upsert(
                    task_rows, on_conflict="tenant_id,external_id"
                ).execute()
            stats["tasks"] = len(task_rows)

            raw_cf = await client.list_custom_fields(self.tenant_id)
            cf_rows: list[dict[str, Any]] = []
            for cf in raw_cf:
                cf_copy = dict(cf)
                aud_et = str(cf_copy.pop("_auditor_entity_type", "leads"))
                entity_norm = {"leads": "lead", "contacts": "contact", "companies": "company"}.get(
                    aud_et,
                    "lead",
                )
                cf_rows.append(mapper.map_custom_field_row(self.tenant_id, entity_norm, cf_copy, synced_at))
            if cf_rows:
                await self.db.table("crm_custom_fields").upsert(
                    cf_rows, on_conflict="tenant_id,entity_type,external_id"
                ).execute()
            stats["custom_fields"] = len(cf_rows)

            # Auto-detecta email/phone no catálogo recém-descoberto (idempotente;
            # do-nothing em conflito → não sobrescreve confirmação humana na UI).
            # Tira o EMAIL/PHONE hardcoded do mapper; a próxima sync já usa o mapeamento.
            try:
                await self.db.rpc(
                    "seed_org_field_mappings", {"_tenant_id": self.tenant_id}
                ).execute()
            except Exception as exc:
                logger.warning("seed_org_field_mappings: %s", exc)

            list_notes = getattr(client, "list_all_entity_notes", None)
            if callable(list_notes):
                try:
                    raw_notes = await list_notes(self.tenant_id)
                    note_rows = [mapper.map_note_row(self.tenant_id, n, synced_at) for n in raw_notes]
                    if note_rows:
                        await self.db.table("crm_auditor_notes").upsert(
                            note_rows, on_conflict="tenant_id,external_id"
                        ).execute()
                    stats["notes"] = len(note_rows)
                except Exception as exc:
                    logger.warning("Sync notas Kommo: %s", exc)

            list_events = getattr(client, "list_all_events", None)
            if callable(list_events):
                try:
                    raw_ev = await list_events(self.tenant_id)
                    ev_rows = [mapper.map_event_row(self.tenant_id, e, synced_at) for e in raw_ev]
                    if ev_rows:
                        await self.db.table("crm_auditor_events").upsert(
                            ev_rows, on_conflict="tenant_id,external_id"
                        ).execute()
                    stats["events"] = len(ev_rows)
                except Exception as exc:
                    logger.warning("Sync eventos Kommo: %s", exc)

            list_talks = getattr(client, "list_all_conversations", None)
            if callable(list_talks):
                try:
                    raw_c = await list_talks(self.tenant_id)
                    c_rows = [mapper.map_conversation_row(self.tenant_id, c, synced_at) for c in raw_c]
                    if c_rows:
                        await self.db.table("crm_auditor_conversations").upsert(
                            c_rows, on_conflict="tenant_id,external_id"
                        ).execute()
                    stats["conversations"] = len(c_rows)
                except Exception as exc:
                    logger.warning("Sync conversas Kommo: %s", exc)

            await (
                self.db.table("crm_snapshots")
                .insert(
                    {
                        "tenant_id": self.tenant_id,
                        "snapshot_kind": "post_sync",
                        "payload": {
                            "stats": stats,
                            "sync_run_id": run_id,
                            "extended_catalog": extended_catalog,
                        },
                        "sync_run_id": run_id,
                    }
                )
                .execute()
            )

            finished = _now_iso()
            await (
                self.db.table("crm_sync_runs")
                .update({"status": "success", "finished_at": finished, "stats": stats})
                .eq("id", run_id)
                .execute()
            )

            await self._set_connection_sync("success", None, finished)

            logger.info(
                "Auditor sync concluído tenant=%s run=%s stats=%s",
                self.tenant_id,
                run_id,
                stats,
            )
            return {"sync_run_id": run_id, "stats": stats}

        except Exception as exc:
            msg = str(exc)
            logger.exception("Auditor sync falhou tenant=%s: %s", self.tenant_id, msg)
            finished = _now_iso()
            await (
                self.db.table("crm_sync_runs")
                .update({"status": "failed", "finished_at": finished, "error_message": msg})
                .eq("id", run_id)
                .execute()
            )
            await self._set_connection_sync("failed", msg, finished)
            raise

    async def _load_contact_field_map(self) -> dict[str, dict[str, str | None]]:
        """Lê org_field_mappings (entity contact) → {'email': {'code','id'}, 'phone': {...}}.

        É o que tira o EMAIL/PHONE hardcoded do mapper: a sync já auto-detecta esses
        campos (seed_org_field_mappings) e aqui passamos a resolução pro mapper.
        """
        try:
            res = await (
                self.db.table("org_field_mappings")
                .select("logical_field, source_code, source_external_id")
                .eq("tenant_id", self.tenant_id)
                .eq("entity_type", "contact")
                .execute()
            )
        except Exception as exc:
            logger.warning("org_field_mappings indisponível (%s) — fallback EMAIL/PHONE", exc)
            return {}
        fm: dict[str, dict[str, str | None]] = {}
        for r in res.data or []:
            lf = r.get("logical_field")
            if lf in ("email", "phone"):
                ext = r.get("source_external_id")
                fm[lf] = {"code": r.get("source_code"), "id": str(ext) if ext is not None else None}
        return fm

    async def _reconcile_simple(self, table: str, fetched_ids: set[str]) -> int:
        """Apaga linhas do tenant cujo external_id não veio da API (delete-missing).

        Segurança: só reconcilia quando a API retornou ALGO (fetched_ids não-vazio).
        Um fetch vazio normalmente é erro/conta sem permissão — nesse caso não apagamos
        nada para evitar zerar o tenant por engano.
        """
        if not fetched_ids:
            return 0
        res = (
            await self.db.table(table)
            .select("external_id")
            .eq("tenant_id", self.tenant_id)
            .execute()
        )
        existing = {str(r["external_id"]) for r in (res.data or []) if r.get("external_id") is not None}
        stale = sorted(existing - fetched_ids)
        if not stale:
            return 0
        for i in range(0, len(stale), 100):
            chunk = stale[i : i + 100]
            await (
                self.db.table(table)
                .delete()
                .eq("tenant_id", self.tenant_id)
                .in_("external_id", chunk)
                .execute()
            )
        logger.info("Reconcile %s tenant=%s: %s removido(s)", table, self.tenant_id, len(stale))
        return len(stale)

    async def _reconcile_stages(self, fetched_keys: set[tuple[str, str]]) -> int:
        """Stages usam chave composta (pipeline_external_id, external_id) — status 142/143
        são compartilhados entre pipelines, então não dá para reconciliar só por external_id.
        """
        if not fetched_keys:
            return 0
        res = (
            await self.db.table("crm_stages")
            .select("pipeline_external_id, external_id")
            .eq("tenant_id", self.tenant_id)
            .execute()
        )
        existing = {
            (str(r["pipeline_external_id"]), str(r["external_id"]))
            for r in (res.data or [])
            if r.get("external_id") is not None
        }
        stale = sorted(existing - fetched_keys)
        for pipe, ext in stale:
            await (
                self.db.table("crm_stages")
                .delete()
                .eq("tenant_id", self.tenant_id)
                .eq("pipeline_external_id", pipe)
                .eq("external_id", ext)
                .execute()
            )
        if stale:
            logger.info("Reconcile crm_stages tenant=%s: %s removido(s)", self.tenant_id, len(stale))
        return len(stale)

    async def _set_connection_sync(self, status: str, error: str | None, finished_at: str | None = None) -> None:
        conn_id = self.connection_row.get("id")
        if not conn_id:
            return
        payload: dict[str, Any] = {
            "sync_status": status,
            "sync_error": error,
            "updated_at": finished_at or _now_iso(),
        }
        if status == "success":
            payload["last_sync_at"] = finished_at or _now_iso()
        await self.db.table("crm_auditor_connections").update(payload).eq("id", conn_id).execute()
