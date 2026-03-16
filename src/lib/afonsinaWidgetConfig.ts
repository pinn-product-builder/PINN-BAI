/**
 * Configuração completa de widgets baseada no projeto Afonsina (pinnbai)
 * Define quais views usar para cada tipo de gráfico/widget
 */

export interface WidgetViewMapping {
  widgetType: 'metric_card' | 'line_chart' | 'bar_chart' | 'pie_chart' | 'funnel' | 'table' | 'area_chart' | 'heatmap';
  title: string;
  viewName: string;
  metricField: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  format?: 'number' | 'currency' | 'percentage';
  groupBy?: string; // Para gráficos que precisam agrupar por campo
  description?: string;
}

/**
 * Mapeamento completo de widgets baseado no projeto Afonsina
 */
export const AFONSINA_WIDGET_CONFIGS: WidgetViewMapping[] = [
  // ===== EXECUTIVO - KPIs Principais =====
  {
    widgetType: 'metric_card',
    title: 'Total de Leads',
    viewName: 'vw_dashboard_kpis_30d_v3',
    metricField: 'leads_total_30d',
    aggregation: 'sum',
    format: 'number',
  },
  {
    widgetType: 'metric_card',
    title: 'Novos Leads',
    viewName: 'vw_dashboard_daily_60d_v3',
    metricField: 'new_leads',
    aggregation: 'sum',
    format: 'number',
  },
  {
    widgetType: 'metric_card',
    title: 'Mensagens Recebidas (30d)',
    viewName: 'vw_dashboard_kpis_30d_v3',
    metricField: 'msg_in_30d',
    aggregation: 'sum',
    format: 'number',
  },
  {
    widgetType: 'metric_card',
    title: 'Reuniões Agendadas (30d)',
    viewName: 'vw_afonsina_custos_funil_dia',
    metricField: 'meetings_booked',
    aggregation: 'sum',
    format: 'number',
  },
  {
    widgetType: 'metric_card',
    title: 'Reuniões Realizadas (30d)',
    viewName: 'vw_afonsina_custos_funil_dia',
    metricField: 'meetings_done',
    aggregation: 'sum',
    format: 'number',
  },
  {
    widgetType: 'metric_card',
    title: 'Investimento (30d)',
    viewName: 'vw_afonsina_custos_funil_dia',
    metricField: 'custo_total',
    aggregation: 'sum',
    format: 'currency',
  },
  {
    widgetType: 'metric_card',
    title: 'CPL - Custo por Lead (30d)',
    viewName: 'vw_afonsina_custos_funil_dia',
    metricField: 'cpl_30d',
    aggregation: 'avg',
    format: 'currency',
  },
  {
    widgetType: 'metric_card',
    title: 'Taxa de Conversão',
    viewName: 'vw_dashboard_kpis_30d_v3',
    metricField: 'conv_lead_to_meeting_30d',
    aggregation: 'avg',
    format: 'percentage',
  },
  
  // ===== EXECUTIVO - Tendência Diária =====
  {
    widgetType: 'line_chart',
    title: 'Evolução de Leads',
    viewName: 'vw_dashboard_daily_60d_v3',
    metricField: 'leads_total',
    aggregation: 'sum',
    groupBy: 'day',
    format: 'number',
    description: 'Tendência diária de leads nos últimos 60 dias',
  },
  {
    widgetType: 'line_chart',
    title: 'Evolução de Mensagens',
    viewName: 'vw_dashboard_daily_60d_v3',
    metricField: 'msg_in',
    aggregation: 'sum',
    groupBy: 'day',
    format: 'number',
    description: 'Tendência diária de mensagens recebidas',
  },
  {
    widgetType: 'line_chart',
    title: 'Evolução de Reuniões',
    viewName: 'vw_dashboard_daily_60d_v3',
    metricField: 'meetings_done',
    aggregation: 'sum',
    groupBy: 'day',
    format: 'number',
    description: 'Tendência diária de reuniões realizadas',
  },
  
  // ===== EXECUTIVO - Funil de Vendas =====
  {
    widgetType: 'funnel',
    title: 'Funil de Vendas',
    viewName: 'vw_funnel_current_v3',
    metricField: 'funnel_stage',
    aggregation: 'count',
    groupBy: 'funnel_stage',
    format: 'number',
    description: 'Distribuição de leads por etapa do funil',
  },
  
  // ===== CONVERSAS - Mensagens Diárias =====
  {
    widgetType: 'area_chart',
    title: 'Mensagens Diárias',
    viewName: 'vw_kommo_msg_in_daily_60d_v3',
    metricField: 'msg_in',
    aggregation: 'sum',
    groupBy: 'day',
    format: 'number',
    description: 'Volume de mensagens recebidas por dia',
  },
  {
    widgetType: 'line_chart',
    title: 'Tendência de Conversão',
    viewName: 'vw_kommo_msg_in_daily_60d_v3',
    metricField: 'conversion_rate',
    aggregation: 'avg',
    groupBy: 'day',
    format: 'percentage',
    description: 'Taxa de conversão ao longo do tempo',
  },
  
  // ===== CONVERSAS - Distribuição por Hora =====
  {
    widgetType: 'bar_chart',
    title: 'Distribuição de Mensagens por Hora',
    viewName: 'vw_kommo_msg_in_by_hour_7d_v3',
    metricField: 'msg_in',
    aggregation: 'sum',
    groupBy: 'hour',
    format: 'number',
    description: 'Distribuição de mensagens por hora do dia (0-23h)',
  },
  
  // ===== CONVERSAS - Mapa de Calor =====
  {
    widgetType: 'heatmap',
    title: 'Mapa de Calor - Mensagens',
    viewName: 'vw_kommo_msg_in_heatmap_30d_v3',
    metricField: 'msg_in',
    aggregation: 'sum',
    groupBy: 'day_of_week,hour',
    format: 'number',
    description: 'Mapa de calor: dia da semana × hora',
  },
  
  // ===== TRÁFEGO - Custo por Etapa =====
  {
    widgetType: 'bar_chart',
    title: 'Custo por Etapa do Funil',
    viewName: 'vw_afonsina_custos_funil_dia',
    metricField: 'custo_total',
    aggregation: 'sum',
    groupBy: 'funnel_stage',
    format: 'currency',
    description: 'Investimento total por etapa do funil',
  },
  {
    widgetType: 'bar_chart',
    title: 'CPL por Etapa',
    viewName: 'vw_afonsina_custos_funil_dia',
    metricField: 'cpl_30d',
    aggregation: 'avg',
    groupBy: 'funnel_stage',
    format: 'currency',
    description: 'Custo por lead por etapa do funil',
  },
  
  // ===== TRÁFEGO - KPIs =====
  {
    widgetType: 'metric_card',
    title: 'Taxa de Entrada',
    viewName: 'vw_afonsina_custos_funil_dia',
    metricField: 'taxa_entrada',
    aggregation: 'avg',
    format: 'percentage',
  },
  {
    widgetType: 'metric_card',
    title: 'Custo por Reunião Agendada',
    viewName: 'vw_afonsina_custos_funil_dia',
    metricField: 'cp_meeting_booked_30d',
    aggregation: 'avg',
    format: 'currency',
  },
  
  // ===== LIGAÇÕES VAPI - Ligações Diárias =====
  {
    widgetType: 'bar_chart',
    title: 'Ligações Diárias',
    viewName: 'v3_calls_daily_v3',
    metricField: 'calls_done',
    aggregation: 'sum',
    groupBy: 'day',
    format: 'number',
    description: 'Volume de ligações realizadas por dia',
  },
  {
    widgetType: 'area_chart',
    title: 'Custo Acumulado de Ligações',
    viewName: 'v3_calls_daily_v3',
    metricField: 'total_spent_usd',
    aggregation: 'sum',
    groupBy: 'day',
    format: 'currency',
    description: 'Custo acumulado de ligações ao longo do tempo',
  },
  {
    widgetType: 'metric_card',
    title: 'Ligações Realizadas',
    viewName: 'v3_calls_daily_v3',
    metricField: 'calls_done',
    aggregation: 'sum',
    format: 'number',
  },
  {
    widgetType: 'metric_card',
    title: 'Ligações Atendidas',
    viewName: 'v3_calls_daily_v3',
    metricField: 'calls_answered',
    aggregation: 'sum',
    format: 'number',
  },
  {
    widgetType: 'metric_card',
    title: 'Taxa de Atendimento',
    viewName: 'v3_calls_daily_v3',
    metricField: 'taxa_atendimento',
    aggregation: 'avg',
    format: 'percentage',
  },
  {
    widgetType: 'metric_card',
    title: 'Tempo Médio (min)',
    viewName: 'v3_calls_daily_v3',
    metricField: 'avg_minutes',
    aggregation: 'avg',
    format: 'number',
  },
  
  // ===== LIGAÇÕES VAPI - Motivos de Finalização =====
  {
    widgetType: 'bar_chart',
    title: 'Motivos de Finalização',
    viewName: 'v3_calls_ended_reason_daily',
    metricField: 'count',
    aggregation: 'sum',
    groupBy: 'ended_reason',
    format: 'number',
    description: 'Distribuição de ligações por motivo de finalização',
  },
  {
    widgetType: 'area_chart',
    title: 'Tendência de Motivos',
    viewName: 'v3_calls_ended_reason_daily',
    metricField: 'count',
    aggregation: 'sum',
    groupBy: 'day,ended_reason',
    format: 'number',
    description: 'Tendência de motivos de finalização ao longo do tempo',
  },
  
  // ===== TABELAS =====
  {
    widgetType: 'table',
    title: 'Tabela de Reuniões',
    viewName: 'vw_calendar_events_current_v3',
    metricField: 'id',
    aggregation: 'count',
    format: 'number',
    description: 'Agenda de reuniões com status, lead e link',
  },
  {
    widgetType: 'table',
    title: 'Tabela de Leads',
    viewName: 'leads_v2',
    metricField: 'id',
    aggregation: 'count',
    format: 'number',
    description: 'Lista completa de leads',
  },
  {
    widgetType: 'table',
    title: 'Métricas Diárias',
    viewName: 'vw_kommo_msg_in_daily_60d_v3',
    metricField: 'day',
    aggregation: 'count',
    format: 'number',
    description: 'Tabela com métricas diárias de mensagens',
  },
];

