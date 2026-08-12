import { useEffect, useRef, useCallback } from 'react';
import { X, Download, ChevronRight } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ColumnDef, DrillDownModalProps } from '@/hooks/useDrillDown';

// ─── Formatação de célula para exibição ───────────────────────────────────────

const fmtCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

const fmtNumber = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
});

function formatCell(value: unknown, fmt?: ColumnDef['format']): string {
  if (value === null || value === undefined || value === '') return '—';

  if (fmt === 'date') {
    const d =
      typeof value === 'string'
        ? parseISO(value)
        : value instanceof Date
          ? value
          : new Date(value as number);
    return isValid(d) ? format(d, 'dd/MM/yyyy') : String(value);
  }

  if (fmt === 'currency') {
    const n = Number(value);
    return isNaN(n) ? String(value) : fmtCurrency.format(n);
  }

  if (fmt === 'number') {
    const n = Number(value);
    return isNaN(n) ? String(value) : fmtNumber.format(n);
  }

  return String(value);
}

// ─── Skeleton de linha ────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted/40 animate-pulse" style={{ width: `${55 + (i * 17) % 35}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function DrillDownModal({
  isOpen,
  onClose,
  title,
  breadcrumb,
  columns,
  data,
  isLoading,
  onExportCSV,
}: DrillDownModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // ESC fecha o modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Trava o scroll do body enquanto aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  const SKELETON_ROWS = 6;
  const isEmpty = !isLoading && data.length === 0;

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      {/* Dialog */}
      <div
        ref={dialogRef}
        className={cn(
          'relative flex flex-col bg-card border border-border/60 shadow-2xl',
          'w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-4xl sm:rounded-xl',
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border/40 shrink-0">
          <div className="min-w-0">
            {/* Breadcrumb */}
            {breadcrumb && breadcrumb.length > 1 && (
              <div className="flex items-center gap-1 mb-1 flex-wrap">
                {breadcrumb.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                    <span
                      className={cn(
                        'text-[11px]',
                        i < breadcrumb.length - 1
                          ? 'text-muted-foreground hover:text-foreground cursor-pointer transition-colors'
                          : 'text-foreground font-medium',
                      )}
                    >
                      {crumb}
                    </span>
                  </span>
                ))}
              </div>
            )}
            <h2
              className="text-sm font-semibold text-foreground leading-snug truncate"
              style={{ fontFamily: "'Poppins', system-ui, sans-serif" }}
            >
              {title}
            </h2>
            {!isLoading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEmpty ? 'Nenhum registro encontrado' : `${data.length} registro${data.length !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onExportCSV && !isEmpty && !isLoading && (
              <button
                type="button"
                onClick={onExportCSV}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border/50 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Tabela ── */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-sm border-collapse">
            {/* Cabeçalho fixo */}
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap border-b border-border/40"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {isLoading
                ? Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                    <SkeletonRow key={i} cols={columns.length} />
                  ))
                : isEmpty
                  ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-4 py-12 text-center text-sm text-muted-foreground"
                      >
                        Nenhum registro no período selecionado
                      </td>
                    </tr>
                  )
                  : data.map((row, i) => (
                    <tr
                      key={i}
                      className={cn(
                        'border-b border-border/20 transition-colors',
                        i % 2 === 0 ? 'bg-transparent' : 'bg-muted/10',
                        'hover:bg-muted/20',
                      )}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-4 py-2.5 text-xs text-foreground whitespace-nowrap',
                            (col.format === 'currency' || col.format === 'number') &&
                              'text-right tabular-nums',
                          )}
                        >
                          {formatCell(row[col.key], col.format)}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
