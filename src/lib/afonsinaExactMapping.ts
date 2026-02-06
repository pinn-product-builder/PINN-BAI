/**
 * Mapeamento EXATO do dashboard da Afonsina
 * Replica exatamente as views, campos e agregações usadas no projeto original
 * 
 * Baseado em:
 * - ExecutivePage.tsx
 * - useDashboardData.ts
 * - kpiDefinitions.ts
 */

export interface ExactWidgetMapping {
  widgetTitle: string;
  widgetType: 'metric_card' | 'line_chart' | 'bar_chart' | 'pie_chart' | 'funnel' | 'table' | 'area_chart' | 'insight_card';
  viewName: string;
  metricField: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  format: 'number' | 'currency' | 'percentage';
  groupBy?: string;
  description?: string;
  // Campos adicionais para gráficos
  lines?: Array<{ key: string; name: string; color: string }>;
  columns?: string[];
  funnelStages?: string[];
}

/**
 * Mapeamento EXATO baseado no ExecutivePage.tsx da Afonsina
 * Cada widget usa exatamente a mesma view e campo do projeto original
 */
export const AFONSINA_EXACT_MAPPING: ExactWidgetMapping[] = [
  // ===== PRIMEIRA LINHA DE KPIs (5 widgets) =====
  {
    widgetTitle: 'Total de Leads',
    widgetType: 'metric_card',
    viewName: 'leads_v2', // Usa useLeadsCount() que busca de leads_v2
    metricField: 'id',
    aggregation: 'count',
    format: 'number',
    description: 'Quantidade total de leads cadastrados no sistema',
  },
  {
    widgetTitle: 'Mensagens (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_dashboard_kpis_30d_v3', // useExecutiveKpis retorna msg_in_30d
    metricField: 'msg_in_30d',
    aggregation: 'sum',
    format: 'number',
    description: 'Total de mensagens recebidas nos últimos 30 dias',
  },
  {
    widgetTitle: 'Reuniões Agendadas (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_afonsina_custos_funil_dia', // useExecutiveKpis retorna meetings_scheduled_30d
    metricField: 'meetings_booked',
    aggregation: 'sum',
    format: 'number',
    description: 'Número de reuniões agendadas nos últimos 30 dias',
  },
  {
    widgetTitle: 'Reuniões Realizadas (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_afonsina_custos_funil_dia', // useExecutiveKpis retorna meetings_done
    metricField: 'meetings_done',
    aggregation: 'sum',
    format: 'number',
    description: 'Total de reuniões que efetivamente aconteceram',
  },
  {
    widgetTitle: 'Reuniões Canceladas (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_dashboard_kpis_30d_v3', // useExecutiveKpis retorna meetings_cancelled_30d
    metricField: 'meetings_cancelled_30d',
    aggregation: 'sum',
    format: 'number',
    description: 'Número de reuniões canceladas nos últimos 30 dias',
  },
  
  // ===== SEGUNDA LINHA DE KPIs (4 widgets) =====
  {
    widgetTitle: 'Investimento (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_afonsina_custos_funil_dia', // useExecutiveKpis retorna spend_30d
    metricField: 'custo_total',
    aggregation: 'sum',
    format: 'currency',
    description: 'Valor total investido em anúncios nos últimos 30 dias',
  },
  {
    widgetTitle: 'CPL (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_afonsina_custos_funil_dia', // useExecutiveKpis retorna cpl_30d
    metricField: 'cpl_30d',
    aggregation: 'avg',
    format: 'currency',
    description: 'Custo por Lead médio nos últimos 30 dias',
  },
  {
    widgetTitle: 'Custo por Reunião (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_afonsina_custos_funil_dia', // useExecutiveKpis retorna cpm_meeting_30d
    metricField: 'cp_meeting_booked_30d',
    aggregation: 'avg',
    format: 'currency',
    description: 'Custo médio para agendar uma reunião',
  },
  {
    widgetTitle: 'Conv. Lead → Reunião (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_dashboard_kpis_30d_v3', // useExecutiveKpis retorna conv_lead_to_meeting_30d
    metricField: 'conv_lead_to_meeting_30d',
    aggregation: 'avg',
    format: 'percentage',
    description: 'Percentual de leads que agendaram reunião',
  },
  
  // ===== GRÁFICO DE EVOLUÇÃO DIÁRIA =====
  {
    widgetTitle: 'Evolução Diária (60d)',
    widgetType: 'line_chart',
    viewName: 'vw_dashboard_daily_60d_v3', // useExecutiveDaily retorna dados desta view
    metricField: 'day',
    aggregation: 'sum',
    format: 'number',
    groupBy: 'day',
    description: 'Leads, mensagens, reuniões e investimento',
    lines: [
      { key: 'new_leads', name: 'Novos Leads', color: 'primary' },
      { key: 'msg_in', name: 'Mensagens', color: 'success' },
      { key: 'meetings_scheduled', name: 'Reuniões', color: 'warning' },
      { key: 'spend', name: 'Investimento (R$)', color: 'destructive' },
    ],
  },
  
  // ===== FUNIL DE VENDAS =====
  {
    widgetTitle: 'Pipeline de Conversão',
    widgetType: 'funnel',
    viewName: 'vw_funnel_current_v3', // useFunnelCurrent retorna dados desta view
    metricField: 'funnel_stage',
    aggregation: 'count',
    format: 'number',
    groupBy: 'funnel_stage',
    description: 'Funil atual por etapa',
    funnelStages: ['Leads', 'Qualificados', 'Em Análise', 'Proposta'],
  },
  
  // ===== TABELA DE PRÓXIMAS REUNIÕES =====
  {
    widgetTitle: 'Próximas Reuniões',
    widgetType: 'table',
    viewName: 'vw_calendar_events_current_v3', // useMeetingsUpcoming retorna dados desta view
    metricField: 'id',
    aggregation: 'count',
    format: 'number',
    description: 'Reuniões agendadas a partir de hoje',
    columns: ['date', 'lead_name', 'status', 'link'],
  },
  
  // ===== INSIGHTS IA =====
  {
    widgetTitle: 'Insights IA',
    widgetType: 'insight_card',
    viewName: '', // Não usa view específica
    metricField: '',
    aggregation: 'count',
    format: 'number',
    description: 'Análises baseadas nos dados reais',
  },
  
  // ===== TABELA DE REUNIÕES DO MÊS =====
  {
    widgetTitle: 'Reuniões do Mês',
    widgetType: 'table',
    viewName: 'vw_calendar_events_current_v3', // MonthlyMeetingsPanel usa esta view
    metricField: 'id',
    aggregation: 'count',
    format: 'number',
    description: 'Controle de comparecimento',
    columns: ['date', 'lead_name', 'status', 'attended'],
  },
  
  // ===== TABELA DE LEADS =====
  {
    widgetTitle: 'Lista de Leads',
    widgetType: 'table',
    viewName: 'leads_v2', // LeadsTable usa esta tabela
    metricField: 'id',
    aggregation: 'count',
    format: 'number',
    description: 'Leads recentes',
    columns: ['name', 'email', 'source', 'status', 'created_at'],
  },
];

