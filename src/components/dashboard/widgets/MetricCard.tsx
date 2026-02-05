import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  metricLabel?: string; // Label da métrica (ex: "total_leads", "revenue")
}

// Generate mock sparkline data
const generateSparklineData = (baseValue: number) => {
  return Array.from({ length: 7 }, (_, i) => ({
    day: i,
    value: baseValue * (0.8 + Math.random() * 0.4),
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
      <Card className="overflow-hidden h-full flex items-center justify-center min-h-[120px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Carregando...</span>
        </div>
      </Card>
    );
  }

  const hasValue = value !== undefined;
  const displayValue = value ?? 0;
  const percentChange = previousValue && displayValue
    ? ((displayValue - previousValue) / previousValue) * 100
    : 0;

  const isPositive = percentChange > 0;
  const isNeutral = percentChange === 0;

  const formatDisplayValue = (val: number): string => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      default:
        return val.toLocaleString('pt-BR');
    }
  };

  const sparklineData = generateSparklineData(displayValue);

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{description}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-foreground tracking-tight">
                {hasValue ? formatDisplayValue(displayValue) : '-'}
              </p>
              {hasValue && (
                <span className="text-xs text-muted-foreground font-medium">
                  {format === 'currency' ? 'BRL' : format === 'percentage' ? '%' : ''}
                </span>
              )}
            </div>
            {hasValue && metricLabel && (
              <p className="text-xs text-muted-foreground font-medium">
                {value} {metricLabel}
              </p>
            )}
            {hasValue && !metricLabel && description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {description}
              </p>
            )}
          </div>
          
          {previousValue !== undefined && (
            <Badge
              variant="secondary"
              className={cn(
                "font-medium shrink-0",
                isPositive && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                !isPositive && !isNeutral && "bg-red-500/10 text-red-600 border-red-500/20",
                isNeutral && "bg-muted text-muted-foreground"
              )}
            >
              {isPositive ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : isNeutral ? (
                <Minus className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {isPositive ? '+' : ''}{percentChange.toFixed(1)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      
      {showSparkline && hasValue && (
        <CardContent className="pt-0 pb-3 flex-1 flex flex-col justify-end">
          <div className="h-12 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id={`gradient-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop 
                      offset="0%" 
                      stopColor={isPositive ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'} 
                      stopOpacity={0.3} 
                    />
                    <stop 
                      offset="100%" 
                      stopColor={isPositive ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'} 
                      stopOpacity={0} 
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isPositive ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'}
                  strokeWidth={1.5}
                  fill={`url(#gradient-${title.replace(/\s/g, '')})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {previousValue !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              vs. período anterior: {formatDisplayValue(previousValue)}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default MetricCard;
