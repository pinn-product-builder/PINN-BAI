import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@tanstack/react-query';
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
  Loader2,
  Volume2,
  Sparkles,
  Move,
  Check,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { EditableCardGrid, type CardWidget } from '@/components/dashboard/EditableCardGrid';
import { cn } from '@/lib/utils';
import { isDemoOrg } from '@/lib/featureFlags';
import { DEMO_INSIGHTS } from '@/data/arguto-extra-demo';

interface InsightResult {
  type: 'recommendation' | 'alert' | 'trend';
  priority: 'high' | 'medium' | 'low';
  title: string;
  content: string;
  evidence?: string;
  metric?: string;
}

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
  const { dateRangeISO } = useFilters();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEditingLayout, setIsEditingLayout] = useState(false);

  const { data: insights, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ai-insights', orgId, dateRangeISO.start, dateRangeISO.end],
    queryFn: async (): Promise<InsightResult[]> => {
      // Modo demo (Arguto): retorna insights pré-curados sem chamar a edge function.
      if (isDemoOrg(orgId)) return DEMO_INSIGHTS as unknown as InsightResult[];

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-data-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          orgId,
          mode: 'insights',
          dateRange: dateRangeISO,
        }),
      });

      if (!resp.ok) throw new Error('Falha ao gerar insights');
      const { insights: result } = await resp.json();
      return Array.isArray(result) ? result : [];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleSpeak = (text: string) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleSpeakAll = () => {
    if (!insights?.length) return;
    const fullText = insights
      .map((i, idx) => `Insight ${idx + 1}: ${i.title}. ${i.content}`)
      .join('. ');
    handleSpeak(fullText);
  };

  const stats = {
    total: insights?.length || 0,
    recommendations: insights?.filter((i) => i.type === 'recommendation').length || 0,
    alerts: insights?.filter((i) => i.type === 'alert').length || 0,
    highPriority: insights?.filter((i) => i.priority === 'high').length || 0,
  };

  const widgets: CardWidget[] = [
    {
      id: 'insights:total',
      size: { w: 3, h: 4 },
      render: () => (
        <Card className="h-full">
          <CardContent className="pt-6 h-full">
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
      ),
    },
    {
      id: 'insights:recommendations',
      size: { w: 3, h: 4 },
      render: () => (
        <Card className="h-full">
          <CardContent className="pt-6 h-full">
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
      ),
    },
    {
      id: 'insights:alerts',
      size: { w: 3, h: 4 },
      render: () => (
        <Card className="h-full">
          <CardContent className="pt-6 h-full">
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
      ),
    },
    {
      id: 'insights:high-priority',
      size: { w: 3, h: 4 },
      render: () => (
        <Card className="h-full">
          <CardContent className="pt-6 h-full">
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
      ),
    },
    {
      id: 'insights:list',
      size: { w: 12, h: 14 },
      render: () => (
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <div>
                <CardTitle>Insights Gerados por IA</CardTitle>
                <CardDescription>Análise em tempo real baseada nos seus dados</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-sm text-muted-foreground">A IA está analisando seus dados...</p>
              </div>
            ) : (
              <ScrollArea className="h-[420px] pr-4 no-drag">
                <div className="space-y-4">
                  {insights?.map((insight, idx) => {
                    const config = insightConfig[insight.type] || insightConfig.recommendation;
                    const priority = priorityConfig[insight.priority] || priorityConfig.medium;
                    const Icon = config.icon;

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border border-l-4 bg-card hover:bg-muted/30 transition-colors ${config.borderColor}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${config.className}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary" className={config.className}>{config.label}</Badge>
                              <Badge variant="outline" className={priority.className}>{priority.label}</Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="no-drag h-6 w-6 ml-auto"
                                onClick={() => handleSpeak(insight.content)}
                                title="Ouvir este insight"
                              >
                                <Volume2 className="w-3 h-3" />
                              </Button>
                            </div>
                            <p className="font-semibold text-foreground text-sm mb-1">{insight.title}</p>
                            <div className="text-sm text-muted-foreground prose prose-sm max-w-none">
                              <ReactMarkdown>{insight.content}</ReactMarkdown>
                            </div>
                            {insight.evidence && (
                              <div className="mt-2 pt-2 border-t border-border/50">
                                <p className="text-xs text-muted-foreground/80">
                                  <span className="font-semibold text-foreground/70">📊 Evidência: </span>
                                  <span className="italic">{insight.evidence}</span>
                                  {insight.metric && (
                                    <Badge variant="outline" className="ml-2 text-[10px] bg-primary/5 text-primary border-primary/20">
                                      {insight.metric}
                                    </Badge>
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-accent font-bold text-xs uppercase tracking-tight mb-1">
            <Sparkles className="w-3 h-3 fill-current" />
            Powered by AI
          </div>
          <h1 className="text-3xl font-bold text-foreground">Inteligência IA</h1>
          <p className="text-muted-foreground mt-1">
            Insights gerados a partir dos seus dados reais
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsEditingLayout((v) => !v)}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border transition-all',
              isEditingLayout
                ? 'border-primary/50 bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-foreground hover:border-primary/40 hover:text-primary',
            )}
          >
            {isEditingLayout ? <Check className="w-3.5 h-3.5" /> : <Move className="w-3.5 h-3.5" />}
            {isEditingLayout ? 'Concluir edição' : 'Editar layout'}
          </button>
          <Button
            variant="outline"
            onClick={handleSpeakAll}
            disabled={!insights?.length}
            className="gap-2"
          >
            <Volume2 className="w-4 h-4" />
            {isSpeaking ? 'Parar' : 'Ouvir Todos'}
          </Button>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Gerar Novos Insights
          </Button>
        </div>
      </div>

      <EditableCardGrid
        pageKey="insights"
        orgId={orgId}
        widgets={widgets}
        isEditing={isEditingLayout}
      />
    </div>
  );
};

export default Insights;
