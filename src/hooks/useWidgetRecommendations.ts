import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { WidgetRecommendation, WidgetType } from '@/lib/types';

interface DataMapping {
  id: string;
  sourceField: string;
  sourceTable: string;
  targetMetric: string;
  transformation: string;
  aggregation?: string;
  format?: string;
}

interface UseWidgetRecommendationsParams {
  orgId?: string;
  mappings: DataMapping[];
  plan: number;
  enabled?: boolean;
}

interface RecommendationResponse {
  success: boolean;
  recommendations: WidgetRecommendation[];
  message?: string;
  error?: string;
}

// Widget plan restrictions - REMOVED: All widgets available for all plans

export function useWidgetRecommendations({
  orgId,
  mappings,
  plan,
  enabled = true,
}: UseWidgetRecommendationsParams) {
  return useQuery({
    queryKey: ['widget-recommendations', orgId, mappings, plan],
    queryFn: async (): Promise<WidgetRecommendation[]> => {
      // Transform mappings to the format expected by the Edge Function
      const transformedMappings = mappings.map(m => ({
        source_table: m.sourceTable,
        source_column: m.sourceField,
        target_metric: m.targetMetric,
        transform_type: m.transformation,
        aggregation: m.aggregation || 'count',
        format: m.format,
      }));

      const { data, error } = await supabase.functions.invoke<RecommendationResponse>(
        'recommend-widgets',
        {
          body: {
            orgId: orgId || 'preview',
            mappings: transformedMappings,
            plan,
          },
        }
      );

      if (error) {
        console.error('Error fetching recommendations:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao buscar recomendações');
      }

      // Sort by score (highest first) - No plan restrictions
      return data.recommendations.sort((a, b) => b.score - a.score);
    },
    enabled: enabled && mappings.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

// Local generation fallback when Edge Function is unavailable
export function generateLocalRecommendations(
  mappings: DataMapping[],
  plan: number
): WidgetRecommendation[] {
  const recommendations: WidgetRecommendation[] = [];
  const metricTypes = new Map<string, DataMapping[]>();

  // Group mappings by target metric
  for (const mapping of mappings) {
    const key = mapping.targetMetric;
    if (!metricTypes.has(key)) {
      metricTypes.set(key, []);
    }
    metricTypes.get(key)!.push(mapping);
  }

  // Generate recommendations based on metrics
  if (metricTypes.has('total_leads') || metricTypes.has('new_leads')) {
    recommendations.push({
      type: 'metric_card',
      title: 'Total de Leads',
      description: 'Exibe o número total de leads capturados no período, com comparação ao período anterior.',
      score: 95,
      config: {
        metric: 'total_leads',
        showTrend: true,
        showSparkline: true,
        compareWithPrevious: true,
      },
      basedOn: 'Mapeamento detectado: total_leads / new_leads (contador)',
    });
  }

  if (metricTypes.has('conversions') || metricTypes.has('conversion_rate')) {
    recommendations.push({
      type: 'metric_card',
      title: 'Taxa de Conversão',
      description: 'Percentual de leads convertidos em clientes. Métrica essencial para avaliar eficiência comercial.',
      score: 92,
      config: {
        metric: 'conversion_rate',
        showTrend: true,
      },
      basedOn: 'Mapeamento detectado: conversions / conversion_rate (percentual)',
    });
  }

  if (metricTypes.has('revenue') || metricTypes.has('mrr')) {
    recommendations.push({
      type: 'metric_card',
      title: 'Receita Total',
      description: 'Soma de todas as vendas no período selecionado, com tendência e comparativo.',
      score: 90,
      config: {
        metric: 'revenue',
        showTrend: true,
        showSparkline: true,
      },
      basedOn: 'Mapeamento detectado: revenue / mrr (valor monetário)',
    });
  }

  // Time series charts
  if (metricTypes.has('created_date') || mappings.length > 0) {
    recommendations.push({
      type: 'area_chart',
      title: 'Evolução de Leads',
      description: 'Gráfico de área mostrando a tendência de captação de leads ao longo do tempo.',
      score: 88,
      config: {
        gradientFill: true,
        showTooltip: true,
        showGrid: true,
        curveType: 'smooth',
        animate: true,
      },
      basedOn: 'Dados temporais detectados no mapeamento',
    });

    // Line chart - available for all plans
    recommendations.push({
      type: 'line_chart',
      title: 'Tendência de Conversões',
      description: 'Linha mostrando a evolução das conversões ao longo do tempo.',
      score: 82,
      config: {
        showGrid: true,
        animate: true,
        curveType: 'smooth',
      },
      basedOn: 'Dados temporais detectados no mapeamento',
    });
  }

  // Categorical charts - available for all plans
  if (metricTypes.has('lead_source')) {
    recommendations.push({
      type: 'pie_chart',
      title: 'Distribuição por Origem',
      description: 'Gráfico de pizza mostrando a proporção de leads por canal de aquisição.',
      score: 87,
      config: {
        showLabels: true,
        innerRadius: 60,
      },
      basedOn: 'Mapeamento detectado: lead_source (dados categóricos)',
    });
  }

  // Funnel - available for all plans
  if (metricTypes.has('funnel_stage') || (metricTypes.has('total_leads') && metricTypes.has('conversions'))) {
    recommendations.push({
      type: 'funnel',
      title: 'Funil de Vendas',
      description: 'Visualização das etapas do funil de conversão, do lead inicial até a venda.',
      score: 89,
      config: {
        funnelStages: ['Leads', 'Qualificados', 'Em Análise', 'Proposta', 'Convertidos'],
        animate: true,
      },
      basedOn: 'Mapeamento detectado: funnel_stage ou combinação leads + conversões',
    });
  }

  // Bar chart
  recommendations.push({
    type: 'bar_chart',
    title: 'Leads por Status',
    description: 'Distribuição de leads por estágio atual no pipeline de vendas.',
    score: 83,
    config: {
      showLabels: true,
      animate: true,
    },
    basedOn: 'Análise de status dos leads (dados categóricos)',
  });

  // Table (always useful)
  recommendations.push({
    type: 'table',
    title: 'Últimos Leads',
    description: 'Tabela com os leads mais recentes, permitindo análise detalhada.',
    score: 80,
    config: {
      columns: ['name', 'email', 'source', 'status', 'value', 'created_at'],
      pageSize: 10,
    },
    basedOn: 'Widget padrão: tabela de dados detalhados',
  });

  // AI Insight - available for all plans
  recommendations.push({
    type: 'insight_card',
    title: 'Insights IA',
    description: 'Análises e recomendações inteligentes geradas automaticamente por IA.',
    score: 75,
    config: {
      animate: true,
    },
    basedOn: 'Funcionalidade IA disponível para todos os planos',
  });

  // Sort by score - No plan restrictions
  return recommendations.sort((a, b) => b.score - a.score);
}
