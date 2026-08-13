/**
 * crmAuditFromViews — monta o payload do CRM Audit Dashboard direto das views
 * Supabase (substitui o backend Python legado `/crm/audit/dashboard`).
 *
 * Caminhos:
 *  1. Com janela temporal → RPC `crm_audit_dashboard_range` (server-side,
 *     números em sincronia com os cards do dashboard cliente).
 *  2. Fallback/sem janela → agrega 13 views `vw_*` no cliente e calcula
 *     scores heurísticos, gaps, evidências e enriquecimentos.
 *
 * Também gera o parecer determinístico (sem LLM) usado quando o backend de IA
 * está indisponível.
 *
 * Reconstruído fielmente a partir do bundle de produção
 * (dist/assets/index-*.js, build de 05/jul/2026).
 */
import { supabase } from "@/integrations/supabase/client";
import { pluralize } from "@/bai/helpers";
import { formatStageName } from "@/lib/stageNames";

// Nem todas as views/RPCs estão nos types gerados do Supabase (padrão da casa,
// ver useEoMetrics). O retorno intencionalmente não é anotado: o payload vem do
// servidor e o consumidor (CrmAuditDashboard) faz o narrowing campo a campo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type ViewRow = Record<string, unknown>;

/** Coerção numérica defensiva: null/undefined/NaN → 0. */
const toNum = (value: unknown): number => {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

async function fetchView(
  view: string,
  tenantId: string,
  opts?: { limit?: number; orderBy?: string; ascending?: boolean },
): Promise<ViewRow[]> {
  let query = sb.from(view).select("*").eq("tenant_id", tenantId);
  if (opts?.orderBy) query = query.order(opts.orderBy, { ascending: opts.ascending ?? false });
  if (opts?.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) {
    console.warn(`[crmAuditFromViews] ${view} error:`, error.message);
    return [];
  }
  return data ?? [];
}

interface LeadEvidenceCtx {
  pipelineNames: Map<string, string>;
  stageNames: Map<string, string>;
  ownerNames: Map<string, string>;
  problem: string;
  severity?: string;
  recommendation: string;
}

/** Converte uma linha de lead de view em linha de evidência do dashboard. */
function leadEvidenceRow(lead: ViewRow, ctx: LeadEvidenceCtx) {
  const pipelineId = String(lead.pipeline_external_id ?? "");
  const stageKey = `${pipelineId}:${String(lead.stage_external_id ?? "")}`;
  const ownerId = String(lead.owner_external_id ?? "");
  const daysStuck = lead.days_since_update != null ? Math.floor(toNum(lead.days_since_update)) : undefined;
  const severity =
    ctx.severity ??
    (daysStuck != null
      ? daysStuck >= 21
        ? "critical"
        : daysStuck >= 14
          ? "high"
          : daysStuck >= 7
            ? "medium"
            : "low"
      : "medium");
  return {
    entity_type: "lead",
    external_id: lead.external_id,
    name: lead.name ?? `Lead #${lead.external_id}`,
    owner_name: ctx.ownerNames.get(ownerId) ?? ownerId ?? "—",
    pipeline_name: ctx.pipelineNames.get(pipelineId) ?? pipelineId ?? "—",
    stage_name: formatStageName(ctx.stageNames.get(stageKey) ?? lead.stage_name, {
      externalId: (lead.stage_external_id as string | number | null | undefined) ?? undefined,
    }),
    value: lead.value != null ? toNum(lead.value) : null,
    days_stuck: daysStuck,
    updated_at: lead.external_updated_at ?? null,
    problem: ctx.problem,
    severity,
    recommendation: ctx.recommendation,
  };
}

export async function fetchCrmAuditDashboard(
  tenantId: string,
  opts: { dateRange?: { start: string; end: string } } = {},
) {
  if (!tenantId) throw new Error("tenantId is required");

  // 1. Janela temporal → RPC server-side (fica em sincronia com o dashboard).
  if (opts.dateRange?.start && opts.dateRange?.end) {
    try {
      const { data, error } = await sb.rpc("crm_audit_dashboard_range", {
        _tenant_id: tenantId,
        _start: opts.dateRange.start,
        _end: opts.dateRange.end,
      });
      if (error) {
        console.warn(
          "[crmAuditFromViews] RPC crm_audit_dashboard_range falhou, fallback para views:",
          error.message,
        );
      } else if (data) return data;
    } catch (err) {
      console.warn("[crmAuditFromViews] RPC exception, fallback para views:", err);
    }
  }

  // 2. Fallback: agrega as views no cliente.
  const [
    pipelineHealthRows,
    ownerRows,
    lostReasonRows,
    noNextActionRows,
    stuckRows,
    overdueTaskRows,
    dataQualityRows,
    forecastQualityRows,
    forecastRevenueRows,
    personTypeRows,
    stageConversionRows,
    funnelVelocityRows,
    duplicateContactRows,
  ] = await Promise.all([
    fetchView("vw_pipeline_health", tenantId),
    fetchView("vw_owner_performance", tenantId),
    fetchView("vw_lost_reasons", tenantId),
    fetchView("vw_no_next_action", tenantId, { limit: 60, orderBy: "external_updated_at", ascending: true }),
    fetchView("vw_leads_stuck_by_stage", tenantId, { limit: 60, orderBy: "days_since_update", ascending: false }),
    fetchView("vw_overdue_tasks", tenantId, { limit: 60, orderBy: "due_at", ascending: true }),
    fetchView("vw_crm_data_quality", tenantId),
    fetchView("vw_forecast_quality", tenantId),
    fetchView("vw_forecast_revenue", tenantId, { limit: 1 }),
    fetchView("vw_contact_person_type_distribution", tenantId, { limit: 1 }),
    fetchView("vw_stage_conversion", tenantId, { limit: 30 }),
    fetchView("vw_funnel_velocity", tenantId, { limit: 30 }),
    fetchView("vw_duplicate_contacts", tenantId, { limit: 50 }),
  ]);

  const forecastRevenue = forecastRevenueRows[0] ?? null;
  const personType = personTypeRows[0] ?? null;

  // Catálogos de nome (pipeline/etapa/responsável) a partir das próprias views.
  const pipelineNames = new Map<string, string>();
  const stageNames = new Map<string, string>();
  for (const row of pipelineHealthRows) {
    if (row.pipeline_external_id && row.pipeline_name) {
      pipelineNames.set(String(row.pipeline_external_id), String(row.pipeline_name));
    }
    if (row.pipeline_external_id && row.stage_external_id && row.stage_name) {
      stageNames.set(`${row.pipeline_external_id}:${row.stage_external_id}`, String(row.stage_name));
    }
  }
  const ownerNames = new Map<string, string>();
  for (const row of ownerRows) {
    if (row.owner_external_id) {
      ownerNames.set(String(row.owner_external_id), String(row.owner_name ?? row.owner_external_id));
    }
  }

  const totals = pipelineHealthRows.reduce<{ open: number; won: number; lost: number; openValue: number }>(
    (acc, row) => {
      acc.open += toNum(row.open_leads);
      acc.won += toNum(row.won_leads);
      acc.lost += toNum(row.lost_leads);
      acc.openValue += toNum(row.open_pipeline_value);
      return acc;
    },
    { open: 0, won: 0, lost: 0, openValue: 0 },
  );
  const totalLeads = totals.open + totals.won + totals.lost;
  const forecastQuality = forecastQualityRows[0] ?? {};
  const dataQuality = dataQualityRows[0] ?? {};

  // Contagens exatas dos universos (as views de amostra são limitadas a 60).
  const countView = async (view: string): Promise<number> => {
    const { count } = await sb.from(view).select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
    return count ?? 0;
  };
  const [noNextActionCount, stuckCount, overdueCount, duplicateGroupCount] = await Promise.all([
    countView("vw_no_next_action"),
    countView("vw_leads_stuck_by_stage"),
    countView("vw_overdue_tasks"),
    countView("vw_duplicate_contacts"),
  ]);

  // Concentração de valor nos top 3 responsáveis.
  const top3OpenValue = [...ownerRows]
    .sort((a, b) => toNum(b.open_value) - toNum(a.open_value))
    .slice(0, 3)
    .reduce((acc, row) => acc + toNum(row.open_value), 0);
  const concentrationTop3Pct = totals.openValue > 0 ? (top3OpenValue / totals.openValue) * 100 : 0;

  const lostReasons = lostReasonRows.map((row) => ({
    lost_reason: (row.lost_reason as string | undefined) ?? "(não informado)",
    cnt: toNum(row.cnt),
  }));
  const lostWithoutReason = lostReasons.find((r) => r.lost_reason === "(não informado)")?.cnt ?? 0;

  // Razões usadas nos scores heurísticos.
  const pctOpenWithoutValue = totals.open > 0 ? toNum(forecastQuality.open_without_value) / totals.open : 0;
  const pctContactsNoEmail =
    toNum(dataQuality.contacts_total) > 0 ? toNum(dataQuality.contacts_no_email) / toNum(dataQuality.contacts_total) : 0;
  const duplicateRatio = toNum(dataQuality.contacts_total) > 0 ? duplicateGroupCount / toNum(dataQuality.contacts_total) : 0;
  const pctNoNextAction = totals.open > 0 ? noNextActionCount / totals.open : 0;
  const pctStuck = totals.open > 0 ? stuckCount / totals.open : 0;
  const overdueRatio = (overdueCount + 1) / (totals.open + 1);

  // Scores 0–100 (heurísticos, sem série temporal).
  const hygieneScore = Math.max(0, Math.round(100 - (pctContactsNoEmail * 30 + duplicateRatio * 50 + pctOpenWithoutValue * 20)));
  const disciplineScore = Math.max(0, Math.round(100 - (pctNoNextAction * 50 + pctStuck * 30 + overdueRatio * 20)));
  const forecastScore = Math.max(0, Math.round(100 - pctOpenWithoutValue * 100));
  const riskScore = Math.max(0, Math.round(100 - (concentrationTop3Pct / 100) * 60 - pctNoNextAction * 20));
  const engagementScore = 50;
  const generalScore = Math.round((hygieneScore + disciplineScore + forecastScore + riskScore + engagementScore) / 5);

  // Gaps e riscos detectados.
  const gaps: { category: string; title: string; detail: string; severity: string }[] = [];
  if (pctOpenWithoutValue > 0.3) {
    gaps.push({
      category: "forecast",
      title: `${Math.round(pctOpenWithoutValue * 100)}% das abertas sem valor`,
      detail: `${pluralize(toNum(forecastQuality.open_without_value), "oportunidade")} em aberto sem valor preenchido — forecast incompleto.`,
      severity: pctOpenWithoutValue > 0.5 ? "high" : "medium",
    });
  }
  if (pctNoNextAction > 0.4) {
    gaps.push({
      category: "discipline",
      title: `${Math.round(pctNoNextAction * 100)}% das abertas sem próxima ação`,
      detail: `${noNextActionCount.toLocaleString("pt-BR")} leads abertos não têm tarefa em aberto no Kommo — risco alto de leads esquecidos.`,
      severity: "high",
    });
  }
  if (pctStuck > 0.2) {
    gaps.push({
      category: "discipline",
      title: `${stuckCount.toLocaleString("pt-BR")} leads parados há +7d`,
      detail: "Oportunidades sem atualização recente — pipeline acumulando estoque morto.",
      severity: "high",
    });
  }
  if (overdueCount > 0) {
    gaps.push({
      category: "discipline",
      title: `${pluralize(overdueCount, "tarefa vencida")}`,
      detail: "Tarefas com data de vencimento no passado e sem conclusão.",
      severity: overdueCount > 50 ? "high" : "medium",
    });
  }
  if (pctContactsNoEmail > 0.3) {
    gaps.push({
      category: "hygiene",
      title: `${Math.round(pctContactsNoEmail * 100)}% dos contatos sem e-mail`,
      detail: `${toNum(dataQuality.contacts_no_email).toLocaleString("pt-BR")} contatos sem endereço de e-mail — alcance comprometido.`,
      severity: "medium",
    });
  }
  if (duplicateGroupCount > 0) {
    gaps.push({
      category: "hygiene",
      title: `${duplicateGroupCount.toLocaleString("pt-BR")} grupos de e-mail duplicados`,
      detail: "Contatos compartilham mesmo e-mail — risco de mensagens duplicadas e métricas infladas.",
      severity: duplicateGroupCount > 100 ? "high" : "medium",
    });
  }
  if (lostWithoutReason > 0) {
    gaps.push({
      category: "loss",
      title: `${lostWithoutReason.toLocaleString("pt-BR")} perdas sem motivo`,
      detail: "Análise de win/loss inviabilizada — padronize motivo de perda no fechamento.",
      severity: "high",
    });
  }
  if (concentrationTop3Pct > 50) {
    gaps.push({
      category: "risk",
      title: `Concentração de valor em top 3: ${concentrationTop3Pct.toFixed(1)}%`,
      detail: "Dependência elevada de poucas contas — risco de receita.",
      severity: "medium",
    });
  }

  // Pontos fortes.
  const strengths: { title: string; detail: string }[] = [];
  if (totals.open > 100) {
    strengths.push({
      title: "Pipeline ativo",
      detail: `${pluralize(totals.open, "oportunidade")} em aberto — base saudável de volume.`,
    });
  }
  if (overdueCount === 0) {
    strengths.push({
      title: "Tarefas em dia",
      detail: "Nenhuma tarefa vencida no snapshot — disciplina de follow-up está mantida.",
    });
  }
  if (
    toNum(dataQuality.contacts_no_phone) === 0 ||
    (toNum(dataQuality.contacts_total) > 0 && toNum(dataQuality.contacts_no_phone) / toNum(dataQuality.contacts_total) < 0.05)
  ) {
    strengths.push({
      title: "Telefones preenchidos",
      detail: "Quase todos os contatos têm telefone cadastrado.",
    });
  }

  // Tabelas de evidência.
  const noNextActionEvidence = noNextActionRows.map((row) =>
    leadEvidenceRow(row, {
      pipelineNames,
      stageNames,
      ownerNames,
      problem: "Sem próxima ação aberta",
      severity: "high",
      recommendation: "Crie tarefa de follow-up no Kommo nas próximas 24h.",
    }),
  );
  const stuckEvidence = stuckRows.map((row) =>
    leadEvidenceRow(row, {
      pipelineNames,
      stageNames,
      ownerNames,
      problem: "Sem atualização há mais de 7 dias",
      recommendation: "Avalie contato direto, mover de etapa, ou desqualificar.",
    }),
  );
  const overdueTaskEvidence = overdueTaskRows.map((row) => ({
    entity_type: "task",
    external_id: row.external_id,
    name: String(row.title ?? "(tarefa sem título)"),
    owner_name: ownerNames.get(String(row.assignee_external_id ?? "")) ?? "—",
    pipeline_name: "—",
    stage_name: "—",
    value: null,
    days_overdue: row.due_at
      ? Math.max(0, Math.floor((Date.now() - new Date(String(row.due_at)).getTime()) / 86_400_000))
      : null,
    updated_at: row.due_at ?? null,
    problem: "Tarefa vencida sem conclusão",
    severity: "high",
    recommendation: "Conclua, reagende ou cancele a tarefa no Kommo.",
    lead_external_id: row.lead_external_id ?? null,
  }));
  const noOwnerEvidence = noNextActionRows
    .filter((row) => !row.owner_external_id)
    .slice(0, 30)
    .map((row) =>
      leadEvidenceRow(row, {
        pipelineNames,
        stageNames,
        ownerNames,
        problem: "Sem responsável atribuído",
        severity: "high",
        recommendation: "Atribua dono no Kommo.",
      }),
    );
  const noValueEvidence = noNextActionRows
    .filter((row) => !row.value || toNum(row.value) === 0)
    .slice(0, 30)
    .map((row) =>
      leadEvidenceRow(row, {
        pipelineNames,
        stageNames,
        ownerNames,
        problem: "Valor zerado / sem forecast",
        severity: "medium",
        recommendation: "Estime valor da oportunidade no Kommo.",
      }),
    );
  const noSourceEvidence = noNextActionRows
    .filter((row) => !row.source)
    .slice(0, 30)
    .map((row) =>
      leadEvidenceRow(row, {
        pipelineNames,
        stageNames,
        ownerNames,
        problem: "Origem/canal não rastreado",
        severity: "medium",
        recommendation: "Preencha origem/UTM no cadastro.",
      }),
    );
  const duplicateEmailEvidence = duplicateContactRows.map((row) => ({
    entity_type: "contact_group",
    external_id: row.email_norm,
    name: String(row.email_norm ?? "—"),
    owner_name: "—",
    pipeline_name: "—",
    stage_name: "—",
    value: null,
    updated_at: null,
    problem: `${toNum(row.cnt)} contatos com mesmo e-mail`,
    severity: toNum(row.cnt) >= 4 ? "critical" : toNum(row.cnt) >= 3 ? "high" : "medium",
    recommendation: "Mesclar contatos no Kommo (Configurações → Duplicidade).",
  }));

  // Risco operacional por responsável (proxy a partir das amostras).
  const noNextActionByOwner = new Map<string, number>();
  for (const row of noNextActionRows) {
    const key = String(row.owner_external_id ?? "");
    noNextActionByOwner.set(key, (noNextActionByOwner.get(key) ?? 0) + 1);
  }
  const stuckByOwner = new Map<string, number>();
  for (const row of stuckRows) {
    const key = String(row.owner_external_id ?? "");
    stuckByOwner.set(key, (stuckByOwner.get(key) ?? 0) + 1);
  }
  const ownerOperational = ownerRows.map((row) => {
    const ownerId = String(row.owner_external_id ?? "");
    const openLeads = toNum(row.open_leads);
    const noNextAction = noNextActionByOwner.get(ownerId) ?? 0;
    const stuck = stuckByOwner.get(ownerId) ?? 0;
    const riskRatio = openLeads > 0 ? (noNextAction * 0.6 + stuck * 0.4) / openLeads : 0;
    const risk = Math.min(100, Math.round(riskRatio * 100));
    return {
      owner_name: row.owner_name,
      open_leads: openLeads,
      open_value: toNum(row.open_value),
      no_next_action_open: noNextAction,
      stuck_open: stuck,
      overdue_tasks: 0,
      operational_risk_0_100: risk,
    };
  });

  const stageDistribution = stageConversionRows.map((row) => ({
    stage_name: row.stage_name,
    lead_count: toNum(row.lead_count),
    pct_of_open_pipeline: toNum(row.pct_of_open_pipeline),
  }));
  const stageLossBreakdown = pipelineHealthRows
    .filter((row) => toNum(row.lost_leads) > 0)
    .map((row) => ({
      stage_name: formatStageName(row.stage_name, {
        externalId: (row.stage_external_id as string | number | null | undefined) ?? undefined,
      }),
      lost_count: toNum(row.lost_leads),
    }));
  const avgDaysPerStage =
    funnelVelocityRows.length > 0
      ? funnelVelocityRows.reduce((acc, row) => acc + toNum(row.avg_days_in_stage_proxy), 0) / funnelVelocityRows.length
      : 0;

  return {
    last_sync_at: new Date().toISOString(),
    overview: {
      total_leads_all_status: totalLeads,
      total_active_leads: totals.open,
      total_won_leads: totals.won,
      total_lost_leads: totals.lost,
      total_open_pipeline_value: totals.openValue,
      open_leads_without_value: toNum(forecastQuality.open_without_value),
      open_leads_without_owner: noOwnerEvidence.length,
      open_leads_without_source: noSourceEvidence.length,
    },
    scores: { crm_data_quality_0_100: hygieneScore, operation_0_100: disciplineScore },
    executive_scoreboard: {
      scores: {
        general_0_100: generalScore,
        hygiene_0_100: hygieneScore,
        discipline_0_100: disciplineScore,
        risk_commercial_0_100: riskScore,
        forecast_0_100: forecastScore,
        engagement_0_100: engagementScore,
      },
      meta: {
        source: "supabase_views",
        weights_note: "Scores heurísticos calculados sobre views agregadas (sem série temporal).",
      },
    },
    data_quality_breakdown: {
      contacts_without_email: toNum(dataQuality.contacts_no_email),
      contacts_without_phone: toNum(dataQuality.contacts_no_phone),
      duplicate_email_keys: duplicateGroupCount,
    },
    gaps_and_risks: gaps,
    strengths,
    samples: {
      counts: { no_next_action_leads: noNextActionCount, overdue_tasks: overdueCount, stuck_leads: stuckCount },
      no_next_action_leads: noNextActionRows.slice(0, 8).map((row) => ({ external_id: row.external_id, name: row.name })),
      overdue_tasks: overdueTaskRows.slice(0, 8).map((row) => ({ external_id: row.external_id, title: row.title })),
      stuck_leads: stuckRows
        .slice(0, 8)
        .map((row) => ({ external_id: row.external_id, name: row.name, days_stuck: row.days_since_update })),
    },
    forecast_revenue: {
      value: toNum(forecastRevenue?.forecast_revenue),
      contributing_leads: toNum(forecastRevenue?.contributing_leads),
      total_open_leads: toNum(forecastRevenue?.total_open_leads),
      methodology: forecastRevenue?.methodology ?? "pipeline_weighted_by_stage_position",
    },
    person_type_distribution: {
      pj_count: toNum(personType?.pj_count),
      pf_count: toNum(personType?.pf_count),
      unknown_count: toNum(personType?.unknown_count),
      total_contacts: toNum(personType?.total_contacts),
      pj_pct: toNum(personType?.pj_pct),
    },
    funnel_velocity: funnelVelocityRows.map((row) => ({
      stage_name: formatStageName(row.stage_name, {
        externalId: (row.stage_external_id as string | number | null | undefined) ?? undefined,
      }),
      avg_days_in_stage: toNum(row.avg_days_in_stage_proxy),
      median_days_in_stage: toNum(row.median_days_in_stage_proxy),
    })),
    stage_distribution: stageDistribution,
    pipeline_health: pipelineHealthRows.map((row) => ({
      stage_name: row.stage_name,
      pipeline_name: row.pipeline_name,
      lost_leads: toNum(row.lost_leads),
      open_leads: toNum(row.open_leads),
      won_leads: toNum(row.won_leads),
      open_pipeline_value: toNum(row.open_pipeline_value),
    })),
    owners: ownerRows.map((row) => ({
      owner_name: row.owner_name,
      open_leads: toNum(row.open_leads),
      won_leads: toNum(row.won_leads),
      lost_leads: toNum(row.lost_leads),
      open_value: toNum(row.open_value),
    })),
    lost_reasons: lostReasons,
    audit_enrichment: {
      owner_operational: ownerOperational,
      task_metrics: {
        total: undefined,
        open: undefined,
        completed: undefined,
        overdue: overdueCount,
        avg_overdue_days:
          overdueTaskEvidence.length > 0
            ? Math.round(
                overdueTaskEvidence.reduce((acc, row) => acc + (row.days_overdue ?? 0), 0) / overdueTaskEvidence.length,
              )
            : undefined,
      },
      financial_snapshot: {
        won_pipeline_value: undefined,
        lost_pipeline_value: undefined,
        avg_ticket_open: totals.open > 0 ? Math.round(totals.openValue / totals.open) : 0,
        open_value_concentration_top3_pct: concentrationTop3Pct,
      },
      loss_metrics: { lost_without_reason_count: lostWithoutReason, total_lost: totals.lost },
      stage_loss_breakdown: stageLossBreakdown,
    },
    engagement: { counts: { avg_days_per_stage: Math.round(avgDaysPerStage) } },
    sync_stats: {
      pipelines: pipelineNames.size,
      stages: stageNames.size,
      users: ownerNames.size,
      leads: totalLeads,
      contacts: toNum(dataQuality.contacts_total),
      open_pipeline_value: Math.round(totals.openValue),
    },
    extended_catalog: { loss_reasons: [] },
    evidence_tables: {
      rows: {
        no_next_action: noNextActionEvidence,
        no_owner: noOwnerEvidence,
        no_value: noValueEvidence,
        no_source: noSourceEvidence,
        overdue_tasks: overdueTaskEvidence,
        stuck_leads: stuckEvidence,
        lost_without_reason: [],
        incomplete_contacts: [],
        duplicate_email_groups: duplicateEmailEvidence,
        stage_bottlenecks: stageDistribution
          .filter((row) => row.pct_of_open_pipeline > 20)
          .map((row) => ({
            entity_type: "stage",
            external_id: row.stage_name,
            name: row.stage_name,
            owner_name: "—",
            pipeline_name: "—",
            stage_name: row.stage_name,
            value: null,
            updated_at: null,
            problem: `Concentra ${row.pct_of_open_pipeline}% do pipeline aberto`,
            severity: row.pct_of_open_pipeline > 40 ? "critical" : "high",
            recommendation:
              "Investigue gargalo: critério de saída pouco claro ou capacidade insuficiente nessa etapa.",
          })),
      },
      counts: {
        no_next_action: noNextActionCount,
        no_owner: noOwnerEvidence.length,
        no_value: noValueEvidence.length,
        no_source: noSourceEvidence.length,
        overdue_tasks: overdueCount,
        stuck_leads: stuckCount,
        lost_without_reason: lostWithoutReason,
        incomplete_contacts: toNum(dataQuality.contacts_no_email) + toNum(dataQuality.contacts_no_phone),
        duplicate_email_groups: duplicateGroupCount,
        stage_bottlenecks: stageDistribution.filter((row) => row.pct_of_open_pipeline > 20).length,
      },
      meta: { stuck_threshold_days: 7, row_cap: 60, source: "supabase_views" },
    },
  };
}

/** Shape mínimo do payload lido pelo parecer determinístico. */
interface CrmAuditPayloadLike {
  overview?: {
    total_active_leads?: number;
    total_lost_leads?: number;
    [key: string]: unknown;
  };
  executive_scoreboard?: { scores?: Record<string, number> };
  audit_enrichment?: {
    financial_snapshot?: { avg_ticket_open?: number; [key: string]: unknown };
    loss_metrics?: { lost_without_reason_count?: number; [key: string]: unknown };
    [key: string]: unknown;
  };
  data_quality_breakdown?: {
    contacts_without_email?: number;
    duplicate_email_keys?: number;
    [key: string]: unknown;
  };
  samples?: {
    counts?: { no_next_action_leads?: number; overdue_tasks?: number; stuck_leads?: number };
  };
  owners?: { owner_name?: string; open_leads?: number; open_value?: number }[];
  gaps_and_risks?: { category?: string; title?: string; detail?: string; severity?: string }[];
  pipeline_health?: {
    stage_name?: string;
    pipeline_name?: string;
    lost_leads?: number;
    open_leads?: number;
    open_pipeline_value?: number;
  }[];
  lost_reasons?: { lost_reason?: string; cnt?: number }[];
}

/**
 * Parecer determinístico (sem LLM) construído a partir do payload já carregado.
 * Usado como fallback quando o backend de IA está indisponível — garante que a
 * aba "Parecer IA" sempre tem conteúdo.
 */
export function buildDeterministicAnalysisReport(payload: CrmAuditPayloadLike): Record<string, unknown> {
  const overview = payload.overview ?? {};
  const scores = payload.executive_scoreboard?.scores ?? {};
  const financial = payload.audit_enrichment?.financial_snapshot ?? {};
  const lossMetrics = payload.audit_enrichment?.loss_metrics ?? {};
  const dataQuality = payload.data_quality_breakdown ?? {};
  const sampleCounts = payload.samples?.counts ?? {};
  const owners = payload.owners ?? [];
  const gaps = payload.gaps_and_risks ?? [];
  const pipelineHealth = payload.pipeline_health ?? [];

  const generalScore = scores.general_0_100 ?? 0;
  const verdict = generalScore >= 80 ? "healthy" : generalScore >= 60 ? "moderate" : generalScore >= 40 ? "warning" : "critical";

  // Agregação por pipeline (funil) com detecção de gargalo.
  const byPipeline = new Map<
    string,
    { open: number; lost: number; value: number; bottleneck?: string; bottleneckCount?: number }
  >();
  for (const row of pipelineHealth) {
    const name = row.pipeline_name ?? "—";
    const agg = byPipeline.get(name) ?? { open: 0, lost: 0, value: 0 };
    agg.open += row.open_leads ?? 0;
    agg.lost += row.lost_leads ?? 0;
    agg.value += row.open_pipeline_value ?? 0;
    if (!agg.bottleneckCount || (row.open_leads ?? 0) > agg.bottleneckCount) {
      agg.bottleneck = row.stage_name;
      agg.bottleneckCount = row.open_leads ?? 0;
    }
    byPipeline.set(name, agg);
  }
  const funnelAnalysis = Array.from(byPipeline.entries()).map(([pipelineName, agg]) => {
    const sample = agg.open + agg.lost;
    const conversionRate = sample >= 5 ? Math.round((agg.open / sample) * 100) : null;
    const lowSample = sample > 0 && sample < 5;
    const severity = agg.lost > agg.open * 0.5 ? "high" : "medium";
    return {
      pipeline_name: pipelineName,
      leads_open: agg.open,
      total_value: agg.value,
      conversion_rate: conversionRate,
      conversion_low_sample: lowSample,
      conversion_sample_size: sample,
      bottleneck_stage: agg.bottleneck ?? null,
      problems: gaps
        .filter((gap) => String(gap.severity) === "high")
        .slice(0, 2)
        .map((gap) => gap.title ?? ""),
      severity,
      recommendation: `Revisar etapa "${agg.bottleneck ?? "—"}" — onde concentra a maior parte das abertas.`,
    };
  });

  return {
    overall_verdict: verdict,
    operation_score: generalScore,
    executive_summary: `Snapshot da operação comercial: score geral ${generalScore}/100 (${verdict}). Higiene ${scores.hygiene_0_100 ?? 0}/100, disciplina ${scores.discipline_0_100 ?? 0}/100, forecast ${scores.forecast_0_100 ?? 0}/100, risco comercial ${scores.risk_commercial_0_100 ?? 0}/100. ${pluralize(overview.total_active_leads ?? 0, "oportunidade")} em aberto somando ${(financial.avg_ticket_open ?? 0) > 0 ? `ticket médio ${(financial.avg_ticket_open ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "valor não dimensionável"}.\n\nPrincipais atritos detectados: ${gaps
      .slice(0, 3)
      .map((gap) => gap.title)
      .join("; ")}.`,
    main_bottlenecks: gaps.slice(0, 5).map((gap) => ({
      title: gap.title,
      detail: gap.detail,
      severity: gap.severity ?? "medium",
      metric: undefined,
      root_cause: "—",
      financial_impact: "—",
    })),
    funnel_analysis: funnelAnalysis,
    task_discipline: {
      overdue_tasks: sampleCounts.overdue_tasks ?? 0,
      no_next_action: sampleCounts.no_next_action_leads ?? 0,
      stuck_leads: sampleCounts.stuck_leads ?? 0,
      stuck_threshold_days: 7,
      severity:
        (sampleCounts.no_next_action_leads ?? 0) > (overview.total_active_leads ?? 1) * 0.4 ? "high" : "medium",
      assessment: `${sampleCounts.no_next_action_leads ?? 0} leads sem próxima ação e ${sampleCounts.stuck_leads ?? 0} parados há mais de 7 dias.`,
      pattern: "Leads acumulando sem follow-up sistemático.",
    },
    data_hygiene: {
      score_0_100: scores.hygiene_0_100 ?? 0,
      diagnosis: `${(dataQuality.contacts_without_email ?? 0).toLocaleString("pt-BR")} contatos sem e-mail e ${(dataQuality.duplicate_email_keys ?? 0).toLocaleString("pt-BR")} grupos duplicados — base de contatos requer limpeza.`,
      issues: [
        ...(dataQuality.contacts_without_email
          ? [
              {
                title: "Contatos sem e-mail",
                qty: dataQuality.contacts_without_email,
                severity: "medium",
                fix: "Importar e-mails do CRM origem ou enriquecer via Apollo/Lusha.",
              },
            ]
          : []),
        ...(dataQuality.duplicate_email_keys
          ? [
              {
                title: "E-mails duplicados",
                qty: dataQuality.duplicate_email_keys,
                severity: "high",
                fix: "Mesclar contatos no Kommo.",
              },
            ]
          : []),
      ],
    },
    commercial_risks: gaps
      .filter((gap) => gap.severity === "high")
      .slice(0, 5)
      .map((gap) => ({
        title: gap.title,
        detail: gap.detail,
        financial_impact: undefined,
        urgency: "short_term",
      })),
    owner_analysis: owners.slice(0, 10).map((owner) => ({
      owner: owner.owner_name,
      open_leads: owner.open_leads,
      open_value: owner.open_value,
      assessment: `${pluralize(owner.open_leads ?? 0, "oportunidade")} em aberto.`,
      concerns:
        (owner.open_leads ?? 0) > 500
          ? "Sobrecarga aparente — distribuir entre time."
          : "Sem preocupações críticas identificadas.",
      risk_level: (owner.open_leads ?? 0) > 1000 ? "critical" : (owner.open_leads ?? 0) > 500 ? "high" : "low",
    })),
    lost_reason_analysis: {
      total_lost: overview.total_lost_leads ?? 0,
      without_reason_pct:
        (overview.total_lost_leads ?? 0) > 0
          ? ((lossMetrics.lost_without_reason_count ?? 0) / (overview.total_lost_leads ?? 1)) * 100
          : 0,
      insight: `${(lossMetrics.lost_without_reason_count ?? 0).toLocaleString("pt-BR")} perdas sem motivo registrado — análise win/loss inviabilizada.`,
      top_reasons: (payload.lost_reasons ?? []).slice(0, 6).map((reason) => ({
        reason: reason.lost_reason,
        count: reason.cnt,
        pct:
          (overview.total_lost_leads ?? 0) > 0 ? ((reason.cnt ?? 0) / (overview.total_lost_leads ?? 1)) * 100 : 0,
        suggestion:
          reason.lost_reason === "(não informado)" ? "Tornar campo obrigatório no fechamento como Perdido." : undefined,
      })),
      recommendation: "Padronizar enum de motivos de perda + win/loss review quinzenal.",
    },
    action_plan: {
      immediate_7d: gaps
        .filter((gap) => gap.severity === "high")
        .slice(0, 5)
        .map((gap) => `Endereçar: ${gap.title}`),
      short_term_15d: gaps
        .filter((gap) => gap.severity === "medium")
        .slice(0, 5)
        .map((gap) => `Resolver: ${gap.title}`),
      structural_30d: [
        "Implementar enum obrigatório para motivo de perda no fechamento.",
        "Configurar regra no Kommo: leads abertos sem tarefa há +3 dias geram alerta.",
        "Win/loss review quinzenal com SDR + CSM.",
      ],
    },
    recommendations_next_7_days: gaps
      .filter((gap) => gap.severity === "high")
      .slice(0, 5)
      .map((gap) => gap.title ?? ""),
    model_used: "deterministic_v1 (sem LLM)",
  };
}
