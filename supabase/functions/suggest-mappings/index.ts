/**
 * Pinn BAI — suggest-mappings Edge Function  (v2)
 *
 * Melhorias na heurística:
 *  - Views agregadas recebem score máximo (vw_*, _30d, _60d, _7d)
 *  - Semântica de negócio: distingue custo vs receita vs taxa
 *  - Padrões PT-BR: custo_total, reuniao_realizada, entrada_total, etc.
 *  - IDs e datas NUNCA mapeados como métricas
 *  - Detecção de padrão monetário por valores (avg > 10 + decimais)
 *  - Confiança calibrada por número de evidências
 *  - Fallback AI via OPENAI_API_KEY (gpt-4o-mini — rápido e barato)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface ColumnInfo {
  name: string;
  type: string;
  sampleValues?: unknown[];
}

interface TableInfo {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
  sampleData?: Record<string, unknown>[];
}

interface MappingSuggestion {
  sourceField: string;
  sourceTable: string;
  targetMetric: string;
  transformation: string;
  confidence: number;
  reason: string;
}

interface SuggestMappingsResponse {
  success: boolean;
  suggestions: MappingSuggestion[];
  primaryTable: string;
  summary: string;
  method: 'ai' | 'heuristic';
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tables, selectedColumns } = await req.json() as {
      tables: TableInfo[];
      selectedColumns?: Record<string, string[]>;
    };

    if (!tables?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhuma tabela fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');

    if (OPENAI_KEY) {
      try {
        const result = await aiMappings(tables, selectedColumns, OPENAI_KEY);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('AI mapping failed, falling back to heuristic:', e);
      }
    }

    // Fallback heurístico
    const result = heuristicMappings(tables, selectedColumns);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento via OpenAI API (gpt-4o-mini)
// ─────────────────────────────────────────────────────────────────────────────

async function aiMappings(
  tables: TableInfo[],
  selectedColumns: Record<string, string[]> | undefined,
  apiKey: string
): Promise<SuggestMappingsResponse> {

  const tablesSummary = tables.map(t => {
    const cols = t.columns.map(c => {
      const samples = c.sampleValues?.slice(0, 8).map(v => JSON.stringify(v)).join(', ') ?? '';
      return `  - ${c.name} (${c.type})${samples ? `: ${samples}` : ''}`;
    }).join('\n');

    return `Tabela: ${t.name} [${t.rowCount} registros]\n${cols}`;
  }).join('\n\n---\n\n');

  const systemPrompt = `Você é um especialista em Business Intelligence e mapeamento de dados para dashboards executivos.

Analise as tabelas fornecidas e sugira mapeamentos de colunas para métricas padronizadas.

MÉTRICAS DISPONÍVEIS:
total_leads, new_leads, conversions, conversion_rate, revenue, mrr, investimento, avg_ticket, 
cpl, cpm_meeting, meetings_scheduled, meetings_done, mensagens, calls_done, active_users,
churn_rate, growth_rate, funnel_stage, lead_source, created_date, custom

TRANSFORMAÇÕES: number, currency, percentage, date, text, none

REGRAS CRÍTICAS:
- NUNCA mapeie colunas de ID (id, uuid, pk, _id) como métricas
- NUNCA mapeie colunas de data/timestamp como métricas (apenas como dimensões groupBy)
- Views agregadas (vw_*, *_30d, *_60d, *dashboard*, *kpi*) têm PRIORIDADE MÁXIMA
- Receita/custo → currency, taxas 0-100% → percentage, contagens → number
- Detecte padrões PT-BR: custo_total, reuniao_realizada, entrada_total, etc.

Retorne JSON válido (sem markdown):
{
  "suggestions": [
    {
      "sourceField": "nome_coluna",
      "sourceTable": "nome_tabela",
      "targetMetric": "metrica",
      "transformation": "tipo",
      "confidence": 95,
      "reason": "Justificativa concisa"
    }
  ],
  "primaryTable": "tabela_principal",
  "summary": "Resumo em 1 frase"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analise estas tabelas e gere mapeamentos para dashboard:\n\n${tablesSummary}` },
      ],
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  const jsonMatch = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in AI response');

  const parsed = JSON.parse(jsonMatch[0]);
  const valid = (parsed.suggestions ?? []).filter((s: MappingSuggestion) =>
    s.sourceField && s.sourceTable && s.targetMetric
  );

  const uniqueTables = new Set(valid.map((s: MappingSuggestion) => s.sourceTable));
  return {
    success: true,
    suggestions: valid,
    primaryTable: parsed.primaryTable ?? tables[0]?.name ?? '',
    summary: parsed.summary ?? `${valid.length} mapeamentos de ${uniqueTables.size} tabela(s)`,
    method: 'ai',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Heurística v2 — melhorada
// ─────────────────────────────────────────────────────────────────────────────

function analyzeNumericValues(samples: unknown[]): {
  isNumeric: boolean;
  isCurrency: boolean;
  isPercentage: boolean;
  avg: number;
  hasDecimals: boolean;
} {
  const nums = samples
    .map(v => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') return parseFloat(v.replace(/[R$,\s%]/g, '.').replace(/\.(?=.*\.)/g, ''));
      return NaN;
    })
    .filter(n => !isNaN(n));

  if (!nums.length) return { isNumeric: false, isCurrency: false, isPercentage: false, avg: 0, hasDecimals: false };

  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const hasDecimals = nums.some(n => n % 1 !== 0);

  const isCurrency = avg > 10 && (hasDecimals || avg > 100 || (avg > 50 && max > 200));
  const isPercentage = max <= 100 && min >= 0 && avg < 100 && (hasDecimals || avg < 50);

  return { isNumeric: true, isCurrency, isPercentage, avg, hasDecimals };
}

function scoreTablePriority(table: TableInfo): number {
  const n = table.name.toLowerCase();
  let score = Math.min(table.rowCount > 0 ? 10 : 0, 20);

  if (/^vw_|^view_|^v\d+_/i.test(n))           score += 50;
  if (/kpi|dashboard|summary|metrics/i.test(n)) score += 40;
  if (/funil|funnel|custos|costs/i.test(n))     score += 30;
  if (/daily|diario|dia/i.test(n))              score += 20;
  if (/_30d|_60d|_7d|_90d/i.test(n))           score += 15;
  if (/lead|cliente|customer/i.test(n))         score += 15;
  if (/sale|venda|revenue|pedido/i.test(n))     score += 15;
  if (/msg|message|kommo/i.test(n))             score += 10;
  if (/call|vapi|ligac/i.test(n))               score += 10;
  if (/log|audit|event_log/i.test(n))           score -= 20;

  const numericCols = table.columns.filter(c => {
    const t = c.type.toLowerCase();
    return t.includes('int') || t.includes('numeric') || t.includes('decimal') || t.includes('float');
  }).length;
  score += Math.min(numericCols * 2, 20);

  return score;
}

function isIdColumn(name: string): boolean {
  return /^id$|^uuid$|^pk$|_id$|_uuid$/i.test(name);
}

function isDateColumn(name: string, type: string): boolean {
  return type.toLowerCase().includes('date') ||
    type.toLowerCase().includes('timestamp') ||
    /^day$|^dia$|^date$|^data$|^created_at$|^updated_at$|_at$|_ts$|event_day|day_brt|started_at|ended_at|last_event_ts/i.test(name);
}

function heuristicMappings(
  tables: TableInfo[],
  selectedColumns?: Record<string, string[]>
): SuggestMappingsResponse {
  const suggestions: MappingSuggestion[] = [];

  const sortedTables = [...tables].sort((a, b) => scoreTablePriority(b) - scoreTablePriority(a));
  const primaryTable = sortedTables[0]?.name ?? '';

  for (const table of sortedTables) {
    const columnsToProcess = selectedColumns?.[table.name]
      ? table.columns.filter(c => selectedColumns[table.name].includes(c.name))
      : table.columns;

    for (const col of columnsToProcess) {
      const n = col.name.toLowerCase();
      const type = col.type.toLowerCase();
      const samples = col.sampleValues ?? [];
      const numStats = analyzeNumericValues(samples);

      // ── Pular IDs e datas como métricas ──────────────────────────────
      if (isIdColumn(col.name)) continue;
      if (isDateColumn(col.name, col.type)) continue;

      const isNumericType = type.includes('int') || type.includes('numeric') ||
        type.includes('decimal') || type.includes('float') || type.includes('double');

      // ── LEADS / CONTAGENS ──────────────────────────────────────────────
      const isLeadCount = /leads_total|total_leads|lead_count|leads_new|new_leads|novos_leads|entrada_total/i.test(n) ||
        (n.endsWith('_total') && /lead|entrada/i.test(n));

      if (isLeadCount && isNumericType) {
        const isNew = /new|novo|novos|recent|latest/i.test(n);
        const isEntrada = /entrada/i.test(n);
        suggestions.push({
          sourceField: col.name,
          sourceTable: table.name,
          targetMetric: isNew ? 'new_leads' : isEntrada ? 'new_leads' : 'total_leads',
          transformation: 'number',
          confidence: 95,
          reason: `Contagem de leads confirmada pelo nome "${col.name}" + tipo numérico`,
        });
        continue;
      }

      // ── RECEITA / FINANCEIRO ───────────────────────────────────────────
      const isRevenue = /revenue|receita|faturamento|mrr|receita_mensal/i.test(n);
      const isSpend = /spend_total|spend_30d|custo_total|investimento|gasto_total/i.test(n);
      const isCpl = /^cpl$|cpl_30d|cpl_total|custo_por_lead|cost_per_lead/i.test(n);
      const isCpmMeeting = /cp_meeting|custo_por_reuniao|cost_per_meeting/i.test(n);
      const isTicket = /ticket_medio|avg_ticket|ticket/i.test(n);
      const isMrr = /^mrr$|mrr_total/i.test(n);

      if (isMrr && isNumericType) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'mrr', transformation: 'currency', confidence: 97, reason: `MRR identificado pelo nome "${col.name}"` });
        continue;
      }
      if (isCpl && isNumericType) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'cpl', transformation: 'currency', confidence: 96, reason: `CPL identificado: "${col.name}"` });
        continue;
      }
      if (isCpmMeeting && isNumericType) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'cpm_meeting', transformation: 'currency', confidence: 96, reason: `Custo por reunião: "${col.name}"` });
        continue;
      }
      if (isTicket && isNumericType) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'avg_ticket', transformation: 'currency', confidence: 93, reason: `Ticket médio: "${col.name}"` });
        continue;
      }
      if (isRevenue && isNumericType) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'revenue', transformation: 'currency', confidence: 95, reason: `Receita identificada: "${col.name}"` });
        continue;
      }
      if (isSpend && isNumericType) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'investimento', transformation: 'currency', confidence: 94, reason: `Investimento/spend identificado: "${col.name}"` });
        continue;
      }

      // Detecção por valor (moeda)
      if (isNumericType && numStats.isCurrency && numStats.avg > 10) {
        const isCostWord = /custo|cost|spend|gasto|invest/i.test(n);
        suggestions.push({
          sourceField: col.name,
          sourceTable: table.name,
          targetMetric: isCostWord ? 'investimento' : 'revenue',
          transformation: 'currency',
          confidence: 88,
          reason: `Valores monetários detectados (média: ${numStats.avg.toFixed(2)}, decimais: ${numStats.hasDecimals})`,
        });
        continue;
      }

      // ── TAXAS / PERCENTUAIS ────────────────────────────────────────────
      const isRate = /rate|taxa|percent|conv_lead|conv_msg|ctr|churn|growth|crescimento|taxa_entrada|taxa_conv/i.test(n);

      if (isRate && isNumericType) {
        let target = 'conversion_rate';
        let conf = 90;
        if (/churn/i.test(n))                             { target = 'churn_rate'; conf = 95; }
        else if (/growth|crescimento/i.test(n))           { target = 'growth_rate'; conf = 93; }
        else if (/ctr/i.test(n))                          { target = 'ctr'; conf = 93; }
        else if (/conv_lead|taxa_conv|conversion_rate/i.test(n)) { target = 'conversion_rate'; conf = 96; }

        suggestions.push({
          sourceField: col.name,
          sourceTable: table.name,
          targetMetric: target,
          transformation: 'percentage',
          confidence: conf,
          reason: `Taxa/percentual: "${col.name}"`,
        });
        continue;
      }

      // Detecção por valor (percentual)
      if (isNumericType && numStats.isPercentage && !numStats.isCurrency) {
        suggestions.push({
          sourceField: col.name,
          sourceTable: table.name,
          targetMetric: n.replace(/[^a-z0-9]/g, '_'),
          transformation: 'percentage',
          confidence: 82,
          reason: `Valores percentuais detectados (0-100, média: ${numStats.avg.toFixed(1)})`,
        });
        continue;
      }

      // ── REUNIÕES ───────────────────────────────────────────────────────
      if (/meetings_done|reuniao_realizada|realizada_total/i.test(n) && isNumericType) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'meetings_done', transformation: 'number', confidence: 95, reason: `Reuniões realizadas: "${col.name}"` });
        continue;
      }
      if (/meetings_booked|meetings_scheduled|reuniao_agendada|agendada_total/i.test(n) && isNumericType) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'meetings_scheduled', transformation: 'number', confidence: 95, reason: `Reuniões agendadas: "${col.name}"` });
        continue;
      }

      // ── MENSAGENS ──────────────────────────────────────────────────────
      if (/msg_in|msg_out|mensagens|messages_total/i.test(n) && isNumericType) {
        const isMsgIn = /msg_in|entrada|recebida/i.test(n);
        suggestions.push({
          sourceField: col.name,
          sourceTable: table.name,
          targetMetric: isMsgIn ? 'mensagens' : 'mensagens',
          transformation: 'number',
          confidence: 93,
          reason: `Mensagens ${isMsgIn ? 'recebidas' : ''}: "${col.name}"`,
        });
        continue;
      }

      // ── LIGAÇÕES / CALLS ───────────────────────────────────────────────
      if (/calls_done|calls_answered|ligacoes_realizadas/i.test(n) && isNumericType) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'calls_done', transformation: 'number', confidence: 94, reason: `Ligações realizadas: "${col.name}"` });
        continue;
      }
      if (/total_spent.*usd|calls.*spent|vapi.*cost/i.test(n) && isNumericType) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'total_spent_calls', transformation: 'currency', confidence: 92, reason: `Custo de ligações: "${col.name}"` });
        continue;
      }

      // ── CATEGORIAS / STATUS / ORIGEM ───────────────────────────────────
      if (/^status$|^stage$|stage_name|stage_key|^etapa$|^fase$/i.test(n)) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'funnel_stage', transformation: 'text', confidence: 88, reason: `Estágio de funil: "${col.name}"` });
        continue;
      }
      if (/^source$|^origem$|^canal$|utm_source|^anuncio$/i.test(n)) {
        suggestions.push({ sourceField: col.name, sourceTable: table.name, targetMetric: 'lead_source', transformation: 'text', confidence: 88, reason: `Origem/canal: "${col.name}"` });
        continue;
      }

      // ── GENÉRICO NUMÉRICO ──────────────────────────────────────────────
      if (isNumericType && numStats.isNumeric && !numStats.isCurrency && !numStats.isPercentage) {
        suggestions.push({
          sourceField: col.name,
          sourceTable: table.name,
          targetMetric: 'total_leads', // melhor fallback para contagem genérica
          transformation: 'number',
          confidence: 72,
          reason: `Campo numérico genérico — provavelmente uma contagem`,
        });
      }
    }
  }

  // Deduplicar por table.field, manter maior confidence
  const deduped = new Map<string, MappingSuggestion>();
  for (const s of suggestions) {
    const key = `${s.sourceTable}.${s.sourceField}`;
    if (!deduped.has(key) || deduped.get(key)!.confidence < s.confidence) {
      deduped.set(key, s);
    }
  }

  const priorityOrder = ['revenue', 'total_leads', 'conversions', 'conversion_rate', 'mrr', 'investimento', 'cpl', 'new_leads', 'meetings_scheduled', 'meetings_done', 'mensagens', 'calls_done'];

  const sorted = Array.from(deduped.values())
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      const ai = priorityOrder.indexOf(a.targetMetric);
      const bi = priorityOrder.indexOf(b.targetMetric);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    })
    .slice(0, 25);

  const uniqueTables = new Set(sorted.map(s => s.sourceTable));

  return {
    success: true,
    suggestions: sorted,
    primaryTable,
    summary: `Identificados ${sorted.length} mapeamentos de ${uniqueTables.size} tabela(s) via análise heurística avançada`,
    method: 'heuristic',
  };
}
