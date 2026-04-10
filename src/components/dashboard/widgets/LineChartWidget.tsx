import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Loader2, Database } from 'lucide-react';
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useTheme } from '@mui/material/styles';
import { getChartSeriesColors, chartGridColor } from '@/theme/chartColors';

interface LineChartWidgetProps {
  title: string;
  description: string;
  data?: Array<{ label: string; [key: string]: unknown }>;
  dataKeys?: string[];
  xAxisKey?: string;
  seriesLabels?: Record<string, string>;
  isLoading?: boolean;
}

const DEFAULT_LABEL_MAP: Record<string, string> = {
  value: 'Valor',
  total: 'Total',
  leads: 'Leads',
  new_leads: 'Novos Leads',
  revenue: 'Receita',
  conversions: 'Conversões',
  messages: 'Mensagens',
  msg_in: 'Mensagens',
  meetings_scheduled: 'Reuniões Agendadas',
  meetings_done: 'Reuniões Realizadas',
  spend: 'Investimento',
  calls_done: 'Ligações',
  status: 'Status',
  // Campos Kommo
  hermes_entrada: 'Entrada',
  hermes_encaminhado: 'Encaminhado',
  encaminhado: 'Encaminhado',
  atendimento_feito: 'Atendimento Feito',
  reuniao_confirmada: 'Reunião Confirmada',
  reuniao_realizada: 'Reunião Realizada',
  venda: 'Venda',
  desqualificado: 'Desqualificado',
};

const createCustomTooltip = (labelMap: Record<string, string>) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover/95 backdrop-blur-md border border-border/60 rounded-lg shadow-xl p-3 min-w-[160px]">
          <p className="text-xs font-semibold text-foreground mb-2 border-b border-border/40 pb-1.5">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-xs py-0.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-muted-foreground">{labelMap[entry.name] || entry.name}</span>
              </div>
              <span className="font-semibold text-foreground tabular-nums">
                {typeof entry.value === 'number' ? entry.value.toLocaleString('pt-BR') : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };
  return CustomTooltip;
};

const LineChartWidget = ({
  title,
  description,
  data = [],
  dataKeys = ['value'],
  xAxisKey = 'label',
  seriesLabels,
  isLoading = false,
}: LineChartWidgetProps) => {
  const theme = useTheme();
  const chartColors = getChartSeriesColors(theme);
  const gridStroke = chartGridColor(theme);
  const tickColor = theme.palette.text.secondary;
  const bgPaper = theme.palette.background.paper;
  const hasRealData = data.length > 0;
  const LABEL_MAP = { ...DEFAULT_LABEL_MAP, ...(seriesLabels || {}) };
  const CustomTooltip = createCustomTooltip(LABEL_MAP);

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
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.9} vertical={false} />
                <XAxis
                  dataKey={xAxisKey}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: tickColor }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: tickColor }}
                  width={45}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: gridStroke, strokeWidth: 1 }} />
                {dataKeys.length > 1 && (
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    iconType="line"
                    iconSize={14}
                    formatter={(val: string) => (
                      <span className="text-xs text-muted-foreground ml-1">{LABEL_MAP[val] || val}</span>
                    )}
                  />
                )}
                {dataKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key}
                    stroke={chartColors[index % chartColors.length]}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: bgPaper }}
                    animationDuration={1200}
                    animationEasing="ease-out"
                    animationBegin={index * 200}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LineChartWidget;
