import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, TrendingUp, AlertTriangle, Lightbulb, Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightCardProps {
  title: string;
  description: string;
}

const mockInsights = [
  {
    id: '1',
    type: 'recommendation' as const,
    priority: 'high' as const,
    content:
      'Taxa de conversão aumentou 15% na última semana. Considere aumentar o investimento em campanhas de Google Ads.',
    timestamp: '2 horas atrás',
  },
  {
    id: '2',
    type: 'alert' as const,
    priority: 'medium' as const,
    content:
      'Queda de 8% nos leads do segmento B2B detectada. Recomenda-se revisar a estratégia de outbound.',
    timestamp: '5 horas atrás',
  },
  {
    id: '3',
    type: 'trend' as const,
    priority: 'low' as const,
    content:
      'Leads provenientes de LinkedIn têm 2x mais chances de conversão. Tendência consistente nos últimos 30 dias.',
    timestamp: '1 dia atrás',
  },
];

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
  return (
    <Card className="rounded-xl bg-card/80 backdrop-blur-sm border-border/50">
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
              <p className="text-[11px] text-muted-foreground">Análise em tempo real</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {mockInsights.map((insight) => {
          const config = typeConfig[insight.type];
          const priority = priorityConfig[insight.priority];
          const Icon = config.icon;

          return (
            <div
              key={insight.id}
              className={cn(
                'p-3 rounded-lg border transition-all duration-200 cursor-pointer',
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
                    <span className="text-[10px] text-muted-foreground/60">{insight.timestamp}</span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed">{insight.content}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mt-1" />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default InsightCard;
