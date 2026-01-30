import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calendar,
  Edit3,
  Save,
  X,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  Percent,
  Lightbulb,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { useToast } from '@/hooks/use-toast';
import {
  mockDashboardMetrics,
  mockChartData,
  mockFunnelData,
  mockInsights,
  mockOrganizations,
} from '@/lib/mock-data';

const insightConfig = {
  recommendation: { icon: Lightbulb, className: 'text-accent border-l-accent' },
  alert: { icon: AlertTriangle, className: 'text-warning border-l-warning' },
  trend: { icon: TrendingUp, className: 'text-success border-l-success' },
};

const Dashboard = () => {
  const { orgId } = useParams();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [dateRange, setDateRange] = useState('30d');

  const currentOrg = mockOrganizations.find((org) => org.id === orgId);

  const handleSaveLayout = () => {
    toast({
      title: 'Layout salvo',
      description: 'As alterações no dashboard foram salvas com sucesso.',
    });
    setIsEditing(false);
  };

  const metrics = [
    {
      id: 'leads',
      title: 'Total de Leads',
      value: mockDashboardMetrics.totalLeads.toLocaleString('pt-BR'),
      change: `+${mockDashboardMetrics.newLeadsToday} hoje`,
      trend: 'up',
      icon: Users,
    },
    {
      id: 'conversions',
      title: 'Deals Ativos',
      value: mockDashboardMetrics.activeDeals.toLocaleString('pt-BR'),
      change: '+12% vs mês anterior',
      trend: 'up',
      icon: Target,
    },
    {
      id: 'rate',
      title: 'Taxa de Conversão',
      value: `${mockDashboardMetrics.conversionRate}%`,
      change: '+2.3% vs mês anterior',
      trend: 'up',
      icon: Percent,
    },
    {
      id: 'revenue',
      title: 'Receita',
      value: `R$ ${(mockDashboardMetrics.revenue / 1000).toFixed(0)}k`,
      change: `+${mockDashboardMetrics.growthRate}% crescimento`,
      trend: 'up',
      icon: DollarSign,
    },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">{currentOrg?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="1y">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isEditing ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={handleSaveLayout}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar Layout
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit3 className="w-4 h-4 mr-2" />
              Editar Dashboard
            </Button>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="mb-4 p-3 bg-accent/10 border border-accent/20 rounded-lg flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-accent" />
          <span className="text-sm text-accent">
            Modo de edição ativo. O drag & drop será habilitado quando o backend estiver integrado.
          </span>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.id} className={isEditing ? 'ring-2 ring-dashed ring-accent/30' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">{metric.title}</p>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {metric.trend === 'up' ? (
                      <TrendingUp className="w-4 h-4 text-success" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-destructive" />
                    )}
                    <span className={`text-xs ${metric.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                      {metric.change}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className={isEditing ? 'ring-2 ring-dashed ring-accent/30' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução de Leads</CardTitle>
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
                  <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className={isEditing ? 'ring-2 ring-dashed ring-accent/30' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conversões</CardTitle>
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
                  <Line type="monotone" dataKey="conversions" stroke="hsl(var(--accent))" strokeWidth={2} name="Conversões" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel and Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className={isEditing ? 'ring-2 ring-dashed ring-accent/30' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Funil de Vendas</CardTitle>
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
                        style={{ width: `${widthPercent}%`, backgroundColor: stage.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className={`lg:col-span-2 ${isEditing ? 'ring-2 ring-dashed ring-accent/30' : ''}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-accent" />
                Insights IA
              </CardTitle>
              <Button variant="ghost" size="sm">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockInsights.map((insight) => {
                const config = insightConfig[insight.type];
                const Icon = config.icon;
                return (
                  <div key={insight.id} className={`p-3 rounded-lg border border-l-4 bg-card ${config.className}`}>
                    <div className="flex items-start gap-2">
                      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground">{insight.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
