"""
Painel único de auditoria CRM: KPIs, o que está certo, o que está errado, amostras e catálogo estendido.
"""
from __future__ import annotations

from typing import Any

from crm_auditor.modules.analytics.metrics_service import MetricsService
from crm_auditor.modules.analytics.report_builder import build_consolidated_json


def _append_gap(
    gaps: list[dict[str, Any]],
    *,
    title: str,
    detail: str,
    severity: str,
    category: str,
) -> None:
    gaps.append(
        {
            "title": title,
            "detail": detail,
            "severity": severity,
            "category": category,
        }
    )


def _append_strength(
    strengths: list[dict[str, Any]],
    *,
    title: str,
    detail: str,
    category: str,
) -> None:
    strengths.append({"title": title, "detail": detail, "category": category})


class AuditDashboardService:
    def __init__(self, db: Any) -> None:
        self.db = db
        self.metrics = MetricsService(db)

    async def build_dashboard(self, tenant_id: str) -> dict[str, Any]:
        ctx = await build_consolidated_json(self.db, tenant_id)
        overview = ctx.get("overview") or {}
        scores = ctx.get("scores") or {}
        dq_score = int(scores.get("crm_data_quality_0_100") or 0)
        op_score = int(scores.get("operation_score_0_100") or 0)

        overdue = await self.metrics.get_overdue_tasks(tenant_id)
        no_action = await self.metrics.get_no_next_action_leads(tenant_id)

        last_snap = await (
            self.db.table("crm_snapshots")
            .select("payload,created_at")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        snap_rows = last_snap.data or []
        last_payload = (snap_rows[0].get("payload") or {}) if snap_rows else {}
        last_sync_at = snap_rows[0].get("created_at") if snap_rows else None

        reports = await (
            self.db.table("crm_analysis_reports")
            .select("id,operation_score,report,created_at,model_used")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rep_row = (reports.data or [None])[0]

        breakdown = ctx.get("data_quality") or {}
        forecast = breakdown.get("forecast") or {}

        eng = await self._load_engagement(tenant_id)

        strengths, gaps, checklist = self._derive_findings(
            overview=overview,
            dq_score=dq_score,
            op_score=op_score,
            breakdown=breakdown,
            forecast=forecast,
            ctx=ctx,
            overdue_count=len(overdue),
            no_action_count=len(no_action),
            engagement_counts=eng.get("counts") or {},
        )

        return {
            "tenant_id": tenant_id,
            "generated_at": ctx.get("generated_at"),
            "scores": {
                "crm_data_quality_0_100": dq_score,
                "operation_0_100": op_score,
            },
            "last_sync_at": last_sync_at,
            "sync_stats": last_payload.get("stats"),
            "extended_catalog": last_payload.get("extended_catalog"),
            "overview": overview,
            "pipeline_health": ctx.get("pipeline_health"),
            "owners": ctx.get("owner_performance"),
            "stage_distribution": ctx.get("stage_distribution"),
            "funnel_velocity": ctx.get("funnel_velocity"),
            "lost_reasons": ctx.get("lost_reasons_top"),
            "data_quality_breakdown": breakdown,
            "samples": {
                "stuck_leads": (ctx.get("stuck_leads_sample") or [])[:15],
                "no_next_action_leads": no_action[:15],
                "overdue_tasks": overdue[:15],
                "counts": {
                    "stuck_leads": ctx.get("stuck_leads_count"),
                    "no_next_action_leads": ctx.get("no_next_action_count"),
                    "overdue_tasks": ctx.get("overdue_tasks_count"),
                },
            },
            "engagement": eng,
            "strengths": strengths,
            "gaps_and_risks": gaps,
            "checklist": checklist,
            "latest_ai_report": rep_row,
        }

    def _derive_findings(
        self,
        *,
        overview: dict[str, Any],
        dq_score: int,
        op_score: int,
        breakdown: dict[str, Any],
        forecast: dict[str, Any],
        ctx: dict[str, Any],
        overdue_count: int,
        no_action_count: int,
        engagement_counts: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
        strengths: list[dict[str, Any]] = []
        gaps: list[dict[str, Any]] = []
        checklist: list[dict[str, Any]] = []

        active = int(overview.get("total_active_leads") or 0)
        total = int(overview.get("total_leads_all_status") or 0)
        won = int(overview.get("total_won_leads") or 0)
        lost = int(overview.get("total_lost_leads") or 0)
        open_val = float(overview.get("total_open_pipeline_value") or 0)
        no_owner = int(overview.get("open_leads_without_owner") or 0)
        no_src = int(overview.get("open_leads_without_source") or 0)
        no_val = int(overview.get("open_leads_without_value") or 0)
        n_notes = int(engagement_counts.get("notes") or 0)
        n_events = int(engagement_counts.get("events") or 0)
        n_talks = int(engagement_counts.get("conversations") or 0)

        checklist.append(
            {
                "id": "sync_ok",
                "label": "Existem oportunidades sincronizadas do Kommo",
                "ok": total > 0,
                "hint": "Execute um sync (Composio ou token direto) e confira crm_sync_runs." if total == 0 else None,
            }
        )
        checklist.append(
            {
                "id": "pipeline_active",
                "label": "Há oportunidades em aberto no funil",
                "ok": active > 0,
                "hint": "Normal se o funil estiver vazio após fechamentos; verifique no Kommo." if active == 0 else None,
            }
        )
        checklist.append(
            {
                "id": "owners",
                "label": "Todas as abertas têm responsável",
                "ok": active == 0 or no_owner == 0,
                "hint": f"{no_owner} sem dono." if no_owner else None,
            }
        )
        checklist.append(
            {
                "id": "sources",
                "label": "Oportunidades abertas com origem preenchida",
                "ok": active == 0 or no_src == 0,
                "hint": f"{no_src} sem origem." if no_src else None,
            }
        )
        checklist.append(
            {
                "id": "values",
                "label": "Oportunidades abertas com valor",
                "ok": active == 0 or no_val == 0,
                "hint": f"{no_val} com valor zerado/ausente." if no_val else None,
            }
        )
        checklist.append(
            {
                "id": "tasks_overdue",
                "label": "Sem tarefas vencidas pendentes (ou volume aceitável)",
                "ok": overdue_count == 0,
                "hint": f"{overdue_count} tarefas vencidas." if overdue_count else None,
            }
        )
        checklist.append(
            {
                "id": "next_action",
                "label": "Oportunidades abertas com próxima ação (tarefa)",
                "ok": no_action_count == 0,
                "hint": f"{no_action_count} sem tarefa aberta vinculada." if no_action_count else None,
            }
        )
        checklist.append(
            {
                "id": "data_quality_score",
                "label": "Score de higiene do CRM ≥ 60",
                "ok": dq_score >= 60,
                "hint": f"Score atual: {dq_score}/100." if dq_score < 60 else None,
            }
        )
        checklist.append(
            {
                "id": "operation_score",
                "label": "Score operacional ≥ 60",
                "ok": op_score >= 60,
                "hint": f"Score atual: {op_score}/100." if op_score < 60 else None,
            }
        )
        checklist.append(
            {
                "id": "engagement_history",
                "label": "Histórico de engajamento (notas ou eventos) sincronizado",
                "ok": total == 0 or (n_notes + n_events) > 0,
                "hint": (
                    "Amplie o sync (Composio/API) ou permissões — notas e eventos vieram vazios."
                    if total > 0 and (n_notes + n_events) == 0
                    else None
                ),
            }
        )

        dup_email = int(breakdown.get("duplicate_email_keys") or 0)
        c_total = int(breakdown.get("contacts_total") or 0)
        checklist.append(
            {
                "id": "dup_contacts",
                "label": "Sem duplicidade óbvia de e-mail em contatos",
                "ok": dup_email == 0,
                "hint": f"{dup_email} e-mails duplicados." if dup_email else None,
            }
        )

        pct_miss = float(forecast.get("pct_open_missing_value") or 0)
        checklist.append(
            {
                "id": "forecast",
                "label": "Maioria das abertas com valor (forecast)",
                "ok": active == 0 or pct_miss < 30,
                "hint": f"{pct_miss:.0f}% das abertas sem valor." if pct_miss >= 30 else None,
            }
        )

        if total > 0:
            _append_strength(
                strengths,
                title="Base de oportunidades carregada",
                detail=f"{total} registros (abertas: {active}, ganhas: {won}, perdidas: {lost}).",
                category="dados",
            )
        if open_val > 0:
            _append_strength(
                strengths,
                title="Valor em pipeline acompanhado",
                detail=f"R$ {open_val:,.2f} em oportunidades abertas.",
                category="receita",
            )
        if won > 0:
            _append_strength(
                strengths,
                title="Histórico de ganhos",
                detail=f"{won} oportunidades ganhas registradas.",
                category="performance",
            )
        if dq_score >= 75:
            _append_strength(
                strengths,
                title="Boa higiene de dados",
                detail=f"Score de qualidade {dq_score}/100.",
                category="dados",
            )
        if overdue_count == 0 and active > 0:
            _append_strength(
                strengths,
                title="Disciplina de tarefas",
                detail="Nenhuma tarefa vencida pendente no recorte sincronizado.",
                category="execução",
            )
        if n_notes >= 50:
            _append_strength(
                strengths,
                title="Volume relevante de notas",
                detail=f"{n_notes} notas sincronizadas — bom sinal de registro de interações.",
                category="engajamento",
            )
        if n_talks >= 5:
            _append_strength(
                strengths,
                title="Conversas ativas no canal",
                detail=f"{n_talks} threads de conversa no recorte.",
                category="engajamento",
            )

        if no_owner > 0:
            _append_gap(
                gaps,
                title="Oportunidades sem responsável",
                detail=f"{no_owner} em aberto sem vendedor — risco de abandono.",
                severity="high",
                category="processo",
            )
        if no_action_count > 0:
            _append_gap(
                gaps,
                title="Abertas sem próxima tarefa",
                detail=f"{no_action_count} oportunidades sem tarefa em aberto.",
                severity="high",
                category="execução",
            )
        if overdue_count > 0:
            _append_gap(
                gaps,
                title="Tarefas atrasadas",
                detail=f"{overdue_count} tarefas vencidas e não concluídas.",
                severity="high",
                category="disciplina",
            )
        if int(ctx.get("stuck_leads_count") or 0) > 0:
            _append_gap(
                gaps,
                title="Oportunidades paradas",
                detail=f"{ctx.get('stuck_leads_count')} sem atualização há mais de {self.metrics.settings.stuck_lead_days} dias.",
                severity="medium",
                category="velocidade",
            )
        if no_src > 0:
            _append_gap(
                gaps,
                title="Origem do lead ausente",
                detail=f"{no_src} abertas sem origem — prejudica atribuição de marketing.",
                severity="medium",
                category="dados",
            )
        if no_val > 0:
            _append_gap(
                gaps,
                title="Forecast incompleto",
                detail=f"{no_val} abertas sem valor ou zeradas.",
                severity="medium",
                category="forecast",
            )
        if dup_email > 0:
            _append_gap(
                gaps,
                title="Contatos com e-mail duplicado",
                detail=f"{dup_email} chaves de e-mail repetidas.",
                severity="medium",
                category="higiene",
            )
        if c_total > 0:
            ne = int(breakdown.get("contacts_without_email") or 0)
            if ne / c_total > 0.25:
                _append_gap(
                    gaps,
                    title="Muitos contatos sem e-mail",
                    detail=f"{ne} de {c_total} contatos sem e-mail.",
                    severity="low",
                    category="dados",
                )
        if active > 30 and n_notes < 10:
            _append_gap(
                gaps,
                title="Poucas notas para o volume de oportunidades",
                detail=f"{active} abertas mas só {n_notes} notas no sync — risco de histórico superficial.",
                severity="low",
                category="engajamento",
            )

        return strengths, gaps, checklist

    async def _load_engagement(self, tenant_id: str) -> dict[str, Any]:
        """Contagens e amostras de notas / eventos / conversas (último sync)."""
        counts: dict[str, int] = {"notes": 0, "events": 0, "conversations": 0}
        for table, key in (
            ("crm_auditor_notes", "notes"),
            ("crm_auditor_events", "events"),
            ("crm_auditor_conversations", "conversations"),
        ):
            try:
                r = await (
                    self.db.table(table)
                    .select("id", count="exact")
                    .eq("tenant_id", tenant_id)
                    .execute()
                )
                counts[key] = int(r.count or 0)
            except Exception:
                counts[key] = 0

        samples: dict[str, Any] = {"recent_notes": [], "recent_events": [], "recent_conversations": []}
        try:
            n = await (
                self.db.table("crm_auditor_notes")
                .select("scope_entity_type,entity_external_id,content_preview,note_at")
                .eq("tenant_id", tenant_id)
                .order("note_at", desc=True)
                .limit(10)
                .execute()
            )
            samples["recent_notes"] = n.data or []
        except Exception:
            pass
        try:
            e = await (
                self.db.table("crm_auditor_events")
                .select("event_type,entity_type,entity_external_id,occurred_at")
                .eq("tenant_id", tenant_id)
                .order("occurred_at", desc=True)
                .limit(10)
                .execute()
            )
            samples["recent_events"] = e.data or []
        except Exception:
            pass
        try:
            c = await (
                self.db.table("crm_auditor_conversations")
                .select("contact_external_id,status,last_message_preview,last_message_at")
                .eq("tenant_id", tenant_id)
                .order("last_message_at", desc=True)
                .limit(10)
                .execute()
            )
            samples["recent_conversations"] = c.data or []
        except Exception:
            pass

        return {"counts": counts, "samples": samples}
