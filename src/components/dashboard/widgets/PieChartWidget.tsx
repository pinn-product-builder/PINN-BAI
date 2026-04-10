import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Loader2, Database } from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import {
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { getChartSeriesColors } from '@/theme/chartColors';
import { cn } from '@/lib/utils';

interface PieChartWidgetProps {
  title: string;
  description: string;
  data?: Array<{ name: string; value: number; color?: string }>;
  isDonut?: boolean;
  isLoading?: boolean;
}

// Prettify label names
const prettifyLabel = (raw: string): string => {
  if (!raw || raw === 'Outros' || raw === 'null' || raw === 'undefined') return 'Outros';
  // Already looks good
  if (/^[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ]/.test(raw) && raw.includes(' ')) return raw;
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
};

const PieChartWidget = ({
  title,
  description,
  data = [],
  isDonut = true,
  isLoading = false,
}: PieChartWidgetProps) => {
  const theme = useTheme();
  const chartColors = getChartSeriesColors(theme);
  // Prettify all labels
  const cleanData = data.map(d => ({ ...d, name: prettifyLabel(d.name) }));
  // Filter out zero values and merge tiny slices
  const filteredData = cleanData.filter(d => d.value > 0);
  const hasRealData = filteredData.length > 0;
  const total = filteredData.reduce((sum, item) => sum + item.value, 0);
  const hasMultipleSlices = filteredData.length > 1;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-popover/95 backdrop-blur-md border border-border/60 rounded-lg shadow-xl p-3 min-w-[120px]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color || chartColors[0] }} />
            <span className="text-xs font-semibold text-foreground">{item.name}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{item.value.toLocaleString('pt-BR')}</span>
            <span className="ml-1">({percentage}%)</span>
          </div>
        </div>
      );
    }
    return null;
  };

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
      <CardHeader className="pb-1">
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
          </div>
          {!hasRealData && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Sem dados</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasRealData ? (
          <div className="h-[220px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sem dados disponíveis</p>
            </div>
          </div>
        ) : !hasMultipleSlices ? (
          /* Fallback: quando só 1 categoria — mostrar como stat card */
          <div className="py-4 space-y-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground tabular-nums">{total.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-muted-foreground mt-1">{filteredData[0]?.name || 'Total'}</p>
            </div>
            <div className="w-full h-3 rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: '100%', backgroundColor: chartColors[0] }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Configure mais campos de origem para ver a distribuição completa
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {/* Chart */}
            <div className="h-[200px] flex-1 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredData}
                    cx="50%"
                    cy="50%"
                    innerRadius={isDonut ? 55 : 0}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {filteredData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {isDonut && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-xl font-bold text-foreground tabular-nums">{total.toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</p>
                  </div>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="space-y-2 shrink-0 min-w-[100px]">
              {filteredData.slice(0, 8).map((item, index) => {
                const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
                return (
                  <div key={item.name} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: item.color || chartColors[index % chartColors.length] }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-muted-foreground truncate block">{item.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-foreground tabular-nums">{pct}%</span>
                  </div>
                );
              })}
              {filteredData.length > 8 && (
                <p className="text-[10px] text-muted-foreground">+{filteredData.length - 8} mais</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PieChartWidget;
