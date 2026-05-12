import { useState, useCallback } from 'react';
import { exportCSV } from '@/utils/exportCSV';

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface ColumnDef {
  key: string;
  header: string;
  format?: 'date' | 'currency' | 'number' | 'text';
}

/** Contexto passado ao clicar numa barra/célula do gráfico */
export interface DrillDownContext {
  /** Label do ponto clicado. Ex: "Google Ads", "Março 2026" */
  label: string;
  /** ISO start do período representado pelo ponto */
  start: string;
  /** ISO end do período representado pelo ponto */
  end: string;
  /** Filtros adicionais livres. Ex: { source: 'google_ads' } */
  extra?: Record<string, unknown>;
}

/** Props prontas para passar direto ao <DrillDownModal> */
export interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  breadcrumb: string[];
  columns: ColumnDef[];
  data: Record<string, unknown>[];
  isLoading: boolean;
  onExportCSV: () => void;
}

// ─── Opções do hook ────────────────────────────────────────────────────────────

export interface UseDrillDownOptions<T extends Record<string, unknown>> {
  /** Título base do modal. Ex: "Leads por Fonte" */
  title: string;
  columns: ColumnDef[];
  /** Chamada quando o usuário clica no gráfico — deve retornar os registros detalhados */
  queryFn: (context: DrillDownContext) => Promise<T[]>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDrillDown<T extends Record<string, unknown>>({
  title,
  columns,
  queryFn,
}: UseDrillDownOptions<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [activeContext, setActiveContext] = useState<DrillDownContext | null>(null);

  const open = useCallback(
    async (context: DrillDownContext) => {
      setActiveContext(context);
      setIsOpen(true);
      setIsLoading(true);
      setData([]);
      try {
        const rows = await queryFn(context);
        setData(rows as Record<string, unknown>[]);
      } catch (err) {
        console.error('[useDrillDown] queryFn error:', err);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    },
    [queryFn],
  );

  const onClose = useCallback(() => {
    setIsOpen(false);
    setActiveContext(null);
  }, []);

  const onExportCSV = useCallback(() => {
    if (!data.length) return;
    const contextLabel = activeContext?.label ?? '';
    const safeName = `${title}${contextLabel ? ` - ${contextLabel}` : ''}`
      .replace(/[^a-zA-Z0-9À-ÿ _-]/g, '')
      .trim();
    exportCSV(data, columns, safeName);
  }, [data, columns, title, activeContext]);

  const modalTitle = activeContext ? `${title} — ${activeContext.label}` : title;
  const breadcrumb = activeContext ? [title, activeContext.label] : [title];

  const modalProps: DrillDownModalProps = {
    isOpen,
    onClose,
    title: modalTitle,
    breadcrumb,
    columns,
    data,
    isLoading,
    onExportCSV,
  };

  return { open, modalProps };
}
