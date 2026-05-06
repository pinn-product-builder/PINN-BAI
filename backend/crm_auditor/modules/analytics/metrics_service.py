"""Cálculo de métricas comerciais a partir das tabelas normalizadas do auditor."""
from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

from crm_auditor.core.config import get_auditor_settings

logger = logging.getLogger(__name__)


def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


class MetricsService:
    def __init__(self, db: Any) -> None:
        self.db = db
        self.settings = get_auditor_settings()

    async def _leads(self, tenant_id: str) -> list[dict[str, Any]]:
        res = await (
            self.db.table("crm_leads")
            .select(
                "external_id,name,lead_status,value,owner_external_id,source,"
                "pipeline_external_id,stage_external_id,external_updated_at,contact_external_id"
            )
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return list(res.data or [])

    async def _contacts(self, tenant_id: str) -> list[dict[str, Any]]:
        res = await (
            self.db.table("crm_norm_contacts")
            .select("external_id,email,phone,name")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return list(res.data or [])

    async def _tasks(self, tenant_id: str) -> list[dict[str, Any]]:
        res = await (
            self.db.table("crm_tasks")
            .select("external_id,lead_external_id,is_completed,due_at")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return list(res.data or [])

    async def get_overview_metrics(self, tenant_id: str) -> dict[str, Any]:
        leads = await self._leads(tenant_id)
        open_leads = [r for r in leads if r.get("lead_status") == "open"]
        won = [r for r in leads if r.get("lead_status") == "won"]
        lost = [r for r in leads if r.get("lead_status") == "lost"]
        open_value = sum(float(r.get("value") or 0) for r in open_leads)
        no_owner = sum(1 for r in open_leads if not r.get("owner_external_id"))
        no_source = sum(1 for r in open_leads if not (r.get("source") or "").strip())
        open_no_value = sum(
            1 for r in open_leads if r.get("value") is None or float(r.get("value") or 0) == 0
        )
        return {
            "total_active_leads": len(open_leads),
            "total_won_leads": len(won),
            "total_lost_leads": len(lost),
            "total_open_pipeline_value": round(open_value, 2),
            "open_leads_without_owner": no_owner,
            "open_leads_without_source": no_source,
            "open_leads_without_value": open_no_value,
            "total_leads_all_status": len(leads),
        }

    async def get_pipeline_health(self, tenant_id: str) -> list[dict[str, Any]]:
        res = await (
            self.db.from_("vw_pipeline_health")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return list(res.data or [])

    async def get_owner_performance(self, tenant_id: str) -> list[dict[str, Any]]:
        res = await (
            self.db.from_("vw_owner_performance")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return list(res.data or [])

    async def get_stuck_leads(self, tenant_id: str, days_threshold: int | None = None) -> list[dict[str, Any]]:
        """Lead parado: aberto sem atualização há >= X dias (config: AUDITOR_STUCK_LEAD_DAYS)."""
        days = float(days_threshold or self.settings.stuck_lead_days)
        leads = await self._leads(tenant_id)
        now = datetime.now(tz=timezone.utc)
        out: list[dict[str, Any]] = []
        for r in leads:
            if r.get("lead_status") != "open":
                continue
            ts = _parse_ts(str(r.get("external_updated_at") or ""))
            if not ts:
                continue
            age_days = (now - ts).total_seconds() / 86400.0
            if age_days >= days:
                row = dict(r)
                row["days_since_update"] = round(age_days, 2)
                out.append(row)
        return out

    async def get_no_next_action_leads(self, tenant_id: str) -> list[dict[str, Any]]:
        res = await (
            self.db.from_("vw_no_next_action").select("*").eq("tenant_id", tenant_id).execute()
        )
        return list(res.data or [])

    async def get_overdue_tasks(self, tenant_id: str) -> list[dict[str, Any]]:
        res = await (
            self.db.from_("vw_overdue_tasks").select("*").eq("tenant_id", tenant_id).execute()
        )
        return list(res.data or [])

    async def get_lost_reasons(self, tenant_id: str, limit: int = 20) -> list[dict[str, Any]]:
        res = await (
            self.db.from_("vw_lost_reasons")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("cnt", desc=True)
            .limit(limit)
            .execute()
        )
        return list(res.data or [])

    async def get_stage_distribution(self, tenant_id: str) -> list[dict[str, Any]]:
        res = await (
            self.db.from_("vw_stage_conversion")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return list(res.data or [])

    async def get_funnel_velocity(self, tenant_id: str) -> list[dict[str, Any]]:
        res = await (
            self.db.from_("vw_funnel_velocity")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return list(res.data or [])

    async def get_data_quality_breakdown(self, tenant_id: str) -> dict[str, Any]:
        contacts = await self._contacts(tenant_id)
        leads = await self._leads(tenant_id)
        open_leads = [r for r in leads if r.get("lead_status") == "open"]
        c_total = len(contacts)
        no_email = sum(1 for c in contacts if not (c.get("email") or "").strip())
        no_phone = sum(1 for c in contacts if not (c.get("phone") or "").strip())

        dup_emails_res = await (
            self.db.from_("vw_duplicate_contacts")
            .select("email_norm,cnt")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        dup_rows = dup_emails_res.data or []

        forecast_res = await (
            self.db.from_("vw_forecast_quality")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        forecast = (forecast_res.data or [None])[0] or {}

        hygiene_res = await (
            self.db.from_("vw_crm_data_quality")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        hygiene_view = (hygiene_res.data or [None])[0] or {}

        duplicate_open_leads = self._count_duplicate_open_leads(open_leads)

        return {
            "contacts_total": c_total,
            "contacts_without_email": no_email,
            "contacts_without_phone": no_phone,
            "duplicate_email_keys": len(dup_rows),
            "forecast": forecast,
            "crm_hygiene_view": hygiene_view,
            "duplicate_open_lead_groups": duplicate_open_leads,
        }

    def _count_duplicate_open_leads(self, open_leads: list[dict[str, Any]]) -> int:
        key_counts: defaultdict[tuple[str, str], int] = defaultdict(int)
        for r in open_leads:
            name = (r.get("name") or "").strip().lower()
            cid = (r.get("contact_external_id") or "").strip()
            if name and cid:
                key_counts[(name, cid)] += 1
        return sum(1 for c in key_counts.values() if c > 1)

    def compute_data_quality_score(self, overview: dict[str, Any], breakdown: dict[str, Any]) -> int:
        """Score 0–100: penaliza dono ausente, valor em aberto zerado, contatos incompletos, duplicidades."""
        score = 100.0
        open_cnt = max(1, int(overview.get("total_active_leads") or 0))
        if open_cnt == 0 and int(overview.get("total_leads_all_status") or 0) == 0:
            return 0
        score -= min(
            35.0,
            35.0 * (overview.get("open_leads_without_owner", 0) / open_cnt),
        )
        score -= min(
            20.0,
            20.0 * (overview.get("open_leads_without_value", 0) / open_cnt),
        )
        score -= min(
            15.0,
            15.0 * (overview.get("open_leads_without_source", 0) / open_cnt),
        )
        c_total = int(breakdown.get("contacts_total") or 0)
        if c_total > 0:
            ne = int(breakdown.get("contacts_without_email") or 0)
            np = int(breakdown.get("contacts_without_phone") or 0)
            score -= min(10.0, 10.0 * (ne / c_total))
            score -= min(5.0, 5.0 * (np / c_total))
        score -= min(10.0, 5.0 * int(breakdown.get("duplicate_email_keys") or 0))
        score -= min(10.0, float(breakdown.get("duplicate_open_lead_groups") or 0) * 3.0)
        return int(max(0, min(100, round(score))))

    def compute_operation_score(
        self,
        data_quality_score: int,
        overdue_tasks: int,
        stuck_leads: int,
        no_action: int,
    ) -> int:
        penalty = min(40, overdue_tasks * 2 + stuck_leads * 3 + no_action * 2)
        return int(max(0, min(100, data_quality_score - penalty)))

    async def get_consolidated_context(self, tenant_id: str) -> dict[str, Any]:
        overview = await self.get_overview_metrics(tenant_id)
        breakdown = await self.get_data_quality_breakdown(tenant_id)
        dq = self.compute_data_quality_score(overview, breakdown)
        stuck = await self.get_stuck_leads(tenant_id)
        no_action = await self.get_no_next_action_leads(tenant_id)
        overdue = await self.get_overdue_tasks(tenant_id)
        op_score = self.compute_operation_score(dq, len(overdue), len(stuck), len(no_action))
        return {
            "tenant_id": tenant_id,
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "overview": overview,
            "pipeline_health": await self.get_pipeline_health(tenant_id),
            "owner_performance": await self.get_owner_performance(tenant_id),
            "stuck_leads_count": len(stuck),
            "stuck_leads_sample": stuck[:15],
            "no_next_action_count": len(no_action),
            "overdue_tasks_count": len(overdue),
            "lost_reasons_top": await self.get_lost_reasons(tenant_id, 10),
            "stage_distribution": await self.get_stage_distribution(tenant_id),
            "funnel_velocity": await self.get_funnel_velocity(tenant_id),
            "data_quality": breakdown,
            "scores": {
                "crm_data_quality_0_100": dq,
                "operation_score_0_100": op_score,
            },
        }
