// Mock data and types for Pinn BAI platform
// This will be replaced with Supabase integration later

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
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'platform_admin' | 'client_admin' | 'analyst' | 'viewer';
  orgId: string | null;
  avatarUrl?: string;
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

export interface AIInsight {
  id: string;
  dashboardId: string;
  content: string;
  type: 'trend' | 'alert' | 'recommendation';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
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
  },
];

// Mock current user (platform admin)
export const mockPlatformAdmin: User = {
  id: 'user-admin-1',
  email: 'admin@pinnbai.com',
  name: 'Admin Pinn',
  role: 'platform_admin',
  orgId: null,
};

// Mock client admin user
export const mockClientAdmin: User = {
  id: 'user-client-1',
  email: 'admin@techcorp.com',
  name: 'João Silva',
  role: 'client_admin',
  orgId: 'org-1',
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

// Plan names
export const planNames: Record<number, string> = {
  1: 'Starter',
  2: 'Professional',
  3: 'Business',
  4: 'Enterprise',
};
