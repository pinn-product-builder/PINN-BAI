import { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Eye, Sparkles, CheckCircle2, LayoutTemplate, BarChart3, PieChart, Table2, TrendingUp, Target, Lightbulb } from 'lucide-react';

import DashboardPreview from '../preview/DashboardPreview';
import WidgetRecommendationList from '../WidgetRecommendationList';
import { useWidgetRecommendations, generateLocalRecommendations } from '@/hooks/useWidgetRecommendations';
import type { WidgetRecommendation } from '@/lib/types';

// Local types for preview step
interface DataMapping {
  id: string;
  sourceField: string;
  sourceTable: string;
  targetMetric: string;
  transformation: string;
  aggregation?: string;
  format?: string;
}

type DashboardWidgetType = 
  | 'metric_card' 
  | 'area_chart' 
  | 'bar_chart' 
  | 'line_chart' 
  | 'pie_chart' 
  | 'donut_chart'
  | 'funnel' 
  | 'radar_chart'
  | 'table' 
  | 'insight_card';

export interface DashboardWidgetConfig {
  id: string;
  type: DashboardWidgetType;
  title: string;
  description: string;
  position: { x: number; y: number; w: number; h: number };
  dataMapping: DataMapping[];
  config: Record<string, unknown>;
}

interface PreviewStepProps {
  mappings: DataMapping[];
  widgets: DashboardWidgetConfig[];
  plan: 1 | 2 | 3 | 4;
  onUpdate: (widgets: DashboardWidgetConfig[]) => void;
  hasTemplate?: boolean;
  templateName?: string;
}

const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  metric_card: { w: 3, h: 2 },
  area_chart: { w: 8, h: 3 },
  bar_chart: { w: 6, h: 3 },
  line_chart: { w: 6, h: 3 },
  pie_chart: { w: 4, h: 3 },
  donut_chart: { w: 4, h: 3 },
  funnel: { w: 4, h: 4 },
  radar_chart: { w: 4, h: 4 },
  table: { w: 6, h: 4 },
  insight_card: { w: 6, h: 2 },
};

const WIDGET_ICONS: Record<string, React.ElementType> = {
  metric_card: TrendingUp,
  area_chart: BarChart3,
  line_chart: BarChart3,
  bar_chart: BarChart3,
  pie_chart: PieChart,
  donut_chart: PieChart,
  funnel: Target,
  table: Table2,
  insight_card: Lightbulb,
};

