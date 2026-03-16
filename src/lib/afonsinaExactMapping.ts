/**
 * Pinn BAI — afonsinaExactMapping.ts  (v2 — preset de cliente, não core)
 *
 * Este arquivo é um PRESET específico para o cliente Afonsina Oliveira.
 * Não deve ser importado por lógica genérica da plataforma.
 *
 * Para novos clientes, crie um preset similar ou use o motor genérico
 * em referenceMappings.ts (resolveMapping / resolveByWidgetTitle).
 *
 * Uso: importar apenas em contextos específicos da Afonsina
 * ou via sistema de templates com org_id === afonsina.
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
  lines?: Array<{ key: string; name: string; color: string }>;
  columns?: string[];
  funnelStages?: string[];
}

/** ID da organização Afonsina no Supabase (para lookup condicional) */
export const AFONSINA_ORG_SLUG = 'afonsina-oliveira';

/**
 * Preset de mapeamentos da Afonsina.
 * Mantido para retrocompatibilidade e como referência de implementação.
 */
export const AFONSINA_EXACT_MAPPING: ExactWidgetMapping[] = [
  // ── KPIs principais ──────────────────────────────────────────────────
  {
    widgetTitle: 'Total de Leads',
    widgetType: 'metric_card',
    viewName: 'leads_v2',
    metricField: 'id',
    aggregation: 'count',
    format: 'number',
    description: 'Quantidade total de leads cadastrados',
  },
  {
    widgetTitle: 'Mensagens (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_dashboard_kpis_30d_v3',
    metricField: 'msg_in_30d',
    aggregation: 'sum',
    format: 'number',
    description: 'Mensagens recebidas nos últimos 30 dias',
  },
  {
    widgetTitle: 'Reuniões Agendadas (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_afonsina_custos_funil_dia',
    metricField: 'meetings_booked',
    aggregation: 'sum',
    format: 'number',
    description: 'Reuniões agendadas nos últimos 30 dias',
  },
  {
    widgetTitle: 'Reuniões Realizadas (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_afonsina_custos_funil_dia',
    metricField: 'meetings_done',
    aggregation: 'sum',
    format: 'number',
    description: 'Reuniões realizadas nos últimos 30 dias',
  },
  {
    widgetTitle: 'Investimento (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_dashboard_kpis_30d_v3',
    metricField: 'spend_30d',
    aggregation: 'sum',
    format: 'currency',
    description: 'Investimento em mídia paga nos últimos 30 dias',
  },
  {
    widgetTitle: 'CPL (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_dashboard_kpis_30d_v3',
    metricField: 'cpl_30d',
    aggregation: 'avg',
    format: 'currency',
    description: 'Custo por lead nos últimos 30 dias',
  },
  {
    widgetTitle: 'Custo por Reunião (30d)',
    widgetType: 'metric_card',
    viewName: 'vw_dashboard_kpis_30d_v3',
    metricField: 'cp_meeting_booked_30d',
    aggregation: 'avg',
    format: 'currency',
    description: 'Custo por reunião agendada nos últimos 30 dias',
  },
  {
    widgetTitle: 'Taxa de Conversão (Lead → Reunião)',
    widgetType: 'metric_card',
    viewName: 'vw_dashboard_kpis_30d_v3',
    metricField: 'conv_lead_to_meeting_30d',
    aggregation: 'avg',
    format: 'percentage',
    description: 'Taxa de conversão de lead para reunião (30d)',
  },

  // ── Gráficos temporais ───────────────────────────────────────────────
  {
    widgetTitle: 'Leads por Dia (60d)',
    widgetType: 'area_chart',
    viewName: 'vw_dashboard_daily_60d_v3',
    metricField: 'new_leads',
    aggregation: 'sum',
    format: 'number',
    groupBy: 'day',
    description: 'Evolução diária de novos leads',
  },
  {
    widgetTitle: 'Investimento Diário (60d)',
    widgetType: 'line_chart',
    viewName: 'vw_dashboard_daily_60d_v3',
    metricField: 'spend_total',
    aggregation: 'sum',
    format: 'currency',
    groupBy: 'day',
    description: 'Evolução diária do investimento em mídia',
  },
  {
    widgetTitle: 'Mensagens por Dia',
    widgetType: 'bar_chart',
    viewName: 'vw_kommo_msg_in_daily_60d_v3',
    metricField: 'msg_in',
    aggregation: 'sum',
    format: 'number',
    groupBy: 'day',
    description: 'Volume diário de mensagens recebidas',
  },

  // ── Funil ────────────────────────────────────────────────────────────
  {
    widgetTitle: 'Funil de Conversão',
    widgetType: 'funnel',
    viewName: 'vw_afonsina_custos_funil_dia',
    metricField: 'leads_total',
    aggregation: 'sum',
    format: 'number',
    description: 'Funil: Leads → Agendamentos → Reuniões → Conversões',
    funnelStages: ['leads_total', 'meetings_booked', 'meetings_done'],
  },
];

/**
 * Busca config de widget pelo título exato (Afonsina).
 * Retorna null se não encontrado — para fallback ao motor genérico.
 */
export function findAfonsinaWidgetConfig(
  widgetTitle: string
): ExactWidgetMapping | null {
  return (
    AFONSINA_EXACT_MAPPING.find(
      w => w.widgetTitle.toLowerCase() === widgetTitle.toLowerCase()
    ) ?? null
  );
}
