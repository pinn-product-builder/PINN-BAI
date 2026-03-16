import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WidgetRecommendation {
  type: string;
  title: string;
  description: string;
  score: number;
  config: Record<string, unknown>;
  basedOn: string;
}

interface DataMapping {
  source_table: string;
  source_column: string;
  target_metric: string;
  transform_type?: string;
  aggregation?: string;
  format?: string;
}

interface RequestBody {
  orgId: string;
  mappings?: DataMapping[];
  plan?: number;
}

// Scoring weights
const WEIGHTS = {
  DATA_RELEVANCE: 0.4,
  UX_QUALITY: 0.3,
  DATA_FIT: 0.3,
};

// Base scores for different metric types
const METRIC_SCORES: Record<string, { widget: string; baseScore: number; format?: string }> = {
  total_leads: { widget: 'metric_card', baseScore: 95, format: 'number' },
  new_leads: { widget: 'metric_card', baseScore: 93, format: 'number' },
  conversions: { widget: 'metric_card', baseScore: 92, format: 'number' },
  conversion_rate: { widget: 'metric_card', baseScore: 91, format: 'percentage' },
  revenue: { widget: 'metric_card', baseScore: 94, format: 'currency' },
  mrr: { widget: 'metric_card', baseScore: 93, format: 'currency' },
  avg_ticket: { widget: 'metric_card', baseScore: 85, format: 'currency' },
  growth_rate: { widget: 'metric_card', baseScore: 84, format: 'percentage' },
  ltv: { widget: 'metric_card', baseScore: 82, format: 'currency' },
  cac: { widget: 'metric_card', baseScore: 81, format: 'currency' },
  churn_rate: { widget: 'metric_card', baseScore: 80, format: 'percentage' },
  lead_source: { widget: 'pie_chart', baseScore: 87 },
  funnel_stage: { widget: 'funnel', baseScore: 89 },
  created_date: { widget: 'area_chart', baseScore: 88 },
};

// Widget descriptions with detailed explanations
const WIDGET_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
  total_leads: {
    title: 'Total de Leads',
    description: 'Exibe o número total de leads capturados no período, com comparação ao período anterior e sparkline de tendência.',
  },
  new_leads: {
    title: 'Novos Leads',
    description: 'Quantidade de leads adquiridos recentemente, permitindo acompanhar a efetividade das campanhas de aquisição.',
  },
  conversions: {
    title: 'Conversões',
    description: 'Número de leads que se tornaram clientes pagantes. Métrica fundamental para avaliar a equipe comercial.',
  },
  conversion_rate: {
    title: 'Taxa de Conversão',
    description: 'Percentual de leads convertidos em clientes. Calculado como (Conversões / Total de Leads) × 100.',
  },
  revenue: {
    title: 'Receita Total',
    description: 'Soma de todas as vendas realizadas no período. Inclui receitas recorrentes e vendas pontuais.',
  },
  mrr: {
    title: 'Receita Recorrente Mensal',
    description: 'MRR representa o valor mensal previsível de todas as assinaturas ativas.',
  },
  avg_ticket: {
    title: 'Ticket Médio',
    description: 'Valor médio por transação. Use para identificar oportunidades de upsell.',
  },
  growth_rate: {
    title: 'Taxa de Crescimento',
    description: 'Variação percentual comparada ao período anterior. Valores positivos indicam crescimento.',
  },
};

function calculateScore(
  baseScore: number,
  hasTemporalData: boolean,
  hasCategoricalData: boolean,
  mappingsCount: number
): number {
  let score = baseScore;
  
  // Bonus for having more data context
  if (mappingsCount >= 5) score += 2;
  if (hasTemporalData) score += 1;
  if (hasCategoricalData) score += 1;
  
  // Cap at 99
  return Math.min(99, score);
}

