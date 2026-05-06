import { useMemo, useEffect, useState } from 'react';
import { Responsive, WidthProvider, type Layout, type Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface GridWidget {
  id: string;
  type: string;
}

interface DashboardGridProps {
  widgets: GridWidget[];
  savedLayouts: Layouts | null;
  isEditing: boolean;
  onLayoutChange: (layouts: Layouts) => void;
  renderWidget: (widget: GridWidget) => React.ReactNode;
}

const COLS = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 };
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const ROW_HEIGHT = 60;

// Tamanhos default por tipo de widget (largura/altura em unidades de grid)
function getDefaultSize(type: string): { w: number; h: number } {
  switch (type) {
    case 'metric_card':
      return { w: 3, h: 3 };
    case 'insight_card':
      return { w: 6, h: 6 };
    case 'area_chart':
    case 'line_chart':
    case 'bar_chart':
    case 'pie_chart':
    case 'funnel':
      return { w: 6, h: 7 };
    case 'table':
      return { w: 6, h: 7 };
    case 'rfm_matrix':
    case 'churn_prediction':
      return { w: 6, h: 7 };
    default:
      return { w: 6, h: 6 };
  }
}

// Gera layout inicial fluindo widgets da esquerda pra direita
function generateInitialLayout(widgets: GridWidget[], cols: number): Layout[] {
  const layout: Layout[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  widgets.forEach((w) => {
    const { w: ww, h: hh } = getDefaultSize(w.type);
    if (x + ww > cols) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    layout.push({ i: w.id, x, y, w: ww, h: hh, minW: 2, minH: 2 });
    x += ww;
    rowHeight = Math.max(rowHeight, hh);
  });

  return layout;
}

export function DashboardGrid({
  widgets,
  savedLayouts,
  isEditing,
  onLayoutChange,
  renderWidget,
}: DashboardGridProps) {
  const [layouts, setLayouts] = useState<Layouts>(() => {
    if (savedLayouts && Object.keys(savedLayouts).length > 0) return savedLayouts;
    return {
      lg: generateInitialLayout(widgets, COLS.lg),
      md: generateInitialLayout(widgets, COLS.md),
      sm: generateInitialLayout(widgets, COLS.sm),
      xs: generateInitialLayout(widgets, COLS.xs),
      xxs: generateInitialLayout(widgets, COLS.xxs),
    };
  });

  // Sincroniza quando widgets mudam (novos widgets ou IDs antigos sumindo)
  useEffect(() => {
    setLayouts((prev) => {
      const next: Layouts = { ...prev };
      (Object.keys(COLS) as Array<keyof typeof COLS>).forEach((bp) => {
        const existing = prev[bp] ?? [];
        const widgetIds = new Set(widgets.map((w) => w.id));
        // Remove órfãos
        const cleaned = existing.filter((l) => widgetIds.has(l.i));
        // Adiciona novos no fim
        const existingIds = new Set(cleaned.map((l) => l.i));
        const missing = widgets.filter((w) => !existingIds.has(w.id));
        if (missing.length > 0) {
          const maxY = cleaned.reduce((m, l) => Math.max(m, l.y + l.h), 0);
          let x = 0;
          let y = maxY;
          let rowH = 0;
          missing.forEach((w) => {
            const { w: ww, h: hh } = getDefaultSize(w.type);
            if (x + ww > COLS[bp]) {
              x = 0;
              y += rowH;
              rowH = 0;
            }
            cleaned.push({ i: w.id, x, y, w: ww, h: hh, minW: 2, minH: 2 });
            x += ww;
            rowH = Math.max(rowH, hh);
          });
        }
        next[bp] = cleaned;
      });
      return next;
    });
  }, [widgets]);

  const handleChange = (_current: Layout[], all: Layouts) => {
    setLayouts(all);
    if (isEditing) onLayoutChange(all);
  };

  const widgetMap = useMemo(() => {
    const m = new Map<string, GridWidget>();
    widgets.forEach((w) => m.set(w.id, w));
    return m;
  }, [widgets]);

  return (
    <ResponsiveGridLayout
      className={`layout ${isEditing ? 'is-editing' : ''}`}
      layouts={layouts}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={ROW_HEIGHT}
      margin={[16, 16]}
      containerPadding={[0, 0]}
      isDraggable={isEditing}
      isResizable={isEditing}
      onLayoutChange={handleChange}
      draggableCancel=".no-drag"
      compactType="vertical"
    >
      {widgets.map((w) => (
        <div key={w.id} className="overflow-hidden">
          {renderWidget(w)}
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
