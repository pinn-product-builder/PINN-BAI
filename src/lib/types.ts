// ============= Database Types =============
// These types map to the Supabase database schema
// Using Json compatible types for Supabase JSONB fields

import type { Json } from '@/integrations/supabase/types';

export type AppRole = 'platform_admin' | 'client_admin' | 'analyst' | 'viewer';
export type OrgStatus = 'active' | 'suspended' | 'trial';
export type IntegrationType = 'supabase' | 'google_sheets' | 'csv' | 'api';
export type IntegrationStatus = 'pending' | 'connected' | 'error' | 'syncing';
export type LeadSource = 'google_ads' | 'linkedin' | 'referral' | 'organic' | 'email' | 'other';
export type LeadStatus = 'new' | 'qualified' | 'in_analysis' | 'proposal' | 'converted' | 'lost';
export type WidgetType = 'metric_card' | 'area_chart' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'funnel' | 'table' | 'insight_card';

// ============= Organization =============
// Aligned with Supabase schema (organizations table)

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: number;
  status: OrgStatus;
  logo_url: string | null;
  primary_color: string | null;
  admin_name: string | null;
  admin_email: string | null;
  settings: Json | null;
  created_at: string;
  updated_at: string;
}

// ============= Profile =============

export interface Profile {
  id: string;
  user_id: string;
  org_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

// ============= User Role =============

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

// ============= Integration =============

export interface Integration {
  id: string;
  org_id: string;
  name: string;
  type: IntegrationType;
  status: IntegrationStatus;
  config: Json;
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseConfig {
  projectUrl: string;
  anonKey: string;
}

export interface GoogleSheetsConfig {
  spreadsheetUrl: string;
  sheetName?: string;
  headerRow?: number;
  refreshInterval?: number;
}

export interface CsvConfig {
  fileName: string;
  fileSize?: number;
  fileUrl?: string;
  delimiter?: string;
  encoding?: string;
  uploadedAt?: string;
}

export interface ApiConfig {
  baseUrl: string;
  endpoint: string;
  method: 'GET' | 'POST';
  authType: 'none' | 'bearer' | 'api_key' | 'basic';
  authValue?: string;
  headers?: Record<string, string>;
  refreshInterval?: number;
}

// ============= Selected Table =============

export interface SelectedTable {
  id: string;
  integration_id: string;
  table_name: string;
  selected_columns: string[];
  column_types: Json;
  is_primary: boolean;
  row_count: number | null;
  sample_data: Json;
  created_at: string;
}

// ============= Data Mapping =============

export interface DataMapping {
  id: string;
  org_id: string;
  integration_id: string;
  source_table: string;
  source_column: string;
  target_metric: string;
  transform_type: string;
  transform_config: Json;
  created_at: string;
}

// ============= Dashboard =============

export interface Dashboard {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  layout: Json;
  filters: Json;
  created_at: string;
  updated_at: string;
}

// ============= Dashboard Widget =============

// Aligned with Supabase schema (dashboard_widgets table)
export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  type: WidgetType;
  title: string;
  description: string | null;
  config: Json;
  position: number;
  size: string | null;
  is_visible: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface WidgetConfig {
  // === Campos de mapeamento (fonte de dados) ===
  /** Nome da coluna REAL na tabela de origem (ex: "leads_total_30d") */
  metric?: string;
  /** Nome da tabela/view de origem (ex: "vw_dashboard_kpis_30d_v3") */
  dataSource?: string;
  /** Alias para dataSource — mantido por compatibilidade */
  sourceTable?: string;
  /** Nome semântico da métrica mapeada (ex: "total_leads") — usado para labels/formatação */
  targetMetric?: string;
  /** Tipo de agregação a aplicar */
  aggregation?: 'sum' | 'count' | 'avg' | 'min' | 'max';
  /** Tipo de transformação/formato (none, date, number, currency, percentage) */
  transformation?: string;
  /** Campo para agrupar dados (ex: "created_at" para séries temporais) */
  groupBy?: string;

  // === Campos de apresentação ===
  showTrend?: boolean;
  showSparkline?: boolean;
  compareWithPrevious?: boolean;
  chartColors?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  gradientFill?: boolean;
  stacked?: boolean;
  showLabels?: boolean;
  innerRadius?: number;
  showGrid?: boolean;
  curveType?: 'linear' | 'smooth' | 'step';
  funnelStages?: string[];
  columns?: string[];
  pageSize?: number;
  format?: 'number' | 'currency' | 'percentage';
}

// ============= Lead =============

export interface Lead {
  id: string;
  org_id: string;
  integration_id: string | null;
  external_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: LeadSource;
  status: LeadStatus;
  value: number;
  metadata: Json;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============= Activity Log =============

export interface ActivityLog {
  id: string;
  org_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Json;
  ip_address: string | null;
  created_at: string;
}

// ============= Widget Recommendation =============

export interface WidgetRecommendation {
  type: WidgetType;
  title: string;
  description: string;
  score: number;
  config: WidgetConfig;
  basedOn: string;
}

// ============= API Response Types =============

export interface ConnectionTestResult {
  success: boolean;
  tables?: DetectedTable[];
  error?: string;
}

export interface DetectedTable {
  name: string;
  columns: DetectedColumn[];
  rowCount: number;
  sampleData: Record<string, unknown>[];
}

export interface DetectedColumn {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'unknown';
  nullable: boolean;
  sampleValues: unknown[];
}

export interface SyncResult {
  success: boolean;
  syncedRecords: number;
  errors: string[];
}

export interface DashboardMetrics {
  totalLeads: number;
  newLeads: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  avgTicket: number;
  previousPeriod: {
    totalLeads: number;
    conversions: number;
    revenue: number;
  };
  timeSeriesData: TimeSeriesPoint[];
  sourceDistribution: DistributionItem[];
  statusDistribution: DistributionItem[];
  funnelData: FunnelStage[];
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

export interface DistributionItem {
  name: string;
  value: number;
  percentage: number;
  color?: string;
}

export interface FunnelStage {
  name: string;
  value: number;
  percentage: number;
  color?: string;
}

// ============= Form Input Types =============

export interface OrganizationInput {
  name: string;
  slug?: string;
  plan: number;
  admin_name: string;
  admin_email: string;
}

export interface IntegrationInput {
  org_id: string;
  name: string;
  type: IntegrationType;
  config: SupabaseConfig | GoogleSheetsConfig | CsvConfig | ApiConfig;
}

// ============= Target Metrics =============

export type TargetMetric = 
  | 'total_leads'
  | 'new_leads'
  | 'conversions'
  | 'conversion_rate'
  | 'revenue'
  | 'mrr'
  | 'growth_rate'
  | 'active_users'
  | 'churn_rate'
  | 'avg_ticket'
  | 'ltv'
  | 'cac'
  | 'funnel_stage'
  | 'lead_source'
  | 'created_date'
  | 'custom';

export const targetMetricLabels: Record<TargetMetric, { label: string; description: string; icon: string }> = {
  total_leads: { label: 'Total de Leads', description: 'Número total de leads no período', icon: 'users' },
  new_leads: { label: 'Novos Leads', description: 'Leads capturados recentemente', icon: 'user-plus' },
  conversions: { label: 'Conversões', description: 'Leads convertidos em clientes', icon: 'check-circle' },
  conversion_rate: { label: 'Taxa de Conversão', description: 'Percentual de leads convertidos', icon: 'percent' },
  revenue: { label: 'Receita Total', description: 'Soma de todas as vendas', icon: 'dollar-sign' },
  mrr: { label: 'MRR', description: 'Receita Recorrente Mensal', icon: 'trending-up' },
  growth_rate: { label: 'Taxa de Crescimento', description: 'Variação percentual no período', icon: 'arrow-up-right' },
  active_users: { label: 'Usuários Ativos', description: 'Usuários com atividade recente', icon: 'activity' },
  churn_rate: { label: 'Taxa de Churn', description: 'Percentual de cancelamentos', icon: 'user-minus' },
  avg_ticket: { label: 'Ticket Médio', description: 'Valor médio por transação', icon: 'credit-card' },
  ltv: { label: 'LTV', description: 'Valor do tempo de vida do cliente', icon: 'gem' },
  cac: { label: 'CAC', description: 'Custo de aquisição de cliente', icon: 'target' },
  funnel_stage: { label: 'Estágio do Funil', description: 'Posição no funil de vendas', icon: 'filter' },
  lead_source: { label: 'Origem do Lead', description: 'Canal de aquisição', icon: 'globe' },
  created_date: { label: 'Data de Criação', description: 'Data do registro', icon: 'calendar' },
  custom: { label: 'Métrica Customizada', description: 'Defina sua própria métrica', icon: 'settings' },
};

// ============= Data Profiler Types (v2) =============
// Exportados aqui para evitar importação circular com data-profiler.ts

export type ColumnSemantics =
  | 'metric_count'
  | 'metric_currency'
  | 'metric_percentage'
  | 'metric_rate'
  | 'dimension_date'
  | 'dimension_category'
  | 'dimension_id'
  | 'text_descriptive'
  | 'unknown';

export interface TableSchema {
  tableName: string;
  isAggregatedView: boolean;
  priority: number;
  columns: {
    name: string;
    type: string;
    semantics: ColumnSemantics;
    relevance: number;
    suggestedAggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
    suggestedFormat: 'number' | 'currency' | 'percentage' | 'date' | 'text';
  }[];
}

// ============= Client Preset =============

/** Identificador de preset de mapeamento por cliente */
export type ClientPresetKey = 'afonsina-oliveira' | 'generic';

export interface ClientMappingPreset {
  orgSlug: ClientPresetKey;
  useExactMapping: boolean;
}
