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

    // Build detailed prompt for AI with sample data analysis
    const tablesSummary = tables.map(t => {
      const cols = t.columns.map(c => {
        const samples = c.sampleValues?.slice(0, 5).map(v => {
          const str = JSON.stringify(v);
          return str.length > 50 ? str.substring(0, 50) + '...' : str;
        }).join(', ') || '';
        const sampleData = t.sampleData?.slice(0, 2).map(row => {
          const val = row[c.name];
          return val !== undefined ? JSON.stringify(val).substring(0, 30) : null;
        }).filter(Boolean).join(', ') || '';
        return `  - ${c.name} (${c.type})${samples ? ` [amostras: ${samples}]` : ''}${sampleData ? ` [dados: ${sampleData}]` : ''}`;
      }).join('\n');
      return `Tabela: ${t.name} (${t.rowCount} registros)\nColunas:\n${cols}`;
    }).join('\n\n');

    const systemPrompt = `Você é um especialista em Business Intelligence e criação de dashboards executivos. Sua tarefa é analisar tabelas de banco de dados e criar mapeamentos inteligentes de colunas para métricas de dashboard.

CONTEXTO:
Você está analisando tabelas de um banco de dados para criar um dashboard de métricas de negócio. O objetivo é identificar automaticamente quais colunas representam KPIs importantes e mapeá-las para métricas padronizadas.

MÉTRICAS PADRÃO DISPONÍVEIS (priorize estas, mas crie customizadas quando necessário):
- total_leads: Total de registros/leads/contagem geral
- new_leads: Novos leads capturados no período
- conversions: Conversões realizadas (leads que viraram clientes)
- conversion_rate: Taxa de conversão em percentual (0-100)
- revenue: Receita total em valores monetários
- mrr: Monthly Recurring Revenue (receita recorrente mensal)
- growth_rate: Taxa de crescimento percentual
- active_users: Usuários ativos no período
- funnel_stage: Estágio do funil de vendas (texto: novo, qualificado, proposta, etc)
- lead_source: Origem do lead (texto: google_ads, linkedin, referral, etc)
- created_date: Data de criação do registro (para análise temporal)

MÉTRICAS CUSTOMIZADAS COMUNS (crie quando identificar):
- cpl: Custo por Lead
- cpm: Custo por Reunião/Meeting
- ctr: Click-Through Rate
- ltv: Lifetime Value
- cac: Customer Acquisition Cost
- avg_ticket: Ticket médio
- mensagens: Total de mensagens
- reuniões_agendadas: Reuniões agendadas
- reuniões_canceladas: Reuniões canceladas
- investimento: Valor investido em marketing

TRANSFORMAÇÕES DISPONÍVEIS (escolha baseado no tipo e conteúdo):
- none: Sem transformação (para texto simples)
- number: Converter para número (para contagens, valores numéricos)
- currency: Formatar como moeda brasileira R$ (para valores monetários)
- percentage: Formatar como percentual % (para taxas, percentuais 0-100)
- date: Formatar como data (para campos temporais)
- text: Texto simples (para categorias, status, nomes)

ANÁLISE DETALHADA REQUERIDA:
1. Analise os NOMES das colunas procurando por padrões:
   - Contagens: total, count, quantidade, leads, clientes, users
   - Valores monetários: value, valor, amount, revenue, receita, mrr, spend, gasto, cost, custo, investimento
   - Taxas: rate, taxa, percent, conv, cpl, cpm, ctr
   - Datas: date, data, created, updated, timestamp, day
   - Status/Estágios: status, stage, etapa, fase, state
   - Origens: source, origem, canal, channel, utm

2. Analise os VALORES DE AMOSTRA:
   - Se valores são numéricos e parecem monetários (ex: 1000, 2500.50) → currency
   - Se valores são percentuais (0-100 ou 0-1) → percentage
   - Se valores são datas/timestamps → date
   - Se valores são texto categórico → text ou funnel_stage/lead_source

3. Analise o TIPO DE DADO:
   - numeric, integer, bigint → number ou currency
   - text, varchar → text, funnel_stage, ou lead_source
   - timestamp, date → date
   - boolean → pode ser conversion ou status

4. Priorize tabelas que são VIEWS (vw_*) ou têm "dashboard" no nome
5. Priorize colunas com nomes descritivos e valores significativos
6. Evite mapear IDs, UUIDs, ou campos técnicos

REGRAS DE QUALIDADE:
1. Confidence (confiança) deve ser 70-100:
   - 95-100: Mapeamento muito claro e óbvio
   - 85-94: Mapeamento provável com boa evidência
   - 75-84: Mapeamento possível mas requer validação
   - 70-74: Mapeamento sugerido mas incerto

2. Retorne 8-20 mapeamentos, priorizando os mais importantes
3. Ordene por relevância (KPIs principais primeiro)
4. Seja específico na "reason" explicando POR QUE esse mapeamento faz sentido
5. Identifique a melhor tabela principal (primaryTable) baseado em:
   - Views agregadas (vw_*)
   - Tabelas com mais KPIs relevantes
   - Tabelas com mais registros e dados completos

FORMATO DE RESPOSTA (JSON válido, sem markdown):
{
  "suggestions": [
    {
      "sourceField": "nome_exato_da_coluna",
      "sourceTable": "nome_exato_da_tabela",
      "targetMetric": "metrica_destino_ou_customizada",
      "transformation": "tipo_transformacao",
      "confidence": 95,
      "reason": "Explicação clara e específica do porquê este mapeamento é correto"
    }
  ],
  "primaryTable": "nome_da_tabela_principal",
  "summary": "Resumo executivo em 1-2 frases das sugestões geradas"
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
    
    // Extract and validate JSON from response
    let result: SuggestMappingsResponse;
    try {
      // Try to find JSON in the response (handle markdown code blocks)
      let jsonStr = content;
      
      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      // Try to find JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and clean suggestions
        const validSuggestions: MappingSuggestion[] = (parsed.suggestions || [])
          .filter((s: any) => {
            // Must have required fields
            if (!s.sourceField || !s.sourceTable || !s.targetMetric) return false;
            
            // Validate confidence (0-100)
            if (typeof s.confidence !== 'number' || s.confidence < 0 || s.confidence > 100) {
              s.confidence = 85; // Default confidence
            }
            
            // Validate transformation
            const validTransformations = ['none', 'number', 'currency', 'percentage', 'date', 'text'];
            if (!validTransformations.includes(s.transformation)) {
              s.transformation = 'none';
            }
            
            // Ensure reason exists
            if (!s.reason || typeof s.reason !== 'string') {
              s.reason = 'Mapeamento sugerido pela IA';
            }
            
            return true;
          })
          .map((s: any) => ({
            sourceField: String(s.sourceField),
            sourceTable: String(s.sourceTable),
            targetMetric: String(s.targetMetric),
            transformation: String(s.transformation),
            confidence: Number(s.confidence),
            reason: String(s.reason),
          }));
        
        if (validSuggestions.length === 0) {
          throw new Error('No valid suggestions found');
        }
        
        result = {
          success: true,
          suggestions: validSuggestions,
          primaryTable: parsed.primaryTable || tables[0]?.name || '',
          summary: parsed.summary || `IA identificou ${validSuggestions.length} mapeamentos relevantes`,
          method: 'ai',
        };
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      console.error("Response content:", content.substring(0, 500));
      // Fallback to heuristic
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

// Analyze sample values to determine data type and format
function analyzeSampleValues(samples: unknown[]): { isNumeric: boolean; isCurrency: boolean; isPercentage: boolean; isDate: boolean; numericValue?: number } {
  if (!samples || samples.length === 0) {
    return { isNumeric: false, isCurrency: false, isPercentage: false, isDate: false };
  }

  const numericSamples = samples
    .map(v => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        // Try to parse as number (handles currency, percentages, etc)
        const cleaned = v.replace(/[R$\s.,%]/g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    })
    .filter((v): v is number => v !== null);

  if (numericSamples.length === 0) {
    // Check if it's a date
    const dateSamples = samples.filter(v => {
      if (typeof v === 'string') {
        const date = new Date(v);
        return !isNaN(date.getTime());
      }
      return false;
    });
    return { isNumeric: false, isCurrency: false, isPercentage: false, isDate: dateSamples.length > 0 };
  }

  const avgValue = numericSamples.reduce((a, b) => a + b, 0) / numericSamples.length;
  const maxValue = Math.max(...numericSamples);
  const minValue = Math.min(...numericSamples);

  // Check if values look like currency (typically > 10, can have decimals)
  const isCurrency = avgValue > 10 && numericSamples.some(v => v % 1 !== 0);

  // Check if values look like percentages (0-100 or 0-1 range)
  const isPercentage = (maxValue <= 100 && minValue >= 0) || (maxValue <= 1 && minValue >= 0);

  return {
    isNumeric: true,
    isCurrency,
    isPercentage,
    isDate: false,
    numericValue: avgValue,
  };
}

function heuristicMappings(tables: TableInfo[], selectedColumns?: Record<string, string[]>): SuggestMappingsResponse {
  const suggestions: MappingSuggestion[] = [];
  let primaryTable = tables[0]?.name || '';
  let maxScore = 0;

  // Find best primary table with improved scoring
  for (const table of tables) {
    const name = table.name.toLowerCase();
    let score = table.rowCount > 0 ? 10 : 0;
    
    // Views and dashboard tables get highest priority
    if (/^vw_|^view_|dashboard|kpi|metrics|summary|agg/i.test(name)) score += 40;
    if (/lead|cliente|customer|user/i.test(name)) score += 25;
    if (/sale|venda|revenue|order|pedido/i.test(name)) score += 20;
    if (/daily|diario|dia|day/i.test(name)) score += 15;
    if (/30d|60d|month|mes/i.test(name)) score += 10;
    
    // Bonus for tables with many numeric columns
    const numericCols = table.columns.filter(c => {
      const type = c.type.toLowerCase();
      return type.includes('int') || type.includes('numeric') || type.includes('decimal') || type.includes('float') || type.includes('double');
    }).length;
    score += Math.min(numericCols * 2, 20);
    
    if (score > maxScore) {
      maxScore = score;
      primaryTable = table.name;
    }
  }

  // Map columns to metrics with improved analysis
  for (const table of tables) {
    const columnsToAnalyze = selectedColumns?.[table.name] || table.columns.map(c => c.name);
    
    for (const colName of columnsToAnalyze) {
      const column = table.columns.find(c => c.name === colName);
      if (!column) continue;

      const name = column.name.toLowerCase();
      const type = column.type.toLowerCase();
      const samples = column.sampleValues || [];
      const sampleAnalysis = analyzeSampleValues(samples);

      // Skip IDs and technical fields
      if (/^id$|^uuid$|^pk$|_id$|_uuid$/i.test(name) && type.includes('uuid')) continue;

      // Lead/count metrics - improved detection
      if (/total|count|quantidade|leads|clientes|users|registros|qtd/i.test(name) || 
          (name.includes('_30d') || name.includes('_60d') || name.includes('_total'))) {
        const isNewLeads = /new|novo|novos/i.test(name);
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: isNewLeads ? 'new_leads' : 'total_leads',
          transformation: 'number',
          confidence: sampleAnalysis.isNumeric ? 92 : 85,
          reason: `${isNewLeads ? 'Novos leads' : 'Total de leads'} identificado pelo nome da coluna${sampleAnalysis.isNumeric ? ' e valores numéricos' : ''}`,
        });
      }

      // Revenue/value metrics - improved with sample analysis
      if (/value|valor|amount|revenue|receita|mrr|spend|gasto|cost|custo|investimento|investment/i.test(name) ||
          sampleAnalysis.isCurrency) {
        let targetMetric = 'revenue';
        let confidence = 90;
        
        if (/mrr|recurring|recorrente/i.test(name)) {
          targetMetric = 'mrr';
          confidence = 95;
        } else if (/spend|gasto|investimento|investment|cost|custo/i.test(name)) {
          targetMetric = name.includes('cpl') ? 'cpl' : name.includes('cpm') ? 'cpm' : 'investimento';
          confidence = 92;
        } else if (/revenue|receita|value|valor|amount/i.test(name)) {
          targetMetric = 'revenue';
          confidence = 93;
        }

        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric,
          transformation: sampleAnalysis.isCurrency || sampleAnalysis.numericValue && sampleAnalysis.numericValue > 10 ? 'currency' : 'number',
          confidence,
          reason: `Campo monetário identificado${sampleAnalysis.isCurrency ? ' (valores confirmam formato monetário)' : ' (nome sugere valor monetário)'}`,
        });
      }

      // Rate/percentage metrics - improved detection
      if (/rate|taxa|percent|conv|cpl|cpm|ctr|ratio|proporcao/i.test(name) || 
          sampleAnalysis.isPercentage) {
        let targetMetric = 'conversion_rate';
        let confidence = 88;
        
        if (/conv|conversao/i.test(name)) {
          targetMetric = 'conversion_rate';
          confidence = 95;
        } else if (/cpl/i.test(name)) {
          targetMetric = 'cpl';
          confidence = 92;
        } else if (/cpm/i.test(name)) {
          targetMetric = 'cpm';
          confidence = 92;
        } else if (/ctr/i.test(name)) {
          targetMetric = 'ctr';
          confidence = 90;
        } else if (/growth|crescimento/i.test(name)) {
          targetMetric = 'growth_rate';
          confidence = 90;
        } else {
          targetMetric = column.name; // Custom metric
          confidence = sampleAnalysis.isPercentage ? 88 : 80;
        }

        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric,
          transformation: 'percentage',
          confidence,
          reason: `Taxa/percentual identificado${sampleAnalysis.isPercentage ? ' (valores confirmam formato percentual)' : ' (nome sugere taxa)'}`,
        });
      }

      // Messages metrics
      if (/msg|message|mensagem|mensagens/i.test(name)) {
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: 'mensagens',
          transformation: 'number',
          confidence: 90,
          reason: 'Campo de mensagens identificado',
        });
      }

      // Meetings metrics
      if (/meeting|reuniao|reunioes|agendada|cancelada/i.test(name)) {
        const isCancelled = /cancel|cancelada/i.test(name);
        const isScheduled = /agend|scheduled/i.test(name);
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: isCancelled ? 'reuniões_canceladas' : isScheduled ? 'reuniões_agendadas' : 'reuniões',
          transformation: 'number',
          confidence: 92,
          reason: `Reuniões ${isCancelled ? 'canceladas' : isScheduled ? 'agendadas' : ''} identificadas`,
        });
      }

      // Date fields - improved detection
      if (/date|data|created|updated|timestamp|day|dia|time/i.test(name) || 
          type.includes('timestamp') || type.includes('date') || 
          sampleAnalysis.isDate) {
        const isCreated = /created|criado|criacao/i.test(name);
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: isCreated ? 'created_date' : 'created_date',
          transformation: 'date',
          confidence: sampleAnalysis.isDate ? 95 : 85,
          reason: `Campo temporal identificado${sampleAnalysis.isDate ? ' (valores confirmam formato de data)' : ' (tipo ou nome sugere data)'}`,
        });
      }

      // Status/stage fields - improved detection
      if (/status|stage|etapa|fase|state|estado/i.test(name)) {
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: /stage|etapa|fase/i.test(name) ? 'funnel_stage' : 'funnel_stage',
          transformation: 'text',
          confidence: 88,
          reason: 'Campo de estágio/status identificado para análise de funil',
        });
      }

      // Source fields - improved detection
      if (/source|origem|canal|channel|utm|medium|campaign/i.test(name)) {
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: 'lead_source',
          transformation: 'text',
          confidence: 90,
          reason: 'Campo de origem/canal identificado para análise de aquisição',
        });
      }

      // Conversions
      if (/conversion|conversao|convertido|convert/i.test(name)) {
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: 'conversions',
          transformation: 'number',
          confidence: 93,
          reason: 'Campo de conversões identificado',
        });
      }

      // Active users
      if (/active|ativo|activos|users|usuarios/i.test(name) && /user|usuario/i.test(name)) {
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric: 'active_users',
          transformation: 'number',
          confidence: 90,
          reason: 'Usuários ativos identificados',
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

  // Sort by confidence and relevance, limit to top 20
  const sortedSuggestions = Array.from(uniqueSuggestions.values())
    .sort((a, b) => {
      // First sort by confidence
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      // Then by metric priority (KPIs first)
      const priorityOrder = ['revenue', 'total_leads', 'conversion_rate', 'mrr', 'new_leads', 'conversions'];
      const aPriority = priorityOrder.indexOf(a.targetMetric);
      const bPriority = priorityOrder.indexOf(b.targetMetric);
      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      return 0;
    })
    .slice(0, 20);

  return {
    success: true,
    suggestions: sortedSuggestions,
    primaryTable,
    summary: `Identificados ${sortedSuggestions.length} mapeamentos relevantes via análise heurística avançada`,
    method: 'heuristic',
  };
}