const PreviewStep = ({ mappings, widgets, plan, onUpdate, hasTemplate, templateName }: PreviewStepProps) => {
  const [showPreview, setShowPreview] = useState(false);

  // =================================================================
  // MODO TEMPLATE: mostrar os widgets do template já selecionado
  // =================================================================
  if (hasTemplate && widgets.length > 0) {
    // Agrupar widgets por tipo para exibição bonita
    const metricCards = widgets.filter(w => w.type === 'metric_card');
    const charts = widgets.filter(w => ['area_chart', 'line_chart', 'bar_chart', 'pie_chart', 'donut_chart'].includes(w.type));
    const funnels = widgets.filter(w => w.type === 'funnel');
    const tables = widgets.filter(w => w.type === 'table');
    const insights = widgets.filter(w => w.type === 'insight_card');

    return (
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Dashboard Pronto para Criação
          </h2>
          <p className="text-muted-foreground">
            O template <strong className="text-accent">{templateName || 'selecionado'}</strong> será 
            aplicado com {widgets.length} widgets, cada um conectado aos seus dados reais via mapeamento.
          </p>
        </div>

        {/* Template Summary Card */}
        <Card className="p-6 bg-accent/5 border-accent/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <LayoutTemplate className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{templateName || 'Template Premium'}</h3>
              <p className="text-sm text-muted-foreground">{widgets.length} widgets configurados</p>
            </div>
            <Badge className="ml-auto bg-accent/20 text-accent border-0">Pronto</Badge>
          </div>

          {/* Widget groups */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            {metricCards.length > 0 && (
              <div className="text-center p-3 rounded-lg bg-background/60">
                <TrendingUp className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                <div className="text-lg font-bold">{metricCards.length}</div>
                <div className="text-xs text-muted-foreground">KPIs</div>
              </div>
            )}
            {charts.length > 0 && (
              <div className="text-center p-3 rounded-lg bg-background/60">
                <BarChart3 className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <div className="text-lg font-bold">{charts.length}</div>
                <div className="text-xs text-muted-foreground">Gráficos</div>
              </div>
            )}
            {funnels.length > 0 && (
              <div className="text-center p-3 rounded-lg bg-background/60">
                <Target className="w-5 h-5 mx-auto mb-1 text-orange-500" />
                <div className="text-lg font-bold">{funnels.length}</div>
                <div className="text-xs text-muted-foreground">Funis</div>
              </div>
            )}
            {tables.length > 0 && (
              <div className="text-center p-3 rounded-lg bg-background/60">
                <Table2 className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                <div className="text-lg font-bold">{tables.length}</div>
                <div className="text-xs text-muted-foreground">Tabelas</div>
              </div>
            )}
            {insights.length > 0 && (
              <div className="text-center p-3 rounded-lg bg-background/60">
                <Lightbulb className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
                <div className="text-lg font-bold">{insights.length}</div>
                <div className="text-xs text-muted-foreground">Insights IA</div>
              </div>
            )}
          </div>
        </Card>

        {/* Widget list */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Widgets incluídos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {widgets.map((w, i) => {
              const Icon = WIDGET_ICONS[w.type] || BarChart3;
              return (
                <div key={w.id || i} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{w.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{w.description || w.type.replace(/_/g, ' ')}</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 ml-auto" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Mapping info */}
        {mappings.length > 0 && (
          <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{mappings.length} mapeamentos</strong> serão usados para 
              conectar os widgets aos dados reais da tabela <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {mappings[0]?.sourceTable || '...'}
              </code>
            </p>
          </div>
        )}
      </div>
    );
  }

  // =================================================================
  // MODO SEM TEMPLATE: gerar recomendações AI (fluxo original)
  // =================================================================

  // Use the recommendation hook
  const {
    data: recommendations,
    isLoading,
    isError,
    refetch,
  } = useWidgetRecommendations({
    mappings,
    plan,
    enabled: mappings.length >= 2 && !hasTemplate,
  });

  // Fallback to local generation if needed
  const displayRecommendations = recommendations || 
    (mappings.length >= 2 ? generateLocalRecommendations(mappings, plan) : []);

  // Convert accepted recommendations to widget configs
  const handleSelectionChange = useCallback((acceptedWidgets: WidgetRecommendation[]) => {
    let xPos = 0;
    let yPos = 0;
    let rowHeight = 0;

    const newWidgets: DashboardWidgetConfig[] = acceptedWidgets.map((rec, index) => {
      const size = DEFAULT_SIZES[rec.type] || { w: 4, h: 3 };
      
      // Simple grid positioning
      if (xPos + size.w > 12) {
        xPos = 0;
        yPos += rowHeight;
        rowHeight = 0;
      }

      // Find relevant mappings for this widget based on basedOn field
      const relevantMappings = mappings.filter(m => 
        rec.basedOn.toLowerCase().includes(m.targetMetric.toLowerCase()) ||
        rec.basedOn.toLowerCase().includes(m.sourceTable.toLowerCase())
      );

      // If no specific match, use all mappings (widget will use first table)
      const widgetMappings = relevantMappings.length > 0 ? relevantMappings : mappings.slice(0, 1);

      // Use the first mapping's table, but each widget can have its own table
      const firstMapping = widgetMappings[0];
      const widgetTable = firstMapping?.sourceTable || null;
      
      const widget: DashboardWidgetConfig = {
        id: `widget-${rec.type}-${index}`,
        type: rec.type as DashboardWidgetType,
        title: rec.title,
        description: rec.description,
        position: { x: xPos, y: yPos, ...size },
        dataMapping: widgetMappings,
        config: {
          ...rec.config,
          dataSource: widgetTable,
          sourceTable: widgetTable,
          metric: firstMapping?.sourceField || null,
          aggregation: firstMapping?.aggregation || 'count',
          transformation: firstMapping?.transformation || 'none',
          targetMetric: firstMapping?.targetMetric || null,
          animate: true,
          showTooltip: true,
        },
      };

      xPos += size.w;
      rowHeight = Math.max(rowHeight, size.h);

      return widget;
    });

    onUpdate(newWidgets);
  }, [mappings, onUpdate]);

  // Convert current widgets back to recommendations for initial state
  const initialAccepted: WidgetRecommendation[] = widgets.map(w => ({
    type: w.type as any,
    title: w.title,
    description: w.description,
    score: 90,
    config: w.config as any,
    basedOn: '',
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Pré-visualização do Dashboard
        </h2>
        <p className="text-muted-foreground">
          Baseado nos mapeamentos, sugerimos os widgets mais adequados. 
          Cada gráfico está vinculado à sua própria tabela de origem.
        </p>
      </div>

      {/* Recommendation List */}
      <WidgetRecommendationList
        recommendations={displayRecommendations}
        isLoading={isLoading && mappings.length >= 2}
        isError={isError}
        onRefetch={refetch}
        onSelectionChange={handleSelectionChange}
        initialAccepted={initialAccepted}
      />

      {/* Preview Toggle and Banner */}
      {widgets.length > 0 && (
        <>
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 p-3 flex-1 bg-warning/10 rounded-lg border border-warning/20">
              <Eye className="w-4 h-4 text-warning shrink-0" />
              <p className="text-sm text-warning">
                <strong>Pré-visualização com dados simulados</strong> — Os gráficos serão atualizados com dados reais após a integração.
              </p>
            </div>
            
            <div className="flex items-center gap-2 ml-4">
              <Label htmlFor="show-preview" className="text-sm text-muted-foreground">
                Mostrar Pré-visualização
              </Label>
              <Switch
                id="show-preview"
                checked={showPreview}
                onCheckedChange={setShowPreview}
              />
            </div>
          </div>

          {/* Dashboard Preview */}
          {showPreview && (
            <div className="border rounded-xl overflow-hidden bg-muted/30">
              <div className="p-4 border-b bg-card flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <span className="font-medium text-foreground">Pré-visualização do Dashboard</span>
                </div>
                <Badge variant="outline">{widgets.length} widgets</Badge>
              </div>
              <div className="p-6">
                <DashboardPreview widgets={widgets} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PreviewStep;
