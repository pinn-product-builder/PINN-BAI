import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Loader2, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FunnelWidgetProps {
  title: string;
  description: string;
  data?: Array<{ stage: string; value: number; color?: string }>;
  isLoading?: boolean;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const FunnelWidget = ({ 
  title, 
  description,
  data = [],
  isLoading = false
}: FunnelWidgetProps) => {
  const hasRealData = data.length > 0;
  const maxValue = hasRealData ? Math.max(...data.map(d => d.value)) : 0;
  const firstValue = hasRealData ? data[0].value : 0;
  const lastValue = hasRealData ? data[data.length - 1].value : 0;
  const totalConversion = firstValue > 0 ? ((lastValue / firstValue) * 100).toFixed(2) : '0.00';

  if (isLoading) {
    return (
      <Card className="h-full flex items-center justify-center min-h-[350px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Carregando dados...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(!hasRealData && 'opacity-60')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
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
          {!hasRealData && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              Sem dados
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasRealData ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sem dados disponíveis</p>
              <p className="text-xs mt-1">Configure a fonte de dados</p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {data.map((item, index) => {
                const widthPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                const prevValue = index > 0 ? data[index - 1].value : item.value;
                const conversionRate = prevValue > 0 
                  ? ((item.value / prevValue) * 100).toFixed(1) 
                  : '100';
                const color = item.color || CHART_COLORS[index % CHART_COLORS.length];

                return (
                  <div 
                    key={item.stage} 
                    className="group animate-fade-up"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-foreground">{item.stage}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-semibold">
                          {item.value.toLocaleString('pt-BR')}
                        </span>
                        {index > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({conversionRate}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="relative h-8 flex items-center">
                      {/* Background bar */}
                      <div className="absolute inset-0 bg-muted/50 rounded" />
                      {/* Funnel bar */}
                      <div
                        className={cn(
                          "h-full rounded transition-all duration-700 relative overflow-hidden",
                          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/0 before:via-white/10 before:to-white/0"
                        )}
                        style={{
                          width: `${widthPercent}%`,
                          backgroundColor: color,
                          marginLeft: `${(100 - widthPercent) / 2}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Conversion summary */}
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Conversão Total</span>
              <span className="text-lg font-bold text-foreground">
                {totalConversion}%
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FunnelWidget;
