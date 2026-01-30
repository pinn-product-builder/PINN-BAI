import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { mockInsights } from '@/lib/mock-data';

const insightConfig = {
  recommendation: {
    icon: Lightbulb,
    label: 'Recomendação',
    className: 'bg-accent/10 text-accent',
    borderColor: 'border-l-accent',
  },
  alert: {
    icon: AlertTriangle,
    label: 'Alerta',
    className: 'bg-warning/10 text-warning',
    borderColor: 'border-l-warning',
  },
  trend: {
    icon: TrendingUp,
    label: 'Tendência',
    className: 'bg-success/10 text-success',
    borderColor: 'border-l-success',
  },
};

const priorityConfig = {
  high: { label: 'Alta', className: 'bg-destructive/10 text-destructive' },
  medium: { label: 'Média', className: 'bg-warning/10 text-warning' },
  low: { label: 'Baixa', className: 'bg-muted text-muted-foreground' },
};

const Insights = () => {
  const { orgId } = useParams();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const stats = {
    total: mockInsights.length,
    recommendations: mockInsights.filter((i) => i.type === 'recommendation').length,
    alerts: mockInsights.filter((i) => i.type === 'alert').length,
    highPriority: mockInsights.filter((i) => i.priority === 'high').length,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Insights IA</h1>
          <p className="text-muted-foreground mt-1">
            Recomendações e alertas gerados automaticamente
          </p>
        </div>
        <Button variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar Insights
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Insights</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recomendações</p>
                <p className="text-3xl font-bold text-accent">{stats.recommendations}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alertas</p>
                <p className="text-3xl font-bold text-warning">{stats.alerts}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alta Prioridade</p>
                <p className="text-3xl font-bold text-destructive">{stats.highPriority}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <CardTitle>Histórico de Insights</CardTitle>
              <CardDescription>Últimos 30 dias de análises automáticas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {mockInsights.map((insight) => {
                const config = insightConfig[insight.type];
                const priority = priorityConfig[insight.priority];
                const Icon = config.icon;

                return (
                  <div
                    key={insight.id}
                    className={`p-4 rounded-lg border border-l-4 bg-card hover:bg-muted/30 transition-colors ${config.borderColor}`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${config.className}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className={config.className}>
                            {config.label}
                          </Badge>
                          <Badge variant="outline" className={priority.className}>
                            {priority.label}
                          </Badge>
                        </div>
                        <p className="text-foreground">{insight.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Gerado em {formatDate(insight.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default Insights;
