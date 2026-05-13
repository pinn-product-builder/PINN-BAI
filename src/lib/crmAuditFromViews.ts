/**
 * CRM Audit Dashboard — fetch direto das views do Supabase (legacy schema bai_crm_auditor).
 *
 * Substitui o backend Python (`${BACKEND}/crm/audit/dashboard`) que foi descomissionado.
 * Lê das views agregadas (vw_pipeline_health, vw_owner_performance, vw_lost_reasons,
 * vw_no_next_action, vw_leads_stuck_by_stage, vw_overdue_tasks, vw_crm_data_quality,
 * vw_forecast_quality, vw_stage_conversion, vw_funnel_velocity, vw_duplicate_contacts)
 * e monta o payload no shape esperado pelo CrmAuditDashboard.tsx.
 *
 * Trade-off: 11 queries paralelas em vez de 1, mas resolve sem reerguer backend.
 */
import { supabase } from "@/integrations/supabase/client";

type AnyRow = Record<string, unknown>;

type PipelineHealthRow = {
  tenant_id?: string;
  pipeline_external_id?: string | null;
  pipeline_name?: string | null;
  stage_external_id?: string | null;
  stage_name?: string | null;
  open_leads?: number | null;
  won_leads?: number | null;
  lost_leads?: number | null;
  open_pipeline_value?: number | string | null;
};

type OwnerPerfRow = {
  owner_external_id?: string | null;
  owner_name?: string | null;
  open_leads?: number | null;
  won_leads?: number | null;
  lost_leads?: number | null;
  open_value?: number | string | null;
};

type LeadRow = {
  id?: string;
  external_id?: string | number | null;
  name?: string | null;
  pipeline_external_id?: string | null;
  stage_external_id?: string | null;
  owner_external_id?: string | null;
  value?: number | string | null;
  source?: string | null;
  lead_status?: string | null;
  external_updated_at?: string | null;
  created_at?: string | null;
  stage_name?: string | null;
  days_since_update?: number | string | null;
};

type TaskRow = {
  external_id?: string | number;
  title?: string | null;
  due_at?: string | null;
  is_completed?: boolean | null;
  lead_external_id?: string | null;
  assignee_external_id?: string | null;
};

type LostRow = { lost_reason?: string | null; cnt?: number | string | null };
type StageConvRow = { stage_external_id?: string | null; stage_name?: string | null; lead_count?: number | null; pct_of_open_pipeline?: number | string | null };
type FunnelVelRow = { stage_external_id?: string | null; stage_name?: string | null; avg_days_in_stage_proxy?: number | string | null; median_days_in_stage_proxy?: number | string | null };
type DataQualityRow = { contacts_no_email?: number; contacts_no_phone?: number; contacts_total?: number };
type ForecastRow = { open_without_value?: number; open_total?: number; pct_open_missing_value?: number | string | null };
type DupEmailRow = { email_norm?: string; cnt?: number | string };

const num = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sevForPct = (pct: number, hi = 0.35, mid = 0.18): "critical" | "high" | "medium" | "low" => {
  if (pct >= hi) return "critical";
  if (pct >= mid) return "high";
  if (pct > 0) return "medium";
  return "low";
};

async function fetchView<T = AnyRow>(view: string, tenantId: string, opts?: { limit?: number; orderBy?: string; ascending?: boolean }): Promise<T[]> {
  let q = supabase.from(view as never).select("*").eq("tenant_id", tenantId);
  if (opts?.orderBy) q = q.order(opts.orderBy, { ascending: opts.ascending ?? false });
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) {
    // RLS pode bloquear views específicas — registra mas não quebra a auditoria toda
    console.warn(`[crmAuditFromViews] ${view} error:`, error.message);
    return [];
  }
  return (data ?? []) as T[];
}

