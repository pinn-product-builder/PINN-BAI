import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Loader2, Database } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

interface BarChartWidgetProps {
  title: string;
  description: string;
  data?: Array<{ label: string; value: number; color?: string }>;
  isLoading?: boolean;
}

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
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Valor:</span>
          <span className="font-medium text-foreground">
            {typeof payload[0].value === 'number'
              ? payload[0].value.toLocaleString('pt-BR')
              : payload[0].value
            }
          </span>
        </div>
      </div>
    );
  }
  return null;
};

const BarChartWidget = ({ 
  title, 
  description,
  data = [],
  isLoading = false
}: BarChartWidgetProps) => {
  const hasRealData = data.length > 0;

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
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  width={80}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar 
                  dataKey="value" 
                  radius={[0, 4, 4, 0]} 
                  barSize={24}
                  animationDuration={800}
                  animationEasing="ease-out"
                  animationBegin={100}
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BarChartWidget;
