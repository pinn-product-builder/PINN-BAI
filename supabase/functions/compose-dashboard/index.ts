// ============================================================
// compose-dashboard — Compositor de dashboard com IA
// ============================================================
// Dada uma org, DESCOBRE as fontes de dados do catálogo (dashboard_data_sources),
// AMOSTRA cada uma (org-scoped), INFERE o schema (tipo/cardinalidade/sinal de cada
// coluna) e pede pra IA (Anthropic/OpenAI) PROJETAR um dashboard rico e variado —
// KPIs por etapa, evolução temporal, funil, distribuições, tabela e insight.
//
// O edge é AGNÓSTICO DE FONTE: vale igual pra Kommo, Omie, Ploomes, Sheets, etc.
// Nada hardcoded por cliente — a IA entende os dados e escolhe os widgets.
//
// Saída: { title, widgets: [{ type, title, size, config, note }], meta }
// Não insere nada por padrão — devolve o spec pro front pré-visualizar/editar.
// Se { apply:true, dashboardId } → também insere em dashboard_widgets.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireOrgAccess } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Inferência de schema (porta do useSourceFields) ─────────────────────────────
type FieldKind = "numeric" | "categorical" | "date" | "boolean" | "text";
const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/;

function isDateLike(v: unknown): boolean {
  if (typeof v !== "string") return false;
  return DATE_RE.test(v.trim());
}
function inferKind(values: unknown[]): FieldKind {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (nonNull.length === 0) return "text";
  const isBool = (v: unknown) => typeof v === "boolean" || v === "true" || v === "false";
  if (nonNull.every(isBool)) return "boolean";
  const isNum = (v: unknown) => typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)));
  if (nonNull.every(isNum)) return "numeric";
  if (nonNull.every(isDateLike)) return "date";
  const distinct = new Set(nonNull.map((v) => String(v))).size;
  return distinct <= 25 ? "categorical" : "text";
}

interface FieldSummary {
  name: string;
  kind: FieldKind;
  distinct: number;
  filledPct: number;
  hasSignal: boolean;
  examples: string[];
}
interface SourceSummary {
  key: string;
  label: string;
  description: string;
  category: string;
  rowCount: number;
  fields: FieldSummary[];
}

function summarizeRows(rows: Record<string, unknown>[]): { rowCount: number; fields: FieldSummary[] } {
  if (rows.length === 0) return { rowCount: 0, fields: [] };
  const cols = Object.keys(rows[0]).filter((c) => c !== "org_id" && c !== "tenant_id" && c !== "id");
  const fields: FieldSummary[] = cols.slice(0, 30).map((name) => {
    const values = rows.map((r) => r[name]);
    const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
    const kind = inferKind(values);
    const hasSignal = kind === "numeric"
      ? values.some((v) => v != null && Number(v) !== 0)
      : nonNull.length > 0;
    const examples = Array.from(new Set(nonNull.map((v) => String(v)))).slice(0, 5);
    return {
      name,
      kind,
      distinct: new Set(nonNull.map((v) => String(v))).size,
      filledPct: rows.length ? Math.round((nonNull.length / rows.length) * 100) : 0,
      hasSignal,
      examples,
    };
  });
  return { rowCount: rows.length, fields };
}

