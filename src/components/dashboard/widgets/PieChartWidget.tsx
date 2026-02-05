import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Loader2, Database } from 'lucide-react';
import {
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { cn } from '@/lib/utils';

interface PieChartWidgetProps {
  title: string;
  description: string;
  data?: Array<{ name: string; value: number; color?: string }>;
  isDonut?: boolean;
  isLoading?: boolean;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const PieChartWidget = ({ 
  title, 
  description, 
  data = [],
  isDonut = false,
  isLoading = false
}: PieChartWidgetProps) => {
  const hasRealData = data.length > 0;
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color || CHART_COLORS[0] }}
            />
            <span className="font-medium text-foreground">{item.name}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {item.value.toLocaleString('pt-BR')} ({percentage}%)
          </div>
        </div>
      );
    }
    return null;
  };

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
          <div className="h-[200px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sem dados disponíveis</p>
              <p className="text-xs mt-1">Configure a fonte de dados</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-[200px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={isDonut ? 50 : 0}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    animationDuration={800}
                    animationEasing="ease-out"
                    animationBegin={100}
                  >
                    {data.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} 
                        strokeWidth={0} 
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {isDonut && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{total.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {data.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.color || CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                  <span className="text-xs font-medium text-foreground ml-auto">
                    {total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PieChartWidget;
