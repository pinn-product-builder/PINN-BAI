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

async function buildDataContext(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  dateRange?: { start: string; end: string },
): Promise<string> {
  const start = dateRange?.start?.substring(0, 10) ?? "";
  const end = dateRange?.end?.substring(0, 10) ?? "";

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
  ] = await Promise.all([
    supabase.from("organizations").select("name, plan").eq("id", orgId).single(),

    // Total leads in period
    (() => {
      let q = supabase.from("leads").select("id, status, value, source, created_at").eq("org_id", orgId);
      if (start) q = q.gte("created_at", start);
      if (end) q = q.lte("created_at", end + "T23:59:59");
      return q.limit(500);
    })(),

    // Converted in period
    (() => {
      let q = supabase.from("leads").select("id, value").eq("org_id", orgId).eq("status", "converted");
      if (start) q = q.gte("created_at", start);
      if (end) q = q.lte("created_at", end + "T23:59:59");
      return q.limit(500);
    })(),

    // Source distribution
    supabase.from("leads").select("source").eq("org_id", orgId).limit(1000),

    // RFM latest run
    supabase
      .from("rfm_analyses")
      .select("rfm_score, rfm_segment, recency_days, frequency, monetary")
      .eq("org_id", orgId)
      .order("calculated_at", { ascending: false })
      .limit(200),

    // Churn predictions
    supabase
      .from("churn_predictions")
      .select("churn_probability, risk_level")
      .eq("org_id", orgId)
      .order("predicted_at", { ascending: false })
      .limit(200),

    // Customer health summary (counts by band)
    supabase
      .from("customer_health_scores")
      .select("health_band, health_score, trend")
      .eq("org_id", orgId)
      .limit(500),

    // Critical health scores
    supabase
      .from("customer_health_scores")
      .select("customer_name, health_score, health_band")
      .eq("org_id", orgId)
      .eq("health_band", "critico")
      .order("health_score", { ascending: true })
      .limit(5),

    // Active unresolved alerts
    supabase
      .from("customer_alerts")
      .select("severity, title, customer_name")
      .eq("org_id", orgId)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(20),

    // Paid traffic metrics in period
    (() => {
      let q = supabase
        .from("paid_traffic_daily_metrics")
        .select("platform_slug, spend, impressions, clicks, leads, purchases, purchase_value, ctr, cpl, roas")
        .eq("org_id", orgId);
      if (start) q = q.gte("date", start);
      if (end) q = q.lte("date", end);
      return q.limit(200);
    })(),
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

  // ── Leads summary ──────────────────────────────────────────────────────────
  const totalLeads = leads.length;
  const totalConverted = converted.length;
  const convRate = pct(totalConverted, totalLeads);
  const totalRevenue = converted.reduce((s, l) => s + safeNum(l.value), 0);
  const avgTicket = totalConverted > 0 ? totalRevenue / totalConverted : 0;

  const statusDist: Record<string, number> = {};
  for (const l of leads) {
    const s = String(l.status ?? "sem_status");
    statusDist[s] = (statusDist[s] ?? 0) + 1;
  }

  const sourceDist: Record<string, number> = {};
  for (const l of allLeadsForSource) {
    const src = String(l.source ?? "desconhecido");
    sourceDist[src] = (sourceDist[src] ?? 0) + 1;
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

  return `
## Dados da Organização: "${org?.name ?? "Cliente"}" | Período: ${periodStr}

### 1. Funil de Vendas (CRM)
- Leads no período: ${totalLeads}
- Convertidos: ${totalConverted} (taxa de conversão: ${convRate})
- Receita gerada: ${brl(totalRevenue)}
- Ticket médio: ${brl(avgTicket)}
- Distribuição por status: ${Object.entries(statusDist).map(([k, v]) => `${k}: ${v}`).join(", ") || "sem dados"}
- Top fontes de leads: ${topSources || "sem dados"}

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
`.trim();
}

// ── Main handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, orgId, mode, dateRange } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let dataContext = "";
    if (orgId) {
      dataContext = await buildDataContext(supabase, orgId, dateRange);
    }

    // ── Insights mode (structured JSON, non-streaming) ────────────────────────

    if (mode === "insights") {
      const systemPrompt = `Você é o Pinn AI — analista sênior de negócios especializado em SaaS e e-commerce brasileiro.
Você recebe dados reais de múltiplas fontes e deve cruzá-los para identificar insights críticos.

FONTES DISPONÍVEIS: CRM (leads/conversões), Tráfego Pago (Meta/Google Ads), Saúde do Cliente (health scores), Churn Risk, RFM.

MÉTODO — Chain-of-Thought:
1. Analise cada fonte de dados individualmente.
2. Identifique correlações entre fontes (ex: alta verba em ads + baixa conversão = problema de qualificação).
3. Priorize pelos impactos financeiros mais altos.
4. Formule insight acionável com dado concreto + causa provável + ação recomendada.

REGRAS:
- Responda APENAS com JSON válido — nenhum texto fora do array
- Use EXCLUSIVAMENTE dados do contexto fornecido; nunca invente números
- Gere exatamente 6 insights (misture tipos)
- "title" deve ser curto e impactante (máx 8 palavras)
- "content" deve incluir: número/dado concreto + causa + ação ("Para resolver: ...")
- Priorize: alto impacto financeiro ou risco de perda = high; oportunidade de melhoria = medium; manutenção = low

Formato esperado (JSON puro):
[
  {"type":"alert|recommendation|trend","priority":"high|medium|low","title":"Título curto","content":"Análise com dado concreto. Para resolver: ação específica."}
]

${dataContext}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Analise todos os dados acima em conjunto e gere exatamente 6 insights acionáveis cruzando as múltiplas fontes. Retorne apenas o JSON array." },
          ],
          stream: false,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const aiResult = await response.json();
      const rawContent = aiResult.choices?.[0]?.message?.content ?? "[]";

      let insights;
      try {
        const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        insights = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
      } catch {
        console.error("Failed to parse insights JSON:", rawContent);
        insights = [{ type: "recommendation", priority: "medium", title: "Dados insuficientes", content: "Adicione mais registros para gerar insights automáticos." }];
      }

      return new Response(JSON.stringify({ insights }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Chat mode (streaming) ─────────────────────────────────────────────────

    const systemPrompt = `Você é o Pinn AI, assistente inteligente especializado em análise de dados de negócios.
Você tem acesso a dados reais cruzando CRM, Tráfego Pago, Health Score, Churn Risk e RFM.

CAPACIDADES:
- Cruzar dados de múltiplas fontes para revelar causas raiz
- Calcular ROI de canais de aquisição (CAC × LTV)
- Identificar clientes em risco antes que churnem
- Comparar performance entre períodos
- Recomendar ações específicas com impacto estimado

REGRAS:
- Use dados concretos do contexto; nunca invente métricas
- Responda em português brasileiro com Markdown
- Quando comparar fontes, explicite a correlação encontrada
- Priorize insights de alto impacto financeiro

${dataContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
