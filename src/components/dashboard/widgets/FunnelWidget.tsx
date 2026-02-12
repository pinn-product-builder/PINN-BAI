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

const FUNNEL_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

// Prettify stage names
const prettifyStage = (raw: string): string => {
  if (!raw || raw === 'null' || raw === 'undefined') return 'Outros';
  if (/^[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ]/.test(raw) && raw.includes(' ')) return raw;
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
};

const FunnelWidget = ({
  title,
  description,
  data = [],
  isLoading = false,
}: FunnelWidgetProps) => {
  // Prettify stage names and filter zero values
  const cleanData = data.filter(d => d.value > 0).map(d => ({ ...d, stage: prettifyStage(d.stage) }));
  const hasRealData = cleanData.length > 0;
  const maxValue = hasRealData ? Math.max(...cleanData.map((d) => d.value)) : 0;
  const firstValue = hasRealData ? cleanData[0].value : 0;
  const lastValue = hasRealData ? cleanData[cleanData.length - 1].value : 0;
  const totalConversion =
    firstValue > 0 ? ((lastValue / firstValue) * 100).toFixed(1) : '0.0';

  if (isLoading) {
    return (
      <Card className="rounded-xl h-full flex items-center justify-center min-h-[350px] bg-card/80 backdrop-blur-sm border-border/50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Carregando...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('rounded-xl bg-card/80 backdrop-blur-sm border-border/50', !hasRealData && 'opacity-60')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
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
            {hasRealData && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Funil atual por etapas
              </p>
            )}
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
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {cleanData.length === 1 && (
              <div className="text-center py-4 space-y-3">
                <p className="text-3xl font-bold text-foreground tabular-nums">{cleanData[0].value.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">{cleanData[0].stage}</p>
                <div className="w-full h-3 rounded-full bg-muted/40 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: FUNNEL_COLORS[0] }} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Configure uma view de funil com múltiplos estágios para ver a conversão
                </p>
              </div>
            )}
            {cleanData.length > 1 && cleanData.map((item, index) => {
              const widthPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
              const prevValue = index > 0 ? cleanData[index - 1].value : item.value;
              const conversionRate =
                prevValue > 0 ? ((item.value / prevValue) * 100).toFixed(0) : '100';
              const color = item.color || FUNNEL_COLORS[index % FUNNEL_COLORS.length];

              return (
                <div
                  key={item.stage}
                  className="group"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {/* Stage row: label — bar — count */}
                  <div className="flex items-center gap-3">
                    {/* Stage name */}
                    <div className="w-24 shrink-0">
                      <span className="text-xs font-medium text-foreground truncate block">
                        {item.stage}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 relative h-7 rounded-md overflow-hidden bg-muted/30">
                      <div
                        className={cn(
                          'h-full rounded-md transition-all duration-700 ease-out relative',
                          'before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/0 before:via-white/5 before:to-white/0',
                        )}
                        style={{
                          width: `${Math.max(widthPercent, 4)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>

                    {/* Value + conversion */}
                    <div className="w-16 shrink-0 text-right">
                      <span className="text-sm font-bold text-foreground tabular-nums">
                        {item.value.toLocaleString('pt-BR')}
                      </span>
                      {index > 0 && (
                        <span className="block text-[10px] text-muted-foreground tabular-nums">
                          {conversionRate}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Conversion summary */}
            {cleanData.length > 1 && (
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Conversão Total</span>
                <span className="text-base font-bold text-foreground tabular-nums">
                  {totalConversion}%
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FunnelWidget;
