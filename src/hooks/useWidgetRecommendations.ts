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

  // Helper: pega o primeiro mapping real de uma métrica
  const getMapping = (metric: string): DataMapping | undefined =>
    metricTypes.get(metric)?.[0];

  // Helper: detecta se a tabela é uma view KPI agregada
  const isAggView = (table?: string) => {
    if (!table) return false;
    const t = table.toLowerCase();
    return /^vw_|^view_/i.test(t) || /kpi|_30d|_60d|_7d|summary|overview|dashboard/i.test(t);
  };

  // Helper: monta config completo com coluna real
  const buildConfig = (metric: string, format: string): Record<string, unknown> => {
    const m = getMapping(metric);
    if (m) {
      return {
        metric: m.sourceField,          // coluna REAL, não o nome semântico
        dataSource: m.sourceTable,
        sourceTable: m.sourceTable,
        targetMetric: metric,
        aggregation: m.aggregation || (format === 'percentage' ? 'avg' : 'sum'),
        format,
        transformation: m.transformation || format,
        isAggregatedView: isAggView(m.sourceTable),
        showTrend: true,
        showSparkline: true,
      };
    }
    return { metric, targetMetric: metric, format, showTrend: true, showSparkline: true };
  };

  // Helper: encontra coluna de data nos mapeamentos
  const getDateField = (): string => {
    const dateMapping = mappings.find(m =>
      m.targetMetric === 'created_date' ||
      /day|dia|date|data|created_at/i.test(m.sourceField)
    );
    return dateMapping?.sourceField || 'day';
  };

  // Helper: encontra view de série temporal
  const getTimeseriesTable = (preferredMetric: string): DataMapping | undefined =>
    mappings.find(m => {
      const t = m.sourceTable.toLowerCase();
      return m.targetMetric === preferredMetric && /daily|diario|_60d|_90d/i.test(t);
    }) || getMapping(preferredMetric);

  if (metricTypes.has('total_leads') || metricTypes.has('new_leads')) {
    const metric = metricTypes.has('total_leads') ? 'total_leads' : 'new_leads';
    recommendations.push({
      type: 'metric_card',
      title: 'Total de Leads',
      description: 'Número total de leads capturados no período.',
      score: 95,
      config: buildConfig(metric, 'number'),
      basedOn: `Mapeamento detectado: ${metric}`,
    });
  }

  if (metricTypes.has('conversions') || metricTypes.has('conversion_rate')) {
    const metric = metricTypes.has('conversion_rate') ? 'conversion_rate' : 'conversions';
    recommendations.push({
      type: 'metric_card',
      title: 'Taxa de Conversão',
      description: 'Percentual de leads convertidos em clientes.',
      score: 92,
      config: buildConfig(metric, metric === 'conversion_rate' ? 'percentage' : 'number'),
      basedOn: `Mapeamento detectado: ${metric}`,
    });
  }

  if (metricTypes.has('revenue') || metricTypes.has('mrr')) {
    const metric = metricTypes.has('revenue') ? 'revenue' : 'mrr';
    recommendations.push({
      type: 'metric_card',
      title: 'Receita Total',
      description: 'Soma de todas as vendas no período selecionado.',
      score: 90,
      config: buildConfig(metric, 'currency'),
      basedOn: `Mapeamento detectado: ${metric}`,
    });
  }

  // Time series charts — usa coluna real de data e view daily
  if (metricTypes.has('created_date') || mappings.length > 0) {
    const mainMetric = metricTypes.has('total_leads') ? 'total_leads'
      : metricTypes.has('new_leads') ? 'new_leads' : [...metricTypes.keys()][0];
    const tsMapping = mainMetric ? getTimeseriesTable(mainMetric) : undefined;
    const dateField = getDateField();

    recommendations.push({
      type: 'area_chart',
      title: 'Evolução de Leads',
      description: 'Gráfico de área mostrando a tendência de captação ao longo do tempo.',
      score: 88,
      config: {
        metric: tsMapping?.sourceField || mainMetric,
        dataSource: tsMapping?.sourceTable,
        sourceTable: tsMapping?.sourceTable,
        groupBy: dateField,
        aggregation: (tsMapping?.aggregation || 'sum') as any,
        format: 'number',
        gradientFill: true,
        showTooltip: true,
        showGrid: true,
        curveType: 'smooth',
        animate: true,
      },
      basedOn: 'Dados temporais detectados no mapeamento',
    });

    recommendations.push({
      type: 'line_chart',
      title: 'Tendência de Conversões',
      description: 'Linha mostrando a evolução das conversões ao longo do tempo.',
      score: 82,
      config: {
        metric: tsMapping?.sourceField || mainMetric,
        dataSource: tsMapping?.sourceTable,
        sourceTable: tsMapping?.sourceTable,
        groupBy: dateField,
        aggregation: 'sum',
        format: 'number',
        // isAggregatedView removed - not part of WidgetConfig
        showGrid: true,
        animate: true,
        curveType: 'smooth',
      },
      basedOn: 'Dados temporais detectados no mapeamento',
    });
  }

  if (metricTypes.has('lead_source')) {
    const m = getMapping('lead_source');
    recommendations.push({
      type: 'pie_chart',
      title: 'Distribuição por Origem',
      description: 'Proporção de leads por canal de aquisição.',
      score: 87,
      config: {
        dataSource: m?.sourceTable,
        sourceTable: m?.sourceTable,
        groupBy: m?.sourceField,
        aggregation: 'count',
        showLabels: true,
        innerRadius: 60,
      },
      basedOn: 'Mapeamento detectado: lead_source',
    });
  }

  if (metricTypes.has('funnel_stage') || (metricTypes.has('total_leads') && metricTypes.has('conversions'))) {
    const funnelM = getMapping('funnel_stage') || getMapping('total_leads');
    recommendations.push({
      type: 'funnel',
      title: 'Funil de Vendas',
      description: 'Visualização das etapas do funil de conversão.',
      score: 89,
      config: {
        dataSource: funnelM?.sourceTable,
        sourceTable: funnelM?.sourceTable,
        groupBy: funnelM?.sourceField,
        aggregation: 'count',
        funnelStages: ['Leads', 'Qualificados', 'Em Análise', 'Proposta', 'Convertidos'],
        animate: true,
      },
      basedOn: 'Mapeamento detectado: funnel_stage ou leads + conversões',
    });
  }

  const firstMapping = mappings[0];
  recommendations.push({
    type: 'bar_chart',
    title: 'Leads por Status',
    description: 'Distribuição de leads por estágio no pipeline.',
    score: 83,
    config: {
      dataSource: firstMapping?.sourceTable,
      sourceTable: firstMapping?.sourceTable,
      aggregation: 'count',
      showLabels: true,
      animate: true,
    },
    basedOn: 'Análise de status dos leads',
  });

  recommendations.push({
    type: 'table',
    title: 'Últimos Leads',
    description: 'Tabela com os leads mais recentes.',
    score: 80,
    config: {
      dataSource: firstMapping?.sourceTable,
      sourceTable: firstMapping?.sourceTable,
      pageSize: 10,
    },
    basedOn: 'Widget padrão: tabela de dados',
  });

  recommendations.push({
    type: 'insight_card',
    title: 'Insights IA',
    description: 'Análises inteligentes geradas automaticamente.',
    score: 75,
    config: { animate: true },
    basedOn: 'Funcionalidade IA disponível para todos os planos',
  });

  return recommendations.sort((a, b) => b.score - a.score);
}
