import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, Info, Loader2, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
  title: string;
  description: string;
  value?: number;
  previousValue?: number;
  format?: 'number' | 'currency' | 'percentage';
  showSparkline?: boolean;
  isLoading?: boolean;
  metricLabel?: string;
}

const generateSparklineData = (baseValue: number) => {
  const points = 12;
  return Array.from({ length: points }, (_, i) => ({
    day: i,
    value: Math.max(0, baseValue * (0.7 + Math.sin(i / 2) * 0.15 + Math.random() * 0.3)),
  }));
};

const MetricCard = ({
  title,
  description,
  value,
  previousValue,
  format = 'number',
  showSparkline = true,
  isLoading = false,
  metricLabel,
}: MetricCardProps) => {
  if (isLoading) {
    return (
      <Card className="relative overflow-hidden rounded-xl h-full flex items-center justify-center min-h-[140px] bg-card/80 backdrop-blur-sm border-border/50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Carregando...</span>
        </div>
      </Card>
    );
  }

  if (value === undefined && !isLoading) {
    return (
      <Card className="relative overflow-hidden rounded-xl h-full flex items-center justify-center min-h-[140px] border-border/30 bg-card/50">
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <Database className="w-5 h-5 text-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">Sem dados disponíveis</span>
        </div>
      </Card>
    );
  }

  const hasValue = value !== undefined;
  const displayValue = value ?? 0;
  const percentChange = previousValue && displayValue
    ? ((displayValue - previousValue) / previousValue) * 100
    : null;

  const isPositive = percentChange !== null && percentChange > 0;
  const isNegative = percentChange !== null && percentChange < 0;

  const formatDisplayValue = (val: number): string => {
    switch (format) {
      case 'currency':
        if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`;
        if (val >= 1_000) return `R$ ${(val / 1_000).toFixed(1)}K`;
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      default:
        if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
        if (val >= 10_000) return `${(val / 1_000).toFixed(1)}K`;
        return val.toLocaleString('pt-BR');
    }
  };

  const sparklineData = generateSparklineData(displayValue);

  // Accent color based on format
  const accentColor = format === 'currency'
    ? 'hsl(var(--chart-1))'
    : format === 'percentage'
    ? 'hsl(var(--chart-3))'
    : 'hsl(var(--chart-2))';

  return (
    <Card className="relative overflow-hidden rounded-xl h-full flex flex-col bg-card/80 backdrop-blur-sm border-border/50 hover:border-border/80 transition-all duration-300 group">
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] opacity-80 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}80)` }}
      />

      <div className="p-4 pb-0 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
              {title}
            </h3>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3 h-3 text-muted-foreground/30 hover:text-muted-foreground cursor-help shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          {percentChange !== null && (
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] px-1.5 py-0.5 shrink-0 font-medium border",
                isPositive && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                isNegative && "bg-red-500/10 text-red-500 border-red-500/20",
                !isPositive && !isNegative && "bg-muted text-muted-foreground border-border"
              )}
            >
              {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> :
               isNegative ? <TrendingDown className="w-3 h-3 mr-0.5" /> :
               <Minus className="w-3 h-3 mr-0.5" />}
              {isPositive ? '+' : ''}{percentChange.toFixed(1)}%
            </Badge>
          )}
        </div>

        <div className="mt-2">
          <p className="text-2xl font-bold text-foreground tracking-tight leading-none">
            {hasValue ? formatDisplayValue(displayValue) : '-'}
          </p>
          {hasValue && metricLabel && (
            <p className="text-[11px] text-muted-foreground/70 mt-1 font-medium">
              {metricLabel}
            </p>
          )}
        </div>
      </div>

      {/* Sparkline */}
      {showSparkline && hasValue && (
        <div className="flex-1 flex flex-col justify-end px-1 pb-1 mt-2">
          <div className="h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id={`spark-${title.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accentColor} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={accentColor}
                  strokeWidth={1.5}
                  fill={`url(#spark-${title.replace(/\W/g, '')})`}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
};

export default MetricCard;