/** Normaliza um lead da view num row de evidência (shape do EvidenceBlock). */
function leadToEvidenceRow(
  l: LeadRow,
  ctx: {
    pipelineNames: Map<string, string>;
    stageNames: Map<string, string>;
    ownerNames: Map<string, string>;
    problem: string;
    severity?: "critical" | "high" | "medium" | "low";
    recommendation: string;
  },
): AnyRow {
  const pipelineKey = String(l.pipeline_external_id ?? "");
  const stageKey = `${pipelineKey}:${String(l.stage_external_id ?? "")}`;
  const ownerKey = String(l.owner_external_id ?? "");
  const days = l.days_since_update != null ? Math.floor(num(l.days_since_update)) : undefined;
  const sev = ctx.severity ?? (days != null ? (days >= 21 ? "critical" : days >= 14 ? "high" : days >= 7 ? "medium" : "low") : "medium");
  return {
    entity_type: "lead",
    external_id: l.external_id,
    name: l.name ?? `Lead #${l.external_id}`,
    owner_name: ctx.ownerNames.get(ownerKey) ?? ownerKey ?? "—",
    pipeline_name: ctx.pipelineNames.get(pipelineKey) ?? pipelineKey ?? "—",
    stage_name: ctx.stageNames.get(stageKey) ?? l.stage_name ?? l.stage_external_id ?? "—",
    value: l.value != null ? num(l.value) : null,
    days_stuck: days,
    updated_at: l.external_updated_at ?? null,
    problem: ctx.problem,
    severity: sev,
    recommendation: ctx.recommendation,
  };
}

