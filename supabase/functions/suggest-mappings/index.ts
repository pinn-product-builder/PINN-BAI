import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tables, selectedColumns } = await req.json() as { 
      tables: TableInfo[];
      selectedColumns?: Record<string, string[]>;
    };

    if (!tables || tables.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhuma tabela fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      // Fallback: use heuristic mapping
      const result = heuristicMappings(tables, selectedColumns);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build detailed prompt for AI
    const tablesSummary = tables.map(t => {
      const cols = t.columns.map(c => {
        const samples = c.sampleValues?.slice(0, 3).map(v => JSON.stringify(v)).join(', ') || '';
        return `  - ${c.name} (${c.type})${samples ? ` [exemplos: ${samples}]` : ''}`;
      }).join('\n');
      return `Tabela: ${t.name} (${t.rowCount} registros)\nColunas:\n${cols}`;
    }).join('\n\n');

    const systemPrompt = `Você é um especialista em BI e dashboards. Analise as tabelas e colunas disponíveis e sugira os melhores mapeamentos de campos para métricas de dashboard.

MÉTRICAS PADRÃO DISPONÍVEIS (use estas como base, mas pode criar métricas customizadas):
- total_leads: Total de registros/leads
- new_leads: Novos leads no período
- conversions: Conversões realizadas
- conversion_rate: Taxa de conversão (%)
- revenue: Receita total
- mrr: Receita recorrente mensal
- growth_rate: Taxa de crescimento (%)
- active_users: Usuários ativos
- funnel_stage: Estágio do funil
- lead_source: Origem do lead
- created_date: Data de criação

TRANSFORMAÇÕES DISPONÍVEIS:
- none: Sem transformação
- number: Converter para número
- currency: Formatar como moeda (R$)
- percentage: Formatar como percentual (%)
- date: Formatar como data
- text: Texto simples

REGRAS:
1. Priorize colunas que representam KPIs importantes (valores, contagens, taxas)
2. Mapeie campos de data para análise temporal
3. Mapeie campos de status/estágio para funis
4. Crie métricas customizadas quando fizer sentido (ex: "cpl" para custo por lead)
5. Escolha a transformação adequada ao tipo de dado
6. Retorne 5-15 mapeamentos mais relevantes
7. Ordene por relevância (mais importantes primeiro)

Responda APENAS com JSON válido:
{
  "suggestions": [
    {
      "sourceField": "nome_coluna",
      "sourceTable": "nome_tabela",
      "targetMetric": "metrica_destino",
      "transformation": "tipo_transformacao",
      "confidence": 95,
      "reason": "Justificativa breve"
    }
  ],
  "primaryTable": "tabela_principal_recomendada",
  "summary": "Resumo breve das sugestões (1 frase)"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise estas tabelas e sugira os melhores mapeamentos para um dashboard de métricas:\n\n${tablesSummary}` }
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status);
      const result = heuristicMappings(tables, selectedColumns);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from response
    let result: SuggestMappingsResponse;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        result = {
          success: true,
          suggestions: parsed.suggestions || [],
          primaryTable: parsed.primaryTable || tables[0]?.name || '',
          summary: parsed.summary || 'Mapeamentos sugeridos pela IA',
          method: 'ai',
        };
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      console.error("Failed to parse AI response:", content);
      result = heuristicMappings(tables, selectedColumns);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function heuristicMappings(tables: TableInfo[], selectedColumns?: Record<string, string[]>): SuggestMappingsResponse {
  const suggestions: MappingSuggestion[] = [];
  let primaryTable = tables[0]?.name || '';
  let maxScore = 0;

  // Find best primary table
  for (const table of tables) {
    const name = table.name.toLowerCase();
    let score = table.rowCount > 0 ? 10 : 0;
    
    if (/vw_|view_|dashboard|kpi/i.test(name)) score += 30;
    if (/lead|cliente|customer/i.test(name)) score += 20;
    if (/sale|venda|revenue|order/i.test(name)) score += 15;
    
    if (score > maxScore) {
      maxScore = score;
      primaryTable = table.name;
    }
  }

  // Map columns to metrics
  for (const table of tables) {
    const columnsToAnalyze = selectedColumns?.[table.name] || table.columns.map(c => c.name);
    
    for (const colName of columnsToAnalyze) {
      const column = table.columns.find(c => c.name === colName);
      if (!column) continue;

      const name = column.name.toLowerCase();
      const type = column.type.toLowerCase();

      // Lead/count metrics
      if (/total|count|quantidade|leads|clientes/i.test(name)) {
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: 'total_leads',
          transformation: 'number',
          confidence: 85,
          reason: 'Campo de contagem identificado',
        });
      }

      // Revenue/value metrics
      if (/value|valor|amount|revenue|receita|mrr|spend|gasto|cost|custo/i.test(name)) {
        const isCurrency = /value|valor|amount|revenue|receita|mrr/i.test(name);
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: /mrr/i.test(name) ? 'mrr' : (/spend|gasto|cost|custo/i.test(name) ? column.name : 'revenue'),
          transformation: isCurrency ? 'currency' : 'number',
          confidence: 90,
          reason: 'Campo de valor monetário',
        });
      }

      // Rate/percentage metrics
      if (/rate|taxa|percent|conv|cpl|cpm|ctr/i.test(name)) {
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: /conv/i.test(name) ? 'conversion_rate' : column.name,
          transformation: 'percentage',
          confidence: 88,
          reason: 'Campo de taxa/percentual',
        });
      }

      // Date fields
      if (/date|data|created|updated|timestamp/i.test(name) || type.includes('timestamp') || type.includes('date')) {
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: 'created_date',
          transformation: 'date',
          confidence: 80,
          reason: 'Campo temporal para análise',
        });
      }

      // Status/stage fields
      if (/status|stage|etapa|fase|state/i.test(name)) {
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: 'funnel_stage',
          transformation: 'text',
          confidence: 82,
          reason: 'Campo de estágio/status',
        });
      }

      // Source fields
      if (/source|origem|canal|channel|utm/i.test(name)) {
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: 'lead_source',
          transformation: 'text',
          confidence: 85,
          reason: 'Campo de origem/canal',
        });
      }
    }
  }

  // Remove duplicates and sort by confidence
  const uniqueSuggestions = suggestions.reduce((acc, curr) => {
    const key = `${curr.sourceTable}.${curr.sourceField}`;
    if (!acc.has(key) || acc.get(key)!.confidence < curr.confidence) {
      acc.set(key, curr);
    }
    return acc;
  }, new Map<string, MappingSuggestion>());

  const sortedSuggestions = Array.from(uniqueSuggestions.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 15);

  return {
    success: true,
    suggestions: sortedSuggestions,
    primaryTable,
    summary: `Identificados ${sortedSuggestions.length} mapeamentos relevantes via análise heurística`,
    method: 'heuristic',
  };
}
