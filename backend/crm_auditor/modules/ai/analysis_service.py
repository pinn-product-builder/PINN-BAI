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

# ─────────────────────────────────────────────────────────────────────────────
# Helpers de formatação
# ─────────────────────────────────────────────────────────────────────────────

def _pct(a: int | float, b: int | float) -> float:
    if not b:
        return 0.0
    return round(100.0 * a / b, 1)


def _fmt_brl(v: float | None) -> str:
    if v is None:
        return "—"
    if v >= 1_000_000:
        return f"R$ {v / 1_000_000:.1f}M"
    if v >= 1_000:
        return f"R$ {v / 1_000:.0f}k"
    return f"R$ {v:.0f}"


def _severity(pct: float, thresholds: tuple[float, float, float] = (50, 30, 15)) -> str:
    crit, high, med = thresholds
    if pct >= crit:
        return "critical"
    if pct >= high:
        return "high"
    if pct >= med:
        return "medium"
    return "low"


# ─────────────────────────────────────────────────────────────────────────────
# Fallback determinístico — completo e analítico
# ─────────────────────────────────────────────────────────────────────────────

def _build_deterministic_report(ctx: dict[str, Any]) -> dict[str, Any]:  # noqa: C901
    """
    Gera relatório de auditoria completo sem LLM.
    Usa todos os dados do contexto consolidado para produzir análise real.
    """
    ov = ctx.get("overview") or {}
    scores = ctx.get("scores") or {}
    pipeline_health = ctx.get("pipeline_health") or []
    owner_perf = ctx.get("owner_performance") or []
    stuck_count = int(ctx.get("stuck_leads_count") or 0)
    stuck_sample = ctx.get("stuck_leads_sample") or []
    no_action = int(ctx.get("no_next_action_count") or 0)
    overdue = int(ctx.get("overdue_tasks_count") or 0)
    lost_reasons_raw = ctx.get("lost_reasons_top") or []
    stage_dist = ctx.get("stage_distribution") or []
    dq = ctx.get("data_quality") or {}
    funnel_vel = ctx.get("funnel_velocity") or []

    op_score = int(scores.get("operation_score_0_100") or scores.get("operation_0_100") or 0)
    dq_score = int(scores.get("crm_data_quality_0_100") or 0)

    total_open = int(ov.get("total_active_leads") or 0)
    total_won = int(ov.get("total_won_leads") or 0)
    total_lost = int(ov.get("total_lost_leads") or 0)
    total_all = int(ov.get("total_leads_all_status") or 0)
    open_value = float(ov.get("total_open_pipeline_value") or 0)
    no_owner = int(ov.get("open_leads_without_owner") or 0)
    no_source = int(ov.get("open_leads_without_source") or 0)
    no_value = int(ov.get("open_leads_without_value") or 0)

    win_rate = _pct(total_won, total_all)
    loss_rate = _pct(total_lost, total_all)
    stuck_pct = _pct(stuck_count, total_open)
    no_action_pct = _pct(no_action, total_open)
    no_value_pct = _pct(no_value, total_open)
    no_source_pct = _pct(no_source, total_open)

    contacts_total = int(dq.get("contacts_total") or 0)
    no_email = int(dq.get("contacts_without_email") or 0)
    no_phone = int(dq.get("contacts_without_phone") or 0)
    dup_emails = int(dq.get("duplicate_email_keys") or 0)
    forecast_data = dq.get("forecast") or {}
    forecast_missing_pct = float(forecast_data.get("pct_open_missing_value") or no_value_pct)

    # ── Overall verdict ──────────────────────────────────────────────────────
    if op_score < 25:
        verdict = "critical"
    elif op_score < 50:
        verdict = "warning"
    elif op_score < 70:
        verdict = "moderate"
    else:
        verdict = "healthy"

    # ── Executive summary ────────────────────────────────────────────────────
    summary_parts = []

    # Parágrafo 1 — situação geral
    p1 = (
        f"A operação comercial registra {total_all} oportunidades no CRM Kommo, sendo "
        f"{total_open} abertas ({_pct(total_open, total_all):.0f}% do total), "
        f"{total_won} ganhas ({win_rate:.1f}%) e {total_lost} perdidas ({loss_rate:.1f}%). "
        f"O valor total em pipeline aberto é {_fmt_brl(open_value)}. "
    )
    if win_rate == 0:
        p1 += "A taxa de ganho zerada é um sinal de alerta crítico — nenhuma oportunidade foi convertida no período capturado. "
    elif win_rate < 5:
        p1 += f"A taxa de ganho de {win_rate:.1f}% está muito abaixo de referências de mercado (tipicamente 15–30%). "
    summary_parts.append(p1)

    # Parágrafo 2 — disciplina operacional
    p2_parts = []
    if stuck_pct >= 50:
        p2_parts.append(
            f"{stuck_count} de {total_open} oportunidades abertas ({stuck_pct:.0f}%) estão paradas "
            f"sem nenhuma atualização — este é o problema mais grave da operação."
        )
    elif stuck_pct >= 25:
        p2_parts.append(
            f"{stuck_count} oportunidades ({stuck_pct:.0f}% das abertas) estão paradas, "
            f"indicando falha sistemática de follow-up."
        )
    if no_action_pct >= 50:
        p2_parts.append(
            f"{no_action} leads ({no_action_pct:.0f}% das abertas) não têm nenhuma tarefa ou "
            f"próxima ação cadastrada — a equipe está operando sem roteiro."
        )
    elif no_action > 0:
        p2_parts.append(
            f"{no_action} oportunidades sem próxima ação definida comprometem o ritmo de follow-up."
        )
    if overdue > 0:
        p2_parts.append(f"{overdue} tarefas vencidas aguardam resolução.")
    if p2_parts:
        summary_parts.append("Disciplina operacional: " + " ".join(p2_parts))

    # Parágrafo 3 — higiene de dados
    p3_parts = []
    if no_value_pct >= 30:
        p3_parts.append(
            f"{no_value} oportunidades abertas ({no_value_pct:.0f}%) não têm valor monetário — "
            f"o forecast de {_fmt_brl(open_value)} está subestimado."
        )
    if no_source_pct >= 30:
        p3_parts.append(
            f"{no_source} leads ({no_source_pct:.0f}%) sem origem cadastrada inviabilizam análise de ROI por canal."
        )
    if no_owner > 0:
        p3_parts.append(f"{no_owner} oportunidades sem responsável designado — risco de abandono.")
    if no_email > 0 and contacts_total > 0:
        p3_parts.append(
            f"{no_email} de {contacts_total} contatos ({_pct(no_email, contacts_total):.0f}%) sem e-mail."
        )
    if dup_emails > 0:
        p3_parts.append(f"{dup_emails} grupos de contatos com e-mail duplicado detectados.")
    if p3_parts:
        summary_parts.append("Higiene de dados: " + " ".join(p3_parts))

    # Parágrafo 4 — perdas
    lost_without = 0
    lost_top_names: list[tuple[str, int]] = []
    for r in lost_reasons_raw:
        name = str(r.get("lost_reason") or "(não informado)")
        cnt = int(r.get("cnt") or 0)
        if name == "(não informado)":
            lost_without = cnt
        else:
            lost_top_names.append((name, cnt))
    if total_lost > 0:
        p4 = f"Das {total_lost} oportunidades perdidas, "
        if lost_without > 0:
            p4 += f"{lost_without} ({_pct(lost_without, total_lost):.0f}%) não têm motivo de perda registrado, "
            p4 += "o que impede análise de causa-raiz e ajustes estratégicos. "
        if lost_top_names:
            top = lost_top_names[0]
            p4 += f"O principal motivo declarado é '{top[0]}' ({top[1]} ocorrências). "
        summary_parts.append(p4)

    # Parágrafo 5 — score e veredito
    verdict_text = {
        "critical": "CRÍTICO — intervenção imediata necessária",
        "warning": "EM ALERTA — atenção urgente requerida",
        "moderate": "MODERADO — há problemas relevantes a corrigir",
        "healthy": "SAUDÁVEL — manutenção e evolução contínua",
    }
    p5 = (
        f"O score geral da operação é {op_score}/100 (higiene: {dq_score}/100), "
        f"classificado como {verdict_text[verdict]}. "
        f"As prioridades detalhadas estão no plano de ação abaixo."
    )
    summary_parts.append(p5)

    executive_summary = "\n\n".join(summary_parts)

    # ── Funnel analysis ──────────────────────────────────────────────────────
    pipeline_map: dict[str, dict[str, Any]] = {}
    for row in pipeline_health:
        pid = str(row.get("pipeline_external_id") or "")
        pname = str(row.get("pipeline_name") or pid or "Pipeline desconhecido")
        if pid not in pipeline_map:
            pipeline_map[pid] = {
                "pipeline_name": pname,
                "leads_open": 0,
                "leads_won": 0,
                "leads_lost": 0,
                "total_value": 0.0,
                "stages": [],
            }
        pipeline_map[pid]["leads_open"] += int(row.get("open_leads") or 0)
        pipeline_map[pid]["leads_won"] += int(row.get("won_leads") or 0)
        pipeline_map[pid]["leads_lost"] += int(row.get("lost_leads") or 0)
        pipeline_map[pid]["total_value"] += float(row.get("open_pipeline_value") or 0)
        if row.get("stage_name"):
            pipeline_map[pid]["stages"].append(row)

    funnel_analysis = []
    for pid, pdata in pipeline_map.items():
        p_open = pdata["leads_open"]
        p_won = pdata["leads_won"]
        p_lost = pdata["leads_lost"]
        p_total = p_open + p_won + p_lost
        p_value = pdata["total_value"]
        p_conv = _pct(p_won, p_total) if p_total else None
        stages_sorted = sorted(pdata["stages"], key=lambda x: int(x.get("open_leads") or 0), reverse=True)
        bottleneck = stages_sorted[0].get("stage_name") if stages_sorted else None

        problems = []
        if p_conv is not None and p_conv == 0 and p_won == 0 and p_total > 0:
            problems.append(f"Taxa de conversão zerada — nenhuma venda registrada neste funil ({p_total} leads no total).")
        elif p_conv is not None and p_conv < 5:
            problems.append(f"Taxa de conversão muito baixa: {p_conv:.1f}%.")

        if p_open > 0 and p_value == 0:
            problems.append(f"Valor financeiro zerado em {p_open} oportunidades abertas — forecast inviável.")
        elif p_open > 0 and p_value > 0:
            avg_ticket = p_value / p_open
            if avg_ticket < 100:
                problems.append(f"Ticket médio muito baixo: {_fmt_brl(avg_ticket)} por oportunidade.")

        if bottleneck and p_open > 0:
            btk_count = int(stages_sorted[0].get("open_leads") or 0)
            btk_pct = _pct(btk_count, p_open)
            if btk_pct >= 40:
                problems.append(
                    f"Gargalo na etapa '{bottleneck}': {btk_count} leads ({btk_pct:.0f}% do funil) concentrados sem avançar."
                )

        if not problems and p_open == 0:
            problems.append("Nenhuma oportunidade aberta neste funil — verificar se está ativo.")

        # Severity
        if p_conv is not None and p_conv == 0 and p_total > 10:
            sev = "critical"
        elif len(problems) >= 2:
            sev = "high"
        elif len(problems) == 1:
            sev = "medium"
        else:
            sev = "low"

        rec_parts = []
        if p_conv == 0:
            rec_parts.append("Auditar os critérios de qualificação e verificar se há oportunidades mal classificadas.")
        if bottleneck and stages_sorted and _pct(int(stages_sorted[0].get("open_leads") or 0), p_open) >= 40:
            rec_parts.append(f"Realizar reunião de funil focada em liberar a etapa '{bottleneck}'.")
        if not rec_parts:
            rec_parts.append("Monitorar métricas de conversão e revisar cadência de follow-up.")

        funnel_analysis.append({
            "pipeline_name": pdata["pipeline_name"],
            "leads_open": p_open,
            "total_value": round(p_value, 2),
            "conversion_rate": p_conv,
            "problems": problems if problems else ["Sem problemas críticos detectados neste funil."],
            "bottleneck_stage": bottleneck,
            "severity": sev,
            "recommendation": " ".join(rec_parts),
        })

    # ── Main bottlenecks ─────────────────────────────────────────────────────
    main_bottlenecks = []

    if stuck_pct >= 90:
        main_bottlenecks.append({
            "title": "Colapso total do pipeline — quase todas as oportunidades estão paradas",
            "detail": (
                f"{stuck_count} de {total_open} oportunidades abertas ({stuck_pct:.0f}%) estão "
                f"sem atualização. Isso indica ausência total de processo de follow-up ativo ou "
                f"leads sendo abertos e nunca trabalhados."
            ),
            "metric": f"{stuck_count} leads parados de {total_open} abertas",
            "severity": "critical",
            "root_cause": "Ausência de cadência de follow-up definida e/ou leads gerados em massa sem capacidade de atendimento.",
            "financial_impact": f"Pipeline de {_fmt_brl(open_value)} em risco de deterioração total por inatividade.",
        })
    elif stuck_pct >= 50:
        main_bottlenecks.append({
            "title": "Maioria das oportunidades abertas está parada",
            "detail": (
                f"{stuck_count} leads ({stuck_pct:.0f}% das abertas) sem atualização, "
                f"indicando falha sistemática de acompanhamento."
            ),
            "metric": f"{stuck_count}/{total_open} leads parados ({stuck_pct:.0f}%)",
            "severity": "critical",
            "root_cause": "Falta de rotina de follow-up ou responsáveis com carga excessiva.",
            "financial_impact": f"{_fmt_brl(open_value * stuck_pct / 100)} em risco imediato de perda por abandono.",
        })
    elif stuck_count > 0:
        main_bottlenecks.append({
            "title": "Leads parados sem follow-up",
            "detail": f"{stuck_count} oportunidades ({stuck_pct:.0f}% das abertas) sem atualização recente.",
            "metric": f"{stuck_count} leads parados",
            "severity": _severity(stuck_pct),
            "root_cause": "Follow-up irregular ou gestão de pipeline inconsistente.",
            "financial_impact": "Risco de perda de oportunidades por esquecimento ou demora.",
        })

    if no_action_pct >= 80:
        main_bottlenecks.append({
            "title": "Colapso de disciplina: equipe opera sem próxima ação",
            "detail": (
                f"{no_action} de {total_open} oportunidades abertas ({no_action_pct:.0f}%) "
                f"não têm nenhuma tarefa ou próxima ação cadastrada no CRM. "
                f"A equipe está trabalhando fora do sistema, perdendo rastreabilidade total."
            ),
            "metric": f"{no_action}/{total_open} sem próxima ação ({no_action_pct:.0f}%)",
            "severity": "critical",
            "root_cause": "CRM usado apenas como repositório, não como ferramenta de gestão de processo.",
            "financial_impact": "Impossível prever receita, identificar oportunidades quentes ou cobrar a equipe.",
        })
    elif no_action > 0:
        main_bottlenecks.append({
            "title": "Oportunidades sem próxima ação definida",
            "detail": f"{no_action} leads sem tarefa cadastrada — risco de esquecimento.",
            "metric": f"{no_action} leads ({no_action_pct:.0f}%)",
            "severity": _severity(no_action_pct, (50, 25, 10)),
            "root_cause": "Falta de disciplina ou protocolo de follow-up.",
            "financial_impact": "Oportunidades sem próxima ação têm 3–5× mais chance de ser esquecidas.",
        })

    if no_value_pct >= 50:
        main_bottlenecks.append({
            "title": "Forecast inviável — maioria das oportunidades sem valor",
            "detail": (
                f"{no_value} de {total_open} oportunidades abertas ({no_value_pct:.0f}%) "
                f"têm valor zerado. O pipeline de {_fmt_brl(open_value)} está subestimado e "
                f"o forecast de receita é não confiável."
            ),
            "metric": f"{no_value} oportunidades sem valor ({no_value_pct:.0f}%)",
            "severity": _severity(no_value_pct),
            "root_cause": "Leads criados sem preenchimento obrigatório de valor ou integração de entrada que não captura ticket.",
            "financial_impact": f"Receita previsível real pode ser muito maior que {_fmt_brl(open_value)} declarado.",
        })

    if no_source_pct >= 50:
        main_bottlenecks.append({
            "title": "Origem dos leads não rastreada — ROI de marketing invisível",
            "detail": (
                f"{no_source} de {total_open} oportunidades ({no_source_pct:.0f}%) "
                f"não têm canal de origem cadastrado. "
                f"É impossível saber quais campanhas ou canais geram receita."
            ),
            "metric": f"{no_source}/{total_open} sem origem ({no_source_pct:.0f}%)",
            "severity": _severity(no_source_pct),
            "root_cause": "Integrações de captação sem UTM ou campo de origem não preenchido pelos SDRs.",
            "financial_impact": "Orçamento de marketing alocado sem evidência de retorno.",
        })

    if win_rate == 0 and total_all > 20:
        main_bottlenecks.append({
            "title": "Taxa de conversão zerada — nenhuma venda registrada",
            "detail": (
                f"Com {total_all} leads no CRM e {total_won} ganhos, a taxa de conversão é 0%. "
                f"Pode indicar: leads sem qualificação, problemas no processo de fechamento, "
                f"oportunidades ganhas não atualizadas no CRM, ou período de análise curto."
            ),
            "metric": f"0 de {total_all} leads convertidos",
            "severity": "critical",
            "root_cause": "Processo de fechamento inexistente, qualificação inadequada ou CRM não atualizado após venda.",
            "financial_impact": f"Pipeline de {_fmt_brl(open_value)} sem nenhuma materialização de receita registrada.",
        })

    if lost_without > 0 and total_lost > 0:
        lost_no_reason_pct = _pct(lost_without, total_lost)
        main_bottlenecks.append({
            "title": "Perdas sem motivo registrado",
            "detail": (
                f"{lost_without} de {total_lost} oportunidades perdidas ({lost_no_reason_pct:.0f}%) "
                f"não têm motivo de perda cadastrado. "
                f"Sem esse dado, é impossível identificar padrões e corrigir o processo."
            ),
            "metric": f"{lost_without} perdas sem motivo ({lost_no_reason_pct:.0f}%)",
            "severity": _severity(lost_no_reason_pct, (50, 30, 15)),
            "root_cause": "Vendedores não preenchem o campo de motivo ao fechar como perdido.",
            "financial_impact": "Impossível calcular o custo real das perdas e ajustar a estratégia.",
        })

    if dup_emails >= 10:
        main_bottlenecks.append({
            "title": "Base de contatos poluída com duplicatas",
            "detail": (
                f"{dup_emails} grupos de e-mails duplicados detectados na base de contatos. "
                f"Isso gera comunicações repetidas, métricas distorcidas e confusão de responsabilidade."
            ),
            "metric": f"{dup_emails} grupos duplicados",
            "severity": "high" if dup_emails >= 50 else "medium",
            "root_cause": "Ausência de deduplicação na entrada de leads ou múltiplas fontes de captação sem merge.",
            "financial_impact": "Clientes recebendo comunicações duplicadas danifica a reputação da marca.",
        })

    # Garantir pelo menos um bottleneck
    if not main_bottlenecks:
        main_bottlenecks.append({
            "title": "Operação em bom estado geral",
            "detail": "Nenhum gargalo crítico detectado neste snapshot. Foco em melhorias incrementais.",
            "metric": f"Score {op_score}/100",
            "severity": "low",
            "root_cause": "—",
            "financial_impact": "—",
        })

    # ── Data hygiene ─────────────────────────────────────────────────────────
    hygiene_issues = []
    if no_value_pct > 0:
        hygiene_issues.append({
            "title": "Oportunidades sem valor monetário",
            "detail": f"{no_value} de {total_open} oportunidades abertas sem valor — forecast comprometido.",
            "qty": no_value,
            "pct": no_value_pct,
            "impact": "Previsão de receita distorcida, impossível priorizar por ticket.",
            "severity": _severity(no_value_pct),
            "fix": "Tornar campo de valor obrigatório na criação do lead; revisar leads existentes com responsável.",
        })
    if no_source_pct > 0:
        hygiene_issues.append({
            "title": "Leads sem canal de origem",
            "detail": f"{no_source} de {total_open} abertas sem origem.",
            "qty": no_source,
            "pct": no_source_pct,
            "impact": "ROI de marketing invisível; impossível otimizar captação.",
            "severity": _severity(no_source_pct),
            "fix": "Configurar UTMs nas fontes de captação e criar campo obrigatório de origem no CRM.",
        })
    if no_owner > 0:
        hygiene_issues.append({
            "title": "Oportunidades sem responsável",
            "detail": f"{no_owner} leads abertos sem responsável designado.",
            "qty": no_owner,
            "pct": _pct(no_owner, total_open),
            "impact": "Ninguém cobra nem acompanha — risco máximo de abandono.",
            "severity": "critical" if no_owner > 10 else "high",
            "fix": "Configurar regra de atribuição automática ou distribuir manualmente em reunião de pipeline.",
        })
    if contacts_total > 0:
        email_pct = _pct(no_email, contacts_total)
        if no_email > 0:
            hygiene_issues.append({
                "title": "Contatos sem e-mail",
                "detail": f"{no_email} de {contacts_total} contatos sem e-mail cadastrado.",
                "qty": no_email,
                "pct": email_pct,
                "impact": "Alcance por e-mail comprometido — campanhas de nutrição ineficazes.",
                "severity": _severity(email_pct, (60, 40, 20)),
                "fix": "Implementar enriquecimento de dados (ex: Apollo, Clearbit) ou solicitar e-mail no primeiro contato.",
            })
        phone_pct = _pct(no_phone, contacts_total)
        if no_phone > 0:
            hygiene_issues.append({
                "title": "Contatos sem telefone",
                "detail": f"{no_phone} de {contacts_total} contatos sem telefone.",
                "qty": no_phone,
                "pct": phone_pct,
                "impact": "Prospecção ativa comprometida.",
                "severity": _severity(phone_pct, (50, 30, 15)),
                "fix": "Capturar telefone obrigatoriamente nos formulários de entrada.",
            })
    if dup_emails > 0:
        hygiene_issues.append({
            "title": "E-mails duplicados na base de contatos",
            "detail": f"{dup_emails} grupos de contatos com o mesmo e-mail.",
            "qty": dup_emails,
            "pct": _pct(dup_emails, max(1, contacts_total)),
            "impact": "Comunicações duplicadas, métricas de abertura distorcidas, confusão de atribuição.",
            "severity": "high" if dup_emails >= 20 else "medium",
            "fix": "Executar rotina de deduplicação no Kommo; revisar fonte de captação.",
        })

    hygiene_diag_parts = []
    if dq_score < 40:
        hygiene_diag_parts.append(f"Score de higiene {dq_score}/100 — situação crítica.")
    elif dq_score < 60:
        hygiene_diag_parts.append(f"Score de higiene {dq_score}/100 — abaixo do mínimo aceitável.")
    else:
        hygiene_diag_parts.append(f"Score de higiene {dq_score}/100 — razoável mas com pontos a corrigir.")

    if no_value_pct >= 50:
        hygiene_diag_parts.append(f"O problema mais urgente é o forecast: {no_value_pct:.0f}% das abertas sem valor.")
    if no_source_pct >= 50:
        hygiene_diag_parts.append(f"Origem dos leads ausente em {no_source_pct:.0f}% das abertas.")

    data_hygiene = {
        "score_0_100": dq_score,
        "diagnosis": " ".join(hygiene_diag_parts) if hygiene_diag_parts else f"Score de higiene: {dq_score}/100.",
        "issues": hygiene_issues,
    }

    # ── Commercial risks ─────────────────────────────────────────────────────
    commercial_risks = []

    if open_value > 0:
        commercial_risks.append({
            "title": f"Pipeline de {_fmt_brl(open_value)} em risco por inatividade",
            "detail": (
                f"Com {stuck_pct:.0f}% das oportunidades paradas e taxa de conversão de {win_rate:.1f}%, "
                f"o pipeline total de {_fmt_brl(open_value)} corre risco significativo de deterioração. "
                f"Leads parados esfriados raramente convertem sem reaquecimento ativo."
            ),
            "financial_impact": f"Até {_fmt_brl(open_value * min(0.8, stuck_pct / 100))} podem nunca se concretizar.",
            "urgency": "immediate",
        })

    if no_value_pct >= 30:
        commercial_risks.append({
            "title": "Forecast de receita não confiável",
            "detail": (
                f"Com {no_value_pct:.0f}% das oportunidades sem valor, qualquer projeção de receita "
                f"está fundamentalmente distorcida. Decisões de contratação, metas e investimento "
                f"baseadas neste forecast são de alto risco."
            ),
            "financial_impact": "Decisões estratégicas baseadas em dados imprecisos.",
            "urgency": "short_term",
        })

    if win_rate == 0 and total_all > 20:
        commercial_risks.append({
            "title": "Zero retorno sobre investimento em captação",
            "detail": (
                f"Com {total_all} leads no CRM e nenhuma conversão registrada, "
                f"o investimento em captação não está gerando retorno mensurável no sistema."
            ),
            "financial_impact": "Custo de aquisição de cliente (CAC) infinito — falta de dados de conversão.",
            "urgency": "immediate",
        })

    if len(owner_perf) == 1:
        commercial_risks.append({
            "title": "Concentração de pipeline em um único responsável",
            "detail": (
                f"Apenas 1 responsável registrado com volume expressivo. "
                f"Qualquer ausência ou saída desta pessoa coloca todo o pipeline em risco."
            ),
            "financial_impact": f"Risco de perda total de {_fmt_brl(open_value)} em caso de turnover.",
            "urgency": "structural",
        })

    # ── Owner analysis ───────────────────────────────────────────────────────
    owner_analysis = []
    for o in owner_perf:
        o_name = str(o.get("owner_name") or o.get("owner_external_id") or "Desconhecido")
        o_open = int(o.get("open_leads") or 0)
        o_won = int(o.get("won_leads") or 0)
        o_lost = int(o.get("lost_leads") or 0)
        o_value = float(o.get("open_value") or 0)
        o_total = o_open + o_won + o_lost
        o_conv = _pct(o_won, o_total) if o_total else None

        concerns_list = []
        if o_open > 200:
            concerns_list.append(f"Carga excessiva: {o_open} oportunidades abertas para um único responsável.")
        if o_conv is not None and o_conv == 0 and o_total > 10:
            concerns_list.append(f"Taxa de conversão zerada ({o_won} ganhos em {o_total} leads).")
        if o_value == 0 and o_open > 0:
            concerns_list.append("Valor em pipeline zerado — forecast deste responsável inviável.")

        risk_level = "low"
        if len(concerns_list) >= 2 or (o_conv is not None and o_conv == 0 and o_total > 20):
            risk_level = "high"
        elif concerns_list:
            risk_level = "medium"

        assessment = (
            f"{o_name} gerencia {o_open} oportunidades abertas "
            f"(valor: {_fmt_brl(o_value)}), {o_won} ganhas e {o_lost} perdidas. "
        )
        if o_conv is not None:
            assessment += f"Taxa de conversão: {o_conv:.1f}%. "
        if o_open > 100:
            assessment += "Carga operacional elevada — risco de atenção distribuída. "

        owner_analysis.append({
            "owner": o_name,
            "open_leads": o_open,
            "open_value": round(o_value, 2),
            "assessment": assessment,
            "concerns": " ".join(concerns_list) if concerns_list else "Sem preocupações críticas identificadas.",
            "risk_level": risk_level,
        })

    # ── Lost reason analysis ─────────────────────────────────────────────────
    top_reasons_out = []
    for r in lost_reasons_raw:
        name = str(r.get("lost_reason") or "(não informado)")
        cnt = int(r.get("cnt") or 0)
        pct_val = _pct(cnt, max(1, total_lost))
        suggestion = ""
        name_low = name.lower()
        if "orçamento" in name_low or "preco" in name_low or "valor" in name_low or "caro" in name_low:
            suggestion = "Revisar política de desconto e criar proposta de valor mais clara. Treinar equipe em objeções de preço."
        elif "concorr" in name_low:
            suggestion = "Analisar diferenciais vs. concorrentes. Criar battle card e treinar time em posicionamento."
        elif "necessidade" in name_low or "fit" in name_low or "encaixa" in name_low:
            suggestion = "Revisar ICP (perfil de cliente ideal) e critérios de qualificação para reduzir leads fora do perfil."
        elif "tempo" in name_low or "prazo" in name_low:
            suggestion = "Alinhar expectativas de implementação desde o início do processo."
        elif "não informado" in name_low:
            suggestion = "Tornar obrigatório o preenchimento do motivo ao marcar como perdido. Realizar follow-up com cliente para entender razão."
        else:
            suggestion = "Analisar padrão e criar protocolo de reativação para este motivo."

        top_reasons_out.append({
            "reason": name,
            "count": cnt,
            "pct": pct_val,
            "suggestion": suggestion,
        })

    lost_insight = ""
    if total_lost == 0:
        lost_insight = "Nenhuma perda registrada — verificar se oportunidades perdidas estão sendo classificadas corretamente."
    elif lost_without > 0:
        lost_insight = (
            f"A ausência de motivo em {_pct(lost_without, total_lost):.0f}% das perdas é o principal problema "
            f"analítico desta operação. Sem esse dado, é impossível identificar se as perdas são por preço, "
            f"timing, fit ou processo. Implementar obrigatoriedade imediata."
        )
    elif top_reasons_out:
        lost_insight = (
            f"Das {total_lost} perdas analisadas, o padrão predominante é '{top_reasons_out[0]['reason']}' "
            f"({top_reasons_out[0]['pct']:.0f}% das perdas). Isso sugere oportunidade de ajuste em "
            f"qualificação ou proposta de valor."
        )

    lost_reason_analysis = {
        "total_lost": total_lost,
        "without_reason_pct": _pct(lost_without, max(1, total_lost)),
        "insight": lost_insight,
        "top_reasons": top_reasons_out[:8],
        "recommendation": (
            "Implementar preenchimento obrigatório de motivo de perda. "
            "Realizar análise de cohort mensal de perdas por responsável e por funil. "
            "Criar programa de win-back para perdas recentes por timing ou orçamento."
        ) if total_lost > 0 else "Sem perdas registradas para análise.",
    }

    # ── Task discipline ──────────────────────────────────────────────────────
    task_sev = "low"
    if no_action_pct >= 80 or stuck_pct >= 80:
        task_sev = "critical"
    elif no_action_pct >= 50 or stuck_pct >= 50:
        task_sev = "high"
    elif no_action_pct >= 25 or stuck_pct >= 25:
        task_sev = "medium"

    pattern_parts = []
    if no_action_pct >= 80:
        pattern_parts.append("CRM usado como banco de dados, não como sistema de gestão de processo.")
    if stuck_pct >= 80:
        pattern_parts.append("Leads abertos em massa e não trabalhados — possível problema de captação x capacidade.")
    if overdue > 0:
        pattern_parts.append(f"{overdue} tarefas vencidas acumuladas.")
    if not pattern_parts:
        pattern_parts.append("Disciplina operacional dentro do esperado.")

    task_discipline = {
        "overdue_tasks": overdue,
        "no_next_action": no_action,
        "stuck_leads": stuck_count,
        "stuck_threshold_days": int(ctx.get("stuck_threshold_days") or 7),
        "assessment": (
            f"A equipe tem {no_action} oportunidades sem próxima ação ({no_action_pct:.0f}% das abertas), "
            f"{stuck_count} leads parados há mais de 7 dias ({stuck_pct:.0f}%) "
            f"e {overdue} tarefas vencidas. "
            + ("Situação crítica que exige intervenção imediata da gestão." if task_sev == "critical"
               else "Atenção necessária para restaurar o ritmo operacional." if task_sev == "high"
               else "Ajustes pontuais de processo recomendados.")
        ),
        "severity": task_sev,
        "pattern": " ".join(pattern_parts),
    }

    # ── CRM hygiene issues ───────────────────────────────────────────────────
    crm_hygiene_issues = []
    if no_value > 0:
        crm_hygiene_issues.append({
            "title": f"{no_value} oportunidades abertas sem valor",
            "detail": f"{no_value_pct:.0f}% das abertas sem valor monetário — forecast comprometido.",
            "qty": no_value,
            "severity": _severity(no_value_pct),
        })
    if no_source > 0:
        crm_hygiene_issues.append({
            "title": f"{no_source} leads sem canal de origem",
            "detail": f"{no_source_pct:.0f}% das abertas sem origem cadastrada.",
            "qty": no_source,
            "severity": _severity(no_source_pct),
        })
    if no_owner > 0:
        crm_hygiene_issues.append({
            "title": f"{no_owner} leads sem responsável",
            "detail": "Oportunidades órfãs — ninguém é cobrado por elas.",
            "qty": no_owner,
            "severity": "critical" if no_owner > 10 else "high",
        })
    if no_email > 0:
        crm_hygiene_issues.append({
            "title": f"{no_email} contatos sem e-mail",
            "detail": f"{_pct(no_email, max(1, contacts_total)):.0f}% dos contatos sem e-mail.",
            "qty": no_email,
            "severity": _severity(_pct(no_email, max(1, contacts_total)), (60, 40, 20)),
        })
    if dup_emails > 0:
        crm_hygiene_issues.append({
            "title": f"{dup_emails} grupos de e-mail duplicado",
            "detail": "Base de contatos poluída com duplicatas.",
            "qty": dup_emails,
            "severity": "high" if dup_emails >= 20 else "medium",
        })
    if lost_without > 0:
        crm_hygiene_issues.append({
            "title": f"{lost_without} perdas sem motivo registrado",
            "detail": "Impossível analisar causa de perda para ajustar o processo.",
            "qty": lost_without,
            "severity": _severity(_pct(lost_without, max(1, total_lost))),
        })

    # ── Action plan ──────────────────────────────────────────────────────────
    immediate = []
    short_term = []
    structural = []

    if stuck_pct >= 50:
        immediate.append(
            f"[URGENTE] Convocar reunião de pipeline para triagem das {stuck_count} oportunidades paradas: "
            f"classificar como ativa, reativação ou perda. Definir responsável e prazo para cada uma."
        )
    if no_action_pct >= 50:
        immediate.append(
            f"[URGENTE] Criar tarefas de follow-up para as {no_action} oportunidades sem próxima ação — "
            f"distribuir entre os responsáveis e monitorar diariamente por 2 semanas."
        )
    if overdue > 0:
        immediate.append(
            f"Resolver as {overdue} tarefas vencidas: reagendar ou marcar como concluídas. "
            f"Eliminar backlog de tarefas antes de criar novas."
        )
    if no_owner > 0:
        immediate.append(
            f"Atribuir responsável às {no_owner} oportunidades sem dono — "
            f"regra: toda oportunidade deve ter um dono antes de sair do estágio inicial."
        )
    if win_rate == 0:
        immediate.append(
            "Auditar as oportunidades marcadas como ganhas no Kommo e verificar se houve vendas "
            "não registradas. Alinhar processo de fechamento: toda venda deve ser atualizada no CRM imediatamente."
        )

    if no_value_pct >= 30:
        short_term.append(
            f"Implementar campo de valor obrigatório nas oportunidades abertas. "
            f"Responsáveis devem preencher o valor estimado das {no_value} oportunidades existentes até o fim da semana."
        )
    if no_source_pct >= 30:
        short_term.append(
            "Configurar UTMs em todas as fontes de captação. "
            "Auditar integrações (formulários, WhatsApp, tráfego pago) para garantir que a origem está sendo capturada."
        )
    if lost_without > 0 and total_lost > 0:
        short_term.append(
            f"Tornar o campo 'motivo de perda' obrigatório no Kommo. "
            f"Retroativamente, revisar as {lost_without} perdas sem motivo e classificá-las manualmente."
        )
    if dup_emails > 0:
        short_term.append(
            f"Executar processo de deduplicação: revisar os {dup_emails} grupos de e-mails duplicados "
            f"e fazer merge dos contatos no Kommo."
        )

    structural.append(
        "Implementar cadência de reunião de pipeline semanal: cada responsável apresenta os 10 leads mais quentes, "
        "os mais parados e as oportunidades em risco de perda."
    )
    structural.append(
        "Criar SLA de atualização do CRM: toda interação com o cliente deve ser registrada em até 24h. "
        "Vincular bônus de comissão ao uso correto do CRM."
    )
    structural.append(
        "Definir e documentar o playbook de vendas: etapas, critérios de avanço, templates de follow-up "
        "e campos obrigatórios por etapa. Treinar a equipe no processo revisado."
    )
    if len(funnel_analysis) > 1:
        structural.append(
            "Revisar a arquitetura de funis: verificar se os múltiplos pipelines refletem jornadas distintas "
            "ou se há sobreposição que confunde o time."
        )

    action_plan = {
        "immediate_7d": immediate if immediate else ["Monitorar KPIs semanalmente e manter disciplina de atualização."],
        "short_term_15d": short_term if short_term else ["Revisar e ajustar SLAs de follow-up."],
        "structural_30d": structural,
    }

    # ── Recommendations (backward compat) ────────────────────────────────────
    recommendations_next_7_days = immediate + (short_term[:2] if short_term else [])

    return {
        "executive_summary": executive_summary,
        "operation_score": op_score,
        "overall_verdict": verdict,
        "funnel_analysis": funnel_analysis,
        "main_bottlenecks": main_bottlenecks,
        "data_hygiene": data_hygiene,
        "commercial_risks": commercial_risks,
        "owner_analysis": owner_analysis,
        "lost_reason_analysis": lost_reason_analysis,
        "task_discipline": task_discipline,
        "crm_hygiene_issues": crm_hygiene_issues,
        "action_plan": action_plan,
        "recommendations_next_7_days": recommendations_next_7_days,
        # Legacy fields (for LLM compat)
        "main_bottlenecks_legacy": [],
        "urgent_opportunities": [],
        "stage_analysis": [],
    }