export async function fetchCrmAuditDashboard(tenantId: string): Promise<AnyRow> {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  // 11 queries em paralelo — todas leem views (sem RLS bloqueando, owner = postgres)
  const [
    pipelineHealthRaw,
    ownerPerfRaw,
    lostReasonsRaw,
    noNextRaw,
    stuckRaw,
    overdueRaw,
    dataQualityRaw,
    forecastRaw,
    stageConvRaw,
    funnelVelRaw,
    dupEmailsRaw,
  ] = await Promise.all([
    fetchView<PipelineHealthRow>("vw_pipeline_health", tenantId),
    fetchView<OwnerPerfRow>("vw_owner_performance", tenantId),
    fetchView<LostRow>("vw_lost_reasons", tenantId),
    fetchView<LeadRow>("vw_no_next_action", tenantId, { limit: 60, orderBy: "external_updated_at", ascending: true }),
    fetchView<LeadRow>("vw_leads_stuck_by_stage", tenantId, { limit: 60, orderBy: "days_since_update", ascending: false }),
    fetchView<TaskRow & { tenant_id?: string }>("vw_overdue_tasks", tenantId, { limit: 60, orderBy: "due_at", ascending: true }),
    fetchView<DataQualityRow>("vw_crm_data_quality", tenantId),
    fetchView<ForecastRow>("vw_forecast_quality", tenantId),
    fetchView<StageConvRow>("vw_stage_conversion", tenantId, { limit: 30 }),
    fetchView<FunnelVelRow>("vw_funnel_velocity", tenantId, { limit: 30 }),
    fetchView<DupEmailRow>("vw_duplicate_contacts", tenantId, { limit: 50 }),
  ]);

  // Maps de catálogo (a partir do que veio nas views agregadas)
  const pipelineNames = new Map<string, string>();
  const stageNames = new Map<string, string>();
  for (const row of pipelineHealthRaw) {
    if (row.pipeline_external_id && row.pipeline_name) {
      pipelineNames.set(String(row.pipeline_external_id), String(row.pipeline_name));
    }
    if (row.pipeline_external_id && row.stage_external_id && row.stage_name) {
      stageNames.set(`${row.pipeline_external_id}:${row.stage_external_id}`, String(row.stage_name));
    }
  }
  const ownerNames = new Map<string, string>();
  for (const row of ownerPerfRaw) {
    if (row.owner_external_id) ownerNames.set(String(row.owner_external_id), String(row.owner_name ?? row.owner_external_id));
  }

  // Agregações de overview
  const totals = pipelineHealthRaw.reduce(
    (acc, r) => {
      acc.open += num(r.open_leads);
      acc.won += num(r.won_leads);
      acc.lost += num(r.lost_leads);
      acc.openValue += num(r.open_pipeline_value);
      return acc;
    },
    { open: 0, won: 0, lost: 0, openValue: 0 },
  );
  const totalLeads = totals.open + totals.won + totals.lost;

  const fq = forecastRaw[0] ?? {};
  const dq = dataQualityRaw[0] ?? {};

  // Counts dos samples (universo total) — usamos o tamanho das views (limited acima → fazemos count="exact" via head para ter o número real)
  const headCount = async (view: string): Promise<number> => {
    const { count } = await supabase.from(view as never).select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
    return count ?? 0;
  };
  const [noNextCount, stuckCount, overdueCount, dupCount] = await Promise.all([
    headCount("vw_no_next_action"),
    headCount("vw_leads_stuck_by_stage"),
    headCount("vw_overdue_tasks"),
    headCount("vw_duplicate_contacts"),
  ]);

  // Owner concentration (top 3) sobre valor em aberto
  const ownersSorted = [...ownerPerfRaw].sort((a, b) => num(b.open_value) - num(a.open_value));
  const top3OpenValue = ownersSorted.slice(0, 3).reduce((s, o) => s + num(o.open_value), 0);
  const concentrationTop3 = totals.openValue > 0 ? (top3OpenValue / totals.openValue) * 100 : 0;

  // Loss reasons — separa "(não informado)" pra contagem
  const lostReasons = lostReasonsRaw.map((r) => ({ lost_reason: r.lost_reason ?? "(não informado)", cnt: num(r.cnt) }));
  const lostWithoutReasonCount = lostReasons.find((r) => r.lost_reason === "(não informado)")?.cnt ?? 0;

  // ── Scores 0-100 (heurística determinística) ─────────────────────────────
  const pctNoValue = totals.open > 0 ? num(fq.open_without_value) / totals.open : 0;
  const pctNoEmail = num(dq.contacts_total) > 0 ? num(dq.contacts_no_email) / num(dq.contacts_total) : 0;
  const pctDuplicates = num(dq.contacts_total) > 0 ? dupCount / num(dq.contacts_total) : 0;
  const pctNoNextAction = totals.open > 0 ? noNextCount / totals.open : 0;
  const pctStuck = totals.open > 0 ? stuckCount / totals.open : 0;
  const pctOverdue = (overdueCount + 1) / (totals.open + 1);

  const hygiene = Math.max(0, Math.round(100 - (pctNoEmail * 30 + pctDuplicates * 50 + pctNoValue * 20)));
  const discipline = Math.max(0, Math.round(100 - (pctNoNextAction * 50 + pctStuck * 30 + pctOverdue * 20)));
  const forecast = Math.max(0, Math.round(100 - pctNoValue * 100));
  const risk = Math.max(0, Math.round(100 - (concentrationTop3 / 100) * 60 - pctNoNextAction * 20));
  const engagement = 50; // sem série temporal de notas no schema atual
  const general = Math.round((hygiene + discipline + forecast + risk + engagement) / 5);

  // ── Gaps & strengths derivados ───────────────────────────────────────────
  const gaps: { category: string; title: string; detail: string; severity: "high" | "medium" | "low" }[] = [];
  if (pctNoValue > 0.3) {
    gaps.push({
      category: "forecast",
      title: `${Math.round(pctNoValue * 100)}% das abertas sem valor`,
      detail: `${num(fq.open_without_value).toLocaleString("pt-BR")} oportunidades em aberto sem valor preenchido — forecast incompleto.`,
      severity: pctNoValue > 0.5 ? "high" : "medium",
    });
  }
  if (pctNoNextAction > 0.4) {
    gaps.push({
      category: "discipline",
      title: `${Math.round(pctNoNextAction * 100)}% das abertas sem próxima ação`,
      detail: `${noNextCount.toLocaleString("pt-BR")} leads abertos não têm tarefa em aberto no Kommo — risco alto de leads esquecidos.`,
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
      title: `${overdueCount.toLocaleString("pt-BR")} tarefas vencidas`,
      detail: "Tarefas com data de vencimento no passado e sem conclusão.",
      severity: overdueCount > 50 ? "high" : "medium",
    });
  }
  if (pctNoEmail > 0.3) {
    gaps.push({
      category: "hygiene",
      title: `${Math.round(pctNoEmail * 100)}% dos contatos sem e-mail`,
      detail: `${num(dq.contacts_no_email).toLocaleString("pt-BR")} contatos sem endereço de e-mail — alcance comprometido.`,
      severity: "medium",
    });
  }
  if (dupCount > 0) {
    gaps.push({
      category: "hygiene",
      title: `${dupCount.toLocaleString("pt-BR")} grupos de e-mail duplicados`,
      detail: "Contatos compartilham mesmo e-mail — risco de mensagens duplicadas e métricas infladas.",
      severity: dupCount > 100 ? "high" : "medium",
    });
  }
  if (lostWithoutReasonCount > 0) {
    gaps.push({
      category: "loss",
      title: `${lostWithoutReasonCount.toLocaleString("pt-BR")} perdas sem motivo`,
      detail: "Análise de win/loss inviabilizada — padronize motivo de perda no fechamento.",
      severity: "high",
    });
  }
  if (concentrationTop3 > 50) {
    gaps.push({
      category: "risk",
      title: `Concentração de valor em top 3: ${concentrationTop3.toFixed(1)}%`,
      detail: "Dependência elevada de poucas contas — risco de receita.",
      severity: "medium",
    });
  }

  const strengths: { title: string; detail: string }[] = [];
  if (totals.open > 100) {
    strengths.push({ title: "Pipeline ativo", detail: `${totals.open.toLocaleString("pt-BR")} oportunidades em aberto — base saudável de volume.` });
  }
  if (overdueCount === 0) {
    strengths.push({ title: "Tarefas em dia", detail: "Nenhuma tarefa vencida no snapshot — disciplina de follow-up está mantida." });
  }
  if (num(dq.contacts_no_phone) === 0 || (num(dq.contacts_total) > 0 && num(dq.contacts_no_phone) / num(dq.contacts_total) < 0.05)) {
    strengths.push({ title: "Telefones preenchidos", detail: "Quase todos os contatos têm telefone cadastrado." });
  }

  // ── Sample rows (top N de cada problema) ────────────────────────────────
  const noNextRows = noNextRaw.map((l) =>
    leadToEvidenceRow(l, {
      pipelineNames,
      stageNames,
      ownerNames,
      problem: "Sem próxima ação aberta",
      severity: "high",
      recommendation: "Crie tarefa de follow-up no Kommo nas próximas 24h.",
    }),
  );
  const stuckRows = stuckRaw.map((l) => leadToEvidenceRow(l, {
    pipelineNames, stageNames, ownerNames,
    problem: "Sem atualização há mais de 7 dias",
    recommendation: "Avalie contato direto, mover de etapa, ou desqualificar.",
  }));
  const overdueRows = overdueRaw.map((t) => ({
    entity_type: "task",
    external_id: t.external_id,
    name: String(t.title ?? "(tarefa sem título)"),
    owner_name: ownerNames.get(String(t.assignee_external_id ?? "")) ?? "—",
    pipeline_name: "—",
    stage_name: "—",
    value: null,
    days_overdue: t.due_at ? Math.max(0, Math.floor((Date.now() - new Date(t.due_at).getTime()) / 86400000)) : null,
    updated_at: t.due_at ?? null,
    problem: "Tarefa vencida sem conclusão",
    severity: "high" as const,
    recommendation: "Conclua, reagende ou cancele a tarefa no Kommo.",
    lead_external_id: t.lead_external_id ?? null,
  }));

  // No owner / no value / no source / lost without reason — derivar a partir do que temos
  const noOwnerRows = noNextRaw
    .filter((l) => !l.owner_external_id)
    .slice(0, 30)
    .map((l) => leadToEvidenceRow(l, { pipelineNames, stageNames, ownerNames, problem: "Sem responsável atribuído", severity: "high", recommendation: "Atribua dono no Kommo." }));
  const noValueRows = noNextRaw
    .filter((l) => !l.value || num(l.value) === 0)
    .slice(0, 30)
    .map((l) => leadToEvidenceRow(l, { pipelineNames, stageNames, ownerNames, problem: "Valor zerado / sem forecast", severity: "medium", recommendation: "Estime valor da oportunidade no Kommo." }));
  const noSourceRows = noNextRaw
    .filter((l) => !l.source)
    .slice(0, 30)
    .map((l) => leadToEvidenceRow(l, { pipelineNames, stageNames, ownerNames, problem: "Origem/canal não rastreado", severity: "medium", recommendation: "Preencha origem/UTM no cadastro." }));

  // Duplicates — passamos como rows simples
  const dupRows = dupEmailsRaw.map((d) => ({
    entity_type: "contact_group",
    external_id: d.email_norm,
    name: String(d.email_norm ?? "—"),
    owner_name: "—",
    pipeline_name: "—",
    stage_name: "—",
    value: null,
    updated_at: null,
    problem: `${num(d.cnt)} contatos com mesmo e-mail`,
    severity: num(d.cnt) >= 4 ? "critical" : num(d.cnt) >= 3 ? "high" : "medium",
    recommendation: "Mesclar contatos no Kommo (Configurações → Duplicidade).",
  }));

  // Owner operational — cruza owner_performance com no_next/stuck por owner_external_id
  const noNextByOwner = new Map<string, number>();
  for (const l of noNextRaw) noNextByOwner.set(String(l.owner_external_id ?? ""), (noNextByOwner.get(String(l.owner_external_id ?? "")) ?? 0) + 1);
  const stuckByOwner = new Map<string, number>();
  for (const l of stuckRaw) stuckByOwner.set(String(l.owner_external_id ?? ""), (stuckByOwner.get(String(l.owner_external_id ?? "")) ?? 0) + 1);

  const ownerOperational = ownerPerfRaw.map((o) => {
    const oid = String(o.owner_external_id ?? "");
    const open = num(o.open_leads);
    const noNext = noNextByOwner.get(oid) ?? 0;
    const stuck = stuckByOwner.get(oid) ?? 0;
    const ratio = open > 0 ? (noNext * 0.6 + stuck * 0.4) / open : 0;
    const operationalRisk = Math.min(100, Math.round(ratio * 100));
    return {
      owner_name: o.owner_name,
      open_leads: open,
      open_value: num(o.open_value),
      no_next_action_open: noNext,
      stuck_open: stuck,
      overdue_tasks: 0, // sem mapping por owner em vw_overdue_tasks (assignee → owner)
      operational_risk_0_100: operationalRisk,
    };
  });

  // Stage distribution (a partir de vw_stage_conversion)
  const stageDistribution = stageConvRaw.map((s) => ({
    stage_name: s.stage_name,
    lead_count: num(s.lead_count),
    pct_of_open_pipeline: num(s.pct_of_open_pipeline),
  }));

  // Stage loss breakdown (a partir de vw_pipeline_health onde lost_leads > 0)
  const stageLoss = pipelineHealthRaw
    .filter((r) => num(r.lost_leads) > 0)
    .map((r) => ({ stage_name: r.stage_name ?? r.stage_external_id, lost_count: num(r.lost_leads) }));

  // Engagement counts (proxy): sem série temporal de notas — estimamos via funnel_velocity (rotatividade)
  const avgVelocity = funnelVelRaw.length > 0
    ? funnelVelRaw.reduce((s, r) => s + num(r.avg_days_in_stage_proxy), 0) / funnelVelRaw.length
    : 0;

  // ── Payload final no shape do CrmAuditDashboard.tsx ──────────────────────
  return {
    last_sync_at: new Date().toISOString(),
    overview: {
      total_leads_all_status: totalLeads,
      total_active_leads: totals.open,
      total_won_leads: totals.won,
      total_lost_leads: totals.lost,
      total_open_pipeline_value: totals.openValue,
      open_leads_without_value: num(fq.open_without_value),
      open_leads_without_owner: noOwnerRows.length, // amostra; universo real via RLS bloqueado
      open_leads_without_source: noSourceRows.length,
    },
    scores: {
      crm_data_quality_0_100: hygiene,
      operation_0_100: discipline,
    },
    executive_scoreboard: {
      scores: {
        general_0_100: general,
        hygiene_0_100: hygiene,
        discipline_0_100: discipline,
        risk_commercial_0_100: risk,
        forecast_0_100: forecast,
        engagement_0_100: engagement,
      },
      meta: {
        source: "supabase_views",
        weights_note: "Scores heurísticos calculados sobre views agregadas (sem série temporal).",
      },
    },
    data_quality_breakdown: {
      contacts_without_email: num(dq.contacts_no_email),
      contacts_without_phone: num(dq.contacts_no_phone),
      duplicate_email_keys: dupCount,
    },
    gaps_and_risks: gaps,
    strengths,
    samples: {
      counts: {
        no_next_action_leads: noNextCount,
        overdue_tasks: overdueCount,
        stuck_leads: stuckCount,
      },
      no_next_action_leads: noNextRaw.slice(0, 8).map((l) => ({ external_id: l.external_id, name: l.name })),
      overdue_tasks: overdueRaw.slice(0, 8).map((t) => ({ external_id: t.external_id, title: t.title })),
      stuck_leads: stuckRaw.slice(0, 8).map((l) => ({ external_id: l.external_id, name: l.name, days_stuck: l.days_since_update })),
    },
    stage_distribution: stageDistribution,
    pipeline_health: pipelineHealthRaw.map((r) => ({
      stage_name: r.stage_name,
      pipeline_name: r.pipeline_name,
      lost_leads: num(r.lost_leads),
      open_leads: num(r.open_leads),
      won_leads: num(r.won_leads),
      open_pipeline_value: num(r.open_pipeline_value),
    })),
    owners: ownerPerfRaw.map((o) => ({
      owner_name: o.owner_name,
      open_leads: num(o.open_leads),
      won_leads: num(o.won_leads),
      lost_leads: num(o.lost_leads),
      open_value: num(o.open_value),
    })),
    lost_reasons: lostReasons,
    audit_enrichment: {
      owner_operational: ownerOperational,
      task_metrics: {
        total: undefined, // requer crm_tasks (RLS bloqueia direto, sem view total)
        open: undefined,
        completed: undefined,
        overdue: overdueCount,
        avg_overdue_days: overdueRows.length > 0 ? Math.round(overdueRows.reduce((s, r) => s + (r.days_overdue ?? 0), 0) / overdueRows.length) : undefined,
      },
      financial_snapshot: {
        won_pipeline_value: undefined, // sem agregação por valor de ganhas em vw_owner_performance/pipeline
        lost_pipeline_value: undefined,
        avg_ticket_open: totals.open > 0 ? Math.round(totals.openValue / totals.open) : 0,
        open_value_concentration_top3_pct: concentrationTop3,
      },
      loss_metrics: {
        lost_without_reason_count: lostWithoutReasonCount,
        total_lost: totals.lost,
      },
      stage_loss_breakdown: stageLoss,
    },
    engagement: {
      counts: {
        avg_days_per_stage: Math.round(avgVelocity),
      },
    },
    sync_stats: {
      pipelines: pipelineNames.size,
      stages: stageNames.size,
      users: ownerNames.size,
      leads: totalLeads,
      contacts: num(dq.contacts_total),
      open_pipeline_value: Math.round(totals.openValue),
    },
    extended_catalog: {
      // sem tabela acessível — vazio (nomes podem aparecer como IDs em motivos de perda)
      loss_reasons: [],
    },
    evidence_tables: {
      rows: {
        no_next_action: noNextRows,
        no_owner: noOwnerRows,
        no_value: noValueRows,
        no_source: noSourceRows,
        overdue_tasks: overdueRows,
        stuck_leads: stuckRows,
        lost_without_reason: [],
        incomplete_contacts: [],
        duplicate_email_groups: dupRows,
        stage_bottlenecks: stageDistribution
          .filter((s) => s.pct_of_open_pipeline > 20)
          .map((s) => ({
            entity_type: "stage",
            external_id: s.stage_name,
            name: s.stage_name,
            owner_name: "—",
            pipeline_name: "—",
            stage_name: s.stage_name,
            value: null,
            updated_at: null,
            problem: `Concentra ${s.pct_of_open_pipeline}% do pipeline aberto`,
            severity: s.pct_of_open_pipeline > 40 ? "critical" : "high",
            recommendation: "Investigue gargalo: critério de saída pouco claro ou capacidade insuficiente nessa etapa.",
          })),
      },
      counts: {
        no_next_action: noNextCount,
        no_owner: noOwnerRows.length,
        no_value: noValueRows.length,
        no_source: noSourceRows.length,
        overdue_tasks: overdueCount,
        stuck_leads: stuckCount,
        lost_without_reason: lostWithoutReasonCount,
        incomplete_contacts: num(dq.contacts_no_email) + num(dq.contacts_no_phone),
        duplicate_email_groups: dupCount,
        stage_bottlenecks: stageDistribution.filter((s) => s.pct_of_open_pipeline > 20).length,
      },
      meta: {
        stuck_threshold_days: 7,
        row_cap: 60,
        source: "supabase_views",
      },
    },
  };
}

