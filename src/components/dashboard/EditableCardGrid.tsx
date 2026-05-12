import { useEffect, useMemo } from 'react';
import { Responsive, WidthProvider, type Layout, type Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';

export interface CardWidget {
  id: string;
  /** Tamanho base (em unidades de 12 cols). Default 3×6 (KPI hero). */
  size?: { w: number; h: number };
  render: () => React.ReactNode;
}

interface Props {
  /** Identifica esta página/grid no backend de persistência. */
  pageKey: string;
  orgId?: string | null;
  widgets: CardWidget[];
  isEditing: boolean;
  /** Altura de uma row do grid (default 40px). */
  rowHeight?: number;
  /** Recebe um reset callback exposto pro pai (botão "Resetar layout"). */
  onLayoutReset?: (reset: () => void) => void;
}

const ResponsiveGridLayout = WidthProvider(Responsive);

const COLS = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 };
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };

function getDefaultSize(s?: { w: number; h: number }) {
  return s ?? { w: 3, h: 6 };
}

function generateInitialLayout(widgets: CardWidget[], cols: number): Layout[] {
  const out: Layout[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  widgets.forEach((w) => {
    const { w: ww, h: hh } = getDefaultSize(w.size);
    const effW = Math.min(ww, cols);
    if (x + effW > cols) { x = 0; y += rowH; rowH = 0; }
    out.push({ i: w.id, x, y, w: effW, h: hh, minW: 2, minH: 3 });
    x += effW;
    rowH = Math.max(rowH, hh);
  });
  return out;
}

function buildAllBreakpoints(widgets: CardWidget[]): Layouts {
  return {
    lg: generateInitialLayout(widgets, COLS.lg),
    md: generateInitialLayout(widgets, COLS.md),
    sm: generateInitialLayout(widgets, COLS.sm),
    xs: generateInitialLayout(widgets, COLS.xs),
    xxs: generateInitialLayout(widgets, COLS.xxs),
  };
}

/** Garante que todo widget atual está representado em todos os breakpoints. */
function mergeWidgets(saved: Layouts, widgets: CardWidget[]): Layouts {
  const next: Layouts = { ...saved };
  (Object.keys(COLS) as Array<keyof typeof COLS>).forEach((bp) => {
    const existing = saved[bp] ?? [];
    const widgetIds = new Set(widgets.map((w) => w.id));
    const cleaned = existing.filter((l) => widgetIds.has(l.i));
    const existingIds = new Set(cleaned.map((l) => l.i));
    const missing = widgets.filter((w) => !existingIds.has(w.id));
    if (missing.length > 0) {
      const maxY = cleaned.reduce((m, l) => Math.max(m, l.y + l.h), 0);
      let x = 0;
      let y = maxY;
      let rowH = 0;
      missing.forEach((w) => {
        const { w: ww, h: hh } = getDefaultSize(w.size);
        const effW = Math.min(ww, COLS[bp]);
        if (x + effW > COLS[bp]) { x = 0; y += rowH; rowH = 0; }
        cleaned.push({ i: w.id, x, y, w: effW, h: hh, minW: 2, minH: 3 });
        x += effW;
        rowH = Math.max(rowH, hh);
      });
    }
    next[bp] = cleaned;
  });
  return next;
}

export function EditableCardGrid({
  pageKey,
  orgId,
  widgets,
  isEditing,
  rowHeight = 40,
  onLayoutReset,
}: Props) {
  const { layouts: storedLayouts, isReady, saveLayouts, resetLayouts } = useDashboardLayout({
    pageKey,
    orgId,
  });

  const defaultLayouts = useMemo(() => buildAllBreakpoints(widgets), [widgets]);

  // Calcula o layout efetivo: stored (se houver) + widgets novos mergeados.
  const effectiveLayouts = useMemo(() => {
    if (!storedLayouts || Object.keys(storedLayouts).length === 0) return defaultLayouts;
    return mergeWidgets(storedLayouts, widgets);
  }, [storedLayouts, defaultLayouts, widgets]);

  // Expõe reset pro pai (pra botão "Resetar layout" no header da página).
  useEffect(() => {
    if (!onLayoutReset) return;
    onLayoutReset(() => resetLayouts());
  }, [onLayoutReset, resetLayouts]);

  const handleChange = (_current: Layout[], all: Layouts) => {
    if (!isReady) return; // ignora o layout-change inicial do react-grid-layout
    if (!isEditing) return; // só salva quando user efetivamente edita
    saveLayouts(all);
  };

  return (
    <ResponsiveGridLayout
      className={`layout ${isEditing ? 'is-editing-grid' : ''}`}
      layouts={effectiveLayouts}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={rowHeight}
      margin={[12, 12]}
      containerPadding={[0, 0]}
      isDraggable={isEditing}
      isResizable={isEditing}
      onLayoutChange={handleChange}
      draggableCancel=".no-drag"
      compactType="vertical"
    >
      {widgets.map((w) => (
        <div
          key={w.id}
          className={`overflow-hidden ${
            isEditing
              ? 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background rounded-xl cursor-grab active:cursor-grabbing'
              : ''
          }`}
        >
          {w.render()}
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
