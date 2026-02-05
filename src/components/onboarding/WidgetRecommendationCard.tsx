import { 
  Check, 
  X, 
  Settings, 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Table2, 
  LineChart, 
  Activity,
  Sparkles,
  Filter,
  AreaChart
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { WidgetRecommendation, WidgetType } from '@/lib/types';

export type RecommendationStatus = 'pending' | 'accepted' | 'rejected' | 'customized';

interface WidgetRecommendationCardProps {
  recommendation: WidgetRecommendation;
  status: RecommendationStatus;
  onAccept: () => void;
  onReject: () => void;
  onCustomize?: () => void;
  index: number;
}

const WIDGET_ICONS: Record<WidgetType, React.ComponentType<{ className?: string }>> = {
  metric_card: TrendingUp,
  area_chart: AreaChart,
  bar_chart: BarChart3,
  line_chart: LineChart,
  pie_chart: PieChart,
  funnel: Filter,
  table: Table2,
  insight_card: Sparkles,
};

const getScoreColor = (score: number): string => {
  if (score >= 90) return 'bg-success/10 text-success border-success/30';
  if (score >= 80) return 'bg-info/10 text-info border-info/30';
  if (score >= 70) return 'bg-warning/10 text-warning border-warning/30';
  return 'bg-muted text-muted-foreground';
};

const getStatusStyles = (status: RecommendationStatus) => {
  switch (status) {
    case 'accepted':
      return {
        border: 'border-success/50 bg-success/5',
        badge: 'bg-success text-success-foreground',
        badgeText: 'Aceito',
      };
    case 'rejected':
      return {
        border: 'border-destructive/30 bg-muted/50 opacity-60',
        badge: 'bg-destructive/20 text-destructive',
        badgeText: 'Rejeitado',
      };
    case 'customized':
      return {
        border: 'border-info/50 bg-info/5',
        badge: 'bg-info text-info-foreground',
        badgeText: 'Customizado',
      };
    default:
      return {
        border: 'border-warning/30 bg-warning/5',
        badge: 'bg-warning/20 text-warning',
        badgeText: 'Pendente',
      };
  }
};

const WidgetRecommendationCard = ({
  recommendation,
  status,
  onAccept,
  onReject,
  onCustomize,
  index,
}: WidgetRecommendationCardProps) => {
  const Icon = WIDGET_ICONS[recommendation.type] || Activity;
  const statusStyles = getStatusStyles(status);
  const scoreColor = getScoreColor(recommendation.score);

  return (
    <Card
      className={cn(
        'p-4 transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-2',
        statusStyles.border
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
          status === 'accepted' ? 'bg-success/10' : 
          status === 'rejected' ? 'bg-muted' : 'bg-accent/10'
        )}>
          <Icon className={cn(
            'w-5 h-5',
            status === 'accepted' ? 'text-success' :
            status === 'rejected' ? 'text-muted-foreground' : 'text-accent'
          )} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={cn(
              'font-medium text-foreground',
              status === 'rejected' && 'text-muted-foreground line-through'
            )}>
              {recommendation.title}
            </h4>
            <Badge className={statusStyles.badge} variant="outline">
              {statusStyles.badgeText}
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
            {recommendation.description}
          </p>
          
          <div className="flex items-center gap-2 text-xs">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={cn('cursor-help', scoreColor)}>
                  Score: {recommendation.score}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Score de relevância baseado na análise dos dados mapeados.
                  Quanto maior, mais adequado é o widget para seus dados.
                </p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground cursor-help truncate max-w-[200px]">
                  {recommendation.basedOn}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{recommendation.basedOn}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-success hover:text-success hover:bg-success/10"
                onClick={onAccept}
              >
                <Check className="w-4 h-4" />
                <span className="sr-only">Aceitar</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onReject}
              >
                <X className="w-4 h-4" />
                <span className="sr-only">Rejeitar</span>
              </Button>
              {onCustomize && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-info hover:text-info hover:bg-info/10"
                  onClick={onCustomize}
                >
                  <Settings className="w-4 h-4" />
                  <span className="sr-only">Customizar</span>
                </Button>
              )}
            </>
          )}
          
          {(status === 'accepted' || status === 'customized') && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={onReject}
            >
              Remover
            </Button>
          )}
          
          {status === 'rejected' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-success"
              onClick={onAccept}
            >
              Restaurar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default WidgetRecommendationCard;
