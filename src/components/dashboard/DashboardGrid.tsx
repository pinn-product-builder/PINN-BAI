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

// Todos os breakpoints "úteis" (>= 480px) usam 12 cols pra manter o padrão
// 4-up dos KPIs (metric_card w=3). Antes xs/xxs tinham 4/2 cols, o que
// forçava os KPIs a empilharem 1 por linha em qualquer container <768px
// (sintoma reportado na BF Company quando a janela do browser não estava
// fullscreen). xxs vira 6 cols para celulares — 2 KPIs por linha.
const COLS = { lg: 12, md: 12, sm: 12, xs: 12, xxs: 6 };
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const ROW_HEIGHT = 60;

// Ordem de exibição: KPIs em cima (filas de 4), depois charts/cards em filas de 2, depois tabelas (linha cheia).
// Indices menores = renderiza primeiro no layout inicial.
const TYPE_ORDER: Record<string, number> = {
  metric_card: 0,
  insight_card: 1,
  area_chart: 2,
  line_chart: 2,
  bar_chart: 2,
  pie_chart: 2,
  funnel: 2,
  rfm_matrix: 2,
  churn_prediction: 2,
  table: 3,
};

// Tamanhos default por tipo de widget (12-col grid).
// metric_card = w:3 (4 por linha); charts/insights = w:6 (2 por linha); table = w:12 (linha cheia).
function getDefaultSize(type: string): { w: number; h: number } {
  switch (type) {
    case 'metric_card':
      return { w: 3, h: 3 };
    case 'insight_card':
      return { w: 6, h: 5 };
    case 'area_chart':
    case 'line_chart':
    case 'bar_chart':
    case 'pie_chart':
    case 'funnel':
      return { w: 6, h: 7 };
    case 'rfm_matrix':
    case 'churn_prediction':
      return { w: 6, h: 7 };
    case 'table':
      return { w: 12, h: 7 };
    default:
      return { w: 6, h: 6 };
  }
}