// ── LLM (Anthropic + fallback OpenAI), espelha ai-data-chat ─────────────────────
async function callLLM(systemPrompt: string, userContent: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const providerEnv = (Deno.env.get("AI_PROVIDER") ?? "").toLowerCase().trim();

  const useAnthropic = (providerEnv === "anthropic" && ANTHROPIC_API_KEY) ||
    (providerEnv !== "openai" && !!ANTHROPIC_API_KEY);

  if (useAnthropic) {
    const model = Deno.env.get("ANTHROPIC_MODEL_INSIGHTS") ?? "claude-sonnet-4-5";
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Anthropic ${resp.status}: ${txt.slice(0, 300)}`);
    }
    const data = await resp.json();
    const blocks = Array.isArray(data?.content) ? data.content : [];
    return blocks.filter((b: { type?: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n");
  }

  if (OPENAI_API_KEY) {
    const model = Deno.env.get("OPENAI_MODEL_INSIGHTS") ?? "gpt-4o";
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 4096,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`OpenAI ${resp.status}: ${txt.slice(0, 300)}`);
    }
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }

  throw new Error("Nenhum provedor de IA configurado (ANTHROPIC_API_KEY ou OPENAI_API_KEY).");
}

// ── Catálogo de widgets + contrato (o que o DashboardEngine aceita) ─────────────
const SYSTEM_PROMPT = `Você é o Pinn AI — arquiteto de dashboards de BI. Recebe o SCHEMA REAL de várias fontes de dados de um cliente e PROJETA um dashboard executivo rico, variado e correto. Você entende o significado de negócio de cada coluna e escolhe o widget certo pra cada dado.

REGRAS DURAS (quebrar = dashboard inútil):
1. Só use "dataSource" que esteja na lista SOURCES fornecida. Só use nomes de campo que existam no schema daquela fonte.
2. NUNCA crie um KPI cujo campo numérico tenha hasSignal=false (é tudo zero/vazio). Não polua com "R$ 0,00" ou "0%".
3. Formato do número:
   - contagens/quantidades (leads, count, qtd, negócios) → "number"
   - dinheiro (valor, receita, ticket, price, mrr) → "currency"
   - taxas/percentuais (conversão, taxa, rate, %) → "percentage"
4. Fonte pré-agregada (rowCount=1, ex.: KPIs consolidados): metric_card com isAggregatedView=true, metric=<campo>, SEM aggregation.
5. Fonte multi-linha (rowCount>1): metric_card usa aggregation=count (total de linhas) ou sum (somar um campo numérico).
6. Dashboard RICO e VARIADO — mire 8 a 14 widgets, NÃO faça tudo metric_card. Inclua, quando os dados permitirem: uma fileira de KPIs no topo, ≥1 série temporal, 1 funil de etapas, 1-2 distribuições (pizza/barra), 1 tabela de registros e EXATAMENTE 1 insight_card.
7. KPIs do topo (máx. 6): priorize VOLUME e RESULTADO — total de leads/negócios, ativos, ganhos, taxa de conversão, ticket médio. Se existir um campo de TOTAL (total_leads, total_deals, leads_total), SEMPRE inclua como PRIMEIRO KPI. Métricas de HIGIENE (campos com "without", "sem_", "leads_without_") NÃO são KPIs de destaque: no máximo 1, nunca como primeiro card, só se sobrar espaço.
8. Aproveite TODAS as fontes ricas, não só os KPIs consolidados: se houver performance por vendedor/dono, gere um bar_chart "Performance por vendedor"; se houver distribuição de campos customizados, gere "Leads por <campo>" pros campos mais preenchidos (maior filledPct/distinct). Quanto mais ângulos reais, melhor.

CATÁLOGO DE WIDGETS (type → quando usar → config):
- metric_card → número único de destaque (total de leads, taxa de conversão, ticket médio).
  config: { dataSource, metric, aggregation?: "count"|"sum"|"avg"|"max"|"min", isAggregatedView?, format, filters? }
  Derivado por fórmula (ex.: conversão): { dataSource, formula: "won_leads / total_leads * 100", format: "percentage" }  (use nomes de campo da MESMA fonte como variáveis)
- area_chart / line_chart → evolução no tempo. config: { dataSource, groupBy: <campo data>, dataKeys: [<campos numéricos>], aggregation: "sum" }
- bar_chart → comparação por categoria (vendedor, origem). config: { dataSource, groupBy: <campo categórico>, metric: <campo numérico ou o próprio>, aggregation: "sum"|"count" }
- pie_chart → composição (≤8 fatias: PF/PJ, motivos de perda). config: { dataSource, groupBy: <categórico>, metric, aggregation }
- funnel → etapas do funil comercial. config: { dataSource, groupBy: <campo de etapa>, metric: <campo de contagem>, aggregation: "sum" }
- table → lista de registros. config: { dataSource, columns: [<campos>] }
- insight_card → narrativa gerada por IA. config: {} (sem fonte; a engine preenche). Use exatamente 1.

CASOS CRM (quando existir a fonte):
- Funil: use a fonte de distribuição por estágio (groupBy no campo de estágio, metric no campo de contagem).
- Campos customizados (formato longo field_name/value): pra "Leads por <Campo>" use bar/pie com groupBy:"value", metric:"lead_count", aggregation:"sum", filters:{ field_name: "<Nome do Campo>" }. Pra um KPI de uma flag, metric_card com filters:{ field_name, value:"true" }.

FORMA SOLICITADA ("form"):
- "sdr_funnel" → foco em funil + KPIs por etapa + reuniões + conversão lead→reunião.
- "executive" → KPIs de destaque + tendências + 1 funil.
- "commercial" → performance por vendedor + pipeline + valor.
- "auto" → escolha a melhor leitura a partir dos dados.

IDIOMA: TODOS os títulos e rótulos OBRIGATORIAMENTE em português do Brasil, curtos e de negócio. NUNCA use inglês (ex.: "Leads Ativos", não "Active Leads"; "Taxa de Conversão", não "Conversion Rate"; "Valor em Aberto", não "Open Pipeline Value").
NÃO REPITA: nunca gere dois widgets com a mesma fonte+groupBy+filtro (ex.: dois "Leads por Características" iguais). Cada widget mostra um ângulo diferente.
MAIS RICO/BONITO: nos metric_card principais (total, ativos, conversão) adicione "showTrend": true. Pra composições com ≤6 categorias prefira pie_chart com "innerRadius": 60 (donut). Agrupe os KPIs no topo, depois os gráficos, depois a tabela e o insight por último.
"size": "small" pra metric_card, "large" pra séries temporais, funil e tabela, "medium" pro resto.

SAÍDA: APENAS JSON válido, sem markdown, sem comentários, no formato:
{"title": "<nome do dashboard>", "widgets": [ {"type": "...", "title": "...", "size": "small|medium|large", "config": { ... }, "note": "<por que esse widget, curto>"} ]}`;

const ALLOWED_TYPES = new Set(["metric_card", "area_chart", "line_chart", "bar_chart", "pie_chart", "funnel", "table", "insight_card"]);

function extractJson(text: string): unknown {
  let t = text.trim();
  // remove cercas de código
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("IA não retornou JSON.");
  return JSON.parse(t.slice(start, end + 1));
}

interface SpecWidget {
  type: string;
  title: string;
  size?: string;
  config?: Record<string, unknown>;
  note?: string;
}

function validateWidgets(widgets: SpecWidget[], sources: SourceSummary[]): SpecWidget[] {
  const byKey = new Map(sources.map((s) => [s.key, s]));
  const out: SpecWidget[] = [];
  const seen = new Set<string>(); // dedup: não repetir o mesmo widget
  for (const w of widgets) {
    if (!w || typeof w !== "object") continue;
    if (!ALLOWED_TYPES.has(w.type)) continue;
    const cfg = (w.config ?? {}) as Record<string, unknown>;
    if (w.type === "insight_card") {
      if (seen.has("insight")) continue; // só 1 insight_card
      seen.add("insight");
      out.push({ type: w.type, title: w.title || "Insights IA", size: w.size || "large", config: {}, note: w.note });
      continue;
    }
    const ds = String(cfg.dataSource ?? "");
    const src = byKey.get(ds);
    if (!src) continue; // fonte inexistente → descarta
    const fieldNames = new Set(src.fields.map((f) => f.name));
    // valida que os campos referenciados existem (quando aplicável)
    const refs: string[] = [];
    for (const k of ["metric", "metricField", "groupBy"]) if (typeof cfg[k] === "string") refs.push(cfg[k] as string);
    if (Array.isArray(cfg.dataKeys)) refs.push(...(cfg.dataKeys as string[]));
    if (Array.isArray(cfg.columns)) refs.push(...(cfg.columns as string[]));
    const allRefsValid = refs.every((r) => fieldNames.has(r));
    // fórmula referencia campos via nomes — valida os identificadores conhecidos
    if (!allRefsValid && !cfg.formula) continue;
    // Dedup: mesmo tipo+fonte+groupBy+metric+filtros+series = duplicata → descarta.
    const dedupKey = [w.type, ds, cfg.groupBy ?? "", cfg.metric ?? cfg.metricField ?? "", JSON.stringify(cfg.filters ?? {}), JSON.stringify(cfg.dataKeys ?? [])].join("|");
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const size = ["small", "medium", "large"].includes(String(w.size)) ? w.size : (w.type === "metric_card" ? "small" : "medium");
    out.push({ type: w.type, title: w.title || ds, size, config: cfg, note: w.note });
  }
  return out;
}

// ── Handler ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { orgId, goal, form = "auto", apply = false, dashboardId } = await req.json();
    if (!orgId) {
      return new Response(JSON.stringify({ error: "orgId é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const auth = await requireOrgAccess(req, orgId, corsHeaders);
    if (!auth.ok) return auth.response;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Fontes candidatas: catálogo ativo (org-específicas + globais), foco em
    //    dados de negócio (exclui category 'outros' = tabelas de sistema).
    const { data: catalog, error: catErr } = await supabase
      .from("dashboard_data_sources")
      .select("key, display_name, description, category, org_id, is_active")
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .eq("is_active", true);
    if (catErr) throw new Error(`Catálogo: ${catErr.message}`);

    let candidates = (catalog ?? []).filter((s) => s.category !== "outros");
    if (candidates.length === 0) candidates = catalog ?? [];

    // 2. Amostra cada fonte (org-scoped), infere schema, descarta vazias.
    const sources: SourceSummary[] = [];
    for (const c of candidates.slice(0, 16)) {
      try {
        const { data: rows, error } = await supabase.from(c.key).select("*").eq("org_id", orgId).limit(50);
        if (error || !rows || rows.length === 0) continue;
        const { rowCount, fields } = summarizeRows(rows as Record<string, unknown>[]);
        if (fields.length === 0) continue;
        sources.push({
          key: c.key,
          label: c.display_name ?? c.key,
          description: c.description ?? "",
          category: c.category ?? "",
          rowCount,
          fields,
        });
      } catch (_e) {
        // fonte sem org_id ou inacessível → ignora
        continue;
      }
    }

    if (sources.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma fonte com dados encontrada pra esta org. Sincronize uma integração primeiro." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Monta o prompt do usuário com o schema real.
    const userPayload = {
      goal: goal ?? null,
      form,
      SOURCES: sources.map((s) => ({
        key: s.key,
        label: s.label,
        description: s.description,
        rowCount: s.rowCount,
        fields: s.fields.map((f) => ({
          name: f.name,
          kind: f.kind,
          distinct: f.distinct,
          filledPct: f.filledPct,
          hasSignal: f.hasSignal,
          examples: f.examples,
        })),
      })),
    };
    const userContent = `Projete o dashboard pra estas fontes (forma="${form}"${goal ? `, objetivo="${goal}"` : ""}). Lembre: só JSON, fontes/campos da lista, sem KPIs zerados.\n\n${JSON.stringify(userPayload, null, 1)}`;

    // 4. Chama a IA.
    const raw = await callLLM(SYSTEM_PROMPT, userContent);

    // 5. Extrai + valida.
    let parsed: { title?: string; widgets?: SpecWidget[] };
    try {
      parsed = extractJson(raw) as { title?: string; widgets?: SpecWidget[] };
    } catch (_e) {
      return new Response(JSON.stringify({ error: "IA não retornou um spec válido.", raw: raw.slice(0, 500) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const widgets = validateWidgets(Array.isArray(parsed.widgets) ? parsed.widgets : [], sources);
    const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : "Visão completa";

    if (widgets.length === 0) {
      return new Response(JSON.stringify({ error: "A IA não conseguiu compor widgets válidos com estas fontes.", sourcesConsidered: sources.map((s) => s.key) }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 6. (Opcional) aplica no dashboard.
    let applied = 0;
    if (apply && dashboardId) {
      const rows = widgets.map((w, idx) => ({
        dashboard_id: dashboardId,
        title: w.title,
        type: w.type,
        position: idx,
        size: w.size ?? "medium",
        config: w.config ?? {},
        is_visible: true,
      }));
      const { error } = await supabase.from("dashboard_widgets").insert(rows);
      if (error) throw new Error(`Insert widgets: ${error.message}`);
      applied = rows.length;
    }

    return new Response(JSON.stringify({
      title,
      widgets,
      applied,
      meta: {
        form,
        sourcesConsidered: sources.map((s) => ({ key: s.key, rowCount: s.rowCount, fields: s.fields.length })),
        model: Deno.env.get("ANTHROPIC_API_KEY") ? (Deno.env.get("ANTHROPIC_MODEL_INSIGHTS") ?? "claude-sonnet-4-5") : (Deno.env.get("OPENAI_MODEL_INSIGHTS") ?? "gpt-4o"),
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[compose-dashboard]", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
