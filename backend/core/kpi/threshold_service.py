"""
Checks KPI alert rules against live data and fires triggers when thresholds are breached.
Called on-demand (POST /kpi/check/:org_id) or by a scheduler.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

logger = logging.getLogger(__name__)

OPERATOR_FNS = {
    "lt":  lambda a, b: a < b,
    "lte": lambda a, b: a <= b,
    "gt":  lambda a, b: a > b,
    "gte": lambda a, b: a >= b,
    "eq":  lambda a, b: abs(a - b) < 1e-9,
}


class ThresholdService:
    def __init__(self, db):
        self.db = db

    async def _fetch_metric(self, org_id: str, metric_key: str) -> float | None:
        """Compute the current value of a metric for the org (last 30 days)."""
        today = date.today()
        start = (today - timedelta(days=30)).isoformat()
        end = today.isoformat()

        try:
            if metric_key == "conversion_rate":
                total = self.db.table("leads").select("id", count="exact").eq("org_id", org_id).gte("created_at", start).execute()
                conv = self.db.table("leads").select("id", count="exact").eq("org_id", org_id).eq("status", "converted").gte("created_at", start).execute()
                t = total.count or 0
                c = conv.count or 0
                return round((c / t) * 100, 2) if t > 0 else 0.0

            if metric_key == "total_leads":
                r = self.db.table("leads").select("id", count="exact").eq("org_id", org_id).gte("created_at", start).execute()
                return float(r.count or 0)

            if metric_key == "total_revenue":
                r = self.db.table("leads").select("value").eq("org_id", org_id).eq("status", "converted").gte("created_at", start).execute()
                return float(sum(row.get("value") or 0 for row in (r.data or [])))

            if metric_key == "avg_ticket":
                r = self.db.table("leads").select("value").eq("org_id", org_id).eq("status", "converted").gte("created_at", start).execute()
                rows = [row.get("value") or 0 for row in (r.data or [])]
                return float(sum(rows) / len(rows)) if rows else 0.0

            if metric_key == "cpl":
                spend_r = self.db.table("paid_traffic_daily_metrics").select("spend,leads").eq("org_id", org_id).gte("date", start).execute()
                rows = spend_r.data or []
                total_spend = sum(r.get("spend") or 0 for r in rows)
                total_leads = sum(r.get("leads") or 0 for r in rows)
                return float(total_spend / total_leads) if total_leads > 0 else None

            if metric_key == "roas":
                r = self.db.table("paid_traffic_daily_metrics").select("spend,purchase_value").eq("org_id", org_id).gte("date", start).execute()
                rows = r.data or []
                spend = sum(x.get("spend") or 0 for x in rows)
                rev = sum(x.get("purchase_value") or 0 for x in rows)
                return float(rev / spend) if spend > 0 else None

            if metric_key == "cac":
                r = self.db.table("paid_traffic_daily_metrics").select("spend,leads").eq("org_id", org_id).gte("date", start).execute()
                rows = r.data or []
                spend = sum(x.get("spend") or 0 for x in rows)
                leads = sum(x.get("leads") or 0 for x in rows)
                return float(spend / leads) if leads > 0 else None

            if metric_key == "churn_rate":
                r = self.db.table("churn_predictions").select("churn_probability").eq("org_id", org_id).execute()
                rows = r.data or []
                if not rows:
                    return None
                avg = sum(x.get("churn_probability") or 0 for x in rows) / len(rows)
                return round(avg * 100, 2)

            if metric_key == "health_score_avg":
                r = self.db.table("customer_health_scores").select("health_score").eq("org_id", org_id).execute()
                rows = r.data or []
                if not rows:
                    return None
                return round(sum(x.get("health_score") or 0 for x in rows) / len(rows), 1)

        except Exception as e:
            logger.error("Error fetching metric %s for org %s: %s", metric_key, org_id, e)
        return None

    async def check_rules(self, org_id: str) -> dict:
        """Evaluate all enabled rules for the org. Insert triggers for breaches."""
        rules_res = self.db.table("kpi_alert_rules").select("*").eq("org_id", org_id).eq("enabled", True).execute()
        rules = rules_res.data or []

        triggered = 0
        checked = len(rules)

        for rule in rules:
            metric_key = rule["metric_key"]
            operator = rule["operator"]
            threshold = float(rule["threshold"])
            op_fn = OPERATOR_FNS.get(operator)
            if not op_fn:
                continue

            actual = await self._fetch_metric(org_id, metric_key)
            if actual is None:
                continue

            if op_fn(actual, threshold):
                # Insert trigger (dedup: skip if same rule triggered today and not yet resolved)
                existing = self.db.table("kpi_alert_triggers").select("id").eq("rule_id", rule["id"]).eq("resolved", False).execute()
                if existing.data:
                    continue  # already active, don't spam

                self.db.table("kpi_alert_triggers").insert({
                    "rule_id": rule["id"],
                    "org_id": org_id,
                    "metric_key": metric_key,
                    "actual_value": actual,
                    "threshold": threshold,
                    "operator": operator,
                }).execute()

                # Update last_triggered_at on rule
                from datetime import datetime, timezone
                self.db.table("kpi_alert_rules").update({"last_triggered_at": datetime.now(timezone.utc).isoformat()}).eq("id", rule["id"]).execute()

                triggered += 1
                logger.info("Rule '%s' triggered: %s %s %s (actual: %s)", rule["name"], metric_key, operator, threshold, actual)

        return {"checked": checked, "triggered": triggered}