/**
 * Encontra configuração de widget baseada no título ou tipo
 */
export function findWidgetConfig(
  title?: string,
  widgetType?: string
): WidgetViewMapping | null {
  if (!title && !widgetType) return null;
  
  const titleLower = title?.toLowerCase() || '';
  
  // Buscar por título exato primeiro
  let config = AFONSINA_WIDGET_CONFIGS.find(w => 
    w.title.toLowerCase() === titleLower
  );
  
  // Se não encontrar, buscar por palavras-chave no título
  if (!config && title) {
    config = AFONSINA_WIDGET_CONFIGS.find(w => {
      const configTitleLower = w.title.toLowerCase();
      const titleWords = titleLower.split(/\s+/);
      return titleWords.some(word => 
        configTitleLower.includes(word) || word.includes(configTitleLower)
      );
    });
  }
  
  // Se ainda não encontrar e temos tipo, buscar por tipo
  if (!config && widgetType) {
    config = AFONSINA_WIDGET_CONFIGS.find(w => w.widgetType === widgetType);
  }
  
  return config || null;
}

/**
 * Obtém todos os widgets disponíveis para uma view específica
 */
export function getWidgetsForView(viewName: string): WidgetViewMapping[] {
  return AFONSINA_WIDGET_CONFIGS.filter(w => w.viewName === viewName);
}

/**
 * Obtém todas as views disponíveis
 */
export function getAvailableViews(): string[] {
  return [...new Set(AFONSINA_WIDGET_CONFIGS.map(w => w.viewName))];
}
