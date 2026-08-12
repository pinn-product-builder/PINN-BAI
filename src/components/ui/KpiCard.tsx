import { cn } from '@/lib/utils';

export type KpiFormat = 'number' | 'currency' | 'percent';

export interface KpiCardProps {
  title: string;
  value: number | string;
  previousValue?: number;
  format?: KpiFormat;
  /** Inverte a cor da seta: queda = verde (bom). Ex: churn rate, custo. */
  isInverse?: boolean;
  /** Texto do período anterior. Ex: "vs. março 2026" */
  periodLabel?: string;
  isLoading?: boolean;
  className?: string;
}

// ─── Formatação pt-BR ──────────────────────────────────────────────────────────

const fmtNumber = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const fmtCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const fmtDelta = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'always',
});

function formatValue(value: number | string, fmt: KpiFormat = 'number'): string {
  if (typeof value === 'string') return value;
  switch (fmt) {
    case 'currency':
      return fmtCurrency.format(value);
    case 'percent':
      return `${new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value)}%`;
    default:
      return fmtNumber.format(value);
  }
}

// ─── Delta ─────────────────────────────────────────────────────────────────────

interface DeltaInfo {
  pct: number;
  isPositive: boolean;
  isNeutral: boolean;
  label: string;
}

function computeDelta(
  current: number,
  previous: number,
): DeltaInfo | null {
  if (previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(pct * 10) / 10; // 1 casa decimal
  return {
    pct: rounded,
    isPositive: rounded > 0,
    isNeutral: rounded === 0,
    label: `${fmtDelta.format(rounded)}%`,
  };
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded bg-muted/40', className)} />
  );
}

// ─── Componente ────────────────────────────────────────────────────────────────

export function KpiCard({
  title,
  value,
  previousValue,
  format: fmt = 'number',
  isInverse = false,
  periodLabel,
  isLoading = false,
  className,
}: KpiCardProps) {
  const delta =
    typeof value === 'number' && previousValue !== undefined
      ? computeDelta(value, previousValue)
      : null;

  // neutro quando delta === 0; verde/vermelho dependendo de isInverse
  const deltaColor: 'green' | 'red' | 'neutral' | null = delta
    ? delta.isNeutral
      ? 'neutral'
      : (isInverse ? !delta.isPositive : delta.isPositive)
        ? 'green'
        : 'red'
    : null;

  return (
    <div
      className={cn(
        'rounded-xl border border-border/40 bg-card px-5 py-4 flex flex-col gap-1.5',
        className,
      )}
    >
      {/* Título */}
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
        {title}
      </span>

      {/* Valor principal */}
      {isLoading ? (
        <Skeleton className="h-8 w-28 mt-1" />
      ) : (
        <span
          className="text-2xl font-bold text-foreground leading-none tracking-tight"
          style={{ fontFamily: "'Poppins', system-ui, sans-serif" }}
        >
          {formatValue(value, fmt)}
        </span>
      )}

      {/* Delta + label do período */}
      {isLoading ? (
        <Skeleton className="h-4 w-24" />
      ) : delta ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Seta + porcentagem */}
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-semibold',
              deltaColor === 'green'   && 'text-emerald-500',
              deltaColor === 'red'     && 'text-red-500',
              deltaColor === 'neutral' && 'text-muted-foreground',
            )}
          >
            {delta.isNeutral ? (
              /* traço horizontal para delta zero */
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
                <rect x="1" y="5.5" width="10" height="1.5" rx="0.75" />
              </svg>
            ) : delta.isPositive ? (
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 1l4.5 7H1.5L6 1z" />
              </svg>
            ) : (
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 11L1.5 4h9L6 11z" />
              </svg>
            )}
            {delta.label}
          </span>

          {/* Label do período anterior */}
          {periodLabel && (
            <span className="text-[11px] text-muted-foreground/60">
              {periodLabel}
            </span>
          )}
        </div>
      ) : previousValue !== undefined && previousValue === 0 ? (
        <span className="text-[11px] text-muted-foreground/50">
          Sem dados no período anterior
        </span>
      ) : null}
    </div>
  );
}
