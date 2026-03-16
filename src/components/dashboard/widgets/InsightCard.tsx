import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, TrendingUp, AlertTriangle, Lightbulb, Sparkles, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface InsightCardProps {
  title: string;
  description: string;
}

interface AIInsight {
  type: 'recommendation' | 'alert' | 'trend';
  priority: 'high' | 'medium' | 'low';
  content: string;
}

const typeConfig = {
  recommendation: {
    icon: Lightbulb,
    label: 'Recomendação',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/5',
    borderColor: 'border-amber-500/15',
    iconBg: 'bg-amber-500/10',
  },
  alert: {
    icon: AlertTriangle,
    label: 'Alerta',
    color: 'text-red-400',
    bgColor: 'bg-red-500/5',
    borderColor: 'border-red-500/15',
    iconBg: 'bg-red-500/10',
  },
  trend: {
    icon: TrendingUp,
    label: 'Tendência',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/5',
    borderColor: 'border-emerald-500/15',
    iconBg: 'bg-emerald-500/10',
  },
};

const priorityConfig = {
  high: { label: 'Alta', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  medium: { label: 'Média', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  low: { label: 'Baixa', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

const InsightCard = ({ title, description }: InsightCardProps) => {
  const { orgId } = useParams();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-data-chat', {
        body: { orgId, mode: 'insights' },
      });

      if (fnError) throw fnError;
      
      if (data?.insights && Array.isArray(data.insights)) {
        setInsights(data.insights.slice(0, 3));
      } else {
        setInsights([]);
      }
    } catch (err) {
      console.error('[InsightCard] Error:', err);
      setError('Não foi possível gerar insights');
      setInsights([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [orgId]);

  return (
    <Card className="rounded-xl bg-card/80 backdrop-blur-sm border-border/50 h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">{description}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-[11px] text-muted-foreground">Análise em tempo real via IA</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fetchInsights}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Gerando insights com IA...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-xs">{error}</p>
          </div>
        ) : insights.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-xs">Sem dados suficientes para insights</p>
          </div>
        ) : (
          insights.map((insight, idx) => {
            const config = typeConfig[insight.type] || typeConfig.recommendation;
            const priority = priorityConfig[insight.priority] || priorityConfig.medium;
            const Icon = config.icon;

            return (
              <div
                key={idx}
                className={cn(
                  'p-3 rounded-lg border transition-all duration-200',
                  'hover:translate-x-0.5 hover:shadow-sm',
                  config.borderColor,
                  config.bgColor,
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('p-1.5 rounded-md shrink-0', config.iconBg)}>
                    <Icon className={cn('w-3.5 h-3.5', config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 h-4 font-medium', priority.className)}>
                        {priority.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">{insight.content}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mt-1" />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default InsightCard;
