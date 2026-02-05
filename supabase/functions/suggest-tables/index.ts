import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TableInfo {
  name: string;
  rowCount: number;
  columns: { name: string; type: string }[];
}

interface TableSuggestion {
  tableName: string;
  score: number;
  reason: string;
  suggestedColumns: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tables } = await req.json() as { tables: TableInfo[] };

    if (!tables || tables.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhuma tabela fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      // Fallback: use heuristic scoring if no API key
      const suggestions = heuristicSuggestions(tables);
      return new Response(
        JSON.stringify({ success: true, suggestions, method: 'heuristic' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build prompt for AI
    const tablesSummary = tables.map(t => 
      `- ${t.name}: ${t.rowCount} registros, colunas: ${t.columns.map(c => `${c.name}(${c.type})`).join(', ')}`
    ).join('\n');

    const systemPrompt = `Você é um especialista em análise de dados e business intelligence. 
Analise as tabelas disponíveis de um banco de dados de CRM/Business e recomende as melhores para criar um dashboard de métricas.

Priorize tabelas que:
1. Contêm dados de leads, clientes, vendas, conversões ou métricas de negócio
2. Têm campos de data para análise temporal
3. Têm campos numéricos para métricas (valores, contagens)
4. Têm volume de dados adequado (nem muito poucos, nem tabelas de log gigantes)
5. Views (vw_*) geralmente são otimizadas para relatórios - priorize-as
6. Evite tabelas de sistema, logs técnicos, migrations, etc.

Responda APENAS com um JSON válido no formato:
{
  "suggestions": [
    {
      "tableName": "nome_tabela",
      "score": 95,
      "reason": "Razão clara e breve",
      "suggestedColumns": ["coluna1", "coluna2"]
    }
  ]
}

Retorne no máximo 10 sugestões, ordenadas por relevância (score de 0 a 100).`;

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
          { role: "user", content: `Analise estas ${tables.length} tabelas e recomende as melhores para um dashboard:\n\n${tablesSummary}` }
        ],
      }),
    });

    if (!response.ok) {
      // Fallback on API error
      console.error("AI gateway error:", response.status);
      const suggestions = heuristicSuggestions(tables);
      return new Response(
        JSON.stringify({ success: true, suggestions, method: 'heuristic' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from response
    let suggestions: TableSuggestion[] = [];
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = parsed.suggestions || [];
      }
    } catch {
      console.error("Failed to parse AI response:", content);
      suggestions = heuristicSuggestions(tables);
    }

    return new Response(
      JSON.stringify({ success: true, suggestions, method: 'ai' }),
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

function heuristicSuggestions(tables: TableInfo[]): TableSuggestion[] {
  const scored = tables.map(table => {
    let score = 50;
    const reasons: string[] = [];
    const suggestedColumns: string[] = [];
    const name = table.name.toLowerCase();

    // Views are usually optimized
    if (name.startsWith('vw_')) {
      score += 15;
      reasons.push('View otimizada para relatórios');
    }

    // Business-relevant tables
    if (/lead|cliente|customer|sale|venda|order|pedido|conversion/i.test(name)) {
      score += 20;
      reasons.push('Dados de negócio relevantes');
    }

    // KPI/Dashboard views
    if (/kpi|dashboard|metrics|daily|weekly|monthly/i.test(name)) {
      score += 25;
      reasons.push('Métricas agregadas');
    }

    // Funnel data
    if (/funnel|funil|stage|etapa/i.test(name)) {
      score += 15;
      reasons.push('Dados de funil');
    }

    // Penalize system tables
    if (/migration|schema|log|cache|temp|session|auth/i.test(name)) {
      score -= 30;
      reasons.push('Tabela de sistema');
    }

    // Check for good columns
    for (const col of table.columns) {
      const colName = col.name.toLowerCase();
      if (/date|created|updated|timestamp/i.test(colName)) {
        suggestedColumns.push(col.name);
      }
      if (/value|amount|total|revenue|price|count/i.test(colName)) {
        suggestedColumns.push(col.name);
        score += 5;
      }
      if (/status|stage|source|type|category/i.test(colName)) {
        suggestedColumns.push(col.name);
        score += 3;
      }
    }

    // Row count bonus (prefer tables with data but not too much)
    if (table.rowCount > 10 && table.rowCount < 100000) {
      score += 10;
    } else if (table.rowCount === 0) {
      score -= 20;
    }

    return {
      tableName: table.name,
      score: Math.max(0, Math.min(100, score)),
      reason: reasons.length > 0 ? reasons.join('. ') : 'Tabela padrão',
      suggestedColumns: [...new Set(suggestedColumns)].slice(0, 5),
    };
  });

  return scored
    .filter(s => s.score > 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