/**
 * Parecer determinístico (sem LLM) — usado quando a chamada de IA falha.
 * Compila um relatório sólido a partir do mesmo payload para a aba Parecer IA.
 */
export function buildDeterministicAnalysisReport(payload: AnyRow): AnyRow {
  const ov = (payload.overview ?? {}) as Record<string, number>;
  const scores = (payload.executive_scoreboard as { scores?: Record<string, number> })?.scores ?? {};
  const fin = ((payload.audit_enrichment as { financial_snapshot?: Record<string, number> })?.financial_snapshot) ?? {};
  const lossM = ((payload.audit_enrichment as { loss_metrics?: Record<string, number> })?.loss_metrics) ?? {};
  const dq = (payload.data_quality_breakdown ?? {}) as Record<string, number>;
  const samples = (payload.samples as { counts?: Record<string, number> })?.counts ?? {};
  const owners = (payload.owners ?? []) as { owner_name?: string; open_leads?: number; open_value?: number }[];
  const gaps = (payload.gaps_and_risks ?? []) as { title?: string; detail?: string; severity?: string }[];
  const ph = (payload.pipeline_health ?? []) as { pipeline_name?: string; open_leads?: number; lost_leads?: number; open_pipeline_value?: number; stage_name?: string }[];

  const overall = scores.general_0_100 ?? 0;
  const verdict =
    overall >= 80 ? "healthy" : overall >= 60 ? "moderate" : overall >= 40 ? "warning" : "critical";

  // Pipeline aggregations
  const pipelineMap = new Map<string, { open: number; lost: number; value: number; bottleneck?: string; bottleneckCount?: number }>();
  for (const r of ph) {
    const k = r.pipeline_name ?? "—";
    const cur = pipelineMap.get(k) ?? { open: 0, lost: 0, value: 0 };
    cur.open += r.open_leads ?? 0;
    cur.lost += r.lost_leads ?? 0;
    cur.value += r.open_pipeline_value ?? 0;
    if (!cur.bottleneckCount || (r.open_leads ?? 0) > cur.bottleneckCount) {
      cur.bottleneck = r.stage_name;
      cur.bottleneckCount = r.open_leads ?? 0;
    }
    pipelineMap.set(k, cur);
  }
  const funnelAnalysis = Array.from(pipelineMap.entries()).map(([name, v]) => {
    const conv = v.open + v.lost > 0 ? Math.round((v.open / (v.open + v.lost)) * 100) : null;
    const sev = v.lost > v.open * 0.5 ? "high" : "medium";
    return {
      pipeline_name: name,
      leads_open: v.open,
      total_value: v.value,
      conversion_rate: conv,
      bottleneck_stage: v.bottleneck ?? null,
      problems: gaps.filter((g) => String(g.severity) === "high").slice(0, 2).map((g) => g.title ?? ""),
      severity: sev,
      recommendation: `Revisar etapa "${v.bottleneck ?? "—"}" — onde concentra a maior parte das abertas.`,
    };
  });

  return {
    overall_verdict: verdict,
    operation_score: overall,
    executive_summary:
      `Snapshot da operação comercial: score geral ${overall}/100 (${verdict}). ` +
      `Higiene ${scores.hygiene_0_100 ?? 0}/100, disciplina ${scores.discipline_0_100 ?? 0}/100, ` +
      `forecast ${scores.forecast_0_100 ?? 0}/100, risco comercial ${scores.risk_commercial_0_100 ?? 0}/100. ` +
      `${ov.total_active_leads ?? 0} oportunidades em aberto somando ${(fin.avg_ticket_open ?? 0) > 0 ? `ticket médio ${(fin.avg_ticket_open ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "valor não dimensionável"}.\n\n` +
      `Principais atritos detectados: ${gaps.slice(0, 3).map((g) => g.title).join("; ")}.`,
    main_bottlenecks: gaps.slice(0, 5).map((g) => ({
      title: g.title,
      detail: g.detail,
      severity: g.severity ?? "medium",
      metric: undefined,
      root_cause: "—",
      financial_impact: "—",
    })),
    funnel_analysis: funnelAnalysis,
    task_discipline: {
      overdue_tasks: samples.overdue_tasks ?? 0,
      no_next_action: samples.no_next_action_leads ?? 0,
      stuck_leads: samples.stuck_leads ?? 0,
      stuck_threshold_days: 7,
      severity: (samples.no_next_action_leads ?? 0) > (ov.total_active_leads ?? 1) * 0.4 ? "high" : "medium",
      assessment: `${samples.no_next_action_leads ?? 0} leads sem próxima ação e ${samples.stuck_leads ?? 0} parados há mais de 7 dias.`,
      pattern: "Leads acumulando sem follow-up sistemático.",
    },
    data_hygiene: {
      score_0_100: scores.hygiene_0_100 ?? 0,
      diagnosis: `${(dq.contacts_without_email ?? 0).toLocaleString("pt-BR")} contatos sem e-mail e ${(dq.duplicate_email_keys ?? 0).toLocaleString("pt-BR")} grupos duplicados — base de contatos requer limpeza.`,
      issues: [
        ...(dq.contacts_without_email ? [{ title: "Contatos sem e-mail", qty: dq.contacts_without_email, severity: "medium" as const, fix: "Importar e-mails do CRM origem ou enriquecer via Apollo/Lusha." }] : []),
        ...(dq.duplicate_email_keys ? [{ title: "E-mails duplicados", qty: dq.duplicate_email_keys, severity: "high" as const, fix: "Mesclar contatos no Kommo." }] : []),
      ],
    },
    commercial_risks: gaps.filter((g) => g.severity === "high").slice(0, 5).map((g) => ({
      title: g.title,
      detail: g.detail,
      financial_impact: undefined,
      urgency: "short_term",
    })),
    owner_analysis: owners.slice(0, 10).map((o) => ({
      owner: o.owner_name,
      open_leads: o.open_leads,
      open_value: o.open_value,
      assessment: `${(o.open_leads ?? 0).toLocaleString("pt-BR")} oportunidades em aberto.`,
      concerns: (o.open_leads ?? 0) > 500 ? "Sobrecarga aparente — distribuir entre time." : "Sem preocupações críticas identificadas.",
      risk_level: (o.open_leads ?? 0) > 1000 ? "critical" : (o.open_leads ?? 0) > 500 ? "high" : "low",
    })),
    lost_reason_analysis: {
      total_lost: ov.total_lost_leads ?? 0,
      without_reason_pct: (ov.total_lost_leads ?? 0) > 0 ? ((lossM.lost_without_reason_count ?? 0) / (ov.total_lost_leads ?? 1)) * 100 : 0,
      insight: `${(lossM.lost_without_reason_count ?? 0).toLocaleString("pt-BR")} perdas sem motivo registrado — análise win/loss inviabilizada.`,
      top_reasons: ((payload.lost_reasons ?? []) as { lost_reason?: string; cnt?: number }[]).slice(0, 6).map((r) => ({
        reason: r.lost_reason,
        count: r.cnt,
        pct: (ov.total_lost_leads ?? 0) > 0 ? ((r.cnt ?? 0) / (ov.total_lost_leads ?? 1)) * 100 : 0,
        suggestion: r.lost_reason === "(não informado)" ? "Tornar campo obrigatório no fechamento como Perdido." : undefined,
      })),
      recommendation: "Padronizar enum de motivos de perda + win/loss review quinzenal.",
    },
    action_plan: {
      immediate_7d: gaps.filter((g) => g.severity === "high").slice(0, 5).map((g) => `Endereçar: ${g.title}`),
      short_term_15d: gaps.filter((g) => g.severity === "medium").slice(0, 5).map((g) => `Resolver: ${g.title}`),
      structural_30d: [
        "Implementar enum obrigatório para motivo de perda no fechamento.",
        "Configurar regra no Kommo: leads abertos sem tarefa há +3 dias geram alerta.",
        "Win/loss review quinzenal com SDR + CSM.",
      ],
    },
    recommendations_next_7_days: gaps.filter((g) => g.severity === "high").slice(0, 5).map((g) => g.title ?? ""),
    model_used: "deterministic_v1 (sem LLM)",
  };
}