// Gera layout inicial fluindo widgets da esquerda pra direita, agrupando por tipo
// pra evitar widgets pequenos espalhados entre widgets grandes.
function generateInitialLayout(widgets: GridWidget[], cols: number): Layout[] {
  const sorted = [...widgets].sort((a, b) => {
    const oa = TYPE_ORDER[a.type] ?? 99;
    const ob = TYPE_ORDER[b.type] ?? 99;
    return oa - ob;
  });

  const layout: Layout[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  sorted.forEach((w) => {
    const { w: ww, h: hh } = getDefaultSize(w.type);
    const effectiveW = Math.min(ww, cols);
    if (x + effectiveW > cols) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    layout.push({ i: w.id, x, y, w: effectiveW, h: hh, minW: 2, minH: 2 });
    x += effectiveW;
    rowHeight = Math.max(rowHeight, hh);
  });

  return layout;
}

/**
 * Detecta layout salvo CATASTROFICAMENTE quebrado e força regeneração com
 * defaults limpos. Esta função roda na carga inicial — ela NÃO deve atropelar
 * customizações deliberadas do user, só corrigir aberrações.
 *
 * Heurística suave (intencional): só sinaliza broken se algum widget está em
 * um estado realmente inutilizável (ex.: KPI ocupando viewport inteira, chart
 * com 1-2 cols espremido). Layouts "estéticos mas válidos" — como 2 widgets
 * de w:4 + 1 espaço vazio — são RESPEITADOS, mesmo que não preencham a linha.
 *
 * Esta foi a fonte do bug reportado pelo cliente: ao editar Insights IA + 
 * Evolução de Leads pra w:4 cada, a heurística antiga marcava como broken
 * (linha < 75% preenchida) e reescrevia no próximo reload.
 */
function isLayoutBroken(layout: Layout[], widgets: GridWidget[], cols: number): boolean {
  if (layout.length === 0) return false;
  const typeById = new Map(widgets.map((w) => [w.id, w.type]));

  // Em mobile (xxs = 6 cols) os checks de largura mínima não fazem sentido —
  // KPIs já ficam 2-up por design. Só validamos sintomas estruturais lá.
  const isWideBp = cols >= 12;

  if (isWideBp) {
    // KPIs aberrantes: ocupando 5+ cols (linha inteira pra um número) ou
    // bizarramente pequenos (1-2 cols, ilegíveis). Range saudável: 2-4 cols.
    const badMetricCard = layout.some((l) => {
      const t = typeById.get(l.i);
      if (t !== 'metric_card') return false;
      return l.w >= 5 || l.w < 2 || l.h < 2;
    });
    if (badMetricCard) return true;

    // Charts/insights inutilizáveis: w<3 cols (sem espaço pra eixos) ou
    // h<3 rows (gráfico esmagado). Aceitamos w=3 ou h=3 — user pode querer.
    const badChart = layout.some((l) => {
      const t = typeById.get(l.i);
      if (!t) return false;
      const isChart = ['area_chart', 'line_chart', 'bar_chart', 'pie_chart', 'funnel', 'rfm_matrix', 'churn_prediction', 'insight_card'].includes(t);
      if (!isChart) return false;
      return l.w < 3 || l.h < 3;
    });
    if (badChart) return true;

    // Tabela inutilizável: w<4 (mostraria 1 coluna) ou h<3 (1 linha visível).
    const badTable = layout.some((l) => {
      const t = typeById.get(l.i);
      return t === 'table' && (l.w < 4 || l.h < 3);
    });
    if (badTable) return true;
  }

  // Sem mais heurísticas de "fill da linha" ou "stacked em x=0" — eram falsos
  // positivos que atropelavam customizações legítimas do user. Confiamos que
  // se o layout passa nos mínimos acima, o user sabe o que quer.

  return false;
}

/**
 * Normaliza largura (cap em 4 para metric_card, cap em cols para resto) e
 * re-flui x/y se o saved layout estiver quebrado. Mantém heights customizados.
 */
function normalizeLayout(layout: Layout[], widgets: GridWidget[], cols: number): Layout[] {
  const typeById = new Map(widgets.map((w) => [w.id, w.type]));

  // Se o layout salvo está quebrado, regenera completamente do zero com base
  // nos widgets (defaults limpos: KPIs 4-up, charts 2-up, table full width).
  if (isLayoutBroken(layout, widgets, cols)) {
    return generateInitialLayout(widgets, cols);
  }

  // Layout salvo é razoável: só corrige larguras-fora-do-budget e mantém posições.
  return layout.map((l) => {
    const type = typeById.get(l.i);
    if (!type) return l;
    const def = getDefaultSize(type);
    let w = l.w;
    if (type === 'metric_card' && w > 4) w = def.w;
    if (w > cols) w = Math.min(def.w, cols);
    return { ...l, w };
  });
}

export function normalizeLayouts(layouts: Layouts, widgets: GridWidget[]): Layouts {
  const next: Layouts = { ...layouts };
  (Object.keys(COLS) as Array<keyof typeof COLS>).forEach((bp) => {
    const arr = layouts[bp];
    if (Array.isArray(arr)) next[bp] = normalizeLayout(arr, widgets, COLS[bp]);
  });
  return next;
}

/**
 * Indica se o layout salvo difere significativamente do layout normalizado.
 * Usado pelo DashboardEngineGrid pra persistir automaticamente a versão
 * regenerada quando detecta um saved layout quebrado — assim o user vê
 * o grid limpo sem precisar entrar em modo de edição.
 */
export function layoutsDifferMaterially(a: Layouts, b: Layouts): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const bp of keys) {
    const arrA = (a as Record<string, Layout[]>)[bp] ?? [];
    const arrB = (b as Record<string, Layout[]>)[bp] ?? [];
    if (arrA.length !== arrB.length) return true;
    const mapA = new Map(arrA.map((l) => [l.i, l] as const));
    for (const lb of arrB) {
      const la = mapA.get(lb.i);
      if (!la) return true;
      if (la.x !== lb.x || la.y !== lb.y || la.w !== lb.w || la.h !== lb.h) return true;
    }
  }
  return false;
}

export function DashboardGrid({
  widgets,
  savedLayouts,
  isEditing,
  onLayoutChange,
  renderWidget,
}: DashboardGridProps) {
  const [layouts, setLayouts] = useState<Layouts>(() => {
    if (savedLayouts && Object.keys(savedLayouts).length > 0) {
      return normalizeLayouts(savedLayouts, widgets);
    }
    return {
      lg: generateInitialLayout(widgets, COLS.lg),
      md: generateInitialLayout(widgets, COLS.md),
      sm: generateInitialLayout(widgets, COLS.sm),
      xs: generateInitialLayout(widgets, COLS.xs),
      xxs: generateInitialLayout(widgets, COLS.xxs),
    };
  });

  // Aplica saved layout quando ele chega async do Supabase (na 1ª render o
  // useState lazy init recebe `savedLayouts = null` e cai nos defaults; sem
  // este efeito, o layout salvo nunca seria aplicado).
  useEffect(() => {
    if (savedLayouts && Object.keys(savedLayouts).length > 0) {
      setLayouts(normalizeLayouts(savedLayouts, widgets));
    }
  }, [savedLayouts, widgets]);

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
            const effectiveW = Math.min(ww, COLS[bp]);
            if (x + effectiveW > COLS[bp]) {
              x = 0;
              y += rowH;
              rowH = 0;
            }
            cleaned.push({ i: w.id, x, y, w: effectiveW, h: hh, minW: 2, minH: 2 });
            x += effectiveW;
            rowH = Math.max(rowH, hh);
          });
        }
        next[bp] = normalizeLayout(cleaned, widgets, COLS[bp]);
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
