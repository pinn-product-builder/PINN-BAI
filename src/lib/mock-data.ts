// Types for Pinn BAI platform
// Most data is now fetched directly from Supabase

// ============= Integration Types =============

export type IntegrationType = 'supabase' | 'google_sheets' | 'csv' | 'api';
export type IntegrationStatus = 'pending' | 'connected' | 'error' | 'syncing';

export interface SupabaseConfig {
  projectUrl: string;
  anonKey: string;
  isConnected: boolean;
  lastSync?: string;
}

export interface GoogleSheetsConfig {
  spreadsheetUrl: string;
  sheetName: string;
  headerRow: number;
  refreshInterval: number;
}

export interface CsvConfig {
  fileName: string;
  fileSize: number;
  delimiter: string;
  encoding: string;
  uploadedAt: string;
}

export interface ApiConfig {
  baseUrl: string;
  authType: 'bearer' | 'api_key' | 'basic' | 'none';
  authValue: string;
  endpoint: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  refreshInterval: number;
}

export interface DataIntegration {
  id: string;
  type: IntegrationType;
  name: string;
  config: SupabaseConfig | GoogleSheetsConfig | CsvConfig | ApiConfig;
  status: IntegrationStatus;
  lastSync?: string;
  errorMessage?: string;
  tables?: DetectedTable[];
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
  sampleValues: string[];
}

// ============= Data Mapping Types =============

export interface DataMapping {
  id: string;
  sourceField: string;
  sourceTable: string;
  targetMetric: TargetMetric;
  transformation: TransformationType;
  aggregation?: AggregationType;
  format?: string;
}

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

export type TransformationType = 'none' | 'date' | 'number' | 'currency' | 'percentage' | 'text' | 'boolean';
export type AggregationType = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'distinct';

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

// ============= Dashboard Widget Types =============

export type DashboardWidgetType =
  | 'metric_card'
  | 'area_chart'
  | 'bar_chart'
  | 'line_chart'
  | 'pie_chart'
  | 'donut_chart'
  | 'funnel'
  | 'radar_chart'
  | 'table'
  | 'insight_card';

export interface DashboardWidgetConfig {
  id: string;
  type: DashboardWidgetType;
  title: string;
  description: string;
  position: { x: number; y: number; w: number; h: number };
  dataMapping: DataMapping[];
  config: {
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
  };
}

// ============= Onboarding Wizard Types =============

export interface OnboardingWizardState {
  currentStep: number;
  organization: {
    name: string;
    adminName: string;
    adminEmail: string;
    plan: 1 | 2 | 3 | 4 | 5;
  };
  integration: DataIntegration | null;
  mappings: DataMapping[];
  selectedWidgets: DashboardWidgetConfig[];
  isComplete: boolean;
}

// ============= Original Types =============

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 1 | 2 | 3 | 4 | 5;
  status: 'active' | 'suspended' | 'trial';
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
  custom_domain?: string;
  admin_name?: string;
  admin_email?: string;
  settings?: any;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'platform_admin' | 'client_admin' | 'analyst' | 'viewer';
  orgId: string | null;
  avatarUrl?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface Dashboard {
  id: string;
  orgId: string;
  name: string;
  is_default: boolean;
  layout: any;
  widgets: DashboardWidgetConfig[];
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  org_id?: string;
  user_id?: string;
  action: string;
  userName: string;
  entityType: string;
  details: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  org_id: string;
  name: string;
  email?: string;
  phone?: string;
  source: string;
  status: string;
  value: number;
  created_at: string;
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultPlan: number;
  trialDays: number;
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  enableRLS: boolean;
  maxFileSize: number;
  logRetention: number;
  enableNotifications: boolean;
  enableAutoInsights: boolean;
  insightsInterval: number;
}

// EMPTY MOCK ARRAYS (For real data transition)
export const planNames: Record<number, string> = {
  1: 'Agent Sales',
  2: 'Revenue OS',
  3: 'Growth Engine',
  4: 'Automation Hub',
  5: 'MicroSaaS Studio',
};

export const planLimits: Record<number, { users: number; features: string[] }> = {
  1: {
    users: 3,
    features: ['Dashboard básico', 'Até 1.000 leads', 'Relatórios mensais'],
  },
  2: {
    users: 10,
    features: ['Dashboard avançado', 'Até 10.000 leads', 'Relatórios semanais', 'Integrações básicas'],
  },
  3: {
    users: 25,
    features: ['Dashboard customizado', 'Leads ilimitados', 'Relatórios diários', 'Integrações avançadas', 'IA básica'],
  },
  4: {
    users: -1,
    features: ['Tudo do Growth', 'Automações', 'IA avançada', 'API completa', 'Suporte prioritário'],
  },
  5: {
    users: -1,
    features: ['White-label', 'Multi-tenant', 'Customização total', 'SLA dedicado'],
  },
};

export const mockPlatformSettings: PlatformSettings = {
  platformName: 'Pinn BAI',
  supportEmail: 'suporte@pinn.com.br',
  defaultPlan: 2,
  trialDays: 14,
  maintenanceMode: false,
  allowNewRegistrations: true,
  enableRLS: true,
  maxFileSize: 50,
  logRetention: 90,
  enableNotifications: true,
  enableAutoInsights: true,
  insightsInterval: 24,
};

export const mockOrganizations: Organization[] = [];
export const mockUsers: User[] = [];
export const mockPlatformAdmin: User | null = null;
export const mockClientAdmin: User | null = null;
export const mockTemplates: any[] = [];
export const mockActivityLogs: ActivityLog[] = [];
export const mockDashboardMetrics = {
  totalLeads: 0,
  newLeadsToday: 0,
  conversionRate: 0,
  activeDeals: 0,
  revenue: 0,
  growthRate: 0,
};
export const mockFunnelData: any[] = [];
export const mockChartData: any[] = [];
export const mockInsights: any[] = [];
export const mockDatasets: any[] = [];
export const mockLeads: Lead[] = [];
