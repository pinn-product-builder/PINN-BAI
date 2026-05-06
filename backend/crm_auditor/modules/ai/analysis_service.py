"""Monta contexto, chama LLM e persiste crm_analysis_reports."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from crm_auditor.core.config import get_auditor_settings
from crm_auditor.modules.ai import llm_client, prompts
from crm_auditor.modules.analytics.metrics_service import MetricsService
from crm_auditor.modules.analytics.report_builder import build_consolidated_json

logger = logging.getLogger(__name__)


def _fallback_report(ctx: dict[str, Any]) -> dict[str, Any]:
    scores = ctx.get("scores") or {}
    overview = ctx.get("overview") or {}
    op = int(scores.get("operation_score_0_100") or 0)
    return {
        "executive_summary": (
            f"Resumo automático (sem LLM): {overview.get('total_active_leads', 0)} oportunidades abertas, "
            f"valor em aberto R$ {overview.get('total_open_pipeline_value', 0)}. "
            f"Score operação: {op}/100. Configure OPENAI_API_KEY para diagnóstico narrativo completo."
        ),
        "operation_score": op,
        "main_bottlenecks": [],
        "commercial_risks": [],
        "crm_hygiene_issues": [],
        "urgent_opportunities": [],
        "owner_analysis": [],
        "stage_analysis": [],
        "recommendations_next_7_days": [
            "Atribuir responsáveis a todas as oportunidades abertas sem dono.",
            "Revisar tarefas vencidas e reagendar follow-ups.",
            "Corrigir campos de valor e origem nas oportunidades abertas.",
        ],
    }


class AnalysisService:
    def __init__(self, db: Any) -> None:
        self.db = db
        self.metrics = MetricsService(db)
        self.settings = get_auditor_settings()

    async def generate_and_persist(self, tenant_id: str) -> dict[str, Any]:
        ctx = await build_consolidated_json(self.db, tenant_id)
        payload = json.dumps(ctx, ensure_ascii=False, default=str)[:120_000]
        user_msg = prompts.USER_TEMPLATE.format(payload=payload)

        model_used = "fallback-local"
        report: dict[str, Any]

        if self.settings.openai_api_key:
            try:
                report = await llm_client.generate_json_report_relaxed(
                    prompts.SYSTEM_PROMPT,
                    user_msg,
                )
                model_used = self.settings.openai_model
            except Exception as exc:
                logger.exception("Falha LLM, usando fallback: %s", exc)
                report = _fallback_report(ctx)
                model_used = f"fallback-after-error:{self.settings.openai_model}"
        else:
            logger.info("OPENAI_API_KEY ausente — relatório determinístico (tenant=%s)", tenant_id)
            report = _fallback_report(ctx)

        op_score = report.get("operation_score")
        if op_score is None:
            op_score = ctx.get("scores", {}).get("operation_score_0_100")

        digest = str(hash(payload))[:16]
        insert = await (
            self.db.table("crm_analysis_reports")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "operation_score": op_score,
                    "model_used": model_used,
                    "report": report,
                    "input_digest": digest,
                }
            )
            .select("id")
            .execute()
        )
        rows = insert.data or []
        report_id = rows[0]["id"] if rows else None
        logger.info("Relatório IA salvo tenant=%s id=%s model=%s", tenant_id, report_id, model_used)
        out = dict(report)
        out["report_id"] = report_id
        out["model_used"] = model_used
        return out

    async def list_reports(self, tenant_id: str, limit: int = 20) -> list[dict[str, Any]]:
        res = await (
            self.db.table("crm_analysis_reports")
            .select("id,operation_score,model_used,created_at,report")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return list(res.data or [])