function detectDataPatterns(mappings: DataMapping[]) {
  const patterns = {
    hasTemporalData: false,
    hasCategoricalData: false,
    hasMonetaryData: false,
    hasPercentageData: false,
    hasFunnelData: false,
    metrics: new Set<string>(),
  };

  for (const mapping of mappings) {
    patterns.metrics.add(mapping.target_metric);

    // Detect temporal data
    if (
      mapping.target_metric === 'created_date' ||
      mapping.source_column.toLowerCase().includes('date') ||
      mapping.source_column.toLowerCase().includes('created') ||
      mapping.source_column.toLowerCase().includes('updated') ||
      mapping.transform_type === 'date'
    ) {
      patterns.hasTemporalData = true;
    }

    // Detect categorical data
    if (
      mapping.target_metric === 'lead_source' ||
      mapping.source_column.toLowerCase().includes('source') ||
      mapping.source_column.toLowerCase().includes('status') ||
      mapping.source_column.toLowerCase().includes('type') ||
      mapping.source_column.toLowerCase().includes('category')
    ) {
      patterns.hasCategoricalData = true;
    }

    // Detect monetary data
    if (
      ['revenue', 'mrr', 'avg_ticket', 'ltv', 'cac'].includes(mapping.target_metric) ||
      mapping.format === 'currency' ||
      mapping.transform_type === 'currency'
    ) {
      patterns.hasMonetaryData = true;
    }

    // Detect percentage data
    if (
      ['conversion_rate', 'growth_rate', 'churn_rate'].includes(mapping.target_metric) ||
      mapping.format === 'percentage' ||
      mapping.transform_type === 'percentage'
    ) {
      patterns.hasPercentageData = true;
    }

    // Detect funnel data
    if (
      mapping.target_metric === 'funnel_stage' ||
      mapping.source_column.toLowerCase().includes('stage') ||
      mapping.source_column.toLowerCase().includes('funnel')
    ) {
      patterns.hasFunnelData = true;
    }
  }

  return patterns;
}

