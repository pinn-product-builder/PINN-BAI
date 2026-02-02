import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, TrendingUp, AlertTriangle, Lightbulb, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightCardProps {
  title: string;
  description: string;
}

// Mock insights
const mockInsights = [
  {
    id: '1',
    type: 'recommendation' as const,
    priority: 'high' as const,
    content: 'Taxa de conversão aumentou 15% na última semana. Considere aumentar o investimento em campanhas de Google Ads.',
    timestamp: '2 horas atrás',
  },
  {
    id: '2',
    type: 'alert' as const,
    priority: 'medium' as const,
    content: 'Queda de 8% nos leads do segmento B2B detectada. Recomenda-se revisar a estratégia de outbound.',
    timestamp: '5 horas atrás',
  },
  {
    id: '3',
    type: 'trend' as const,
    priority: 'low' as const,
    content: 'Leads provenientes de LinkedIn têm 2x mais chances de conversão. Tendência consistente nos últimos 30 dias.',
    timestamp: '1 dia atrás',
  },
];

const typeConfig = {
  recommendation: {
    icon: Lightbulb,
    label: 'Recomendação',
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    borderColor: 'border-accent/20',
  },
  alert: {
    icon: AlertTriangle,
    label: 'Alerta',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  trend: {
    icon: TrendingUp,
    label: 'Tendência',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
};

const priorityConfig = {
  high: { label: 'Alta', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  medium: { label: 'Média', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  low: { label: 'Baixa', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
};

const InsightCard = ({ title, description }: InsightCardProps) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-accent" />
            <CardTitle className="text-base">{title}</CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {mockInsights.map((insight) => {
          const config = typeConfig[insight.type];
          const priority = priorityConfig[insight.priority];
          const Icon = config.icon;

          return (
            <div
              key={insight.id}
              className={cn(
                "p-3 rounded-lg border transition-colors hover:bg-muted/50",
                config.borderColor,
                config.bgColor
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("p-1.5 rounded", config.bgColor)}>
                  <Icon className={cn("w-4 h-4", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5", priority.className)}>
                      {priority.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{insight.timestamp}</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {insight.content}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default InsightCard;
