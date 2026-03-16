import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, Info, Loader2, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
  title: string;
  description: string;
  value?: number;
  previousValue?: number;
  format?: 'number' | 'currency' | 'percentage';
  showSparkline?: boolean;
  isLoading?: boolean;
  metricLabel?: string;
}

const generateSparklineData = (baseValue: number) => {
  const points = 14;
  return Array.from({ length: points }, (_, i) => ({
    day: i,
    value: Math.max(0, baseValue * (0.65 + Math.sin(i / 1.8) * 0.2 + Math.random() * 0.25)),
  }));
};

const TITLE_MAP: Record<string, string> = {
  total_leads: 'Total de Leads',
  new_leads: 'Novos Leads',
  leads_new: 'Novos Leads',
  mensagens: 'Mensagens',
  msg_in: 'Mensagens Recebidas',
  msg_in_30d: 'Mensagens (30d)',
  reunioes_agendadas: 'Reuniões Agendadas',
  meetings_booked: 'Reuniões Agendadas',
  meetings_booked_30d: 'Reuniões Agendadas',
  reunioes_realizadas: 'Reuniões Realizadas',
  meetings_done: 'Reuniões Realizadas',
  meetings_done_30d: 'Reuniões Realizadas',
  investimento: 'Investimento',
  spend: 'Investimento',
  spend_30d: 'Investimento (30d)',
  cpl: 'Custo por Lead',
  cpl_30d: 'CPL (30d)',
  cpm: 'Custo por Reunião',
  cp_meeting_booked_30d: 'Custo por Reunião',
  conversion_rate: 'Taxa de Conversão',
  conv_lead_to_meeting_30d: 'Conv. Lead → Reunião',
  calls_done: 'Ligações Realizadas',
};

const prettifyTitle = (raw: string): string => {
  const lower = raw.toLowerCase().trim();
  if (TITLE_MAP[lower]) return TITLE_MAP[lower];
  const noSuffix = lower.replace(/_\d+d$/, '');
  if (TITLE_MAP[noSuffix]) return TITLE_MAP[noSuffix];
  if (/^[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ]/.test(raw) && raw.includes(' ')) return raw;
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\s+/g, ' ').trim();
};

/* Acento visual por tipo — contraste bom em light E dark:
   currency  → orange #FF6900 (primary Pinn)
   percentage → verde #16a34a (bom contraste nos dois modos)
   number     → amber #d97706 (mais escuro que FCB900 — legível no branco)
*/
const ACCENT: Record<string, { line: string; stop: string }> = {
  currency:   { line: '#FF6900', stop: 'rgba(255,105,0,0.12)' },
  percentage: { line: '#16a34a', stop: 'rgba(22,163,74,0.10)' },
  number:     { line: '#d97706', stop: 'rgba(217,119,6,0.10)' },
};

const MetricCard = ({
  title,
  description,
  value,
  previousValue,
  format = 'number',
  showSparkline = true,
  isLoading = false,
  metricLabel,
}: MetricCardProps) => {
  const displayTitle = prettifyTitle(title);
  const accent = ACCENT[format] ?? ACCENT.number;

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden rounded-xl h-full flex items-center justify-center min-h-[140px] bg-card/70 border-border/40">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: accent.line }} />
          <span className="text-[11px] text-muted-foreground">Carregando...</span>
        </div>
      </Card>
    );
  }

  if (value === undefined) {
    return (
      <Card className="relative overflow-hidden rounded-xl h-full flex items-center justify-center min-h-[140px] border-border/25 bg-card/40">
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <Database className="w-4 h-4 text-muted-foreground/30" />
          <span className="text-[11px] text-muted-foreground/50">Sem dados</span>
        </div>
      </Card>
    );
  }

  const percentChange = previousValue && value
    ? ((value - previousValue) / previousValue) * 100
    : null;
  const isPositive = percentChange !== null && percentChange > 0;
  const isNegative = percentChange !== null && percentChange < 0;

  const formatValue = (v: number): string => {
    switch (format) {
      case 'currency':
        if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v);
      case 'percentage':
        return `${v.toFixed(1)}%`;
      default:
        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`;
        return v.toLocaleString('pt-BR');
    }
  };

  const sparkData = generateSparklineData(value);

  return (
    <Card
      className="relative overflow-hidden rounded-xl h-full flex flex-col bg-card/80 backdrop-blur-sm border-border/40 hover:border-border/70 transition-all duration-300 group"
      style={{ minHeight: 140 }}
    >
      {/* Top accent bar — thin, full-width */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accent.line}, ${accent.line}40)` }}
      />

      <div className="p-4 pb-2 flex-shrink-0">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
              {displayTitle}
            </h3>
            {description && (
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground/25 hover:text-muted-foreground/60 cursor-help shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{description}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Trend badge */}
          {percentChange !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0',
                isPositive && 'text-emerald-400',
                isNegative && 'text-red-400',
                !isPositive && !isNegative && 'text-muted-foreground'
              )}
              style={{
                background: isPositive ? 'rgba(34,197,94,0.10)'
                  : isNegative ? 'rgba(239,68,68,0.10)'
                  : 'rgba(255,255,255,0.05)',
              }}
            >
              {isPositive ? <TrendingUp className="w-3 h-3" />
                : isNegative ? <TrendingDown className="w-3 h-3" />
                : <Minus className="w-3 h-3" />}
              {isPositive ? '+' : ''}{percentChange.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Value */}
        <div className="mt-2">
          <p
            className="text-[1.7rem] font-bold leading-none tracking-tight text-foreground"
            style={{ fontFamily: "'Poppins', system-ui, sans-serif" }}
          >
            {formatValue(value)}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1 font-medium uppercase tracking-wider">
            {metricLabel || 'Últimos 30 dias'}
          </p>
        </div>
      </div>

      {/* Sparkline */}
      {showSparkline && (
        <div className="flex-1 flex flex-col justify-end px-0 pb-0 mt-1">
          <div className="h-[52px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`sg-${format}-${title.replace(/\W/g,'')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent.line} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={accent.line} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={accent.line}
                  strokeWidth={1.5}
                  fill={`url(#sg-${format}-${title.replace(/\W/g,'')})`}
                  dot={false}
                  isAnimationActive
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
};

export default MetricCard;
