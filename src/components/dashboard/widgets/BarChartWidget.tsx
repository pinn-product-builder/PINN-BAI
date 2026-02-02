import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
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

interface BarChartWidgetProps {
  title: string;
  description: string;
}

// Mock data for chart
const mockData = [
  { source: 'Google Ads', leads: 890, color: 'hsl(var(--chart-1))' },
  { source: 'LinkedIn', leads: 650, color: 'hsl(var(--chart-2))' },
  { source: 'Referral', leads: 420, color: 'hsl(var(--chart-3))' },
  { source: 'Organic', leads: 320, color: 'hsl(var(--chart-4))' },
  { source: 'Email', leads: 170, color: 'hsl(var(--chart-5))' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3">
        <p className="font-medium text-foreground mb-1">{label}</p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Leads:</span>
          <span className="font-medium text-foreground">
            {payload[0].value.toLocaleString('pt-BR')}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

const BarChartWidget = ({ title, description }: BarChartWidgetProps) => {
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
            <BarChart data={mockData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                type="category"
                dataKey="source"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                width={80}
              />
              <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Bar dataKey="leads" radius={[0, 4, 4, 0]} barSize={24}>
                {mockData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default BarChartWidget;
