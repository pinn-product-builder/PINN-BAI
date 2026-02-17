/**
 * Mapeamentos de referência baseados no projeto Afonsina (pinnbai)
 * Define quais campos usar para cada métrica em cada view
 */
import { findWidgetConfig as findWidgetConfigByTitle } from '@/lib/afonsinaWidgetConfig';

export interface ReferenceMapping {
  targetMetric: string;
  views: {
    viewName: string;
    fieldName: string;
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  }[];
}

/**
 * Mapeamentos padrão baseados nas views do projeto de referência
 * Ordem de prioridade: primeiro item é o preferido
 */
export const REFERENCE_MAPPINGS: ReferenceMapping[] = [
  // ===== LEADS =====
  {
    targetMetric: 'total_leads',
    views: [
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'leads_total_30d', aggregation: 'sum' },
      { viewName: 'vw_dashboard_daily_60d_v3', fieldName: 'leads_total', aggregation: 'sum' },
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'leads_total', aggregation: 'sum' },
      { viewName: 'leads_v2', fieldName: 'id', aggregation: 'count' },
    ],
  },
  {
    targetMetric: 'new_leads',
    views: [
      { viewName: 'vw_dashboard_daily_60d_v3', fieldName: 'new_leads', aggregation: 'sum' },
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'leads_30d', aggregation: 'sum' },
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'leads_new', aggregation: 'sum' },
      { viewName: 'leads_v2', fieldName: 'id', aggregation: 'count' },
    ],
  },
  {
    targetMetric: 'leads_30d',
    views: [
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'leads_30d', aggregation: 'sum' },
      { viewName: 'vw_dashboard_daily_60d_v3', fieldName: 'leads_total', aggregation: 'sum' },
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'leads_total', aggregation: 'sum' },
    ],
  },
  
  // ===== RECEITA/INVESTIMENTO =====
  {
    targetMetric: 'revenue',
    views: [
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'custo_total', aggregation: 'sum' },
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'spend_30d', aggregation: 'sum' },
      { viewName: 'vw_dashboard_daily_60d_v3', fieldName: 'spend_total', aggregation: 'sum' },
    ],
  },
  {
    targetMetric: 'spend_30d',
    views: [
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'spend_30d', aggregation: 'sum' },
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'custo_total', aggregation: 'sum' },
      { viewName: 'vw_dashboard_daily_60d_v3', fieldName: 'spend_total', aggregation: 'sum' },
    ],
  },
  {
    targetMetric: 'investimento',
    views: [
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'custo_total', aggregation: 'sum' },
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'spend_30d', aggregation: 'sum' },
    ],
  },
  
  // ===== CONVERSÕES =====
  {
    targetMetric: 'conversions',
    views: [
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'meetings_done', aggregation: 'sum' },
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'meetings_done_30d', aggregation: 'sum' },
      { viewName: 'vw_dashboard_daily_60d_v3', fieldName: 'meetings_done', aggregation: 'sum' },
    ],
  },
  {
    targetMetric: 'meetings_done',
    views: [
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'meetings_done', aggregation: 'sum' },
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'meetings_done_30d', aggregation: 'sum' },
      { viewName: 'vw_dashboard_daily_60d_v3', fieldName: 'meetings_done', aggregation: 'sum' },
    ],
  },
  {
    targetMetric: 'meetings_scheduled',
    views: [
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'meetings_booked', aggregation: 'sum' },
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'meetings_booked_30d', aggregation: 'sum' },
      { viewName: 'vw_dashboard_daily_60d_v3', fieldName: 'meetings_scheduled', aggregation: 'sum' },
    ],
  },
  
  // ===== TAXAS =====
  {
    targetMetric: 'conversion_rate',
    views: [
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'conv_lead_to_meeting_30d', aggregation: 'avg' },
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'taxa_entrada', aggregation: 'avg' },
      { viewName: 'vw_dashboard_daily_60d_v3', fieldName: 'conversion_rate', aggregation: 'avg' },
    ],
  },
  {
    targetMetric: 'taxa_conversao',
    views: [
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'conv_lead_to_meeting_30d', aggregation: 'avg' },
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'taxa_entrada', aggregation: 'avg' },
    ],
  },
  {
    targetMetric: 'taxa_entrada',
    views: [
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'taxa_entrada', aggregation: 'avg' },
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'taxa_entrada_30d', aggregation: 'avg' },
    ],
  },
  
  // ===== CUSTOS POR LEAD/REUNIÃO =====
  {
    targetMetric: 'cpl_30d',
    views: [
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'cpl_30d', aggregation: 'avg' },
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'cpl_30d', aggregation: 'avg' },
    ],
  },
  {
    targetMetric: 'cp_meeting_booked_30d',
    views: [
      { viewName: 'vw_afonsina_custos_funil_dia', fieldName: 'cp_meeting_booked_30d', aggregation: 'avg' },
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'cp_meeting_booked_30d', aggregation: 'avg' },
    ],
  },
  
  // ===== MENSAGENS =====
  {
    targetMetric: 'mensagens',
    views: [
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'msg_in_30d', aggregation: 'sum' },
      { viewName: 'vw_kommo_msg_in_daily_60d_v3', fieldName: 'msg_in', aggregation: 'sum' },
    ],
  },
  {
    targetMetric: 'msg_in_30d',
    views: [
      { viewName: 'vw_dashboard_kpis_30d_v3', fieldName: 'msg_in_30d', aggregation: 'sum' },
      { viewName: 'vw_kommo_msg_in_daily_60d_v3', fieldName: 'msg_in', aggregation: 'sum' },
    ],
  },
];

