"""
Checks KPI alert rules against live data and fires triggers when thresholds are breached.
Called on-demand (POST /kpi/check/:org_id) or by a scheduler.
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

from .lead_data import fetch_org_leads

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
                rows = fetch_org_leads(self.db, org_id, start)
                t = len(rows)
                c = sum(1 for row in rows if row.get("status") == "converted")
                return round((c / t) * 100, 2) if t > 0 else 0.0

            if metric_key == "total_leads":
                return float(len(fetch_org_leads(self.db, org_id, start)))

            if metric_key == "total_revenue":
                rows = fetch_org_leads(self.db, org_id, start)
                return float(sum(row.get("value") or 0 for row in rows if row.get("status") == "converted"))

            if metric_key == "avg_ticket":
                values = [
                    row.get("value") or 0
                    for row in fetch_org_leads(self.db, org_id, start)
                    if row.get("status") == "converted"
                ]
                return float(sum(values) / len(values)) if values else 0.0

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
                # RFM/Churn removido do produto (commit 131aaef) — a tabela
                # churn_predictions não existe. Sem code path quebrado em runtime.
                return None

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

                inserted = self.db.table("kpi_alert_triggers").insert({
                    "rule_id": rule["id"],
                    "org_id": org_id,
                    "metric_key": metric_key,
                    "actual_value": actual,
                    "threshold": threshold,
                    "operator": operator,
                }).execute()
                trigger_row = (inserted.data or [None])[0]

                self.db.table("kpi_alert_rules").update(
                    {"last_triggered_at": datetime.now(timezone.utc).isoformat()}
                ).eq("id", rule["id"]).execute()

                # E7.S3 — dispara webhook se a rule tiver webhook_url configurado.
                webhook_url = rule.get("webhook_url")
                if webhook_url and trigger_row:
                    await self._dispatch_webhook(rule, trigger_row, actual)

                triggered += 1
                logger.info("Rule '%s' triggered: %s %s %s (actual: %s)", rule["name"], metric_key, operator, threshold, actual)

        return {"checked": checked, "triggered": triggered}

    async def _dispatch_webhook(
        self,
        rule: dict[str, Any],
        trigger: dict[str, Any],
        actual_value: float,
    ) -> None:
        """POST no webhook_url da regra com payload contendo o trigger.

        Não levanta exceção — falha vira `webhook_error` no trigger pra ser
        visível na UI sem quebrar o ciclo de checagem.
        """
        method = (rule.get("webhook_method") or "POST").upper()
        url = rule["webhook_url"]
        custom_headers = rule.get("webhook_headers") or {}
        secret = rule.get("webhook_secret")

        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "User-Agent": "PinnBAI-Webhook/1.0",
            **(custom_headers if isinstance(custom_headers, dict) else {}),
        }
        if secret:
            headers["X-Webhook-Secret"] = secret

        payload = {
            "event": "kpi_alert_triggered",
            "trigger_id": trigger.get("id"),
            "rule_id": rule.get("id"),
            "rule_name": rule.get("name"),
            "org_id": trigger.get("org_id"),
            "metric_key": rule.get("metric_key"),
            "operator": rule.get("operator"),
            "threshold": rule.get("threshold"),
            "actual_value": actual_value,
            "fired_at": datetime.now(timezone.utc).isoformat(),
        }

        update_trigger: dict[str, Any] = {
            "webhook_dispatched_at": datetime.now(timezone.utc).isoformat(),
        }
        update_rule: dict[str, Any] = {
            "last_dispatch_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.request(method, url, headers=headers, content=json.dumps(payload))
                update_trigger["webhook_response_code"] = resp.status_code
                body_snip = resp.text[:1000] if resp.text else ""
                update_trigger["webhook_response_body"] = body_snip
                update_rule["last_dispatch_status"] = str(resp.status_code)
                logger.info("Webhook %s %s → %s", method, url, resp.status_code)
        except Exception as exc:
            err = str(exc)[:500]
            update_trigger["webhook_error"] = err
            update_rule["last_dispatch_status"] = "error"
            logger.warning("Webhook %s %s falhou: %s", method, url, err)

        try:
            self.db.table("kpi_alert_triggers").update(update_trigger).eq("id", trigger["id"]).execute()
            self.db.table("kpi_alert_rules").update(update_rule).eq("id", rule["id"]).execute()
        except Exception as exc:
            logger.warning("Não consegui salvar resultado do webhook: %s", exc)
