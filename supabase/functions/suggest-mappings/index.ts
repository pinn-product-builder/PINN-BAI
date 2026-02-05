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

    // Build comprehensive data analysis for AI
    const tablesSummary = tables.map(t => {
      // Analyze table structure and data patterns
      const numericColumns = t.columns.filter(c => {
        const type = c.type.toLowerCase();
        return type.includes('int') || type.includes('numeric') || type.includes('decimal') || type.includes('float') || type.includes('double');
      });
      
      const textColumns = t.columns.filter(c => {
        const type = c.type.toLowerCase();
        return type.includes('text') || type.includes('varchar') || type.includes('char');
      });
      
      const dateColumns = t.columns.filter(c => {
        const type = c.type.toLowerCase();
        const name = c.name.toLowerCase();
        return type.includes('date') || type.includes('timestamp') || name.includes('date') || name.includes('created') || name.includes('updated');
      });
      
      // Analyze column relationships and patterns
      const cols = t.columns.map(c => {
        // Include more samples (up to 15) for deep analysis
        const samples = c.sampleValues?.slice(0, 15).map(v => {
          const str = JSON.stringify(v);
          return str.length > 50 ? str.substring(0, 50) + '...' : str;
        }).join(', ') || '';
        
        // Include full sample rows (up to 10) for context understanding
        const sampleData = t.sampleData?.slice(0, 10).map(row => {
          const val = row[c.name];
          return val !== undefined ? JSON.stringify(val).substring(0, 40) : null;
        }).filter(Boolean).join(' | ') || '';
        
        // Deep statistical analysis
        const numericSamples = c.sampleValues?.filter(v => {
          if (typeof v === 'number') return true;
          if (typeof v === 'string') {
            const cleaned = v.replace(/,/g, '.').replace(/[R$\s%]/g, '');
            return !isNaN(parseFloat(cleaned));
          }
          return false;
        });
        
        let stats = '';
        let dataPattern = '';
        if (numericSamples && numericSamples.length > 0) {
          const nums = numericSamples.map(v => {
            if (typeof v === 'number') return v;
            const cleaned = String(v).replace(/,/g, '.').replace(/[R$\s%]/g, '');
            return parseFloat(cleaned);
          }).filter(n => !isNaN(n));
          
          if (nums.length > 0) {
            const min = Math.min(...nums);
            const max = Math.max(...nums);
            const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
            const median = nums.sort((a, b) => a - b)[Math.floor(nums.length / 2)];
            const uniqueCount = new Set(nums).size;
            const hasDecimals = nums.some(n => n % 1 !== 0);
            
            stats = ` [min:${min.toFixed(2)}, max:${max.toFixed(2)}, avg:${avg.toFixed(2)}, mediana:${median.toFixed(2)}, únicos:${uniqueCount}/${nums.length}]`;
            
            // Pattern detection
            if (avg > 1000 && hasDecimals) dataPattern = ' [PADRÃO: Valores monetários grandes]';
            else if (avg > 0 && avg <= 100 && !hasDecimals && uniqueCount < nums.length * 0.3) dataPattern = ' [PADRÃO: Contagem discreta]';
            else if (avg >= 0 && avg <= 100 && (max <= 100)) dataPattern = ' [PADRÃO: Possível percentual ou contagem]';
            else if (hasDecimals && avg < 1) dataPattern = ' [PADRÃO: Taxa decimal (0-1)]';
          }
        }
        
        // Analyze text patterns
        const textSamples = c.sampleValues?.filter(v => typeof v === 'string').slice(0, 10);
        if (textSamples && textSamples.length > 0) {
          const uniqueTexts = new Set(textSamples);
          const avgLength = textSamples.reduce((sum, v) => sum + v.length, 0) / textSamples.length;
          if (uniqueTexts.size <= 5) {
            dataPattern = ` [PADRÃO: Categoria (${uniqueTexts.size} valores únicos: ${Array.from(uniqueTexts).slice(0, 3).join(', ')})]`;
          } else if (avgLength > 50) {
            dataPattern = ' [PADRÃO: Texto longo/descrição]';
          }
        }
        
        // Date pattern detection
        const dateSamples = c.sampleValues?.filter(v => {
          if (typeof v === 'string') {
            const date = new Date(v);
            return !isNaN(date.getTime());
          }
          return false;
        });
        if (dateSamples && dateSamples.length > 0) {
          dataPattern = ' [PADRÃO: Datas/timestamps]';
        }
        
        return `  - ${c.name} (${c.type})${samples ? `\n    Amostras: ${samples}` : ''}${sampleData ? `\n    Dados reais: ${sampleData}` : ''}${stats}${dataPattern}`;
      }).join('\n');
      
      const tableAnalysis = `
Tabela: ${t.name}
- Total de registros: ${t.rowCount.toLocaleString()}
- Colunas numéricas: ${numericColumns.length}
- Colunas de texto: ${textColumns.length}
- Colunas de data: ${dateColumns.length}
- Análise: ${t.rowCount > 1000 ? 'Grande volume de dados' : t.rowCount > 100 ? 'Volume médio' : 'Volume pequeno'}
${numericColumns.length > 3 ? '- RICA EM MÉTRICAS: Esta tabela tem muitas colunas numéricas, ideal para KPIs' : ''}
${t.name.toLowerCase().includes('view') || t.name.toLowerCase().includes('vw_') ? '- VIEW AGREGADA: Esta tabela provavelmente já tem dados processados' : ''}

Colunas detalhadas:
${cols}`;
      
      return tableAnalysis;
    }).join('\n\n' + '='.repeat(80) + '\n\n');

    const systemPrompt = `Você é um ESPECIALISTA SÊNIOR em Business Intelligence, Analytics e criação de dashboards executivos. Sua missão é analisar profundamente tabelas de banco de dados e criar mapeamentos PERFEITOS e ASSERTIVOS de colunas para métricas de dashboard.

CONTEXTO CRÍTICO:
Você está analisando tabelas de um banco de dados para criar um dashboard executivo AUTOMÁTICO. O objetivo é:
1. IDENTIFICAR com precisão quais colunas representam KPIs importantes
2. MAPEAR corretamente para métricas padronizadas que funcionarão no dashboard
3. PENSAR no dashboard final: como os dados serão visualizados, agregados e apresentados
4. SER ASSERTIVO: tomar decisões claras baseadas em evidências múltiplas (nome + tipo + valores + padrões)

IMPORTANTE: Você precisa pensar como um ANALISTA DE DADOS EXPERIENTE que:
- Entende o contexto de negócio por trás dos dados
- Identifica padrões e relacionamentos entre colunas
- Prioriza métricas que realmente importam para decisões executivas
- Garante que os mapeamentos resultarão em dashboards úteis e acionáveis

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

METODOLOGIA DE ANÁLISE (SIGA RIGOROSAMENTE):

ETAPA 1: ANÁLISE ESTRUTURAL DAS TABELAS
1. Identifique a TABELA PRINCIPAL (primaryTable):
   - Views agregadas (vw_*, view_*) têm PRIORIDADE MÁXIMA
   - Tabelas com "dashboard", "kpi", "summary", "metrics" no nome
   - Tabelas com MAIS registros e MAIS colunas numéricas
   - Tabelas que parecem ser a "fonte da verdade" do negócio
   - EVITE tabelas de log, audit, ou transacionais muito granulares

2. Analise o CONTEXTO DO NEGÓCIO:
   - O que esta tabela representa? (leads, vendas, usuários, produtos?)
   - Quais são as métricas mais importantes para este tipo de negócio?
   - Quais colunas são essenciais para um dashboard executivo?

ETAPA 2: ANÁLISE PROFUNDA DAS COLUNAS (para cada coluna):

A) ANÁLISE DO NOME (case-insensitive, múltiplos padrões):
   - Contagens: total, count, quantidade, qtd, leads, clientes, users, usuarios, registros, numero, num
   - Valores monetários: value, valor, amount, revenue, receita, mrr, spend, gasto, cost, custo, investimento, price, preco, ticket, lucro, profit
   - Taxas: rate, taxa, percent, conv, cpl, cpm, ctr, ratio, proporcao, porcentagem
   - Datas: date, data, created, updated, timestamp, day, dia, hora, time, quando, inicio, fim
   - Status/Estágios: status, stage, etapa, fase, state, estado, situacao, fase_atual
   - Origens: source, origem, canal, channel, utm, medium, campaign, fonte, aquisicao
   - Conversões: conversion, conversao, converted, convertido, convertido_em
   - Mensagens: message, mensagem, msg, mensagens, chat, texto
   - Reuniões: meeting, reuniao, reunioes, agendada, scheduled, call
   - Novos/Recentes: new, novo, novos, recent, recente, latest, ultimo

B) ANÁLISE DOS VALORES (use TODAS as amostras e estatísticas):
   - Valores numéricos GRANDES (>100) com decimais → currency (ex: 1250.50, 2500.00, 10000.99)
   - Valores numéricos MÉDIOS (10-1000) inteiros → contagem (ex: 25, 150, 500)
   - Valores numéricos PEQUENOS (0-100) → pode ser contagem OU percentual
   - Valores entre 0-1 → percentage (taxa decimal)
   - Valores entre 0-100 → percentage (taxa percentual) OU contagem pequena
   - Valores com muitos decimais → currency ou medida precisa
   - Valores inteiros sem decimais → contagem ou ID
   - Muitos valores únicos → métrica individual (revenue por registro)
   - Poucos valores únicos → categoria (funnel_stage, lead_source)
   - Valores de data/timestamp válidos → date
   - Texto com poucos valores únicos (<10) → categoria (funnel_stage, lead_source)
   - Texto com muitos valores únicos → descrição/nome (não mapear)

C) ANÁLISE DO TIPO DE DADO:
   - numeric, integer, bigint → number (contagem) ou currency (se valores grandes)
   - decimal, float, double → currency (se >100) ou percentage (se 0-100)
   - text, varchar, char → text, funnel_stage, ou lead_source (depende dos valores)
   - timestamp, date, datetime → date (SEMPRE)
   - boolean → conversion (se nome sugere) ou status

D) ANÁLISE DE RELACIONAMENTOS:
   - Se há coluna "created_date" + coluna numérica → pode ser evolução temporal
   - Se há coluna "status" + coluna numérica → pode ser funil
   - Se há coluna "source" + coluna numérica → pode ser análise por origem
   - Se há múltiplas colunas monetárias → identifique qual é receita vs custo

ETAPA 3: DECISÃO ASSERTIVA DE MAPEAMENTO
1. Para cada coluna, avalie TODAS as evidências:
   - Nome da coluna (peso: 40%)
   - Valores de amostra e estatísticas (peso: 40%)
   - Tipo de dado (peso: 10%)
   - Contexto da tabela (peso: 10%)

2. Seja DECISIVO:
   - Se 3+ evidências apontam para uma métrica → confidence 95-100
   - Se 2 evidências apontam → confidence 85-94
   - Se 1 evidência aponta → confidence 75-84
   - Se incerto mas útil → confidence 70-74

3. PRIORIZE métricas que serão úteis no dashboard:
   - Revenue/Receita é SEMPRE importante
   - Leads são SEMPRE importantes
   - Conversões são SEMPRE importantes
   - Taxas são importantes para análise
   - Datas são essenciais para gráficos temporais
   - Categorias são essenciais para agrupamentos

REGRAS DE QUALIDADE E ASSERTIVIDADE:

1. CONFIDENCE (confiança) - Seja RIGOROSO:
   - 98-100: Mapeamento PERFEITO - nome + tipo + valores + padrões TODOS confirmam (ex: coluna "total_revenue" numeric com valores 1000-50000)
   - 95-97: Mapeamento EXCELENTE - 3+ evidências fortes confirmam
   - 90-94: Mapeamento BOM - 2 evidências fortes confirmam
   - 85-89: Mapeamento PROVÁVEL - evidência forte mas alguma incerteza
   - 80-84: Mapeamento POSSÍVEL - evidência parcial, mas útil
   - 75-79: Mapeamento SUGERIDO - pode ser útil, mas requer validação
   - 70-74: Mapeamento INCERTO - última opção, apenas se necessário

2. QUANTIDADE E QUALIDADE:
   - Retorne 12-30 mapeamentos (mais é melhor se forem relevantes)
   - PRIORIZE QUALIDADE sobre quantidade
   - Cada mapeamento deve ser ÚTIL para o dashboard
   - Evite mapeamentos redundantes (não mapeie a mesma coluna 2x)

3. ORDENAÇÃO POR RELEVÂNCIA (KPIs primeiro):
   - revenue/receita (mais importante para executivos)
   - total_leads (essencial para vendas)
   - conversions (essencial para performance)
   - conversion_rate (importante para análise)
   - mrr (importante para SaaS)
   - new_leads (importante para crescimento)
   - created_date (essencial para gráficos temporais)
   - lead_source (importante para análise de canais)
   - funnel_stage (importante para funis)
   - outros...

4. REASON (justificativa) - Seja DETALHADO e ESPECÍFICO:
   - Explique TODAS as evidências que levaram à decisão
   - Mencione nome da coluna, tipo, valores, padrões identificados
   - Explique por que esta métrica é útil no dashboard
   - Exemplo PERFEITO: "Coluna 'total_revenue' (tipo: numeric) com valores entre R$ 1.250-5.000 (média: R$ 2.450) e decimais confirma receita total. Nome explícito + valores monetários + tipo numérico = mapeamento perfeito para métrica 'revenue' com transformação 'currency'."

5. PRIMARY TABLE (tabela principal) - Seja ESTRATÉGICO:
   - Views agregadas (vw_*, view_*) têm PRIORIDADE ABSOLUTA
   - Tabelas com mais KPIs mapeados
   - Tabelas com mais registros (dados completos)
   - Tabelas que parecem ser a "fonte da verdade"
   - EVITE tabelas de log, audit, ou muito granulares

6. ESPECIFICIDADE - Escolha SEMPRE a métrica mais específica:
   - "total_leads" > "total" genérico
   - "conversion_rate" > "rate" genérico
   - "revenue" > "value" genérico
   - "new_leads" > "leads" (se houver distinção)
   - "mrr" > "revenue" (se for recorrente)

7. PENSANDO NO DASHBOARD FINAL:
   - Mapeie colunas que serão úteis em gráficos temporais (datas)
   - Mapeie colunas que permitirão agrupamentos (categorias)
   - Mapeie métricas que executivos querem ver (KPIs principais)
   - Garanta que haverá dados suficientes para visualizações
   - Pense em como os dados serão agregados (sum, count, avg)

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
          { role: "user", content: `Analise PROFUNDAMENTE estas tabelas e crie mapeamentos PERFEITOS e ASSERTIVOS para um dashboard executivo.

