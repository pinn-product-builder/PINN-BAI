import { useEffect, useMemo, useState } from 'react';
import { Responsive, WidthProvider, type Layout, type Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

export interface SnapshotWidget {
  id: string;
  /** Tamanho base do card no grid (em unidades de 12). Default 3×6. */
  size?: { w: number; h: number };
  /** Conteúdo do card já renderizado (a Card com KPI ou alerta). */
  render: () => React.ReactNode;
}

interface Props {
  storageKey: string;
  widgets: SnapshotWidget[];
  isEditing: boolean;
  /** Callback pra resetar o layout (chamado externamente). */
  onLayoutReset?: (resetFn: () => void) => void;
}

const ResponsiveGridLayout = WidthProvider(Responsive);

// 12 colunas em qualquer breakpoint — mesma matemática do DashboardGrid.
const COLS = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 };
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const ROW_HEIGHT = 40;
const STORAGE_VERSION = 'v1';

function getDefaultSize(w?: { w: number; h: number }) {
  return w ?? { w: 3, h: 6 };
}

function generateInitialLayout(widgets: SnapshotWidget[], cols: number): Layout[] {
  const layout: Layout[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;

  widgets.forEach((w) => {
    const { w: ww, h: hh } = getDefaultSize(w.size);
    const effW = Math.min(ww, cols);
    if (x + effW > cols) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    layout.push({ i: w.id, x, y, w: effW, h: hh, minW: 2, minH: 3 });
    x += effW;
    rowH = Math.max(rowH, hh);
  });

  return layout;
}

function buildAllBreakpoints(widgets: SnapshotWidget[]): Layouts {
  return {
    lg: generateInitialLayout(widgets, COLS.lg),
    md: generateInitialLayout(widgets, COLS.md),
    sm: generateInitialLayout(widgets, COLS.sm),
    xs: generateInitialLayout(widgets, COLS.xs),
    xxs: generateInitialLayout(widgets, COLS.xxs),
  };
}

function loadLayouts(storageKey: string): Layouts | null {
  try {
    const raw = window.localStorage.getItem(`${storageKey}:${STORAGE_VERSION}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Layouts;
  } catch {
    return null;
  }
}

function saveLayouts(storageKey: string, layouts: Layouts) {
  try {
    window.localStorage.setItem(`${storageKey}:${STORAGE_VERSION}`, JSON.stringify(layouts));
  } catch {
    /* ignora — localStorage cheio ou bloqueado */
  }
}

export function EditableSnapshotGrid({ storageKey, widgets, isEditing, onLayoutReset }: Props) {
  const defaultLayouts = useMemo(() => buildAllBreakpoints(widgets), [widgets]);

  const [layouts, setLayouts] = useState<Layouts>(() => {
    const saved = loadLayouts(storageKey);
    return saved && Object.keys(saved).length > 0 ? saved : defaultLayouts;
  });

  // Sincroniza quando lista de widgets muda (id novo entra ou velho sai).
  useEffect(() => {
    setLayouts((prev) => {
      const next: Layouts = { ...prev };
      (Object.keys(COLS) as Array<keyof typeof COLS>).forEach((bp) => {
        const existing = prev[bp] ?? [];
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
            if (x + effW > COLS[bp]) {
              x = 0;
              y += rowH;
              rowH = 0;
            }
            cleaned.push({ i: w.id, x, y, w: effW, h: hh, minW: 2, minH: 3 });
            x += effW;
            rowH = Math.max(rowH, hh);
          });
        }
        next[bp] = cleaned;
      });
      return next;
    });
  }, [widgets]);

  // Expõe um reset pro pai (botão "Resetar layout" no header).
  useEffect(() => {
    if (!onLayoutReset) return;
    onLayoutReset(() => {
      setLayouts(defaultLayouts);
      saveLayouts(storageKey, defaultLayouts);
    });
  }, [onLayoutReset, defaultLayouts, storageKey]);

  const handleChange = (_current: Layout[], all: Layouts) => {
    setLayouts(all);
    if (isEditing) saveLayouts(storageKey, all);
  };

  return (
    <ResponsiveGridLayout
      className={`layout ${isEditing ? 'is-editing-snapshot' : ''}`}
      layouts={layouts}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={ROW_HEIGHT}
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
          className={`overflow-hidden ${isEditing ? 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background rounded-xl cursor-grab active:cursor-grabbing' : ''}`}
        >
          {w.render()}
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