function generateRecommendations(
  mappings: DataMapping[],
  plan: number = 2
): WidgetRecommendation[] {
  const recommendations: WidgetRecommendation[] = [];
  const patterns = detectDataPatterns(mappings);
  const addedTypes = new Set<string>();

  // Índice rápido: targetMetric → mapping com source_column real
  const mappingByTarget = new Map<string, DataMapping>();
  for (const m of mappings) {
    if (!mappingByTarget.has(m.target_metric)) {
      mappingByTarget.set(m.target_metric, m);
    }
  }

  // Detectar se a tabela de origem é uma view KPI agregada
  const isAggregatedViewTable = (tableName: string): boolean => {
    const t = tableName.toLowerCase();
    return /^vw_|^view_/i.test(t) || /kpi|_30d|_60d|_7d|summary|overview|dashboard/i.test(t);
  };

  // Helper: montar config completo e correto para um metric_card
  const buildMetricCardConfig = (
    targetMetric: string,
    format: string,
  ): Record<string, unknown> => {
    const m = mappingByTarget.get(targetMetric);
    if (m) {
      return {
        // metric aponta para a coluna REAL na tabela real — nunca o nome semântico
        metric: m.source_column,
        dataSource: m.source_table,
        sourceTable: m.source_table,
        targetMetric,
        aggregation: m.aggregation || (format === 'percentage' ? 'avg' : 'sum'),
        format,
        transformation: m.transform_type || format,
        isAggregatedView: isAggregatedViewTable(m.source_table),
        showTrend: true,
        showSparkline: true,
      };
    }
    // Sem mapping real: usar nome semântico como fallback (engine vai tentar resolver)
    return {
      metric: targetMetric,
      targetMetric,
      format,
      showTrend: true,
      showSparkline: true,
    };
  };

  // Helper: montar config para gráficos temporais (area/line)
  const buildTimeSeriesConfig = (
    targetMetric: string,
    format: string,
  ): Record<string, unknown> => {
    // Preferir view de séries temporais (daily, 60d) sobre KPI (30d)
    const timeseriesMapping = mappings.find(m => {
      const t = m.source_table.toLowerCase();
      return m.target_metric === targetMetric && (/daily|diario|_60d|_90d/i.test(t));
    }) || mappingByTarget.get(targetMetric);

    const dateMapping = mappings.find(m =>
      m.target_metric === 'created_date' ||
      /day|dia|date|data|created_at/i.test(m.source_column)
    );

    const cfg: Record<string, unknown> = {
      showGrid: true,
      gradientFill: true,
      animate: true,
      curveType: 'smooth',
      showTooltip: true,
    };

    if (timeseriesMapping) {
      cfg.metric = timeseriesMapping.source_column;
      cfg.dataSource = timeseriesMapping.source_table;
      cfg.sourceTable = timeseriesMapping.source_table;
      cfg.targetMetric = targetMetric;
      cfg.aggregation = timeseriesMapping.aggregation || 'sum';
      cfg.format = format;
      cfg.isAggregatedView = false; // séries temporais têm múltiplos rows
    }

    if (dateMapping) {
      cfg.groupBy = dateMapping.source_column;
    } else {
      cfg.groupBy = 'day'; // fallback comum em views diárias
    }

    return cfg;
  };

  // Helper: montar config para pie/bar (distribuição categórica)
  const buildCategoricalConfig = (
    categoryMetric: string,
    valueMetric?: string,
  ): Record<string, unknown> => {
    const catMapping = mappingByTarget.get(categoryMetric);
    const valMapping = valueMetric ? mappingByTarget.get(valueMetric) : undefined;

    const cfg: Record<string, unknown> = {
      showLabels: true,
      showLegend: true,
      animate: true,
    };

    if (catMapping) {
      cfg.dataSource = catMapping.source_table;
      cfg.sourceTable = catMapping.source_table;
      cfg.groupBy = catMapping.source_column;
    }
    if (valMapping) {
      cfg.metric = valMapping.source_column;
      cfg.aggregation = valMapping.aggregation || 'count';
    } else {
      cfg.aggregation = 'count';
    }

    return cfg;
  };

  // ── Metric cards ─────────────────────────────────────────────────────────
  for (const mapping of mappings) {
    const metricConfig = METRIC_SCORES[mapping.target_metric];
    if (metricConfig && metricConfig.widget === 'metric_card') {
      const key = `metric_card_${mapping.target_metric}`;
      if (addedTypes.has(key)) continue;
      addedTypes.add(key);

      const widgetDesc = WIDGET_DESCRIPTIONS[mapping.target_metric] || {
        title: mapping.target_metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: `Métrica de ${mapping.source_column} na tabela ${mapping.source_table}.`,
      };

      recommendations.push({
        type: 'metric_card',
        title: widgetDesc.title,
        description: widgetDesc.description,
        score: calculateScore(
          metricConfig.baseScore,
          patterns.hasTemporalData,
          patterns.hasCategoricalData,
          mappings.length
        ),
        config: buildMetricCardConfig(mapping.target_metric, metricConfig.format || 'number'),
        basedOn: `${mapping.source_table}.${mapping.source_column} → ${mapping.target_metric}`,
      });
    }
  }

  // ── Gráfico de área (evolução temporal) ──────────────────────────────────
  const mainMetric = patterns.metrics.has('total_leads') ? 'total_leads'
    : patterns.metrics.has('new_leads') ? 'new_leads'
    : patterns.metrics.has('revenue') ? 'revenue'
    : [...patterns.metrics][0];

  if (patterns.hasTemporalData || mappings.length > 0) {
    recommendations.push({
      type: 'area_chart',
      title: 'Evolução de Leads',
      description: 'Gráfico de área mostrando a tendência de captação ao longo do tempo.',
      score: calculateScore(88, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length),
      config: buildTimeSeriesConfig(mainMetric || 'total_leads', 'number'),
      basedOn: patterns.hasTemporalData
        ? 'Dados temporais detectados nos mapeamentos'
        : 'Widget padrão para visualização de tendências',
    });
  }

  // ── Gráfico de linha (conversões) ─────────────────────────────────────────
  if (patterns.hasTemporalData && (patterns.metrics.has('conversions') || patterns.metrics.has('conversion_rate'))) {
    const convMetric = patterns.metrics.has('conversion_rate') ? 'conversion_rate' : 'conversions';
    recommendations.push({
      type: 'line_chart',
      title: 'Tendência de Conversões',
      description: 'Linha mostrando a evolução das conversões ao longo do tempo.',
      score: calculateScore(82, true, patterns.hasCategoricalData, mappings.length),
      config: buildTimeSeriesConfig(convMetric, convMetric === 'conversion_rate' ? 'percentage' : 'number'),
      basedOn: 'Dados de conversão + temporais detectados',
    });
  }

  // ── Pie chart (distribuição por origem) ───────────────────────────────────
  if (patterns.hasCategoricalData || patterns.metrics.has('lead_source')) {
    recommendations.push({
      type: 'pie_chart',
      title: 'Distribuição por Origem',
      description: 'Proporção de leads por canal de aquisição.',
      score: calculateScore(87, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length),
      config: {
        ...buildCategoricalConfig('lead_source', mainMetric),
        innerRadius: 60,
      },
      basedOn: patterns.metrics.has('lead_source')
        ? 'Mapeamento de lead_source detectado'
        : 'Dados categóricos detectados',
    });
  }

  // ── Funil ─────────────────────────────────────────────────────────────────
  if (patterns.hasFunnelData || (patterns.metrics.has('total_leads') && patterns.metrics.has('conversions'))) {
    const funnelMapping = mappingByTarget.get('funnel_stage') || mappingByTarget.get('total_leads');
    recommendations.push({
      type: 'funnel',
      title: 'Funil de Vendas',
      description: 'Progressão de leads pelo funil de conversão.',
      score: calculateScore(89, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length),
      config: {
        dataSource: funnelMapping?.source_table,
        sourceTable: funnelMapping?.source_table,
        groupBy: funnelMapping?.source_column,
        aggregation: 'count',
        funnelStages: ['Leads', 'Qualificados', 'Em Análise', 'Proposta', 'Convertidos'],
        animate: true,
        showLabels: true,
      },
      basedOn: patterns.hasFunnelData
        ? 'Mapeamento de funnel_stage detectado'
        : 'Combinação leads + conversões',
    });
  }

  // ── Bar chart (leads por status) ──────────────────────────────────────────
  if (patterns.hasCategoricalData || patterns.metrics.has('lead_source')) {
    recommendations.push({
      type: 'bar_chart',
      title: 'Leads por Status',
      description: 'Distribuição de leads por estágio no pipeline.',
      score: calculateScore(83, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length),
      config: {
        ...buildCategoricalConfig('funnel_stage', mainMetric),
        stacked: false,
        showTooltip: true,
      },
      basedOn: 'Dados categóricos detectados',
    });
  }

  // ── Tabela ────────────────────────────────────────────────────────────────
  const leadsMapping = mappingByTarget.get('total_leads') || mappingByTarget.get('new_leads') || mappings[0];
  recommendations.push({
    type: 'table',
    title: 'Últimos Leads',
    description: 'Registros mais recentes com análise detalhada.',
    score: 80,
    config: {
      dataSource: leadsMapping?.source_table,
      sourceTable: leadsMapping?.source_table,
      pageSize: 10,
      sortable: true,
      searchable: true,
    },
    basedOn: `Tabela de dados: ${leadsMapping?.source_table || 'detectada automaticamente'}`,
  });

  // ── Insight IA ────────────────────────────────────────────────────────────
  recommendations.push({
    type: 'insight_card',
    title: 'Insights IA',
    description: 'Análises e recomendações inteligentes geradas automaticamente.',
    score: 75,
    config: { refreshInterval: 300, animate: true },
    basedOn: 'Funcionalidade IA disponível para todos os planos',
  });

  return recommendations.sort((a, b) => b.score - a.score);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgId, mappings, plan = 2 }: RequestBody = await req.json();

    if (!orgId) {
      return new Response(
        JSON.stringify({ success: false, error: 'orgId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get mappings from database if not provided
    let dataMappings = mappings;
    if (!dataMappings || dataMappings.length === 0) {
      // Initialize Supabase client only if we need to fetch from DB
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase
        .from('data_mappings')
        .select('*')
        .eq('org_id', orgId);

      if (error) throw error;
      dataMappings = data || [];
    }

    // Generate recommendations
    const recommendations = generateRecommendations(dataMappings, plan);

    return new Response(
      JSON.stringify({
        success: true,
        recommendations,
        message: `Geradas ${recommendations.length} recomendações de widgets baseadas em ${dataMappings.length} mapeamentos`,
        patterns: detectDataPatterns(dataMappings),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao gerar recomendações',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});