PENSE NO DASHBOARD FINAL:
- Como os dados serão visualizados?
- Quais métricas são mais importantes para decisões executivas?
- Quais colunas permitirão criar gráficos úteis?
- Quais agrupamentos serão possíveis?

SEJA ASSERTIVO:
- Tome decisões claras baseadas em múltiplas evidências
- Priorize métricas que realmente importam
- Garanta que os mapeamentos resultarão em um dashboard útil

DADOS DAS TABELAS:
${tablesSummary}

Lembre-se: O objetivo é criar um dashboard que funcione PERFEITAMENTE apenas conectando a fonte de dados. Seja preciso, assertivo e pense no resultado final.` }
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
        // Replace comma with dot for decimal separator, then remove currency symbols
        const cleaned = v.replace(/,/g, '.').replace(/[R$\s%]/g, '');
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
  const hasDecimals = numericSamples.some(v => v % 1 !== 0);

  // Enhanced currency detection
  // Currency: values > 10, often have decimals, typically in hundreds/thousands
  const isCurrency = avgValue > 10 && (
    hasDecimals || 
    avgValue > 100 || 
    (avgValue > 50 && maxValue > 200) // Large values even if integer
  );

  // Enhanced percentage detection
  // Percentage: 0-100 range OR 0-1 range, often with decimals
  const isPercentage = (
    (maxValue <= 100 && minValue >= 0 && avgValue <= 100) ||
    (maxValue <= 1 && minValue >= 0 && avgValue <= 1)
  ) && (
    hasDecimals || // Percentages often have decimals
    (maxValue <= 100 && minValue >= 0 && avgValue < 50) // Low values in 0-100 range
  );

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
      if (/^id$|^uuid$|^pk$|_id$|_uuid$/i.test(column.name) && (type.includes('uuid') || type.includes('serial'))) continue;

      // Skip IDs and technical fields
      if (/^id$|^uuid$|^pk$|_id$|_uuid$/i.test(name) && type.includes('uuid')) continue;

      // Lead/count metrics - enhanced detection with multiple patterns
      const isCountPattern = /total|count|quantidade|leads|clientes|users|registros|qtd|numero|num/i.test(name) || 
          (name.includes('_30d') || name.includes('_60d') || name.includes('_total') || name.includes('_count'));
      
      if (isCountPattern) {
        const isNewLeads = /new|novo|novos|recent|recente|latest|ultimo/i.test(name);
        const isTotalLeads = /total|total_leads|total_lead/i.test(name);
        
        let confidence = 85;
        let targetMetric = 'total_leads';
        
        // Determine metric type
        if (isNewLeads) {
          targetMetric = 'new_leads';
          confidence = 92;
        } else if (isTotalLeads) {
          targetMetric = 'total_leads';
          confidence = 95;
        } else if (/lead/i.test(name)) {
          targetMetric = 'total_leads';
          confidence = 90;
        }
        
        // Boost confidence based on value analysis
        if (sampleAnalysis.isNumeric) {
          if (sampleAnalysis.numericValue && sampleAnalysis.numericValue > 0 && sampleAnalysis.numericValue < 1000000) {
            confidence = Math.min(98, confidence + 5);
          }
          // If values are integers and reasonable counts, boost confidence
          if (!sampleAnalysis.isCurrency && !sampleAnalysis.isPercentage && 
              sampleAnalysis.numericValue && sampleAnalysis.numericValue > 0 && sampleAnalysis.numericValue < 10000) {
            confidence = Math.min(97, confidence + 3);
          }
        }
        
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric,
          transformation: 'number',
          confidence,
          reason: `${isNewLeads ? 'Novos leads' : 'Total de leads'} identificado: nome "${column.name}"${sampleAnalysis.isNumeric ? ` + valores numéricos confirmam (média: ${sampleAnalysis.numericValue?.toFixed(0)})` : ''}${type.includes('int') ? ' + tipo integer confirma contagem' : ''}`,
        });
      }

      // Revenue/value metrics - enhanced detection with multiple evidence
      const isMonetaryPattern = /value|valor|amount|revenue|receita|mrr|spend|gasto|cost|custo|investimento|investment|price|preco|ticket|lucro|profit|venda|sale/i.test(name);
      const isCurrencyByValue = sampleAnalysis.isCurrency && sampleAnalysis.numericValue && sampleAnalysis.numericValue > 10;
      
      if (isMonetaryPattern || isCurrencyByValue) {
        let targetMetric = 'revenue';
        let confidence = 88;
        
        // Determine specific metric type
        if (/mrr|recurring|recorrente|mensal/i.test(name)) {
          targetMetric = 'mrr';
          confidence = sampleAnalysis.isCurrency ? 98 : 95;
        } else if (/spend|gasto|investimento|investment|cost|custo|despesa/i.test(name)) {
          if (/cpl|cost_per_lead/i.test(name)) {
            targetMetric = 'cpl';
            confidence = sampleAnalysis.isCurrency ? 96 : 93;
          } else if (/cpm|cost_per_meeting/i.test(name)) {
            targetMetric = 'cpm';
            confidence = sampleAnalysis.isCurrency ? 96 : 93;
          } else {
            targetMetric = 'investimento';
            confidence = sampleAnalysis.isCurrency ? 95 : 92;
          }
        } else if (/revenue|receita|faturamento/i.test(name)) {
          targetMetric = 'revenue';
          confidence = sampleAnalysis.isCurrency ? 97 : 94;
        } else if (/ticket|ticket_medio|avg_ticket/i.test(name)) {
          targetMetric = 'avg_ticket';
          confidence = sampleAnalysis.isCurrency ? 96 : 93;
        } else if (/value|valor|amount|price|preco|venda|sale/i.test(name)) {
          targetMetric = 'revenue';
          confidence = sampleAnalysis.isCurrency ? 95 : 91;
        } else if (isCurrencyByValue) {
          // Detected as currency by values but name doesn't match - still likely revenue
          targetMetric = 'revenue';
          confidence = 90;
        }

        // Boost confidence if multiple evidence points match
        if (isMonetaryPattern && isCurrencyByValue) {
          confidence = Math.min(99, confidence + 3);
        }
        
        // Ensure transformation is currency for monetary values
        const transformation = (sampleAnalysis.isCurrency || (sampleAnalysis.numericValue && sampleAnalysis.numericValue > 50)) ? 'currency' : 'number';
        
        // Get numeric values for detailed reason
        const numericVals = samples.filter(v => {
          if (typeof v === 'number') return true;
          if (typeof v === 'string') {
            const cleaned = v.replace(/,/g, '.').replace(/[R$\s%]/g, '');
            return !isNaN(parseFloat(cleaned));
          }
          return false;
        }).map(v => {
          if (typeof v === 'number') return v;
          const cleaned = String(v).replace(/,/g, '.').replace(/[R$\s%]/g, '');
          return parseFloat(cleaned);
        }).filter(n => !isNaN(n));
        
        const minVal = numericVals.length > 0 ? Math.min(...numericVals) : 0;
        const maxVal = numericVals.length > 0 ? Math.max(...numericVals) : 0;
        
        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric,
          transformation,
          confidence,
          reason: `Campo monetário identificado: nome "${column.name}"${sampleAnalysis.isCurrency && numericVals.length > 0 ? ` + valores confirmam (R$ ${sampleAnalysis.numericValue?.toFixed(2)} em média, min: ${minVal.toFixed(2)}, max: ${maxVal.toFixed(2)})` : ''}${type.includes('numeric') || type.includes('decimal') ? ' + tipo numérico confirma' : ''}`,
        });
      }

      // Rate/percentage metrics - improved detection
      if (/rate|taxa|percent|conv|cpl|cpm|ctr|ratio|proporcao/i.test(name) || 
          sampleAnalysis.isPercentage) {
        let targetMetric = 'conversion_rate';
        let confidence = 88;
        
        if (/conv|conversao/i.test(name)) {
          targetMetric = 'conversion_rate';
          confidence = sampleAnalysis.isPercentage ? 97 : 95;
        } else if (/cpl/i.test(name)) {
          targetMetric = 'cpl';
          confidence = 92;
        } else if (/cpm/i.test(name)) {
          targetMetric = 'cpm';
          confidence = 92;
        } else if (/ctr/i.test(name)) {
          targetMetric = 'ctr';
          confidence = sampleAnalysis.isPercentage ? 93 : 90;
        } else if (/growth|crescimento/i.test(name)) {
          targetMetric = 'growth_rate';
          confidence = sampleAnalysis.isPercentage ? 93 : 90;
        } else if (sampleAnalysis.isPercentage) {
          // Detected as percentage by values
          targetMetric = column.name.toLowerCase().replace(/[^a-z0-9]/g, '_'); // Custom metric
          confidence = 88;
        } else {
          targetMetric = column.name.toLowerCase().replace(/[^a-z0-9]/g, '_'); // Custom metric
          confidence = 80;
        }

        suggestions.push({
          sourceField: column.name,
          sourceTable: table.name,
          targetMetric,
          transformation: 'percentage',
          confidence,
          reason: `Taxa/percentual identificado${sampleAnalysis.isPercentage ? ` (valores confirmam: ${sampleAnalysis.numericValue?.toFixed(1)}% em média)` : ' (nome sugere taxa)'}`,
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