/**
 * Encontra o mapeamento exato para um widget baseado no título
 */
export function findExactMapping(widgetTitle: string): ExactWidgetMapping | null {
  const titleLower = widgetTitle.toLowerCase().trim();
  
  // Buscar correspondência exata primeiro
  let mapping = AFONSINA_EXACT_MAPPING.find(m => 
    m.widgetTitle.toLowerCase().trim() === titleLower
  );
  
  // Se não encontrar, buscar por palavras-chave
  if (!mapping) {
    // Mapear variações comuns de títulos
    const titleVariations: Record<string, string> = {
      'total de leads': 'Total de Leads',
      'mensagens': 'Mensagens (30d)',
      'reuniões agendadas': 'Reuniões Agendadas (30d)',
      'reuniões realizadas': 'Reuniões Realizadas (30d)',
      'reuniões canceladas': 'Reuniões Canceladas (30d)',
      'investimento': 'Investimento (30d)',
      'cpl': 'CPL (30d)',
      'custo por reunião': 'Custo por Reunião (30d)',
      'conversão': 'Conv. Lead → Reunião (30d)',
      'evolução': 'Evolução Diária (60d)',
      'funil': 'Pipeline de Conversão',
      'próximas reuniões': 'Próximas Reuniões',
      'insights': 'Insights IA',
      'reuniões do mês': 'Reuniões do Mês',
      'lista de leads': 'Lista de Leads',
    };
    
    for (const [key, exactTitle] of Object.entries(titleVariations)) {
      if (titleLower.includes(key)) {
        mapping = AFONSINA_EXACT_MAPPING.find(m => 
          m.widgetTitle === exactTitle
        );
        if (mapping) break;
      }
    }
  }
  
  return mapping || null;
}

/**
 * Obtém todos os mapeamentos para criar um dashboard completo
 */
export function getAllExactMappings(): ExactWidgetMapping[] {
  return AFONSINA_EXACT_MAPPING;
}

/**
 * Cria configuração de widget baseada no mapeamento exato
 */
export function createWidgetConfigFromExactMapping(
  mapping: ExactWidgetMapping,
  position: number
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    dataSource: mapping.viewName,
    sourceTable: mapping.viewName,
    metric: mapping.metricField,
    aggregation: mapping.aggregation,
    format: mapping.format,
  };
  
  if (mapping.groupBy) {
    config.groupBy = mapping.groupBy;
  }
  
  if (mapping.lines) {
    config.lines = mapping.lines;
  }
  
  if (mapping.columns) {
    config.columns = mapping.columns;
  }
  
  if (mapping.funnelStages) {
    config.funnelStages = mapping.funnelStages;
  }
  
  return config;
}
