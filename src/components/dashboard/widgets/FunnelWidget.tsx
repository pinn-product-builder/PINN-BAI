import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FunnelWidgetProps {
  title: string;
  description: string;
}

// Mock funnel data
const mockFunnelData = [
  { stage: 'Visitantes', value: 10000, color: 'hsl(var(--chart-1))' },
  { stage: 'Leads', value: 2450, color: 'hsl(var(--chart-2))' },
  { stage: 'Oportunidades', value: 890, color: 'hsl(var(--chart-3))' },
  { stage: 'Propostas', value: 320, color: 'hsl(var(--chart-4))' },
  { stage: 'Clientes', value: 156, color: 'hsl(var(--chart-5))' },
];

const maxValue = mockFunnelData[0].value;

const FunnelWidget = ({ title, description }: FunnelWidgetProps) => {
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
        <div className="space-y-3">
          {mockFunnelData.map((item, index) => {
            const widthPercent = (item.value / maxValue) * 100;
            const prevValue = index > 0 ? mockFunnelData[index - 1].value : item.value;
            const conversionRate = index > 0 ? ((item.value / prevValue) * 100).toFixed(1) : '100';

            return (
              <div key={item.stage} className="group">
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
                      "h-full rounded transition-all duration-500 relative overflow-hidden",
                      "before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/0 before:via-white/10 before:to-white/0"
                    )}
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: item.color,
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
            {((mockFunnelData[mockFunnelData.length - 1].value / mockFunnelData[0].value) * 100).toFixed(2)}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default FunnelWidget;