/**
 * Encontra o melhor mapeamento para uma métrica e view específicas
 */
export function findReferenceMapping(
  targetMetric: string,
  availableViews: string[]
): { viewName: string; fieldName: string; aggregation: string } | null {
  const metricLower = targetMetric.toLowerCase();
  
  // Buscar mapeamento exato
  let mapping = REFERENCE_MAPPINGS.find(m => 
    m.targetMetric.toLowerCase() === metricLower
  );
  
  // Se não encontrar, buscar por correspondência parcial
  if (!mapping) {
    mapping = REFERENCE_MAPPINGS.find(m => 
      metricLower.includes(m.targetMetric.toLowerCase()) || 
      m.targetMetric.toLowerCase().includes(metricLower)
    );
  }
  
  if (!mapping) return null;
  
  // Encontrar a primeira view disponível no mapeamento
  const availableMapping = mapping.views.find(v => 
    availableViews.includes(v.viewName)
  );
  
  if (!availableMapping) {
    // Se nenhuma view está disponível, retornar o primeiro mapeamento como fallback
    const firstMapping = mapping.views[0];
    return {
      viewName: firstMapping.viewName,
      fieldName: firstMapping.fieldName,
      aggregation: firstMapping.aggregation || 'sum',
    };
  }
  
  return {
    viewName: availableMapping.viewName,
    fieldName: availableMapping.fieldName,
    aggregation: availableMapping.aggregation || 'sum',
  };
}

/**
 * Encontra o melhor campo para um widget baseado no título e views disponíveis
 * Agora usa a configuração completa do projeto Afonsina
 */
export function findFieldByWidgetTitle(
  widgetTitle: string,
  availableViews: string[],
  availableFields: string[]
): { viewName: string; fieldName: string; aggregation: string } | null {
  // Primeiro, tentar usar a configuração completa do Afonsina
  const widgetConfig = findWidgetConfigByTitle(widgetTitle);
  
  if (widgetConfig) {
    // Verificar se a view está disponível
    if (availableViews.length === 0 || availableViews.includes(widgetConfig.viewName)) {
      return {
        viewName: widgetConfig.viewName,
        fieldName: widgetConfig.metricField,
        aggregation: widgetConfig.aggregation,
      };
    }
  }
  
  // Fallback para o método antigo se não encontrar na configuração
  const titleLower = widgetTitle.toLowerCase();
  
  // Mapear títulos comuns para métricas
  const titleToMetric: Record<string, string> = {
    'total de leads': 'total_leads',
    'novos leads': 'new_leads',
    'receita total': 'revenue',
    'investimento': 'spend_30d',
    'conversões': 'conversions',
    'taxa de conversão': 'conversion_rate',
    'taxa conversão': 'conversion_rate',
    'mensagens': 'mensagens',
    'reuniões agendadas': 'meetings_scheduled',
    'reuniões realizadas': 'meetings_done',
  };
  
  // Encontrar métrica correspondente ao título
  let targetMetric: string | undefined;
  for (const [title, metric] of Object.entries(titleToMetric)) {
    if (titleLower.includes(title)) {
      targetMetric = metric;
      break;
    }
  }
  
  // Buscas específicas por palavras-chave
  if (!targetMetric) {
    if (titleLower.includes('receita') || titleLower.includes('revenue') || titleLower.includes('investimento')) {
      targetMetric = 'revenue';
    } else if (titleLower.includes('convers') && !titleLower.includes('taxa')) {
      targetMetric = 'conversions';
    } else if (titleLower.includes('taxa') || titleLower.includes('rate')) {
      targetMetric = 'conversion_rate';
    } else if (titleLower.includes('novos') || titleLower.includes('new')) {
      targetMetric = 'new_leads';
    } else if (titleLower.includes('lead')) {
      targetMetric = 'total_leads';
    }
  }
  
  if (!targetMetric) return null;
  
  // Usar findReferenceMapping para encontrar o campo correto
  return findReferenceMapping(targetMetric, availableViews);
}
