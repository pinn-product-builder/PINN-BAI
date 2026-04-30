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

async function buildDataContext(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  dateRange?: { start: string; end: string },
): Promise<DataContextResult> {
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

  // ── Cruzamentos pré-calculados (para evitar erros de cálculo da IA) ───────
  const cacPaid = totalConverted > 0 && totalSpend > 0 ? totalSpend / totalConverted : 0;
  const marginPerLead = avgTicket > 0 && globalCPL > 0 ? avgTicket - globalCPL : 0;
  const paidShareOfLeads = totalLeads > 0 && totalPaidLeads > 0 ? (totalPaidLeads / totalLeads) * 100 : 0;
  const grossProfitFromAds = totalPurchaseValue - totalSpend;

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

### 7. Cruzamentos Pré-Calculados (use estes números, não recalcule)
${cacPaid > 0 ? `- CAC via Ads = ${brl(cacPaid)} (investimento ${brl(totalSpend)} ÷ ${totalConverted} convertidos)` : "- CAC via Ads: indisponível (faltam convertidos ou investimento)"}
${marginPerLead !== 0 ? `- Margem por lead pago = ${brl(marginPerLead)} (ticket médio ${brl(avgTicket)} - CPL ${brl(globalCPL)})` : "- Margem por lead pago: indisponível"}
${paidShareOfLeads > 0 ? `- Participação de Ads no funil = ${paidShareOfLeads.toFixed(1)}% (${totalPaidLeads} de ${totalLeads} leads)` : "- Participação de Ads no funil: indisponível"}
${totalSpend > 0 ? `- Lucro bruto dos Ads = ${brl(grossProfitFromAds)} (receita compras ${brl(totalPurchaseValue)} - investimento ${brl(totalSpend)})` : ""}
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

    // ── Insights mode (structured via tool-calling, non-streaming) ────────────

    if (mode === "insights") {
      // Detecta se há dados mínimos. Se tudo zerado, retorna mensagem honesta.
      const hasAnyData = /Leads no período: [1-9]/.test(dataContext)
        || /Investimento total:/.test(dataContext)
        || /Score médio:/.test(dataContext)
        || /Total analisado: [1-9]/.test(dataContext)
        || /Total com predição: [1-9]/.test(dataContext);

      if (!hasAnyData) {
        return new Response(JSON.stringify({
          insights: [{
            type: "recommendation",
            priority: "high",
            title: "Sem dados suficientes para análise",
            content: "Nenhuma fonte (CRM, Tráfego Pago, Health, RFM, Churn) retornou dados no período. Conecte uma integração ou amplie o período para gerar insights precisos.",
          }],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const systemPrompt = `Você é o Pinn AI — analista sênior de Revenue Operations com rigor estatístico de auditoria.

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
${dataContext}`;

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
                  },
                  required: ["type", "priority", "title", "content", "evidence", "metric"],
                  additionalProperties: false,
                },
              },
            },
            required: ["insights"],
            additionalProperties: false,
          },
        },
      };

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
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
        console.error("AI gateway error (insights):", status, txt);
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      const numMatches = dataContext.match(/\d[\d.,]*/g) ?? [];
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

      if (insights.length === 0) {
        insights = [{
          type: "recommendation",
          priority: "medium",
          title: "Análise inconclusiva",
          content: "A IA não conseguiu gerar insights ancorados em números reais dos dados atuais. Verifique se as integrações estão sincronizadas e tente novamente.",
          evidence: "",
          metric: "",
        }];
      }

      return new Response(JSON.stringify({ insights }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Chat mode (streaming) ─────────────────────────────────────────────────

    const systemPrompt = `Você é o Pinn AI — analista sênior de Revenue Operations com rigor estatístico.

REGRAS DE PRECISÃO (não negociáveis):
- Use APENAS números que aparecem literalmente no contexto abaixo. Se não estiver lá, responda "não tenho esse dado".
- NUNCA invente comparações temporais ("aumentou 20%") a menos que ambos os pontos estejam no contexto.
- Sempre cite o número exato (ex: "ROAS de 2.34x", "47 leads convertidos", "R$ 12.300 de receita").
- Se uma seção do contexto disser "sem dados", reconheça explicitamente a lacuna em vez de inferir.
- Cálculos derivados permitidos: taxa de conversão, CAC (gasto/convertidos), margem (ticket - CPL), ROAS por canal.

CAPACIDADES:
- Cruzar fontes (CRM × Ads × Health × RFM × Churn) para revelar causas raiz com evidência numérica.
- Recomendar ações concretas com impacto financeiro estimável a partir dos dados reais.

FORMATO:
- Português brasileiro, Markdown.
- Cada afirmação quantitativa deve vir acompanhada do número fonte.
- Termine com "Próxima ação recomendada:" quando a pergunta pedir decisão.

DADOS REAIS DA ORGANIZAÇÃO:
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
