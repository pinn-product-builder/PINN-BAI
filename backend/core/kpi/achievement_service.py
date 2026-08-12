"""
Auto-grants achievements to org members based on their KPI performance.
Called via POST /kpi/achievements/check/:org_id
"""
from __future__ import annotations

import logging
from datetime import date, timedelta

from .lead_data import org_has_converted_lead

logger = logging.getLogger(__name__)


class AchievementService:
    def __init__(self, db):
        self.db = db

    async def _get_org_members(self, org_id: str) -> list[dict]:
        # Membros da org = profiles com esse org_id (não existe tabela org_members).
        r = self.db.table("profiles").select("user_id").eq("org_id", org_id).execute()
        return r.data or []

    async def _already_earned(self, org_id: str, user_id: str, achievement_id: str) -> bool:
        r = (
            self.db.table("user_achievements")
            .select("id")
            .eq("org_id", org_id)
            .eq("user_id", user_id)
            .eq("achievement_id", achievement_id)
            .execute()
        )
        return bool(r.data)

    async def _grant(self, org_id: str, user_id: str, achievement_id: str) -> bool:
        if await self._already_earned(org_id, user_id, achievement_id):
            return False
        self.db.table("user_achievements").upsert({
            "org_id": org_id,
            "user_id": user_id,
            "achievement_id": achievement_id,
        }).execute()
        logger.info("Achievement '%s' granted to user %s in org %s", achievement_id, user_id, org_id)
        return True

    async def check_and_grant(self, org_id: str) -> dict:
        members = await self._get_org_members(org_id)
        total_granted = 0
        today = date.today()
        start_30d = (today - timedelta(days=30)).isoformat()

        # ── Org-wide metrics ──────────────────────────────────────────────────

        # Paid traffic
        paid_r = self.db.table("paid_traffic_daily_metrics").select("spend,leads,purchase_value,ctr,cpl").eq("org_id", org_id).gte("date", start_30d).execute()
        paid_rows = paid_r.data or []
        total_spend = sum(r.get("spend") or 0 for r in paid_rows)
        total_paid_leads = sum(r.get("leads") or 0 for r in paid_rows)
        total_pv = sum(r.get("purchase_value") or 0 for r in paid_rows)
        avg_ctr = (sum(r.get("ctr") or 0 for r in paid_rows) / len(paid_rows)) if paid_rows else 0
        global_roas = (total_pv / total_spend) if total_spend > 0 else 0
        global_cpl = (total_spend / total_paid_leads) if total_paid_leads > 0 else 0

        # Health
        health_r = self.db.table("customer_health_scores").select("health_band, health_score").eq("org_id", org_id).execute()
        health_rows = health_r.data or []
        total_health = len(health_rows)
        healthy_count = sum(1 for h in health_rows if h.get("health_band") == "saudavel")
        critical_count = sum(1 for h in health_rows if h.get("health_band") == "critico")
        healthy_pct = (healthy_count / total_health * 100) if total_health > 0 else 0

        # Churn removido do produto (commit 131aaef) — churn_predictions não existe.

        # CRM leads — fonte de verdade é crm_leads (a tabela `leads` legada está
        # vazia). lead_status='won' ≈ convertido (P1.2).
        leads_r = self.db.table("crm_leads").select("id,lead_status").eq("tenant_id", org_id).gte("created_at", start_30d).execute()
        leads = leads_r.data or []
        total_leads_30d = len(leads)
        total_conv_30d = sum(1 for l in leads if l.get("lead_status") == "won")
        conv_rate = (total_conv_30d / total_leads_30d * 100) if total_leads_30d > 0 else 0

        # Grant org-level achievements to ALL members
        org_achievements: list[tuple[str, bool]] = [
            ("century_leads",   total_leads_30d >= 100),
            ("high_ctr",        avg_ctr >= 5.0),
            ("roas_3x",         global_roas >= 3.0),
            ("low_cpl",         0 < global_cpl <= 50),
            ("healthy_base",    healthy_pct >= 80),
            ("zero_critical",   total_health > 0 and critical_count == 0),
        ]

        # First conversion (org-wide, all-time) — crm_leads first, fallback legado.
        has_conversion = org_has_converted_lead(self.db, org_id)

        for member in members:
            uid = member["user_id"]

            if has_conversion:
                if await self._grant(org_id, uid, "first_conversion"):
                    total_granted += 1

            for achievement_id, condition in org_achievements:
                if condition:
                    if await self._grant(org_id, uid, achievement_id):
                        total_granted += 1

        return {"checked_members": len(members), "granted": total_granted}