# ─────────────────────────────────────────────────────────────────────────────
# AnalysisService
# ─────────────────────────────────────────────────────────────────────────────

class AnalysisService:
    def __init__(self, db: Any) -> None:
        self.db = db
        self.metrics = MetricsService(db)
        self.settings = get_auditor_settings()

    async def generate_and_persist(self, tenant_id: str) -> dict[str, Any]:
        ctx = await build_consolidated_json(self.db, tenant_id)
        model_used = "fallback-local"
        report: dict[str, Any]

        if self.settings.openai_api_key:
            payload = json.dumps(ctx, ensure_ascii=False, default=str)[:120_000]
            user_msg = prompts.USER_TEMPLATE.format(payload=payload)
            try:
                report = await llm_client.generate_json_report_relaxed(
                    prompts.SYSTEM_PROMPT,
                    user_msg,
                )
                model_used = self.settings.openai_model
                # Ensure deterministic sections fill any gaps the LLM may leave
                det = _build_deterministic_report(ctx)
                for key in ("funnel_analysis", "data_hygiene", "lost_reason_analysis",
                            "task_discipline", "action_plan", "owner_analysis"):
                    if not report.get(key):
                        report[key] = det[key]
                if not report.get("overall_verdict"):
                    report["overall_verdict"] = det["overall_verdict"]
            except Exception as exc:
                logger.exception("Falha LLM, usando fallback: %s", exc)
                report = _build_deterministic_report(ctx)
                model_used = f"fallback-after-error:{self.settings.openai_model}"
        else:
            logger.info("OPENAI_API_KEY ausente — relatório determinístico (tenant=%s)", tenant_id)
            report = _build_deterministic_report(ctx)

        op_score = report.get("operation_score")
        if op_score is None:
            op_score = ctx.get("scores", {}).get("operation_score_0_100")

        digest = str(hash(json.dumps(ctx, default=str)))[:16]
        await (
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
            .execute()
        )

        out = dict(report)
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
