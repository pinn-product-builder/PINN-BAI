import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeNum(v: unknown): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? 0)) || 0;
}

function pct(num: number, den: number): string {
  if (!den) return "N/A";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ── Context builder ────────────────────────────────────────────────────────────

interface CalculationTrail {
  key: string;
  label: string;
  formula: string;
  inputs: Record<string, string | number>;
  value: string;
  available: boolean;
}

interface DataContextResult {
  text: string;
  trail: CalculationTrail[];
}

interface ClientLeadStats {
  totalLeads: number;
  totalConverted: number;
  totalRevenue: number;
  avgTicket: number;
  statusDist: Record<string, number>;
  sourceDist: Record<string, number>;
  source: "kommo_leads" | "leads";
}

interface LeadRow {
  name?: string | null;
  email?: string | null;
  company?: string | null;
  status?: string | null;
  source?: string | null;
  value?: number | null;
  created_at?: string | null;
  converted_at?: string | null;
}

function brDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

// Quando a org tem integração Supabase conectada (ex.: BF Company), os leads ficam
// no projeto externo do cliente em `kommo_leads` — não na tabela interna `leads`.
// Esta função tenta ler de lá; retorna null se a org não tiver integração ou se a
// tabela `kommo_leads` não existir no projeto remoto.
// Busca a lista nominal de leads no Supabase externo do cliente (kommo_leads).
// Schema é flexível — tentamos colunas comuns (nome/name, empresa/company, etc.).
// Retorna null se a org não tem integração ou kommo_leads não existe.
async function fetchLeadListsFromClientSupabase(
  internalSupabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<{ top: Record<string, unknown>[]; recent: Record<string, unknown>[] } | null> {
  try {
    const { data: integration } = await internalSupabase
      .from("integrations")
      .select("config")
      .eq("org_id", orgId)
      .eq("type", "supabase")
      .eq("status", "connected")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cfg = (integration?.config ?? {}) as { projectUrl?: string; anonKey?: string };
    if (!cfg.projectUrl || !cfg.anonKey) return null;

    const clientDb = createClient(cfg.projectUrl, cfg.anonKey);

    // Top 15: leads ganhos (venda = true), mais recentes primeiro.
    const topRes = await clientDb
      .from("kommo_leads")
      .select("*")
      .eq("venda", true)
      .order("won_at_iso", { ascending: false, nullsFirst: false })
      .limit(15);

    // Recent 15: qualquer status, ordenado por criação.
    const recentRes = await clientDb
      .from("kommo_leads")
      .select("*")
      .order("created_at_iso", { ascending: false, nullsFirst: false })
      .limit(15);

    if (topRes.error || recentRes.error) {
      console.warn("[ai-data-chat] kommo_leads lists fetch falhou:", topRes.error?.message || recentRes.error?.message);
      return null;
    }

    return {
      top: (topRes.data ?? []) as Record<string, unknown>[],
      recent: (recentRes.data ?? []) as Record<string, unknown>[],
    };
  } catch (err) {
    console.warn("[ai-data-chat] fetchLeadListsFromClientSupabase erro:", err);
    return null;
  }
}

// Formata uma linha vinda do kommo_leads. Schema flex — tenta colunas comuns.
function formatKommoLeadLine(row: Record<string, unknown>): string {
  const pick = (keys: string[]): string | null => {
    for (const k of keys) {
      const v = row[k];
      if (v !== null && v !== undefined && String(v).trim() !== "") return String(v);
    }
    return null;
  };

  const name = pick(["nome", "name", "lead_name", "contact_name", "cliente", "title"]) ?? "—";
  const company = pick(["empresa", "company", "organization", "razao_social", "account_name"]);
  const source = pick(["utm_source", "origem", "source", "channel", "canal"]);
  const stage = row.venda === true
    ? "ganho"
    : row.desqualificado === true
      ? "perdido"
      : row.reuniao_realizada === true
        ? "reunião realizada"
        : row.reuniao_confirmada === true
          ? "reunião confirmada"
          : row.atendimento_feito === true
            ? "atendimento feito"
            : "em andamento";
  const dateIso = pick(["won_at_iso", "created_at_iso", "created_at", "won_at"]);
  const dateStr = dateIso ? brDate(dateIso) : "—";

  return `  - ${name}${company ? ` (${company})` : ""} · ${stage}${source ? ` · fonte: ${source}` : ""} · ${dateStr}`;
}

async function fetchLeadStatsFromClientSupabase(
  internalSupabase: ReturnType<typeof createClient>,
  orgId: string,
  start: string,
  end: string,
): Promise<ClientLeadStats | null> {
  try {
    const { data: integration } = await internalSupabase
      .from("integrations")
      .select("config")
      .eq("org_id", orgId)
      .eq("type", "supabase")
      .eq("status", "connected")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cfg = (integration?.config ?? {}) as { projectUrl?: string; anonKey?: string };
    if (!cfg.projectUrl || !cfg.anonKey) return null;

    const clientDb = createClient(cfg.projectUrl, cfg.anonKey);

    let q = clientDb
      .from("kommo_leads")
      .select("lead_id, venda, encaminhado, atendimento_feito, reuniao_confirmada, reuniao_realizada, desqualificado, utm_source, origem, created_at_iso, won_at_iso", { count: "exact" });
    if (start) q = q.gte("created_at_iso", start);
    if (end) q = q.lte("created_at_iso", end + "T23:59:59");

    const { data, error, count } = await q.limit(5000);
    if (error) {
      console.warn("[ai-data-chat] kommo_leads fetch falhou:", error.message);
      return null;
    }

    const rows = data ?? [];
    if (rows.length === 0 && (count ?? 0) === 0) return null;

    const totalLeads = count ?? rows.length;
    const totalConverted = rows.filter((r) => r.venda === true).length;
    // sem coluna `value` no kommo_leads → ticket médio fica indisponível
    const totalRevenue = 0;
    const avgTicket = 0;

    const statusDist: Record<string, number> = {};
    for (const r of rows) {
      const buckets: Array<[string, unknown]> = [
        ["venda", r.venda],
        ["reuniao_realizada", r.reuniao_realizada],
        ["reuniao_confirmada", r.reuniao_confirmada],
        ["atendimento_feito", r.atendimento_feito],
        ["encaminhado", r.encaminhado],
        ["desqualificado", r.desqualificado],
      ];
      const stage = buckets.find(([, v]) => v === true)?.[0] ?? "sem_status";
      statusDist[stage] = (statusDist[stage] ?? 0) + 1;
    }

    const sourceDist: Record<string, number> = {};
    for (const r of rows) {
      const src = String(r.utm_source ?? r.origem ?? "desconhecido");
      sourceDist[src] = (sourceDist[src] ?? 0) + 1;
    }

    return {
      totalLeads,
      totalConverted,
      totalRevenue,
      avgTicket,
      statusDist,
      sourceDist,
      source: "kommo_leads",
    };
  } catch (err) {
    console.warn("[ai-data-chat] fetchLeadStatsFromClientSupabase erro:", err);
    return null;
  }
}

async function buildDataContext(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  dateRange?: { start: string; end: string },
): Promise<DataContextResult> {
  const start = dateRange?.start?.substring(0, 10) ?? "";
  const end = dateRange?.end?.substring(0, 10) ?? "";

  // Tenta primeiro buscar leads na fonte externa do cliente (integração Supabase).
  // Se a org não tem integração ou não tem kommo_leads, cai no fluxo interno padrão.
  const clientLeadStats = await fetchLeadStatsFromClientSupabase(supabase, orgId, start, end);
  // Quando há fonte externa, também busca a LISTA nominal (top + recent) por lá.
  // O `topLeadsByValueRes` interno provavelmente vai voltar vazio nessas orgs.
  const clientLeadLists = clientLeadStats
    ? await fetchLeadListsFromClientSupabase(supabase, orgId)
    : null;

  const [
    orgRes,
    leadsRes,
    leadsConvRes,
    sourceRes,
    rfmRes,
    churnRes,
    healthSummaryRes,
    healthCriticalRes,
    alertsRes,
    paidTrafficRes,
    // ── Configuração e dados detalhados da org ──
    integrationsRes,
    paidConnectionsRes,
    paidCampaignsRes,
    dashboardsRes,
    widgetsRes,
    goalsRes,
    alertRulesRes,
    topLeadsByValueRes,
    recentLeadsRes,
  ] = await Promise.all([
    supabase.from("organizations").select("name, plan, status, slug, trial_ends_at, created_at").eq("id", orgId).single(),

    // Total leads in period
    (() => {
      let q = supabase.from("leads").select("id, status, value, source, created_at").eq("org_id", orgId);
      if (start) q = q.gte("created_at", start);
      if (end) q = q.lte("created_at", end + "T23:59:59");
      return q.limit(2000);
    })(),

    // Converted in period
    (() => {
      let q = supabase.from("leads").select("id, value").eq("org_id", orgId).eq("status", "converted");
      if (start) q = q.gte("created_at", start);
      if (end) q = q.lte("created_at", end + "T23:59:59");
      return q.limit(2000);
    })(),

    // Source distribution (sem janela de período pra distribuição agregada)
    supabase.from("leads").select("source").eq("org_id", orgId).limit(2000),

    // RFM latest run
    supabase
      .from("rfm_analyses")
      .select("rfm_score, rfm_segment, recency_days, frequency, monetary")
      .eq("org_id", orgId)
      .order("calculated_at", { ascending: false })
      .limit(500),

    // Churn predictions
    supabase
      .from("churn_predictions")
      .select("churn_probability, risk_level")
      .eq("org_id", orgId)
      .order("predicted_at", { ascending: false })
      .limit(500),

    // Customer health summary (counts by band)
    supabase
      .from("customer_health_scores")
      .select("health_band, health_score, trend")
      .eq("org_id", orgId)
      .limit(1000),

    // Critical health scores
    supabase
      .from("customer_health_scores")
      .select("customer_name, health_score, health_band")
      .eq("org_id", orgId)
      .eq("health_band", "critico")
      .order("health_score", { ascending: true })
      .limit(10),

    // Active unresolved alerts
    supabase
      .from("customer_alerts")
      .select("severity, title, customer_name")
      .eq("org_id", orgId)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(30),

    // Paid traffic metrics in period
    (() => {
      let q = supabase
        .from("paid_traffic_daily_metrics")
        .select("platform_slug, spend, impressions, clicks, leads, purchases, purchase_value, ctr, cpl, roas")
        .eq("org_id", orgId);
      if (start) q = q.gte("date", start);
      if (end) q = q.lte("date", end);
      return q.limit(500);
    })(),

    // Integrações ativas configuradas pra org
    supabase
      .from("integrations")
      .select("name, type, status, last_sync_at, sync_error")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(20),

    // Conexões de tráfego pago
    supabase
      .from("paid_traffic_connections")
      .select("platform_slug, account_id, account_name, sync_status, last_sync_at, sync_error")
      .eq("org_id", orgId)
      .limit(20),

    // Top campanhas de tráfego pago (por status)
    supabase
      .from("paid_traffic_campaigns")
      .select("platform_slug, name, status, objective, daily_budget, lifetime_budget")
      .eq("org_id", orgId)
      .order("synced_at", { ascending: false })
      .limit(30),

    // Dashboards configurados pra org
    supabase
      .from("dashboards")
      .select("id, name, description, is_default, created_at, updated_at")
      .eq("org_id", orgId)
      .order("is_default", { ascending: false })
      .order("name")
      .limit(20),

    // Widgets de TODOS os dashboards da org (filtramos depois)
    supabase
      .from("dashboard_widgets")
      .select("dashboard_id, type, title, description, is_visible")
      .eq("is_visible", true)
      .limit(200),

    // Metas configuradas
    supabase
      .from("kpi_goals")
      .select("name, metric_key, target_value, current_value, unit, period_type, period_start, period_end")
      .eq("org_id", orgId)
      .order("period_start", { ascending: false })
      .limit(30),

    // Regras de alerta configuradas
    supabase
      .from("kpi_alert_rules")
      .select("name, metric_key, operator, threshold, severity, channel, enabled, last_triggered_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(30),

    // Top 15 leads convertidos por valor (lista nominal)
    supabase
      .from("leads")
      .select("name, email, company, status, source, value, created_at, converted_at")
      .eq("org_id", orgId)
      .eq("status", "converted")
      .order("value", { ascending: false, nullsFirst: false })
      .limit(15),

    // 15 leads mais recentes (lista nominal)
    supabase
      .from("leads")
      .select("name, email, company, status, source, value, created_at, converted_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const org = orgRes.data;
  const leads = leadsRes.data ?? [];
  const converted = leadsConvRes.data ?? [];
  const allLeadsForSource = sourceRes.data ?? [];
  const rfmRows = rfmRes.data ?? [];
  const churnRows = churnRes.data ?? [];
  const healthRows = healthSummaryRes.data ?? [];
  const criticalCustomers = healthCriticalRes.data ?? [];
  const alerts = alertsRes.data ?? [];
  const paidRows = paidTrafficRes.data ?? [];
  const integrations = integrationsRes.data ?? [];
  const paidConnections = paidConnectionsRes.data ?? [];
  const paidCampaigns = paidCampaignsRes.data ?? [];
  const dashboards = dashboardsRes.data ?? [];
  const widgetsAll = widgetsRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const alertRules = alertRulesRes.data ?? [];
  const topLeadsByValue = (topLeadsByValueRes.data ?? []) as LeadRow[];
  const recentLeads = (recentLeadsRes.data ?? []) as LeadRow[];

  // ── Leads summary ──────────────────────────────────────────────────────────
  // Prefere fonte externa (kommo_leads via integração) quando disponível.
  const useClient = !!clientLeadStats;
  const totalLeads = useClient ? clientLeadStats!.totalLeads : leads.length;
  const totalConverted = useClient ? clientLeadStats!.totalConverted : converted.length;
  const convRate = pct(totalConverted, totalLeads);
  const totalRevenue = useClient
    ? clientLeadStats!.totalRevenue
    : converted.reduce((s, l) => s + safeNum(l.value), 0);
  const avgTicket = totalConverted > 0 ? totalRevenue / totalConverted : 0;

  const statusDist: Record<string, number> = useClient ? { ...clientLeadStats!.statusDist } : {};
  if (!useClient) {
    for (const l of leads) {
      const s = String(l.status ?? "sem_status");
      statusDist[s] = (statusDist[s] ?? 0) + 1;
    }
  }

  const sourceDist: Record<string, number> = useClient ? { ...clientLeadStats!.sourceDist } : {};
  if (!useClient) {
    for (const l of allLeadsForSource) {
      const src = String(l.source ?? "desconhecido");
      sourceDist[src] = (sourceDist[src] ?? 0) + 1;
    }
  }
  const topSources = Object.entries(sourceDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([src, n]) => `${src}: ${n}`)
    .join(", ");

  // ── RFM summary ────────────────────────────────────────────────────────────
  const rfmSegDist: Record<string, number> = {};
  for (const r of rfmRows) {
    const seg = String(r.rfm_segment ?? "?");
    rfmSegDist[seg] = (rfmSegDist[seg] ?? 0) + 1;
  }
  const rfmTop = Object.entries(rfmSegDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s, n]) => `${s}: ${n}`)
    .join(", ");

  // ── Churn summary ──────────────────────────────────────────────────────────
  const highChurn = churnRows.filter((r) => safeNum(r.churn_probability) >= 0.7).length;
  const medChurn = churnRows.filter((r) => {
    const p = safeNum(r.churn_probability);
    return p >= 0.4 && p < 0.7;
  }).length;
  const avgChurnProb =
    churnRows.length > 0
      ? (churnRows.reduce((s, r) => s + safeNum(r.churn_probability), 0) / churnRows.length) * 100
      : 0;

  // ── Health summary ─────────────────────────────────────────────────────────
  const bandCounts: Record<string, number> = { saudavel: 0, atencao: 0, risco: 0, critico: 0 };
  let sumHealth = 0;
  let improvingCount = 0;
  let decliningCount = 0;
  for (const h of healthRows) {
    const band = String(h.health_band ?? "?");
    bandCounts[band] = (bandCounts[band] ?? 0) + 1;
    sumHealth += safeNum(h.health_score);
    if (h.trend === "up") improvingCount++;
    if (h.trend === "down") decliningCount++;
  }
  const avgHealth = healthRows.length > 0 ? Math.round(sumHealth / healthRows.length) : 0;

  const criticalAlerts = alerts.filter((a) => a.severity === "critical").length;
  const warningAlerts = alerts.filter((a) => a.severity === "warning").length;

  // ── Paid traffic summary ───────────────────────────────────────────────────
  const paidByPlatform: Record<string, { spend: number; leads: number; purchases: number; purchase_value: number; impressions: number; clicks: number }> = {};
  for (const m of paidRows) {
    const p = String(m.platform_slug ?? "unknown");
    if (!paidByPlatform[p]) {
      paidByPlatform[p] = { spend: 0, leads: 0, purchases: 0, purchase_value: 0, impressions: 0, clicks: 0 };
    }
    paidByPlatform[p].spend += safeNum(m.spend);
    paidByPlatform[p].leads += safeNum(m.leads);
    paidByPlatform[p].purchases += safeNum(m.purchases);
    paidByPlatform[p].purchase_value += safeNum(m.purchase_value);
    paidByPlatform[p].impressions += safeNum(m.impressions);
    paidByPlatform[p].clicks += safeNum(m.clicks);
  }
  const totalSpend = Object.values(paidByPlatform).reduce((s, p) => s + p.spend, 0);
  const totalPaidLeads = Object.values(paidByPlatform).reduce((s, p) => s + p.leads, 0);
  const totalPurchaseValue = Object.values(paidByPlatform).reduce((s, p) => s + p.purchase_value, 0);
  const globalROAS = totalSpend > 0 ? totalPurchaseValue / totalSpend : 0;
  const globalCPL = totalPaidLeads > 0 ? totalSpend / totalPaidLeads : 0;

  const paidPlatformLines = Object.entries(paidByPlatform)
    .map(([slug, m]) => {
      const roas = m.spend > 0 ? (m.purchase_value / m.spend).toFixed(2) : "N/A";
      const cpl = m.leads > 0 ? brl(m.spend / m.leads) : "N/A";
      return `  ${slug}: gasto=${brl(m.spend)}, leads=${m.leads}, CPL=${cpl}, ROAS=${roas}x, CTR=${pct(m.clicks, m.impressions)}`;
    })
    .join("\n");

  const periodStr = start && end ? `${start} a ${end}` : "todos os dados disponíveis";

  // ── Cruzamentos pré-calculados (para evitar erros de cálculo da IA) ───────
  const cacPaid = totalConverted > 0 && totalSpend > 0 ? totalSpend / totalConverted : 0;
  const marginPerLead = avgTicket > 0 && globalCPL > 0 ? avgTicket - globalCPL : 0;
  const paidShareOfLeads = totalLeads > 0 && totalPaidLeads > 0 ? (totalPaidLeads / totalLeads) * 100 : 0;
  const grossProfitFromAds = totalPurchaseValue - totalSpend;
  const convRateNum = totalLeads > 0 ? (totalConverted / totalLeads) * 100 : 0;

  // ── Trilha de auditoria dos cálculos ───────────────────────────────────────
  const trail: CalculationTrail[] = [
    {
      key: "conversion_rate",
      label: "Taxa de conversão",
      formula: "convertidos ÷ leads × 100",
      inputs: { convertidos: totalConverted, leads: totalLeads },
      value: totalLeads > 0 ? `${convRateNum.toFixed(1)}%` : "indisponível",
      available: totalLeads > 0,
    },
    {
      key: "avg_ticket",
      label: "Ticket médio",
      formula: "receita ÷ convertidos",
      inputs: { receita: brl(totalRevenue), convertidos: totalConverted },
      value: totalConverted > 0 ? brl(avgTicket) : "indisponível",
      available: totalConverted > 0,
    },
    {
      key: "global_roas",
      label: "ROAS global",
      formula: "receita_compras ÷ investimento",
      inputs: { receita_compras: brl(totalPurchaseValue), investimento: brl(totalSpend) },
      value: totalSpend > 0 ? `${globalROAS.toFixed(2)}x` : "indisponível",
      available: totalSpend > 0,
    },
    {
      key: "global_cpl",
      label: "CPL global",
      formula: "investimento ÷ leads_pagos",
      inputs: { investimento: brl(totalSpend), leads_pagos: totalPaidLeads },
      value: totalPaidLeads > 0 ? brl(globalCPL) : "indisponível",
      available: totalPaidLeads > 0,
    },
    {
      key: "cac_via_ads",
      label: "CAC via Ads",
      formula: "investimento_total ÷ convertidos",
      inputs: { investimento_total: brl(totalSpend), convertidos: totalConverted },
      value: cacPaid > 0 ? brl(cacPaid) : "indisponível",
      available: cacPaid > 0,
    },
    {
      key: "margin_per_lead",
      label: "Margem por lead pago",
      formula: "ticket_medio − CPL",
      inputs: { ticket_medio: brl(avgTicket), CPL: brl(globalCPL) },
      value: marginPerLead !== 0 ? brl(marginPerLead) : "indisponível",
      available: marginPerLead !== 0,
    },
    {
      key: "paid_share",
      label: "Participação de Ads no funil",
      formula: "leads_pagos ÷ leads_totais × 100",
      inputs: { leads_pagos: totalPaidLeads, leads_totais: totalLeads },
      value: paidShareOfLeads > 0 ? `${paidShareOfLeads.toFixed(1)}%` : "indisponível",
      available: paidShareOfLeads > 0,
    },
    {
      key: "gross_profit_ads",
      label: "Lucro bruto dos Ads",
      formula: "receita_compras − investimento",
      inputs: { receita_compras: brl(totalPurchaseValue), investimento: brl(totalSpend) },
      value: totalSpend > 0 ? brl(grossProfitFromAds) : "indisponível",
      available: totalSpend > 0,
    },
  ];

  // ── Listagens nominais e configuração da org ──────────────────────────────
  const dashIdToName = new Map<string, string>();
  for (const d of dashboards) dashIdToName.set(String(d.id), String(d.name));

  const widgetsByDash: Record<string, Array<{ type: string; title: string }>> = {};
  for (const w of widgetsAll) {
    const dashId = String(w.dashboard_id);
    if (!dashIdToName.has(dashId)) continue;
    if (!widgetsByDash[dashId]) widgetsByDash[dashId] = [];
    widgetsByDash[dashId].push({ type: String(w.type ?? ""), title: String(w.title ?? "") });
  }

  const dashboardLines = dashboards.length > 0
    ? dashboards.map((d) => {
        const ws = widgetsByDash[String(d.id)] ?? [];
        const wList = ws.slice(0, 8).map((w) => `${w.title} (${w.type})`).join(", ");
        const moreCount = ws.length > 8 ? ` (+${ws.length - 8} widgets)` : "";
        return `  - "${d.name}"${d.is_default ? " [padrão]" : ""}${d.description ? ` — ${d.description}` : ""}\n    Widgets: ${wList || "nenhum configurado"}${moreCount}`;
      }).join("\n")
    : "  Nenhum dashboard configurado.";

  const integrationsLines = integrations.length > 0
    ? integrations.map((i) => `  - ${i.name} (${i.type}) — status: ${i.status}${i.last_sync_at ? `, última sync: ${brDate(i.last_sync_at as string)}` : ""}${i.sync_error ? ` ⚠️ erro: ${i.sync_error}` : ""}`).join("\n")
    : "  Nenhuma integração configurada.";

  const paidConnLines = paidConnections.length > 0
    ? paidConnections.map((c) => `  - ${c.platform_slug}: ${c.account_name ?? c.account_id ?? "—"} — status: ${c.sync_status}${c.last_sync_at ? `, última sync: ${brDate(c.last_sync_at as string)}` : ""}${c.sync_error ? ` ⚠️ ${c.sync_error}` : ""}`).join("\n")
    : "  Nenhuma conta de tráfego pago conectada.";

  const activeCampaigns = paidCampaigns.filter((c) => String(c.status).toUpperCase() === "ACTIVE");
  const campaignLines = paidCampaigns.length > 0
    ? paidCampaigns.slice(0, 15).map((c) => `  - [${c.platform_slug}] "${c.name}" — ${c.status}${c.objective ? ` · ${c.objective}` : ""}${c.daily_budget ? ` · diário ${brl(safeNum(c.daily_budget))}` : ""}${c.lifetime_budget ? ` · vitalício ${brl(safeNum(c.lifetime_budget))}` : ""}`).join("\n")
    : "  Nenhuma campanha sincronizada.";

  const goalsLines = goals.length > 0
    ? goals.slice(0, 10).map((g) => {
        const target = safeNum(g.target_value);
        const cur = safeNum(g.current_value);
        const progress = target > 0 ? Math.round((cur / target) * 100) : 0;
        const fmt = g.unit === "currency" ? brl : (n: number) => `${n}${g.unit === "percent" ? "%" : ""}`;
        return `  - "${g.name}" (${g.metric_key}) — atual ${fmt(cur)} / alvo ${fmt(target)} (${progress}%) · ${g.period_type} ${g.period_start}→${g.period_end}`;
      }).join("\n")
    : "  Nenhuma meta configurada.";

  const alertRulesLines = alertRules.length > 0
    ? alertRules.slice(0, 10).map((r) => `  - "${r.name}" (${r.metric_key} ${r.operator} ${r.threshold}) — severidade: ${r.severity} · ${r.enabled ? "ativa" : "desativada"}${r.last_triggered_at ? `, último disparo: ${brDate(r.last_triggered_at as string)}` : ""}`).join("\n")
    : "  Nenhuma regra de alerta configurada.";

  const formatLeadLine = (l: LeadRow): string => {
    const name = l.name ?? "—";
    const company = l.company ? ` (${l.company})` : "";
    const valueStr = l.value && safeNum(l.value) > 0 ? ` · ${brl(safeNum(l.value))}` : "";
    const status = l.status ? ` · ${l.status}` : "";
    const src = l.source ? ` · fonte: ${l.source}` : "";
    const date = l.converted_at ? ` · convertido em ${brDate(l.converted_at)}` : ` · criado em ${brDate(l.created_at)}`;
    return `  - ${name}${company}${valueStr}${status}${src}${date}`;
  };

  // Prioridade: externo (kommo_leads) → interno (leads) → mensagem de vazio.
  const topLeadsLines = clientLeadLists && clientLeadLists.top.length > 0
    ? clientLeadLists.top.map(formatKommoLeadLine).join("\n")
    : topLeadsByValue.length > 0
      ? topLeadsByValue.map(formatLeadLine).join("\n")
      : "  NENHUM LEAD CONVERTIDO REGISTRADO. Não invente exemplos.";

  const recentLeadsLines = clientLeadLists && clientLeadLists.recent.length > 0
    ? clientLeadLists.recent.map(formatKommoLeadLine).join("\n")
    : recentLeads.length > 0
      ? recentLeads.map(formatLeadLine).join("\n")
      : "  NENHUM LEAD CADASTRADO. Não invente exemplos.";

  const text = `
## Dados da Organização: "${org?.name ?? "Cliente"}" | Período: ${periodStr}

### 0.A Identidade da Organização
- Nome: ${org?.name ?? "—"}
- Slug: ${org?.slug ?? "—"} | Plano: ${org?.plan ?? "—"} | Status: ${org?.status ?? "—"}${org?.trial_ends_at ? ` | Trial termina em ${brDate(org.trial_ends_at as string)}` : ""}
- Criada em: ${brDate(org?.created_at as string | null | undefined)}

### 0.B Integrações Ativas
${integrationsLines}

### 0.C Contas de Tráfego Pago Conectadas
${paidConnLines}

### 0.D Dashboards Configurados
${dashboardLines}

### 0.E Metas Ativas
${goalsLines}

### 0.F Regras de Alerta Configuradas
${alertRulesLines}

### 1. Funil de Vendas (CRM)
- Leads no período: ${totalLeads}
- Convertidos: ${totalConverted} (taxa de conversão: ${convRate})
- Receita gerada: ${brl(totalRevenue)}
- Ticket médio: ${brl(avgTicket)}
- Distribuição por status: ${Object.entries(statusDist).map(([k, v]) => `${k}: ${v}`).join(", ") || "sem dados"}
- Top fontes de leads: ${topSources || "sem dados"}

### 1.A Top 15 Leads Convertidos (por valor)
${topLeadsLines}

### 1.B 15 Leads Mais Recentes
${recentLeadsLines}

### 2. Tráfego Pago
${
  totalSpend > 0
    ? `- Investimento total: ${brl(totalSpend)}
- Leads gerados via ads: ${totalPaidLeads}
- Receita de compras: ${brl(totalPurchaseValue)}
- ROAS global: ${globalROAS.toFixed(2)}x
- CPL global: ${brl(globalCPL)}
- Por plataforma:
${paidPlatformLines || "  (sem dados por plataforma)"}`
    : "- Sem dados de tráfego pago para o período"
}

### 2.A Campanhas (top 15 por sincronização recente)
- Campanhas ativas: ${activeCampaigns.length} de ${paidCampaigns.length}
${campaignLines}

### 3. Saúde dos Clientes (Customer Health)
${
  healthRows.length > 0
    ? `- Score médio: ${avgHealth}/100
- Saudável: ${bandCounts.saudavel} | Atenção: ${bandCounts.atencao} | Em Risco: ${bandCounts.risco} | Crítico: ${bandCounts.critico}
- Clientes melhorando: ${improvingCount} | Piorando: ${decliningCount}
- Clientes críticos (piores scores): ${criticalCustomers.map((c) => `${c.customer_name ?? "?"} (${c.health_score})`).join(", ") || "nenhum"}`
    : "- Sem dados de health score calculados ainda"
}

### 4. Alertas Ativos
- Críticos: ${criticalAlerts} | Avisos: ${warningAlerts}
${alerts.slice(0, 5).map((a) => `  - [${a.severity}] ${a.customer_name ?? "?"}: ${a.title}`).join("\n") || "  Nenhum alerta ativo"}

### 5. Segmentação RFM
${
  rfmRows.length > 0
    ? `- Total analisado: ${rfmRows.length} clientes
- Distribuição por segmento: ${rfmTop || "sem dados"}
- Recência média (dias): ${rfmRows.length > 0 ? Math.round(rfmRows.reduce((s, r) => s + safeNum(r.recency_days), 0) / rfmRows.length) : "N/A"}`
    : "- Sem análise RFM disponível"
}

### 6. Risco de Churn
${
  churnRows.length > 0
    ? `- Total com predição: ${churnRows.length}
- Alto risco (≥70%): ${highChurn} clientes
- Médio risco (40-70%): ${medChurn} clientes
- Probabilidade média de churn: ${avgChurnProb.toFixed(1)}%`
    : "- Sem predições de churn disponíveis"
}

### 7. Cruzamentos Pré-Calculados (use estes números, não recalcule)
${trail.filter(t => t.available).map(t => `- ${t.label} = ${t.value} [fórmula: ${t.formula}; entradas: ${Object.entries(t.inputs).map(([k,v]) => `${k}=${v}`).join(", ")}]`).join("\n")}
${trail.filter(t => !t.available).length > 0 ? `\nIndisponíveis (não use): ${trail.filter(t => !t.available).map(t => t.label).join(", ")}` : ""}
`.trim();

  return { text, trail };
}

// ── LLM helpers (E1.S3 — LLMClient genérico) ──────────────────────────────────
//
// Anthropic Messages API tem formato diferente do OpenAI:
//   - Endpoint: https://api.anthropic.com/v1/messages
//   - Header: x-api-key + anthropic-version: 2023-06-01
//   - Body: { model, max_tokens, system, messages: [{role:"user|assistant", content}] }
//   - Resposta: { content: [{type:"text", text}] }
// Estes helpers normalizam pra que o restante do código fale "OpenAI-like" e
// só essa camada saiba traduzir.

async function callAnthropicNonStream(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string,
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<{ content: string; rawStatus: number }> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.3,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    console.error("[anthropic] erro", resp.status, txt.slice(0, 400));
    return { content: "", rawStatus: resp.status };
  }
  const data = await resp.json();
  // Resposta: { content: [{ type: "text", text: "..." }, ...] }
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const text = blocks
    .filter((b: { type?: string }) => b.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("\n");
  return { content: text, rawStatus: 200 };
}

// ── Main handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, orgId, mode, dateRange, pathname, dashboardName, dashboardContext, intent, availableTables, persona, meeting_context } = await req.json();

    // Provider selection: OpenAI preferred (when chave está configurada), Lovable como fallback.
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!OPENAI_API_KEY && !LOVABLE_API_KEY && !ANTHROPIC_API_KEY) {
      throw new Error("Nenhum provedor de IA configurado (OPENAI_API_KEY, LOVABLE_API_KEY ou ANTHROPIC_API_KEY).");
    }

    // E1.S3 — seleção de provedor por env. AI_PROVIDER explicito ganha; caso contrário
    // prioridade: anthropic > openai > lovable (mas só se a chave existir).
    const providerEnv = (Deno.env.get("AI_PROVIDER") ?? "").toLowerCase().trim();
    type AiProvider = "anthropic" | "openai" | "lovable";
    const provider: AiProvider = (() => {
      if (providerEnv === "anthropic" && ANTHROPIC_API_KEY) return "anthropic";
      if (providerEnv === "openai" && OPENAI_API_KEY) return "openai";
      if (providerEnv === "lovable" && LOVABLE_API_KEY) return "lovable";
      // Auto-fallback (ordem de preferência)
      if (ANTHROPIC_API_KEY) return "anthropic";
      if (OPENAI_API_KEY) return "openai";
      return "lovable";
    })();
    const useOpenAI = provider === "openai";
    const useAnthropic = provider === "anthropic";

    // Endpoint OpenAI-compat (vale para OpenAI e Lovable; Anthropic usa caminho próprio).
    const aiEndpoint = useOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiAuthHeader = useOpenAI ? `Bearer ${OPENAI_API_KEY}` : `Bearer ${LOVABLE_API_KEY}`;

    // Modelos por provedor.
    const insightsModel = useAnthropic
      ? (Deno.env.get("ANTHROPIC_MODEL_INSIGHTS") ?? "claude-sonnet-4-5")
      : useOpenAI
      ? (Deno.env.get("OPENAI_MODEL_INSIGHTS") ?? "gpt-4o")
      : "google/gemini-2.5-pro";
    const chatModel = useAnthropic
      ? (Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-5")
      : useOpenAI
      ? (Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini")
      : "google/gemini-3-flash-preview";

    console.log("[ai-data-chat] provider=", provider, "insights=", insightsModel, "chat=", chatModel);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let dataContextText = "";
    let calcTrail: CalculationTrail[] = [];
    if (orgId) {
      const ctx = await buildDataContext(supabase, orgId, dateRange);
      dataContextText = ctx.text;
      calcTrail = ctx.trail;
    }

    // ── Contexto da tela atual ────────────────────────────────────────────────
    // O frontend manda `pathname` (ex: "/client/abc/paid-traffic") e opcionalmente
    // o nome do dashboard ativo. Isso ajuda o modelo a focar a resposta na tela
    // que o usuário está olhando no momento (ele pode perguntar "o que tá ruim
    // aqui?" sem especificar a métrica).
    const ROUTE_LABELS: Record<string, string> = {
      "dashboard":        "Dashboard principal (widgets configuráveis)",
      "arguto":           "Arguto · BAI (demonstração — clientes, churn, ROI, mapa de visitas)",
      "crm":              "CRM Kanban (pipeline de leads)",
      "import":           "Dados (importação de leads / planilhas)",
      "insights":         "Inteligência IA (insights estruturados sobre os dados)",
      "rfm-churn":        "RFM + Churn (segmentação e predição de churn)",
      "paid-traffic":     "Tráfego Pago (Meta Ads / Google Ads / TikTok)",
      "customer-health":  "Saúde do Cliente (health score, NPS, sinais de risco)",
      "unit-economics":   "CAC + LTV (unit economics e payback)",
      "goals":            "Metas & Alertas",
      "gamification":     "Conquistas / Gamificação",
      "integrations":     "Integrações (Kommo, Ploomes, Meta, Google)",
      "crm-auditor":      "Auditor CRM (análise de qualidade de dados)",
      "crm-audit":        "Auditoria CRM (dashboard de auditoria)",
      "pinn-sdr":         "Pinn SDR (Ploomes + LinkedIn + Cold Mail unificados)",
      "linkedin-sdr":     "LinkedIn SDR Manager (campanhas, conversas, perfis Mari)",
      "settings":         "White Label / Configurações",
      "users":            "Usuários da organização",
    };
    const routeSlug = (pathname ?? "").split("?")[0].split("/").filter(Boolean).pop() ?? "";
    const routeLabel = ROUTE_LABELS[routeSlug] ?? (routeSlug ? `Tela "${routeSlug}"` : "tela não identificada");
    const screenContext = pathname
      ? `### 0. Tela aberta agora (foque a resposta nela)
- Rota: ${pathname}
- Tela: ${routeLabel}${dashboardName ? `
- Dashboard ativo: ${dashboardName}` : ""}
`
      : "";
    if (screenContext) {
      dataContextText = `${screenContext}\n${dataContextText}`;
    }

    // ── Snapshot do dashboard renderizado na sessão do cliente ────────────────
    // O frontend captura as queries do React Query em cache (KPIs, scoreboard,
    // forecast, etc) e envia em `dashboardContext`. Sem isso, perguntas sobre
    // métricas custom calculadas no client (ex: vw_forecast_revenue,
    // resolveExecutiveScoreboard) caíam em "não vejo esse número no contexto".
    if (dashboardContext && typeof dashboardContext === "object") {
      try {
        const dc = dashboardContext as {
          capturedAt?: string;
          pathname?: string;
          entries?: Array<{ key: unknown[]; value: string }>;
          truncated?: boolean;
        };
        const entries = Array.isArray(dc.entries) ? dc.entries : [];
        if (entries.length > 0) {
          const lines: string[] = [
            "### 0.1 Métricas visíveis na sessão do cliente AGORA",
            "(snapshot do estado renderizado no navegador — fonte de verdade para perguntas sobre 'o que estou vendo')",
            `- Capturado em: ${dc.capturedAt ?? "—"}`,
            `- Pathname: ${dc.pathname ?? pathname ?? "—"}`,
            ...(dc.truncated ? ["- ⚠️ Snapshot truncado por tamanho — peça filtros específicos se faltar dado."] : []),
            "",
          ];
          for (const e of entries) {
            const keyLabel = Array.isArray(e.key) ? e.key.map((k) => (typeof k === "string" ? k : JSON.stringify(k))).join(":") : String(e.key);
            lines.push(`#### query:${keyLabel}`);
            lines.push("```json");
            lines.push(typeof e.value === "string" ? e.value : JSON.stringify(e.value));
            lines.push("```");
          }
          dataContextText = `${lines.join("\n")}\n\n${dataContextText}`;
        }
      } catch (e) {
        console.warn("[ai-data-chat] dashboardContext injection skipped:", e);
      }
    }

    // ── Insights mode (structured via tool-calling, non-streaming) ────────────

    if (mode === "insights") {
      // Detecta se há dados mínimos. Se tudo zerado, retorna mensagem honesta.
      const hasAnyData = /Leads no período: [1-9]/.test(dataContextText)
        || /Investimento total:/.test(dataContextText)
        || /Score médio:/.test(dataContextText)
        || /Total analisado: [1-9]/.test(dataContextText)
        || /Total com predição: [1-9]/.test(dataContextText);

      if (!hasAnyData) {
        return new Response(JSON.stringify({
          insights: [{
            type: "recommendation",
            priority: "high",
            title: "Sem dados suficientes para análise",
            content: "Nenhuma fonte (CRM, Tráfego Pago, Health, RFM, Churn) retornou dados no período. Conecte uma integração ou amplie o período para gerar insights precisos.",
          }],
          calculationTrail: calcTrail,
          contextText: dataContextText,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ── Lente da persona (E4.S4) ───────────────────────────────────────────
      // Direciona os insights pelo ângulo de leitura do C-level alvo.
      // "geral" = sem lente específica (default, comportamento legado).
      const PERSONA_LENS: Record<string, string> = {
        ceo:
          "Lente CEO: foque em saúde geral do negócio, crescimento, escala, sinais sistêmicos. Cruze ROI, expansão de base e capacidade de operação. Ignore micro-otimizações; prefira insights que afetam decisão de capital ou direção estratégica.",
        cro:
          "Lente CRO: foque em receita, pipeline, conversão, forecast, performance da força de vendas. Sempre quantifique o impacto em revenue (R$). Cruze taxa de conversão por etapa, ticket médio, ciclo de venda e produtividade por owner.",
        cmo:
          "Lente CMO: foque em fontes de aquisição, ROAS, CPL, qualidade de lead por canal, conversão entrada→reunião. Aponte canais com melhor/pior unit economics e oportunidades de realocação de verba.",
        cfo:
          "Lente CFO: foque em CAC, LTV, LTV/CAC ratio, margem por lead, payback, eficiência do capital alocado. Cite números monetários sempre e evite sugestões que dependam de hipóteses não financeiras.",
        coo:
          "Lente COO: foque em eficiência operacional, gargalos do funil, SLAs (tempo de resposta, tempo por etapa), tarefas vencidas, leads parados. Aponte onde o processo trava e quanta capacidade está sendo desperdiçada.",
      };
      const personaKey = String(persona ?? "").toLowerCase().trim();
      const personaLens = PERSONA_LENS[personaKey] ?? "";

      const systemPrompt = `Você é o Pinn AI — analista sênior de Revenue Operations com rigor estatístico de auditoria.${personaLens ? `\n\nLENTE DE LEITURA OBRIGATÓRIA:\n${personaLens}\n\nMantenha cada insight ALINHADO a essa lente. Se um insight não couber sob essa lente, NÃO o gere — prefira menos insights bem direcionados a 6 dispersos.` : ""}

MISSÃO: gerar insights de PRECISÃO ABSOLUTA usando EXCLUSIVAMENTE os números do contexto. Tolerância zero para alucinação.

PROTOCOLO (siga em ordem):
1) INVENTÁRIO: liste mentalmente todas as métricas presentes. Se uma seção diz "sem dados" / "indisponível", essa área NÃO PODE aparecer em insight algum.
2) USE OS CRUZAMENTOS PRÉ-CALCULADOS da seção 7 — NÃO recalcule CAC, margem, lucro bruto ou participação de Ads. Eles já estão prontos e corretos.
3) Para cada insight, escolha UMA métrica-âncora e copie o número EXATAMENTE como aparece no contexto (mesmos dígitos, mesma formatação: "R$ 12.300", "2.34x", "47", "23.5%").
4) Cruzamentos obrigatórios quando ambos lados existirem: Tráfego Pago × CRM (CAC vs ticket), Churn × Health (risco crítico), RFM × Receita.
5) Priorização: high = perda/risco financeiro mensurável OU oportunidade ≥20% de impacto; medium = otimização clara; low = monitoramento.

REGRAS DE PRECISÃO (violação = insight descartado automaticamente):
- PROIBIDO inventar números. Todo dígito citado deve existir no contexto.
- PROIBIDO inferir tendências temporais ("aumentou X%", "caiu Y%") — não há série histórica no contexto.
- PROIBIDO usar valores aproximados ou arredondados diferentes dos do contexto.
- PROIBIDO citar áreas marcadas "sem dados".
- "evidence" DEVE ser uma cópia literal de 1 linha do contexto (mesmas palavras, mesmos números).
- "content" deve ter: (a) número exato citado, (b) interpretação causal, (c) ação concreta no imperativo iniciada por verbo (Ex: "Realoque...", "Reative...", "Negocie...").
- Gere 4 a 6 insights — só gere mais que 4 se houver dados ricos para sustentar.

EXEMPLO DE INSIGHT CORRETO:
{
  "type": "alert", "priority": "high", "metric": "CAC",
  "title": "CAC supera ticket médio",
  "content": "O CAC via Ads de R$ 450 é 1.5x maior que o ticket médio de R$ 300, indicando prejuízo unitário. Renegocie criativos da plataforma com pior ROAS ou pause campanhas com CPL acima de R$ 200.",
  "evidence": "CAC via Ads = R$ 450 (investimento R$ 9.000 ÷ 20 convertidos)"
}

DADOS REAIS DA ORGANIZAÇÃO (única fonte de verdade):
${dataContextText}`;

      const insightTool = {
        type: "function",
        function: {
          name: "emit_insights",
          description: "Emite insights de negócio precisos baseados exclusivamente nos dados fornecidos.",
          parameters: {
            type: "object",
            properties: {
              insights: {
                type: "array",
                minItems: 4,
                maxItems: 6,
                items: {
                  type: "object",
                properties: {
                    type: { type: "string", enum: ["alert", "recommendation", "trend"] },
                    priority: { type: "string", enum: ["high", "medium", "low"] },
                    title: { type: "string", description: "Máx 8 palavras, impactante." },
                    content: { type: "string", description: "Análise com número exato + causa + ação ('Para resolver: ...')." },
                    evidence: { type: "string", description: "Trecho literal do contexto que sustenta o insight." },
                    metric: { type: "string", description: "Nome da métrica-âncora (ex: ROAS, CPL, taxa de conversão)." },
                    sourceSection: { type: "string", description: "Seção do contexto usada (ex: '1. Funil de Vendas', '7. Cruzamentos Pré-Calculados')." },
                  },
                  required: ["type", "priority", "title", "content", "evidence", "metric", "sourceSection"],
                  additionalProperties: false,
                },
              },
            },
            required: ["insights"],
            additionalProperties: false,
          },
        },
      };

      const response = await fetch(aiEndpoint, {
        method: "POST",
        headers: { Authorization: aiAuthHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: insightsModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Execute o protocolo de análise e chame emit_insights com 4 a 6 insights de máxima precisão. Cada insight deve citar um número exato do contexto." },
          ],
          stream: false,
          temperature: 0,
          tools: [insightTool],
          tool_choice: { type: "function", function: { name: "emit_insights" } },
        }),
      });

      if (!response.ok) {
        const status = response.status;
        const txt = await response.text().catch(() => "");
        console.error("AI provider error (insights):", status, txt);
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "AI provider error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const aiResult = await response.json();
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      let insights: any[] = [];

      if (toolCall?.function?.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          insights = Array.isArray(args.insights) ? args.insights : [];
        } catch (e) {
          console.error("Failed to parse tool arguments:", e, toolCall.function.arguments);
        }
      }

      // Fallback: tenta parsing de JSON se modelo não usou tool
      if (insights.length === 0) {
        const rawContent = aiResult.choices?.[0]?.message?.content ?? "";
        try {
          const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
          if (jsonMatch) insights = JSON.parse(jsonMatch[0]);
        } catch {
          // ignore
        }
      }

      // Validação anti-alucinação: cada insight precisa citar pelo menos UM número
      // que apareça literalmente no contexto de dados.
      const contextNumbers = new Set<string>();
      const numMatches = dataContextText.match(/\d[\d.,]*/g) ?? [];
      for (const n of numMatches) {
        const normalized = n.replace(/\.$/, "").replace(/,$/, "");
        if (normalized.length >= 1) contextNumbers.add(normalized);
      }

      const hasGroundedNumber = (text: string): boolean => {
        const cited = text.match(/\d[\d.,]*/g) ?? [];
        if (cited.length === 0) return false;
        return cited.some((c) => {
          const norm = c.replace(/\.$/, "").replace(/,$/, "");
          // aceita match exato OU substring de pelo menos 2 dígitos no contexto
          if (contextNumbers.has(norm)) return true;
          if (norm.length >= 2) {
            for (const ctx of contextNumbers) {
              if (ctx.includes(norm) || norm.includes(ctx)) return true;
            }
          }
          return false;
        });
      };

      insights = insights.filter((i) =>
        i &&
        typeof i.content === "string" &&
        i.content.length > 40 &&
        hasGroundedNumber(i.content) &&
        typeof i.evidence === "string" &&
        i.evidence.length > 5
      );

      // ── Auditoria por insight: extrai números citados, marca quais existem
      // no contexto e linka aos cálculos pré-computados (trail) quando aplicável.
      const trailLabels = calcTrail.map((t) => t.label.toLowerCase());
      const enrichWithAudit = (insight: any) => {
        const cited = (insight.content?.match(/\d[\d.,]*/g) ?? []) as string[];
        const numbers = cited.map((c) => {
          const norm = c.replace(/\.$/, "").replace(/,$/, "");
          let foundIn: "context" | "derived" | "missing" = "missing";
          if (contextNumbers.has(norm)) foundIn = "context";
          else if (norm.length >= 2) {
            for (const ctx of contextNumbers) {
              if (ctx.includes(norm) || norm.includes(ctx)) {
                foundIn = "context";
                break;
              }
            }
          }
          return { value: c, foundIn };
        });

        // Trilha relacionada (pré-cálculos cujo label aparece no content/evidence/metric)
        const haystack = `${insight.title ?? ""} ${insight.content ?? ""} ${insight.evidence ?? ""} ${insight.metric ?? ""}`.toLowerCase();
        const relatedTrail = calcTrail.filter((t, idx) =>
          haystack.includes(trailLabels[idx]) ||
          (t.key === "cac_via_ads" && /\bcac\b/.test(haystack)) ||
          (t.key === "global_roas" && /\broas\b/.test(haystack)) ||
          (t.key === "global_cpl" && /\bcpl\b/.test(haystack)) ||
          (t.key === "conversion_rate" && /convers[aã]o/.test(haystack))
        );

        // Evidence verificada: tenta achar substring exata (>=15 chars) no contexto
        const evidenceText: string = insight.evidence ?? "";
        const evidenceSnippet = evidenceText.length >= 15 ? evidenceText.slice(0, 80) : evidenceText;
        const evidenceVerified = evidenceSnippet.length >= 15
          ? dataContextText.includes(evidenceSnippet)
          : false;

        return {
          ...insight,
          audit: {
            numbers,
            relatedTrail: relatedTrail.map((t) => ({
              label: t.label,
              formula: t.formula,
              inputs: t.inputs,
              value: t.value,
            })),
            evidenceVerified,
          },
        };
      };

      insights = insights.map(enrichWithAudit);

      if (insights.length === 0) {
        insights = [{
          type: "recommendation",
          priority: "medium",
          title: "Análise inconclusiva",
          content: "A IA não conseguiu gerar insights ancorados em números reais dos dados atuais. Verifique se as integrações estão sincronizadas e tente novamente.",
          evidence: "",
          metric: "",
          audit: { numbers: [], relatedTrail: [], evidenceVerified: false },
        }];
      }

      return new Response(JSON.stringify({
        insights,
        calculationTrail: calcTrail,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Live Generative Dashboard mode (E4.S3) ────────────────────────────────
    // Recebe { intent: string, available_tables: string[] } e devolve uma lista
    // de widget specs prontos para inserir em dashboard_widgets. A UI admin
    // pega esse JSON e chama useCreateDashboardWidgets em batch.
    if (mode === "live_generate") {
      const userIntent = String(intent ?? "").trim();
      if (!userIntent) {
        return new Response(JSON.stringify({ error: "intent obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const liveSystem = `Você é um construtor de dashboards do Pinn BAI. O usuário descreve em linguagem natural o que quer ver, e você devolve EXCLUSIVAMENTE uma chamada para emit_widgets com 3-6 widgets coerentes.

REGRAS:
- Use apenas tipos válidos: metric_card, area_chart, bar_chart, line_chart, pie_chart, funnel, table, insight_card.
- Use dataSource real apresentado na lista. Se não houver tabela adequada, prefira metric_card com title descritivo e deixe dataSource vazio.
- aggregation: sum | count | avg | min | max.
- format: number | currency | percentage.
- Para cada widget, coloque uma description curta (1 linha) que vira tooltip ℹ no card.

TABELAS DISPONÍVEIS NA ORG:
${(availableTables ?? []).join(", ") || "(lista não fornecida — use nomes conhecidos como crm_leads, paid_traffic_daily_metrics, bai_kpi_snapshots)"}

PEDIDO DO USUÁRIO:
${userIntent}`;

      const widgetTool = {
        type: "function",
        function: {
          name: "emit_widgets",
          description: "Emite a lista de widgets a inserir no dashboard.",
          parameters: {
            type: "object",
            properties: {
              widgets: {
                type: "array",
                minItems: 3,
                maxItems: 6,
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["metric_card","area_chart","bar_chart","line_chart","pie_chart","funnel","table","insight_card"] },
                    title: { type: "string" },
                    description: { type: "string", description: "Aparece como tooltip do widget." },
                    dataSource: { type: "string", description: "Nome da tabela/view (deixe vazio se não souber)." },
                    metric: { type: "string", description: "Coluna que será agregada." },
                    aggregation: { type: "string", enum: ["sum","count","avg","min","max"] },
                    format: { type: "string", enum: ["number","currency","percentage"] },
                    groupBy: { type: "string" },
                  },
                  required: ["type","title","description"],
                  additionalProperties: false,
                },
              },
            },
            required: ["widgets"],
            additionalProperties: false,
          },
        },
      };

      const liveResp = await fetch(aiEndpoint, {
        method: "POST",
        headers: { Authorization: aiAuthHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: insightsModel,
          messages: [
            { role: "system", content: liveSystem },
            { role: "user", content: userIntent },
          ],
          stream: false,
          temperature: 0.2,
          tools: [widgetTool],
          tool_choice: { type: "function", function: { name: "emit_widgets" } },
        }),
      });

      if (!liveResp.ok) {
        if (liveResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (liveResp.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "AI provider error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const liveJson = await liveResp.json();
      const liveTool = liveJson.choices?.[0]?.message?.tool_calls?.[0];
      let widgets: unknown[] = [];
      if (liveTool?.function?.arguments) {
        try {
          const args = JSON.parse(liveTool.function.arguments);
          widgets = Array.isArray(args.widgets) ? args.widgets : [];
        } catch {
          /* ignore */
        }
      }
      return new Response(JSON.stringify({ widgets, generated_at: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Meeting brief mode (F13) ──────────────────────────────────────────────
    // Gera pauta enxuta de reunião consultiva: 3-5 pontos priorizados,
    // cada um com diagnóstico breve, número-âncora do contexto e ação sugerida.
    // O analista júnior usa o output como roteiro — sem precisar do sênior junto.
    if (mode === "meeting_brief") {
      // meeting_context opcional: passado pelo frontend quando o admin
      // colou/digitou info do evento (título, participantes, foco, hora).
      // Quando ausente, fluxo legado continua valendo.
      const meetingCtx = meeting_context as
        | { title?: string; when?: string; attendees?: string; focus?: string }
        | undefined;
      const meetingContextBlock = meetingCtx && (meetingCtx.title || meetingCtx.focus || meetingCtx.attendees || meetingCtx.when)
        ? `\n\nCONTEXTO ESPECÍFICO DESTA REUNIÃO (forneça pauta otimizada para este encontro):\n${[
            meetingCtx.title && `- Encontro: ${meetingCtx.title}`,
            meetingCtx.when && `- Quando: ${meetingCtx.when}`,
            meetingCtx.attendees && `- Participantes: ${meetingCtx.attendees}`,
            meetingCtx.focus && `- Foco/tópicos prévios: ${meetingCtx.focus}`,
          ].filter(Boolean).join("\n")}`
        : "";

      const briefSystem = `Você é um consultor sênior de Revenue Ops da Pinn preparando a pauta da próxima reunião de acompanhamento com o cliente.

REGRAS:
- Português brasileiro, tom executivo, direto.
- Markdown estruturado: cada ponto tem título, "O que aconteceu" (com número exato do contexto), "Por que importa" (1 linha) e "Sugestão de ação" (1 linha imperativa).
- Entre 3 e 5 pontos, ordenados por impacto.
- PROIBIDO inventar números. Use só o que aparece literalmente no contexto.
- Termine com seção "Perguntas para o cliente" (2-3 perguntas que o consultor faz na reunião para validar interpretações).
- NÃO comece com "Olá", saudação ou intro — vá direto na pauta.
${meetingContextBlock ? "- AJUSTE a seleção dos 3-5 pontos pra que respondam ao foco/tópicos do encontro, quando houver." : ""}

DADOS REAIS DA ORGANIZAÇÃO:
${dataContextText}${meetingContextBlock}`;

      let briefContent = "";
      if (useAnthropic) {
        const { content, rawStatus } = await callAnthropicNonStream(
          ANTHROPIC_API_KEY!,
          insightsModel,
          briefSystem,
          "Gere a pauta para a próxima reunião consultiva com base nos dados acima.",
          { maxTokens: 2500, temperature: 0.3 },
        );
        if (rawStatus !== 200) {
          if (rawStatus === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          return new Response(JSON.stringify({ error: "AI provider error (anthropic)" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        briefContent = content || "Não foi possível gerar a pauta — sem resposta do modelo.";
      } else {
        const briefResp = await fetch(aiEndpoint, {
          method: "POST",
          headers: { Authorization: aiAuthHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: insightsModel,
            messages: [
              { role: "system", content: briefSystem },
              { role: "user", content: "Gere a pauta para a próxima reunião consultiva com base nos dados acima." },
            ],
            stream: false,
            temperature: 0.3,
          }),
        });

        if (!briefResp.ok) {
          const status = briefResp.status;
          if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          if (status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          return new Response(JSON.stringify({ error: "AI provider error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const briefJson = await briefResp.json();
        briefContent = briefJson.choices?.[0]?.message?.content ?? "Não foi possível gerar a pauta — sem resposta do modelo.";
      }

      return new Response(JSON.stringify({
        markdown: briefContent,
        generated_at: new Date().toISOString(),
        model: insightsModel,
        provider,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Chat mode (streaming) ─────────────────────────────────────────────────

    const systemPrompt = `Você é o **BAI Copilot** — analista sênior de Revenue Operations da Pinn, dedicado a esta organização.

ESCOPO DE ACESSO (importante esclarecer ao usuário se perguntado):
Você TEM ACESSO AO BANCO COMPLETO DA ORGANIZAÇÃO desta sessão **E TAMBÉM AO ESTADO RENDERIZADO NA TELA DO USUÁRIO** (seção "0.1 Métricas visíveis na sessão do cliente AGORA"). Quando o usuário perguntar sobre uma métrica ("qual a taxa de conversão atual?", "quanto é o forecast?"), PROCURE PRIMEIRO na seção 0.1 — ela traz os mesmos números que ele está vendo no dashboard naquele momento. Só caia para as demais seções se a 0.1 não tiver a métrica.

REGRA CRÍTICA — VALORES JÁ CALCULADOS DOS WIDGETS:
Dentro da seção 0.1, entradas com key começando em "widget-snapshot:" trazem o valor EXATO que cada widget do dashboard está mostrando ao usuário. Estrutura: { widgetId, title, metric, value, format, ... }.

Quando o usuário perguntar sobre uma métrica que casa com um título de widget-snapshot, USE O VALOR DO WIDGET-SNAPSHOT — NÃO RECALCULE a partir dos dados crus. Se você recalcular, vai obter número diferente do que o usuário vê na tela (porque você não conhece o filtro de período, agregação ou fórmula custom que o widget aplica).

Exemplo: se o usuário pergunta "qual a taxa de conversão atual?" e há um widget-snapshot com title="Taxa de Conversão" e value=1.1, responda "A taxa de conversão atual visível no seu dashboard é 1,1%". NUNCA invente um cálculo diferente que dê 22% só porque você tem acesso aos leads crus.

Se houver MAIS DE UM widget-snapshot relacionado (ex: "Conv. Lead → Reunião" e "Conv. Lead → Fechamento" — três taxas diferentes no Pinn Bay), cite TODAS com os labels exatos. NÃO escolha uma e omita as outras.

Os dados disponíveis abaixo cobrem:
- Identidade da org (nome, plano, status, slug, datas)
- TODAS as integrações configuradas (CRM, Supabase externo, Kommo, etc.)
- TODAS as conexões de tráfego pago (Meta Ads, Google Ads) e suas campanhas
- TODOS os dashboards configurados e seus widgets visíveis
- TODAS as metas (KPI goals) e regras de alerta configuradas
- Funil de vendas completo do período (com top 15 leads convertidos por valor + 15 mais recentes — nome, empresa, fonte, status, valor, data)
- Métricas de tráfego pago agregadas e por plataforma + lista de campanhas
- Saúde dos clientes (health score, bandas, tendência, clientes críticos)
- Alertas ativos não resolvidos
- Segmentação RFM
- Predições de churn
- Cruzamentos pré-calculados (CAC via Ads, ROAS, CPL, margem por lead, etc.)

NUNCA diga ao usuário que "só tem acesso aos dados da tela atual". Você tem acesso a TUDO listado acima.
Se uma informação específica não estiver no contexto (ex.: dado de um lead não citado nominalmente), explique que o contexto traz amostras (top 15 / 15 mais recentes) e que você pode aprofundar se ele perguntar por filtros ou métricas específicas.

REGRAS DE PRECISÃO NUMÉRICA (não negociáveis):
- Use APENAS números que aparecem literalmente no contexto. Se um número específico não estiver lá, responda honestamente "não vejo esse número específico no recorte atual".
- NUNCA invente comparações temporais ("aumentou 20%") a menos que ambos os pontos estejam no contexto.
- Sempre cite o número exato (ex: "ROAS de 2.34x", "47 leads convertidos", "R$ 12.300 de receita").
- Se uma seção do contexto disser "sem dados" / "Nenhum X configurado", reconheça explicitamente a lacuna em vez de inferir.
- Cálculos derivados permitidos: taxa de conversão, CAC (gasto/convertidos), margem (ticket - CPL), ROAS por canal.

REGRA DE NÃO-INVENÇÃO ABSOLUTA (CRÍTICO — violação aqui = resposta inválida):
- Se o contexto disser "NENHUM LEAD CONVERTIDO REGISTRADO" ou "NENHUM LEAD CADASTRADO" ou similar, RESPONDA EXATAMENTE:
  "Não há leads convertidos registrados para esta organização no período. Conecte uma integração de CRM ou importe leads via /import para começar a ver dados aqui."
- JAMAIS gere listas com placeholders genéricos tipo "Nome do Lead 1", "Empresa A", "Fonte 1", "Data 1", "Lead Genérico", "Cliente X". Esses padrões são proibidos.
- Quando o usuário pede listas nominais (top N, mais recentes), use APENAS as linhas que aparecem em "### 1.A Top 15 Leads Convertidos" e "### 1.B 15 Leads Mais Recentes" do contexto. Se a seção mostra mensagem de "sem leads", reconheça e oriente — NÃO COMPLETE com exemplos.
- Se você notar que está prestes a numerar "Lead 1, Lead 2, Lead 3..." sem nomes reais, PARE e admita a lacuna.

CAPACIDADES QUALITATIVAS (use também quando perguntado):
- Descrever a estrutura da org (quais integrações estão ativas, quais dashboards existem, quais metas e alertas estão configurados).
- Cruzar fontes (CRM × Ads × Health × RFM × Churn) para revelar causas raiz com evidência numérica.
- Listar leads nominalmente quando o usuário pedir (use as listas Top Convertidos / Mais Recentes).
- Diagnosticar falhas de integração (ex.: integração com erro de sync, conta de tráfego pago desconectada).
- Recomendar ações concretas com impacto financeiro estimável a partir dos dados reais.

ESTILO:
- Português brasileiro, Markdown.
- Direto, sem rodeios. Sem desculpas defensivas.
- Cada afirmação quantitativa vem com o número fonte.
- Termine com "Próxima ação recomendada:" quando a pergunta pedir decisão.

DADOS REAIS DA ORGANIZAÇÃO (banco completo desta org):
${dataContextText}`;

    const response = await fetch(aiEndpoint, {
      method: "POST",
      headers: { Authorization: aiAuthHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chatModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      console.error("AI provider error (chat):", response.status, txt);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI provider error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("ai-data-chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
