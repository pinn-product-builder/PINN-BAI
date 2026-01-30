import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Download,
  Edit3,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Save,
  Settings,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  mockOrganizations,
  mockDashboardMetrics,
  mockFunnelData,
  mockChartData,
  mockInsights,
} from '@/lib/mock-data';

const ClientDashboard = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);
  const [dateRange, setDateRange] = useState('30d');

  const organization = mockOrganizations.find((o) => o.id === orgId) || mockOrganizations[0];
  const metrics = mockDashboardMetrics;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const insightTypeConfig = {
    recommendation: { icon: Lightbulb, color: 'text-success', bg: 'bg-success/10' },
    alert: { icon: TrendingDown, color: 'text-warning', bg: 'bg-warning/10' },
    trend: { icon: TrendingUp, color: 'text-info', bg: 'bg-info/10' },
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold text-sidebar-foreground">Pinn BAI</span>
          </div>

          {/* Organization info */}
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sidebar-accent flex items-center justify-center">
                <span className="text-lg font-semibold text-sidebar-accent-foreground">
                  {organization.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sidebar-foreground truncate">{organization.name}</p>
                <Badge variant="outline" className="text-xs text-sidebar-foreground/60 border-sidebar-border">
                  {organization.plan === 4 ? 'Enterprise' : organization.plan === 3 ? 'Business' : organization.plan === 2 ? 'Professional' : 'Starter'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            <Link
              to={`/client/${orgId}/dashboard`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-accent text-sidebar-accent-foreground"
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-medium">Dashboard</span>
            </Link>
            <Link
              to={`/client/${orgId}/import`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="font-medium">Importar Dados</span>
            </Link>
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <Settings className="w-5 h-5" />
              <span className="font-medium">Configurações</span>
            </button>
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                  <span className="text-sm font-medium text-sidebar-accent-foreground">
                    {organization.adminName.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-sidebar-foreground">{organization.adminName}</p>
                  <p className="text-xs text-sidebar-foreground/60">Admin</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => navigate('/login')}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral dos seus indicadores de performance
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date filter */}
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="1y">Último ano</SelectItem>
              </SelectContent>
            </Select>

            {/* Edit mode toggle */}
            {isEditMode ? (
              <>
                <Button variant="outline" onClick={() => setIsEditMode(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Layout
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsEditMode(true)}>
                <Edit3 className="w-4 h-4 mr-2" />
                Editar Dashboard
              </Button>
            )}
          </div>
        </div>

        {/* Edit mode banner */}
        {isEditMode && (
          <div className="mb-6 p-4 bg-accent/10 border border-accent/20 rounded-lg flex items-center gap-3">
            <Edit3 className="w-5 h-5 text-accent" />
            <p className="text-sm text-foreground">
              <strong>Modo de edição ativo.</strong> Arraste e redimensione os widgets para personalizar seu dashboard.
            </p>
          </div>
        )}

        {/* Metrics cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className={isEditMode ? 'ring-2 ring-dashed ring-accent/30' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Total de Leads</p>
                <Badge className="bg-success/10 text-success">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +{metrics.growthRate}%
                </Badge>
              </div>
              <p className="text-3xl font-bold text-foreground">{formatNumber(metrics.totalLeads)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                +{metrics.newLeadsToday} hoje
              </p>
            </CardContent>
          </Card>

          <Card className={isEditMode ? 'ring-2 ring-dashed ring-accent/30' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Taxa de Conversão</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{metrics.conversionRate}%</p>
              <p className="text-sm text-muted-foreground mt-1">
                Média do período
              </p>
            </CardContent>
          </Card>

          <Card className={isEditMode ? 'ring-2 ring-dashed ring-accent/30' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Negócios Ativos</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{metrics.activeDeals}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Em andamento
              </p>
            </CardContent>
          </Card>

          <Card className={isEditMode ? 'ring-2 ring-dashed ring-accent/30' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Receita</p>
                <Badge className="bg-success/10 text-success">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +18%
                </Badge>
              </div>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(metrics.revenue)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                No período
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Leads over time chart */}
          <Card className={isEditMode ? 'ring-2 ring-dashed ring-accent/30' : ''}>
            <CardHeader>
              <CardTitle className="text-lg">Leads por Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="leads" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Conversions trend */}
          <Card className={isEditMode ? 'ring-2 ring-dashed ring-accent/30' : ''}>
            <CardHeader>
              <CardTitle className="text-lg">Tendência de Conversões</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="conversions"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-2))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Funnel and Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Funnel */}
          <Card className={`lg:col-span-1 ${isEditMode ? 'ring-2 ring-dashed ring-accent/30' : ''}`}>
            <CardHeader>
              <CardTitle className="text-lg">Funil de Conversão</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockFunnelData.map((stage, index) => {
                  const widthPercent = (stage.value / mockFunnelData[0].value) * 100;
                  return (
                    <div key={stage.stage} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium">{stage.stage}</span>
                        <span className="text-muted-foreground">{stage.value.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${widthPercent}%`,
                            backgroundColor: `hsl(var(--chart-${index + 1}))`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card className={`lg:col-span-2 ${isEditMode ? 'ring-2 ring-dashed ring-accent/30' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-accent" />
                  Insights Inteligentes
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  Atualizado há 2h
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockInsights.map((insight) => {
                  const config = insightTypeConfig[insight.type];
                  const Icon = config.icon;
                  return (
                    <div
                      key={insight.id}
                      className="flex gap-4 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground leading-relaxed">{insight.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(insight.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ClientDashboard;
