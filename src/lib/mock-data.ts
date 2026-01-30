// Mock data and types for Pinn BAI platform
// This will be replaced with Supabase integration later

export interface SupabaseConfig {
  projectUrl: string;
  anonKey: string;
  isConnected: boolean;
  lastSync?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 1 | 2 | 3 | 4;
  status: 'active' | 'suspended' | 'trial';
  createdAt: string;
  adminEmail: string;
  adminName: string;
  totalUsers: number;
  totalLeads: number;
  supabaseConfig?: SupabaseConfig;
  settings?: OrgSettings;
}

export interface OrgSettings {
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  language: string;
  dataRefreshInterval: number;
  allowUserUploads: boolean;
  maxFileSize: number;
  retentionDays: number;
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
  templateId: string;
  layout: WidgetLayout[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  plan: 1 | 2 | 3 | 4;
  widgets: Widget[];
  isDefault: boolean;
}

export interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface Widget {
  id: string;
  type: 'metric' | 'chart' | 'funnel' | 'table' | 'insight';
  title: string;
  config: Record<string, unknown>;
}

export interface DataRecord {
  id: string;
  orgId: string;
  datasetId: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface Dataset {
  id: string;
  orgId: string;
  name: string;
  status: 'processing' | 'ready' | 'error';
  recordCount: number;
  fileUrl: string;
  mappings: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface AIInsight {
  id: string;
  dashboardId: string;
  content: string;
  type: 'trend' | 'alert' | 'recommendation';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  entityType: 'organization' | 'user' | 'dataset' | 'dashboard' | 'system';
  entityId?: string;
  createdAt: string;
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultPlan: 1 | 2 | 3 | 4;
  trialDays: number;
  enableNotifications: boolean;
  enableAutoInsights: boolean;
  insightsInterval: number;
  maxFileSize: number;
  enableRLS: boolean;
  logRetention: number;
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
}

// Mock organizations data
export const mockOrganizations: Organization[] = [
  {
    id: 'org-1',
    name: 'TechCorp Solutions',
    slug: 'techcorp',
    plan: 3,
    status: 'active',
    createdAt: '2024-01-15T10:00:00Z',
    adminEmail: 'admin@techcorp.com',
    adminName: 'João Silva',
    totalUsers: 12,
    totalLeads: 2450,
    supabaseConfig: {
      projectUrl: 'https://abc123.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      isConnected: true,
      lastSync: '2024-03-15T10:30:00Z',
    },
    settings: {
      theme: 'light',
      timezone: 'America/Sao_Paulo',
      language: 'pt-BR',
      dataRefreshInterval: 5,
      allowUserUploads: true,
      maxFileSize: 50,
      retentionDays: 90,
    },
  },
  {
    id: 'org-2',
    name: 'Marketing Plus',
    slug: 'marketingplus',
    plan: 2,
    status: 'active',
    createdAt: '2024-02-20T14:30:00Z',
    adminEmail: 'admin@marketingplus.com',
    adminName: 'Maria Santos',
    totalUsers: 5,
    totalLeads: 890,
    supabaseConfig: {
      projectUrl: 'https://def456.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      isConnected: true,
      lastSync: '2024-03-14T16:00:00Z',
    },
    settings: {
      theme: 'system',
      timezone: 'America/Sao_Paulo',
      language: 'pt-BR',
      dataRefreshInterval: 10,
      allowUserUploads: true,
      maxFileSize: 25,
      retentionDays: 60,
    },
  },
  {
    id: 'org-3',
    name: 'Startup Hub',
    slug: 'startuphub',
    plan: 1,
    status: 'trial',
    createdAt: '2024-03-10T09:15:00Z',
    adminEmail: 'founder@startuphub.io',
    adminName: 'Pedro Costa',
    totalUsers: 3,
    totalLeads: 156,
    settings: {
      theme: 'dark',
      timezone: 'America/Sao_Paulo',
      language: 'pt-BR',
      dataRefreshInterval: 15,
      allowUserUploads: false,
      maxFileSize: 10,
      retentionDays: 30,
    },
  },
  {
    id: 'org-4',
    name: 'Enterprise Global',
    slug: 'enterprise-global',
    plan: 4,
    status: 'active',
    createdAt: '2023-11-05T11:00:00Z',
    adminEmail: 'cto@enterprise-global.com',
    adminName: 'Ana Rodrigues',
    totalUsers: 45,
    totalLeads: 12500,
    supabaseConfig: {
      projectUrl: 'https://ghi789.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      isConnected: true,
      lastSync: '2024-03-15T12:00:00Z',
    },
    settings: {
      theme: 'light',
      timezone: 'Europe/London',
      language: 'en-US',
      dataRefreshInterval: 5,
      allowUserUploads: true,
      maxFileSize: 100,
      retentionDays: 365,
    },
  },
  {
    id: 'org-5',
    name: 'Retail Masters',
    slug: 'retailmasters',
    plan: 2,
    status: 'suspended',
    createdAt: '2024-01-28T16:45:00Z',
    adminEmail: 'admin@retailmasters.com',
    adminName: 'Carlos Oliveira',
    totalUsers: 8,
    totalLeads: 1200,
    settings: {
      theme: 'light',
      timezone: 'America/Sao_Paulo',
      language: 'pt-BR',
      dataRefreshInterval: 10,
      allowUserUploads: true,
      maxFileSize: 25,
      retentionDays: 60,
    },
  },
];

// Mock users data
export const mockUsers: User[] = [
  {
    id: 'user-admin-1',
    email: 'admin@pinnbai.com',
    name: 'Admin Pinn',
    role: 'platform_admin',
    orgId: null,
    isActive: true,
    lastLogin: '2024-03-15T08:00:00Z',
    createdAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'user-client-1',
    email: 'admin@techcorp.com',
    name: 'João Silva',
    role: 'client_admin',
    orgId: 'org-1',
    isActive: true,
    lastLogin: '2024-03-15T09:30:00Z',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'user-client-2',
    email: 'admin@marketingplus.com',
    name: 'Maria Santos',
    role: 'client_admin',
    orgId: 'org-2',
    isActive: true,
    lastLogin: '2024-03-14T14:00:00Z',
    createdAt: '2024-02-20T14:30:00Z',
  },
  {
    id: 'user-analyst-1',
    email: 'analyst@techcorp.com',
    name: 'Carlos Lima',
    role: 'analyst',
    orgId: 'org-1',
    isActive: true,
    lastLogin: '2024-03-15T10:00:00Z',
    createdAt: '2024-01-20T10:00:00Z',
  },
  {
    id: 'user-viewer-1',
    email: 'viewer@techcorp.com',
    name: 'Ana Costa',
    role: 'viewer',
    orgId: 'org-1',
    isActive: true,
    lastLogin: '2024-03-13T16:00:00Z',
    createdAt: '2024-02-01T10:00:00Z',
  },
];

// Mock current user (platform admin)
export const mockPlatformAdmin: User = mockUsers[0];

// Mock client admin user
export const mockClientAdmin: User = mockUsers[1];

// Mock dashboard templates
export const mockTemplates: DashboardTemplate[] = [
  {
    id: 'template-1',
    name: 'Starter Dashboard',
    description: 'Dashboard básico com métricas essenciais para pequenas empresas',
    plan: 1,
    isDefault: true,
    widgets: [
      { id: 'w1', type: 'metric', title: 'Total de Leads', config: {} },
      { id: 'w2', type: 'metric', title: 'Conversões', config: {} },
      { id: 'w3', type: 'chart', title: 'Leads por Mês', config: { chartType: 'bar' } },
    ],
  },
  {
    id: 'template-2',
    name: 'Professional Dashboard',
    description: 'Dashboard completo com funil e insights para equipes médias',
    plan: 2,
    isDefault: true,
    widgets: [
      { id: 'w1', type: 'metric', title: 'Total de Leads', config: {} },
      { id: 'w2', type: 'metric', title: 'Conversões', config: {} },
      { id: 'w3', type: 'metric', title: 'Taxa de Conversão', config: {} },
      { id: 'w4', type: 'funnel', title: 'Funil de Vendas', config: {} },
      { id: 'w5', type: 'chart', title: 'Leads por Mês', config: { chartType: 'line' } },
    ],
  },
  {
    id: 'template-3',
    name: 'Business Dashboard',
    description: 'Dashboard avançado com análises detalhadas e insights por IA',
    plan: 3,
    isDefault: true,
    widgets: [
      { id: 'w1', type: 'metric', title: 'Total de Leads', config: {} },
      { id: 'w2', type: 'metric', title: 'Conversões', config: {} },
      { id: 'w3', type: 'metric', title: 'Taxa de Conversão', config: {} },
      { id: 'w4', type: 'metric', title: 'Receita', config: {} },
      { id: 'w5', type: 'funnel', title: 'Funil de Vendas', config: {} },
      { id: 'w6', type: 'chart', title: 'Leads por Mês', config: { chartType: 'line' } },
      { id: 'w7', type: 'chart', title: 'Conversões por Canal', config: { chartType: 'bar' } },
      { id: 'w8', type: 'insight', title: 'Insights IA', config: {} },
    ],
  },
  {
    id: 'template-4',
    name: 'Enterprise Dashboard',
    description: 'Dashboard enterprise com todas as funcionalidades e customização total',
    plan: 4,
    isDefault: true,
    widgets: [
      { id: 'w1', type: 'metric', title: 'Total de Leads', config: {} },
      { id: 'w2', type: 'metric', title: 'Conversões', config: {} },
      { id: 'w3', type: 'metric', title: 'Taxa de Conversão', config: {} },
      { id: 'w4', type: 'metric', title: 'Receita', config: {} },
      { id: 'w5', type: 'metric', title: 'Crescimento', config: {} },
      { id: 'w6', type: 'funnel', title: 'Funil de Vendas', config: {} },
      { id: 'w7', type: 'chart', title: 'Leads por Mês', config: { chartType: 'area' } },
      { id: 'w8', type: 'chart', title: 'Conversões por Canal', config: { chartType: 'bar' } },
      { id: 'w9', type: 'table', title: 'Top Leads', config: {} },
      { id: 'w10', type: 'insight', title: 'Insights IA', config: {} },
    ],
  },
];

// Mock activity logs
export const mockActivityLogs: ActivityLog[] = [
  {
    id: 'log-1',
    userId: 'user-admin-1',
    userName: 'Admin Pinn',
    action: 'Criou nova organização',
    details: 'TechCorp Solutions foi provisionada com plano Business',
    entityType: 'organization',
    entityId: 'org-1',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'log-2',
    userId: 'user-admin-1',
    userName: 'Admin Pinn',
    action: 'Configurou integração Supabase',
    details: 'Conexão estabelecida para TechCorp Solutions',
    entityType: 'organization',
    entityId: 'org-1',
    createdAt: '2024-01-15T10:30:00Z',
  },
  {
    id: 'log-3',
    userId: 'user-client-1',
    userName: 'João Silva',
    action: 'Importou dataset',
    details: 'leads_janeiro.csv - 450 registros',
    entityType: 'dataset',
    entityId: 'dataset-1',
    createdAt: '2024-01-20T14:00:00Z',
  },
  {
    id: 'log-4',
    userId: 'user-admin-1',
    userName: 'Admin Pinn',
    action: 'Atualizou configurações',
    details: 'RLS habilitado para todas organizações',
    entityType: 'system',
    createdAt: '2024-02-01T09:00:00Z',
  },
  {
    id: 'log-5',
    userId: 'user-admin-1',
    userName: 'Admin Pinn',
    action: 'Suspendeu organização',
    details: 'Retail Masters - Pagamento pendente',
    entityType: 'organization',
    entityId: 'org-5',
    createdAt: '2024-03-10T11:00:00Z',
  },
];

// Mock platform settings
export const mockPlatformSettings: PlatformSettings = {
  platformName: 'Pinn BAI',
  supportEmail: 'suporte@pinnbai.com',
  defaultPlan: 1,
  trialDays: 14,
  enableNotifications: true,
  enableAutoInsights: true,
  insightsInterval: 24,
  maxFileSize: 50,
  enableRLS: true,
  logRetention: 90,
  maintenanceMode: false,
  allowNewRegistrations: true,
};

// Mock dashboard metrics
export const mockDashboardMetrics = {
  totalLeads: 2450,
  newLeadsToday: 47,
  conversionRate: 12.5,
  activeDeals: 156,
  revenue: 458000,
  growthRate: 23.4,
};

// Mock funnel data
export const mockFunnelData = [
  { stage: 'Visitantes', value: 10000, color: 'hsl(var(--chart-1))' },
  { stage: 'Leads', value: 2450, color: 'hsl(var(--chart-2))' },
  { stage: 'Oportunidades', value: 890, color: 'hsl(var(--chart-3))' },
  { stage: 'Propostas', value: 320, color: 'hsl(var(--chart-4))' },
  { stage: 'Clientes', value: 156, color: 'hsl(var(--chart-5))' },
];

// Mock chart data
export const mockChartData = [
  { month: 'Jan', leads: 180, conversions: 22 },
  { month: 'Fev', leads: 220, conversions: 28 },
  { month: 'Mar', leads: 195, conversions: 24 },
  { month: 'Abr', leads: 310, conversions: 38 },
  { month: 'Mai', leads: 280, conversions: 35 },
  { month: 'Jun', leads: 365, conversions: 45 },
];

// Mock AI insights
export const mockInsights: AIInsight[] = [
  {
    id: 'insight-1',
    dashboardId: 'dash-1',
    content: 'Taxa de conversão aumentou 15% na última semana. Considere aumentar o investimento em campanhas de Google Ads.',
    type: 'recommendation',
    priority: 'high',
    createdAt: '2024-03-15T08:00:00Z',
  },
  {
    id: 'insight-2',
    dashboardId: 'dash-1',
    content: 'Queda de 8% nos leads do segmento B2B detectada. Recomenda-se revisar a estratégia de outbound.',
    type: 'alert',
    priority: 'medium',
    createdAt: '2024-03-14T14:30:00Z',
  },
  {
    id: 'insight-3',
    dashboardId: 'dash-1',
    content: 'Leads provenientes de LinkedIn têm 2x mais chances de conversão. Tendência consistente nos últimos 30 dias.',
    type: 'trend',
    priority: 'low',
    createdAt: '2024-03-13T11:00:00Z',
  },
];

// Mock datasets
export const mockDatasets: Dataset[] = [
  {
    id: 'dataset-1',
    orgId: 'org-1',
    name: 'leads_janeiro.csv',
    status: 'ready',
    recordCount: 450,
    fileUrl: '/uploads/leads_janeiro.csv',
    mappings: { nome: 'lead.name', email: 'lead.email', telefone: 'lead.phone' },
    createdAt: '2024-01-20T14:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
  },
  {
    id: 'dataset-2',
    orgId: 'org-1',
    name: 'leads_fevereiro.csv',
    status: 'ready',
    recordCount: 580,
    fileUrl: '/uploads/leads_fevereiro.csv',
    mappings: { nome: 'lead.name', email: 'lead.email', telefone: 'lead.phone' },
    createdAt: '2024-02-15T10:00:00Z',
    updatedAt: '2024-02-15T10:45:00Z',
  },
  {
    id: 'dataset-3',
    orgId: 'org-1',
    name: 'leads_marco.csv',
    status: 'processing',
    recordCount: 0,
    fileUrl: '/uploads/leads_marco.csv',
    mappings: {},
    createdAt: '2024-03-15T09:00:00Z',
    updatedAt: '2024-03-15T09:00:00Z',
  },
];

// Plan names
export const planNames: Record<number, string> = {
  1: 'Starter',
  2: 'Professional',
  3: 'Business',
  4: 'Enterprise',
};

// Plan limits
export const planLimits: Record<number, { users: number; storage: string; features: string[] }> = {
  1: { users: 3, storage: '5GB', features: ['Dashboard básico', 'Importação CSV', 'Suporte email'] },
  2: { users: 10, storage: '25GB', features: ['Dashboard avançado', 'Importação multi-formato', 'Insights básicos', 'Suporte prioritário'] },
  3: { users: 25, storage: '100GB', features: ['Dashboard customizável', 'Importação ilimitada', 'Insights IA', 'API access', 'Suporte dedicado'] },
  4: { users: -1, storage: 'Ilimitado', features: ['Tudo do Business', 'Multi-dashboards', 'White-label', 'SLA garantido', 'Gerente de conta'] },
};
