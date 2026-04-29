"""
CustomerHealthService — computa health score composto por cliente.

Score 0-100 composto de 4 dimensões:
  - Engajamento (35%): recência + frequência de atividades no CRM
  - Receita (30%): valor monetário + tendência vs período anterior
  - Momentum (20%): deals ativos no pipeline, velocidade de avanço
  - Lealdade (15%): segmento RFM + tempo como cliente

Gera alertas proativos quando detecta sinais de risco.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from core.db import get_db

logger = logging.getLogger(__name__)

_HEALTH_BANDS = [
    (80, "saudavel"),
    (60, "atencao"),
    (40, "risco"),
    (0,  "critico"),
]

_RFM_SEGMENT_LOYALTY: dict[str, int] = {
    "Campeões": 100,
    "Leais": 85,
    "Promissores": 70,
    "Em Risco": 40,
    "Precisam de Atenção": 50,
    "Prestes a Hibernar": 30,
    "Hibernando": 20,
    "Regulares": 60,
}

_ALERT_TYPES = {
    "no_activity":      ("Sem atividade recente",      "warning"),
    "champion_at_risk": ("Cliente Campeão em risco",   "critical"),
    "deal_stalled":     ("Deal parado há muito tempo", "warning"),
    "revenue_drop":     ("Queda de receita",           "critical"),
    "churn_risk":       ("Alto risco de churn",        "critical"),
    "long_inactivity":  ("Inatividade prolongada",     "critical"),
}


def _band(score: int) -> str:
    for threshold, band in _HEALTH_BANDS:
        if score >= threshold:
            return band
    return "critico"


def _clamp(val: float) -> int:
    return max(0, min(100, int(round(val))))


class CustomerHealthService:
    """Calcula e persiste health scores para todos os clientes de um tenant."""

    def __init__(self, tenant_id: str) -> None:
        self.tenant_id = tenant_id

    async def compute_all(self) -> dict:
        db = await get_db()
        now = datetime.now(tz=timezone.utc)

        # ── Carregar dados base ────────────────────────────────────────────────

        rfm_res = await db.table("customer_rfm_scores").select("*").eq("org_id", self.tenant_id).execute()
        churn_res = await db.table("customer_churn_scores").select("*").eq("org_id", self.tenant_id).execute()
        leads_res = await db.table("leads").select(
            "id,name,email,status,value,created_at,updated_at"
        ).eq("org_id", self.tenant_id).execute()

        rfm_by_key: dict[str, dict] = {r["customer_key"]: r for r in (rfm_res.data or [])}
        churn_by_key: dict[str, dict] = {r["customer_key"]: r for r in (churn_res.data or [])}
        leads: list[dict] = leads_res.data or []

        if not leads:
            return {"computed": 0, "alerts": 0}

        # ── Calcular score por cliente ─────────────────────────────────────────

        health_rows: list[dict] = []
        alert_rows: list[dict] = []
        existing_health_res = await db.table("customer_health_scores").select(
            "customer_key,health_score"
        ).eq("org_id", self.tenant_id).execute()
        prev_scores: dict[str, int] = {r["customer_key"]: r["health_score"] for r in (existing_health_res.data or [])}

        for lead in leads:
            key = lead["id"]
            rfm = rfm_by_key.get(key) or rfm_by_key.get(lead.get("email", ""))
            churn = churn_by_key.get(key) or churn_by_key.get(lead.get("email", ""))

            # ── Dimensão 1: Engajamento (recência + frequência) ────────────────
            days_since_update = (now - datetime.fromisoformat(
                lead["updated_at"].replace("Z", "+00:00")
            )).days if lead.get("updated_at") else 999

            if rfm:
                recency_days = int(rfm.get("recency_days", days_since_update))
                frequency = int(rfm.get("frequency", 1))
            else:
                recency_days = days_since_update
                frequency = 1

            recency_score = max(0, 100 - recency_days * 2)  # perde 2pts por dia
            freq_score = min(100, frequency * 15)
            engagement_score = _clamp(recency_score * 0.6 + freq_score * 0.4)

            # ── Dimensão 2: Receita (monetário + tendência) ────────────────────
            monetary = float(rfm["monetary"]) if rfm else float(lead.get("value") or 0)
            # Score baseado em quantil simplificado: normaliza vs R$50k como referência
            monetary_score = _clamp(min(monetary / 50000, 1) * 100)

            if rfm:
                m_score_rfm = int(rfm.get("m_score", 3))
                revenue_score = _clamp((m_score_rfm / 5) * 100)
            else:
                revenue_score = monetary_score

            # ── Dimensão 3: Momentum (pipeline) ───────────────────────────────
            status = lead.get("status", "new")
            momentum_map = {
                "converted": 100,
                "proposal": 85,
                "in_analysis": 70,
                "qualified": 55,
                "new": 40,
                "lost": 5,
            }
            momentum_score = momentum_map.get(status, 40)

            # ── Dimensão 4: Lealdade (RFM segment + idade) ────────────────────
            rfm_segment = rfm.get("rfm_segment", "Regulares") if rfm else "Regulares"
            loyalty_score = _RFM_SEGMENT_LOYALTY.get(rfm_segment, 50)

            # ── Score composto ─────────────────────────────────────────────────
            churn_prob = float(churn["churn_probability"]) if churn else 0.0
            churn_penalty = int(churn_prob * 40)  # churn 100% → -40pts

            composite = _clamp(
                engagement_score * 0.35
                + revenue_score * 0.30
                + momentum_score * 0.20
                + loyalty_score * 0.15
                - churn_penalty
            )

            prev_score = prev_scores.get(key)
            delta = (composite - prev_score) if prev_score is not None else None
            trend = "stable"
            if delta is not None:
                if delta >= 5:
                    trend = "up"
                elif delta <= -5:
                    trend = "down"

            # ── Sinais de risco ────────────────────────────────────────────────
            signals: list[dict] = []
            if recency_days > 60:
                signals.append({"type": "no_activity", "label": f"Sem atividade há {recency_days} dias", "severity": "critical"})
            elif recency_days > 30:
                signals.append({"type": "no_activity", "label": f"Sem atividade há {recency_days} dias", "severity": "warning"})

            if rfm_segment in ("Campeões", "Leais") and churn_prob > 0.5:
                signals.append({"type": "champion_at_risk", "label": f"Cliente {rfm_segment} com {churn_prob*100:.0f}% risco de churn", "severity": "critical"})

            if churn_prob > 0.7:
                signals.append({"type": "churn_risk", "label": f"Risco de churn: {churn_prob*100:.0f}%", "severity": "critical"})

            if status == "proposal" and recency_days > 14:
                signals.append({"type": "deal_stalled", "label": "Proposta sem movimentação há mais de 14 dias", "severity": "warning"})

            health_rows.append({
                "org_id": self.tenant_id,
                "customer_key": key,
                "customer_name": lead.get("name", ""),
                "customer_email": lead.get("email"),
                "source_table": "leads",
                "health_score": composite,
                "health_band": _band(composite),
                "engagement_score": engagement_score,
                "revenue_score": revenue_score,
                "momentum_score": momentum_score,
                "loyalty_score": loyalty_score,
                "health_delta": delta,
                "trend": trend,
                "signals": signals,
                "calculated_at": now.isoformat(),
            })

            # ── Alertas proativos ──────────────────────────────────────────────
            for sig in signals:
                if sig["severity"] in ("critical", "warning"):
                    alert_type, default_severity = _ALERT_TYPES.get(sig["type"], (sig["type"], sig["severity"]))
                    alert_rows.append({
                        "org_id": self.tenant_id,
                        "customer_key": key,
                        "customer_name": lead.get("name", ""),
                        "alert_type": sig["type"],
                        "severity": sig["severity"],
                        "title": sig["label"],
                        "description": self._build_alert_description(sig, rfm, churn, lead),
                        "metadata": {
                            "health_score": composite,
                            "rfm_segment": rfm_segment,
                            "churn_probability": churn_prob,
                            "recency_days": recency_days,
                            "status": status,
                        },
                    })

        # ── Persistir ──────────────────────────────────────────────────────────
        if health_rows:
            await db.table("customer_health_scores").upsert(
                health_rows, on_conflict="org_id,customer_key"
            ).execute()

        # Inserir apenas alertas novos (não duplicar alertas do mesmo tipo no mesmo dia)
        if alert_rows:
            today_start = now.replace(hour=0, minute=0, second=0).isoformat()
            existing_alerts_res = await db.table("customer_alerts").select(
                "customer_key,alert_type"
            ).eq("org_id", self.tenant_id).gte("created_at", today_start).eq("resolved", False).execute()
            existing_set = {
                (r["customer_key"], r["alert_type"])
                for r in (existing_alerts_res.data or [])
            }
            new_alerts = [
                a for a in alert_rows
                if (a["customer_key"], a["alert_type"]) not in existing_set
            ]
            if new_alerts:
                await db.table("customer_alerts").insert(new_alerts).execute()

        logger.info(
            "Health compute (tenant=%s): %d scores, %d alertas",
            self.tenant_id, len(health_rows), len(alert_rows),
        )
        return {"computed": len(health_rows), "alerts": len(alert_rows)}

    def _build_alert_description(
        self, sig: dict, rfm: Any, churn: Any, lead: dict
    ) -> str:
        t = sig["type"]
        name = lead.get("name", "Cliente")
        if t == "no_activity":
            return f"{name} não apresenta nenhuma atividade registrada. Considere uma abordagem proativa para reengajar."
        if t == "champion_at_risk":
            seg = rfm.get("rfm_segment", "") if rfm else ""
            prob = float(churn["churn_probability"]) * 100 if churn else 0
            return f"{name} é um cliente {seg} mas apresenta {prob:.0f}% de probabilidade de churn. Intervenção imediata recomendada."
        if t == "churn_risk":
            prob = float(churn["churn_probability"]) * 100 if churn else 0
            return f"{name} tem {prob:.0f}% de probabilidade de churn calculada pelo modelo preditivo."
        if t == "deal_stalled":
            return f"{name} está em etapa de Proposta há mais de 14 dias sem avanço. Verifique objeções ou necessidade de follow-up."
        if t == "revenue_drop":
            return f"Queda de receita detectada para {name}. Revise histórico de compras."
        return sig["label"]
