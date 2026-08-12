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
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useTheme } from '@mui/material/styles';
import { getChartSeriesColors, chartGridColor } from '@/theme/chartColors';

interface AreaChartWidgetProps {
  title: string;
  description: string;
  data?: Array<{ label: string; [key: string]: unknown }>;
  xAxisKey?: string;
  dataKeys?: string[];
  seriesLabels?: Record<string, string>;
  /** Cor por série vinda do config do widget (DB) — sobrepõe o mapa/paleta default. */
  seriesColors?: Record<string, string>;
  isLoading?: boolean;
}

// Paleta estendida para séries não mapeadas — derivada do DS oficial Pinn v1.0
// Ordem: orange → success → info → warning → error → graphite + variações safe
const EXTENDED_COLORS = [
  '#FF6B35', '#2E7D32', '#2563EB', '#F57C00', '#C62828',
  '#555555', '#E55A2B', '#0EA5A4', '#7C3AED', '#06B6D4',
];

// Cor de série: override do banco/config (seriesColors — p/ ETAPAS vem de
// vw_org_stage_presentation.color via a RPC canônica) tem prioridade; senão,
// paleta determinística por índice. Sem cor de etapa hardcoded por cliente.
const getSeriesColorFn =
  (overrides: Record<string, string>, paletteFallback: string[]) =>
  (key: string, index: number) => {
    if (overrides[key]) return overrides[key];
    return paletteFallback[index % paletteFallback.length] ?? EXTENDED_COLORS[index % EXTENDED_COLORS.length];
  };

const DEFAULT_LABEL_MAP: Record<string, string> = {
  value: 'Valor',
  value2: 'Valor 2',
  total: 'Total',
  leads: 'Leads',
  new_leads: 'Novos Leads',
  leads_new: 'Novos Leads',
  leads_total: 'Total de Leads',
  revenue: 'Receita',
  conversions: 'Conversões',
  messages: 'Mensagens',
  msg_in: 'Mensagens',
  meetings_scheduled: 'Reuniões Agendadas',
  meetings_booked: 'Reuniões Agendadas',
  meetings_done: 'Reuniões Realizadas',
  spend: 'Investimento',
  calls_done: 'Ligações',
  cpl: 'CPL',
  // Nomes de ETAPA não são hardcoded aqui: chegam via seriesLabels
  // (vw_org_stage_presentation, RPC canônica) ou config do widget.
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

const AreaChartWidget = ({
  title,
  description,
  data = [],
  xAxisKey = 'label',
  dataKeys = ['value'],
  seriesLabels,
  seriesColors,
  isLoading = false,
}: AreaChartWidgetProps) => {
  const theme = useTheme();
  const paletteSeries = getChartSeriesColors(theme);
  const getSeriesColor = getSeriesColorFn(seriesColors || {}, paletteSeries);
  const hasRealData = data.length > 0;
  const LABEL_MAP = { ...DEFAULT_LABEL_MAP, ...(seriesLabels || {}) };
  const CustomTooltip = createCustomTooltip(LABEL_MAP);
  const gridStroke = chartGridColor(theme);
  const tickColor = theme.palette.text.secondary;
  const bgPaper = theme.palette.background.paper;

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

  // Legenda dinâmica: como o widget pode ser estreito (4-col ≈ 320px) e
  // legendas com PT-BR ("Reunião Confirmada") são longas, assumimos ~2 séries
  // por linha pra reservar altura suficiente sem truncar. Bug reportado em
  // BF Company: linha "Reunião Confirmada · Reunião Realizada · Venda"
  // saindo cortada por baixo com height=28 fixo.
  const legendHeight = dataKeys.length > 1 ? Math.max(32, Math.ceil(dataKeys.length / 2) * 24) : 0;

  return (
    <Card className={cn('rounded-xl bg-card/80 backdrop-blur-sm border-border/50 h-full flex flex-col', !hasRealData && 'opacity-60')}>
      <CardHeader className="pb-1 shrink-0">
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
      <CardContent className="pt-2 flex-1 flex flex-col min-h-0">
        {!hasRealData ? (
          <div className="flex-1 min-h-[200px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sem dados disponíveis</p>
              <p className="text-xs mt-1 text-muted-foreground/60">Configure a fonte de dados</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  {dataKeys.map((key, index) => (
                    <linearGradient key={key} id={`area-grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={getSeriesColor(key, index)} stopOpacity={0.25} />
                      <stop offset="90%" stopColor={getSeriesColor(key, index)} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
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
                    height={legendHeight}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingTop: 6, lineHeight: '20px' }}
                    formatter={(val: string) => (
                      <span className="text-xs text-muted-foreground ml-1">{LABEL_MAP[val] || val}</span>
                    )}
                  />
                )}
                {dataKeys.map((key, index) => (
                  <Area
                    key={key}
                    type="linear"
                    dataKey={key}
                    name={key}
                    stroke={getSeriesColor(key, index)}
                    strokeWidth={2}
                    fill={`url(#area-grad-${key})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: bgPaper }}
                    animationDuration={1000}
                    animationEasing="ease-out"
                    animationBegin={index * 150}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AreaChartWidget;
