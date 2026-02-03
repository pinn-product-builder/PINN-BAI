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
  transform_type: string;
}

interface RequestBody {
  orgId: string;
  mappings?: DataMapping[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgId, mappings }: RequestBody = await req.json();

    if (!orgId) {
      return new Response(
        JSON.stringify({ success: false, error: 'orgId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get mappings from database if not provided
    let dataMappings = mappings;
    if (!dataMappings) {
      const { data, error } = await supabase
        .from('data_mappings')
        .select('*')
        .eq('org_id', orgId);

      if (error) throw error;
      dataMappings = data || [];
    }

    // Generate recommendations based on mappings
    const recommendations: WidgetRecommendation[] = [];

    // Analyze mappings and suggest widgets
    const metricTypes: Record<string, DataMapping[]> = {};
    
    for (const mapping of dataMappings) {
      const metric = mapping.target_metric;
      if (!metricTypes[metric]) {
        metricTypes[metric] = [];
      }
      metricTypes[metric].push(mapping);
    }

    // Generate widget recommendations based on metric types
    if (metricTypes['total_leads'] || metricTypes['new_leads']) {
      recommendations.push({
        type: 'metric_card',
        title: 'Total de Leads',
        description: 'Exibe o número total de leads capturados',
        score: 95,
        config: {
          metric: 'total_leads',
          showTrend: true,
          showSparkline: true,
          compareWithPrevious: true,
        },
        basedOn: 'Mapeamento: total_leads / new_leads',
      });
    }

    if (metricTypes['conversions'] || metricTypes['conversion_rate']) {
      recommendations.push({
        type: 'metric_card',
        title: 'Taxa de Conversão',
        description: 'Percentual de leads convertidos',
        score: 92,
        config: {
          metric: 'conversion_rate',
          showTrend: true,
          format: 'percentage',
        },
        basedOn: 'Mapeamento: conversions / conversion_rate',
      });
    }

    if (metricTypes['revenue'] || metricTypes['mrr']) {
      recommendations.push({
        type: 'metric_card',
        title: 'Receita Total',
        description: 'Soma de todas as vendas no período',
        score: 90,
        config: {
          metric: 'revenue',
          showTrend: true,
          format: 'currency',
          showSparkline: true,
        },
        basedOn: 'Mapeamento: revenue / mrr',
      });
    }

    if (metricTypes['avg_ticket']) {
      recommendations.push({
        type: 'metric_card',
        title: 'Ticket Médio',
        description: 'Valor médio por transação',
        score: 85,
        config: {
          metric: 'avg_ticket',
          format: 'currency',
        },
        basedOn: 'Mapeamento: avg_ticket',
      });
    }

    // Time series charts
    if (metricTypes['created_date'] || dataMappings.length > 0) {
      recommendations.push({
        type: 'area_chart',
        title: 'Evolução de Leads',
        description: 'Gráfico de área mostrando leads ao longo do tempo',
        score: 88,
        config: {
          showGrid: true,
          gradientFill: true,
          animate: true,
          curveType: 'smooth',
        },
        basedOn: 'Dados temporais detectados',
      });

      recommendations.push({
        type: 'line_chart',
        title: 'Tendência de Conversões',
        description: 'Linha mostrando evolução das conversões',
        score: 82,
        config: {
          showGrid: true,
          animate: true,
          curveType: 'smooth',
        },
        basedOn: 'Dados temporais detectados',
      });
    }

    // Categorical charts
    if (metricTypes['lead_source']) {
      recommendations.push({
        type: 'pie_chart',
        title: 'Distribuição por Origem',
        description: 'Gráfico de pizza mostrando leads por canal',
        score: 87,
        config: {
          showLabels: true,
          showLegend: true,
          innerRadius: 60,
        },
        basedOn: 'Mapeamento: lead_source (categórico)',
      });
    }

    // Funnel
    if (metricTypes['funnel_stage'] || (metricTypes['total_leads'] && metricTypes['conversions'])) {
      recommendations.push({
        type: 'funnel',
        title: 'Funil de Vendas',
        description: 'Visualização das etapas do funil de conversão',
        score: 89,
        config: {
          funnelStages: ['Leads', 'Qualificados', 'Em Análise', 'Proposta', 'Convertidos'],
          animate: true,
        },
        basedOn: 'Mapeamento: funnel_stage ou leads + conversões',
      });
    }

    // Table
    recommendations.push({
      type: 'table',
      title: 'Últimos Leads',
      description: 'Tabela com os leads mais recentes',
      score: 80,
      config: {
        columns: ['name', 'email', 'source', 'status', 'value', 'created_at'],
        pageSize: 10,
      },
      basedOn: 'Padrão: sempre incluir tabela de dados',
    });

    // Bar chart for status distribution
    recommendations.push({
      type: 'bar_chart',
      title: 'Leads por Status',
      description: 'Distribuição de leads por estágio atual',
      score: 83,
      config: {
        showLabels: true,
        stacked: false,
        animate: true,
      },
      basedOn: 'Análise de status dos leads',
    });

    // AI Insight card
    recommendations.push({
      type: 'insight_card',
      title: 'Insights IA',
      description: 'Análises e recomendações geradas por IA',
      score: 75,
      config: {
        refreshInterval: 300,
      },
      basedOn: 'Funcionalidade IA habilitada',
    });

    // Sort by score
    recommendations.sort((a, b) => b.score - a.score);

    return new Response(
      JSON.stringify({
        success: true,
        recommendations,
        message: `Geradas ${recommendations.length} recomendações de widgets`,
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
