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
  if (score >= 90) return 'bg-green-500/10 text-green-600 border-green-500/30';
  if (score >= 80) return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
  if (score >= 70) return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
  return 'bg-muted text-muted-foreground';
};

const getStatusStyles = (status: RecommendationStatus) => {
  switch (status) {
    case 'accepted':
      return {
        border: 'border-green-500/50 bg-green-500/5',
        badge: 'bg-green-500 text-white',
        badgeText: 'Aceito',
      };
    case 'rejected':
      return {
        border: 'border-red-500/30 bg-muted/50 opacity-60',
        badge: 'bg-red-500/20 text-red-600',
        badgeText: 'Rejeitado',
      };
    case 'customized':
      return {
        border: 'border-blue-500/50 bg-blue-500/5',
        badge: 'bg-blue-500 text-white',
        badgeText: 'Customizado',
      };
    default:
      return {
        border: 'border-amber-500/30 bg-amber-500/5',
        badge: 'bg-amber-500/20 text-amber-700',
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
          status === 'accepted' ? 'bg-green-500/10' : 
          status === 'rejected' ? 'bg-muted' : 'bg-accent/10'
        )}>
          <Icon className={cn(
            'w-5 h-5',
            status === 'accepted' ? 'text-green-600' :
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
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                onClick={onAccept}
              >
                <Check className="w-4 h-4" />
                <span className="sr-only">Aceitar</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                onClick={onReject}
              >
                <X className="w-4 h-4" />
                <span className="sr-only">Rejeitar</span>
              </Button>
              {onCustomize && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
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
              className="h-8 px-2 text-xs text-muted-foreground hover:text-red-500"
              onClick={onReject}
            >
              Remover
            </Button>
          )}
          
          {status === 'rejected' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-green-600"
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
