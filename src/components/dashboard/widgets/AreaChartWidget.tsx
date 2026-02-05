import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Loader2, Database } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

interface AreaChartWidgetProps {
  title: string;
  description: string;
  data?: Array<{ label: string; [key: string]: unknown }>;
  xAxisKey?: string;
  dataKeys?: string[];
  isLoading?: boolean;
}

// Placeholder data when no real data is available
const placeholderData = [
  { label: 'Jan', value: 0, value2: 0 },
  { label: 'Fev', value: 0, value2: 0 },
  { label: 'Mar', value: 0, value2: 0 },
  { label: 'Abr', value: 0, value2: 0 },
  { label: 'Mai', value: 0, value2: 0 },
  { label: 'Jun', value: 0, value2: 0 },
];

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3">
        <p className="font-medium text-foreground mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground">
              {typeof entry.value === 'number' 
                ? entry.value.toLocaleString('pt-BR')
                : entry.value
              }
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const AreaChartWidget = ({ 
  title, 
  description,
  data = [],
  xAxisKey = 'label',
  dataKeys = ['value'],
  isLoading = false
}: AreaChartWidgetProps) => {
  const hasRealData = data.length > 0;
  const chartData = hasRealData ? data : placeholderData;

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
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    {dataKeys.map((key, index) => (
                      <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey={xAxisKey}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    width={40}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />
                  {dataKeys.map((key, index) => (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={key}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2}
                      fill={`url(#gradient-${key})`}
                      animationDuration={1000}
                      animationEasing="ease-out"
                      animationBegin={index * 200}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              {dataKeys.map((key, index) => (
                <div key={key} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span className="text-sm text-muted-foreground capitalize">{key}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AreaChartWidget;
