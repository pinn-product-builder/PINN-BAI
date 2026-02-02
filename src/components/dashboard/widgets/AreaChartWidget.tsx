import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface AreaChartWidgetProps {
  title: string;
  description: string;
}

// Mock data for chart
const mockData = [
  { month: 'Jan', leads: 180, conversions: 22 },
  { month: 'Fev', leads: 220, conversions: 28 },
  { month: 'Mar', leads: 195, conversions: 24 },
  { month: 'Abr', leads: 310, conversions: 38 },
  { month: 'Mai', leads: 280, conversions: 35 },
  { month: 'Jun', leads: 365, conversions: 45 },
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
              {entry.value.toLocaleString('pt-BR')}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const AreaChartWidget = ({ title, description }: AreaChartWidgetProps) => {
  return (
    <Card>
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockData}>
              <defs>
                <linearGradient id="gradientLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradientConversions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
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
              <Area
                type="monotone"
                dataKey="leads"
                name="Leads"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#gradientLeads)"
              />
              <Area
                type="monotone"
                dataKey="conversions"
                name="Conversões"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                fill="url(#gradientConversions)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-1))]" />
            <span className="text-sm text-muted-foreground">Leads</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-2))]" />
            <span className="text-sm text-muted-foreground">Conversões</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AreaChartWidget;
