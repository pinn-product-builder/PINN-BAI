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

  // Generate metric cards for each relevant metric
  for (const mapping of mappings) {
    const metricConfig = METRIC_SCORES[mapping.target_metric];
    
    if (metricConfig && metricConfig.widget === 'metric_card') {
      // Avoid duplicate metric cards for the same target
      const key = `metric_card_${mapping.target_metric}`;
      if (addedTypes.has(key)) continue;
      addedTypes.add(key);

      const widgetDesc = WIDGET_DESCRIPTIONS[mapping.target_metric] || {
        title: mapping.target_metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: `Métrica baseada no campo ${mapping.source_column} da tabela ${mapping.source_table}.`,
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
        config: {
          metric: mapping.target_metric,
          showTrend: true,
          showSparkline: true,
          compareWithPrevious: true,
          format: metricConfig.format || 'number',
        },
        basedOn: `Mapeamento: ${mapping.source_table}.${mapping.source_column} → ${mapping.target_metric}`,
      });
    }
  }

  // Add area chart for temporal data
  if (patterns.hasTemporalData || mappings.length > 0) {
    recommendations.push({
      type: 'area_chart',
      title: 'Evolução de Leads',
      description: 'Gráfico de área mostrando a tendência de captação de leads ao longo do tempo, com preenchimento gradiente.',
      score: calculateScore(88, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length),
      config: {
        showGrid: true,
        gradientFill: true,
        animate: true,
        curveType: 'smooth',
        showTooltip: true,
      },
      basedOn: patterns.hasTemporalData 
        ? 'Dados temporais detectados nos mapeamentos' 
        : 'Widget padrão para visualização de tendências',
    });
  }

  // Add line chart for trends - Available for all plans
  if (patterns.hasTemporalData) {
    recommendations.push({
      type: 'line_chart',
      title: 'Tendência de Conversões',
      description: 'Linha mostrando a evolução das conversões ao longo do tempo, ideal para comparar múltiplos períodos.',
      score: calculateScore(82, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length),
      config: {
        showGrid: true,
        animate: true,
        curveType: 'smooth',
        showTooltip: true,
      },
      basedOn: 'Dados temporais detectados nos mapeamentos',
    });
  }

  // Add pie chart for categorical data - Available for all plans
  if (patterns.hasCategoricalData || patterns.metrics.has('lead_source')) {
    recommendations.push({
      type: 'pie_chart',
      title: 'Distribuição por Origem',
      description: 'Gráfico de pizza mostrando a proporção de leads por canal de aquisição.',
      score: calculateScore(87, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length),
      config: {
        showLabels: true,
        showLegend: true,
        innerRadius: 60,
        animate: true,
      },
      basedOn: patterns.metrics.has('lead_source')
        ? 'Mapeamento de lead_source detectado (dados categóricos)'
        : 'Dados categóricos detectados nos mapeamentos',
    });
  }

  // Add funnel for stage data or leads+conversions - Available for all plans
  if (
    patterns.hasFunnelData || (patterns.metrics.has('total_leads') && patterns.metrics.has('conversions'))
  ) {
    recommendations.push({
      type: 'funnel',
      title: 'Funil de Vendas',
      description: 'Visualização completa do funil de conversão, mostrando a progressão de leads através de cada estágio até a venda.',
      score: calculateScore(89, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length),
      config: {
        funnelStages: ['Leads', 'Qualificados', 'Em Análise', 'Proposta', 'Convertidos'],
        animate: true,
        showLabels: true,
      },
      basedOn: patterns.hasFunnelData
        ? 'Mapeamento de funnel_stage detectado'
        : 'Combinação leads + conversões permite visualização de funil',
    });
  }

  // Add bar chart for status distribution
  if (patterns.hasCategoricalData || patterns.metrics.has('lead_source')) {
    recommendations.push({
      type: 'bar_chart',
      title: 'Leads por Status',
      description: 'Distribuição de leads por estágio atual no pipeline de vendas. Identifique gargalos no processo.',
      score: calculateScore(83, patterns.hasTemporalData, patterns.hasCategoricalData, mappings.length),
      config: {
        showLabels: true,
        stacked: false,
        animate: true,
        showTooltip: true,
      },
      basedOn: 'Análise de status e categorias dos leads',
    });
  }

  // Add table widget (always useful)
  recommendations.push({
    type: 'table',
    title: 'Últimos Leads',
    description: 'Tabela com os leads mais recentes, permitindo análise detalhada e busca por registros específicos.',
    score: 80,
    config: {
      columns: ['name', 'email', 'source', 'status', 'value', 'created_at'],
      pageSize: 10,
      sortable: true,
      searchable: true,
    },
    basedOn: 'Widget padrão: tabela de dados para análise detalhada',
  });

  // Add insight card for AI features - Available for all plans
  recommendations.push({
    type: 'insight_card',
    title: 'Insights IA',
    description: 'Análises e recomendações inteligentes geradas automaticamente por IA, baseadas nos padrões detectados.',
    score: 75,
    config: {
      refreshInterval: 300,
      animate: true,
    },
    basedOn: 'Funcionalidade IA disponível para todos os planos',
  });

  // Sort by score (highest first)
  recommendations.sort((a, b) => b.score - a.score);

  return recommendations;
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