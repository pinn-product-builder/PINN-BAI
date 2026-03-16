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
      <div className="bg-popover/95 backdrop-blur-md border border-border/60 rounded-lg shadow-xl p-3 min-w-[120px]">
        <p className="text-xs font-semibold text-foreground mb-1.5">{label}</p>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].color || CHART_COLORS[0] }} />
          <span className="font-semibold text-foreground tabular-nums">
            {typeof payload[0].value === 'number' ? payload[0].value.toLocaleString('pt-BR') : payload[0].value}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Prettify bar labels
const prettifyLabel = (raw: string): string => {
  if (!raw || raw === 'null' || raw === 'undefined' || raw === 'Outros') return 'Outros';
  if (/^[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ]/.test(raw) && raw.includes(' ')) return raw;
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
};

const BarChartWidget = ({
  title,
  description,
  data = [],
  isLoading = false,
}: BarChartWidgetProps) => {
  // Clean data: prettify labels, filter zero
  const cleanData = data.filter(d => d.value > 0).map(d => ({ ...d, label: prettifyLabel(d.label) }));
  const hasRealData = cleanData.length > 0;

  if (isLoading) {
    return (
      <Card className="rounded-xl h-full flex items-center justify-center min-h-[350px] bg-card/80 backdrop-blur-sm border-border/50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Carregando dados...</span>
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
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {!hasRealData && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Sem dados</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {!hasRealData ? (
          <div className="h-[260px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sem dados disponíveis</p>
              <p className="text-xs mt-1 text-muted-foreground/60">Configure a fonte de dados</p>
            </div>
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cleanData} layout="vertical" margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  width={100}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22} animationDuration={800} animationEasing="ease-out">
                  {cleanData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
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
