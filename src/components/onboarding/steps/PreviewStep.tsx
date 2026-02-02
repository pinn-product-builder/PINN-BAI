import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Info, Eye, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DataMapping, DashboardWidgetConfig, DashboardWidgetType } from '@/lib/mock-data';

import DashboardPreview from '../preview/DashboardPreview';

interface PreviewStepProps {
  mappings: DataMapping[];
  widgets: DashboardWidgetConfig[];
  plan: 1 | 2 | 3 | 4;
  onUpdate: (widgets: DashboardWidgetConfig[]) => void;
}

const WIDGET_CATALOG: { 
  type: DashboardWidgetType; 
  title: string; 
  description: string; 
  minPlan: number;
  defaultSize: { w: number; h: number };
}[] = [
  { type: 'metric_card', title: 'Card de Métrica', description: 'Exibe um valor com tendência e sparkline', minPlan: 1, defaultSize: { w: 3, h: 2 } },
  { type: 'area_chart', title: 'Gráfico de Área', description: 'Evolução temporal com preenchimento gradiente', minPlan: 1, defaultSize: { w: 6, h: 3 } },
  { type: 'bar_chart', title: 'Gráfico de Barras', description: 'Comparação entre categorias', minPlan: 1, defaultSize: { w: 6, h: 3 } },
  { type: 'line_chart', title: 'Gráfico de Linha', description: 'Múltiplas séries temporais', minPlan: 2, defaultSize: { w: 6, h: 3 } },
  { type: 'pie_chart', title: 'Gráfico de Pizza', description: 'Distribuição percentual', minPlan: 2, defaultSize: { w: 4, h: 3 } },
  { type: 'donut_chart', title: 'Gráfico Donut', description: 'Distribuição com total central', minPlan: 2, defaultSize: { w: 4, h: 3 } },
  { type: 'funnel', title: 'Funil de Conversão', description: 'Visualização de estágios do funil', minPlan: 2, defaultSize: { w: 4, h: 4 } },
  { type: 'radar_chart', title: 'Gráfico Radar', description: 'Análise multidimensional', minPlan: 3, defaultSize: { w: 4, h: 4 } },
  { type: 'table', title: 'Tabela de Dados', description: 'Lista detalhada com paginação', minPlan: 1, defaultSize: { w: 6, h: 4 } },
  { type: 'insight_card', title: 'Card de Insight', description: 'Insights gerados por IA', minPlan: 3, defaultSize: { w: 6, h: 2 } },
];

const PreviewStep = ({ mappings, widgets, plan, onUpdate }: PreviewStepProps) => {
  const [showPreview, setShowPreview] = useState(true);

  // Auto-generate widgets based on mappings if none exist
  useEffect(() => {
    if (widgets.length === 0 && mappings.length > 0) {
      const autoWidgets = generateSuggestedWidgets(mappings, plan);
      onUpdate(autoWidgets);
    }
  }, [mappings, plan]);

  const generateSuggestedWidgets = (mappings: DataMapping[], plan: number): DashboardWidgetConfig[] => {
    const suggested: DashboardWidgetConfig[] = [];
    let xPos = 0;
    let yPos = 0;

    // Add metric cards for key metrics
    const metricMappings = mappings.filter(m => 
      ['total_leads', 'conversions', 'revenue', 'conversion_rate'].includes(m.targetMetric)
    );

    metricMappings.slice(0, 4).forEach((mapping, index) => {
      suggested.push({
        id: `widget-metric-${index}`,
        type: 'metric_card',
        title: getMetricTitle(mapping.targetMetric),
        description: getMetricDescription(mapping.targetMetric),
        position: { x: index * 3, y: 0, w: 3, h: 2 },
        dataMapping: [mapping],
        config: {
          showTrend: true,
          showSparkline: true,
          compareWithPrevious: true,
          animate: true,
        },
      });
    });

    yPos = 2;

    // Add area chart for temporal data
    suggested.push({
      id: 'widget-area-1',
      type: 'area_chart',
      title: 'Evolução de Leads',
      description: 'Visualização da tendência de captação de leads ao longo do tempo, com preenchimento gradiente para destacar volume.',
      position: { x: 0, y: yPos, w: 8, h: 3 },
      dataMapping: mappings.filter(m => m.targetMetric === 'total_leads' || m.targetMetric === 'new_leads'),
      config: {
        gradientFill: true,
        showTooltip: true,
        showGrid: true,
        curveType: 'smooth',
        animate: true,
      },
    });

    // Add funnel if plan >= 2
    if (plan >= 2) {
      suggested.push({
        id: 'widget-funnel-1',
        type: 'funnel',
        title: 'Funil de Conversão',
        description: 'Visualização completa do funil de vendas, mostrando a progressão de leads através de cada estágio até a conversão.',
        position: { x: 8, y: yPos, w: 4, h: 3 },
        dataMapping: mappings.filter(m => m.targetMetric === 'funnel_stage'),
        config: {
          showLabels: true,
          animate: true,
          showTooltip: true,
        },
      });
    }

    yPos += 3;

    // Add bar chart for sources
    suggested.push({
      id: 'widget-bar-1',
      type: 'bar_chart',
      title: 'Leads por Origem',
      description: 'Comparação do volume de leads por canal de aquisição. Use para identificar os canais mais efetivos.',
      position: { x: 0, y: yPos, w: 6, h: 3 },
      dataMapping: mappings.filter(m => m.targetMetric === 'lead_source'),
      config: {
        showLegend: true,
        showTooltip: true,
        animate: true,
        chartColors: ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'],
      },
    });

    // Add donut chart for distribution
    if (plan >= 2) {
      suggested.push({
        id: 'widget-donut-1',
        type: 'donut_chart',
        title: 'Distribuição por Status',
        description: 'Proporção de leads em cada status do pipeline. O valor central mostra o total.',
        position: { x: 6, y: yPos, w: 3, h: 3 },
        dataMapping: [],
        config: {
          innerRadius: 60,
          showLabels: true,
          animate: true,
        },
      });
    }

    // Add insight card if plan >= 3
    if (plan >= 3) {
      suggested.push({
        id: 'widget-insight-1',
        type: 'insight_card',
        title: 'Insights Inteligentes',
        description: 'Análises geradas automaticamente por IA baseadas nos padrões detectados nos seus dados.',
        position: { x: 9, y: yPos, w: 3, h: 3 },
        dataMapping: [],
        config: {
          animate: true,
        },
      });
    }

    return suggested;
  };

  const getMetricTitle = (metric: string): string => {
    const titles: Record<string, string> = {
      total_leads: 'Total de Leads',
      conversions: 'Conversões',
      revenue: 'Receita Total',
      conversion_rate: 'Taxa de Conversão',
      mrr: 'MRR',
      growth_rate: 'Crescimento',
    };
    return titles[metric] || metric;
  };

  const getMetricDescription = (metric: string): string => {
    const descriptions: Record<string, string> = {
      total_leads: 'Número total de leads capturados no período selecionado. Inclui todos os canais de aquisição configurados.',
      conversions: 'Quantidade de leads que se tornaram clientes. Acompanhe este número para medir a efetividade do time comercial.',
      revenue: 'Soma total de todas as vendas realizadas no período. Inclui receitas recorrentes e one-time.',
      conversion_rate: 'Percentual de leads convertidos em clientes. Calculado como (Conversões / Total de Leads) × 100.',
      mrr: 'Receita Recorrente Mensal. Representa o valor mensal previsível de todas as assinaturas ativas.',
      growth_rate: 'Variação percentual comparada ao período anterior. Valores positivos indicam crescimento.',
    };
    return descriptions[metric] || 'Métrica customizada baseada nos dados mapeados.';
  };

  const toggleWidget = (widgetType: DashboardWidgetType) => {
    const existingIndex = widgets.findIndex(w => w.type === widgetType);
    
    if (existingIndex >= 0) {
      onUpdate(widgets.filter((_, i) => i !== existingIndex));
    } else {
      const catalogItem = WIDGET_CATALOG.find(w => w.type === widgetType);
      if (!catalogItem) return;

      const newWidget: DashboardWidgetConfig = {
        id: `widget-${widgetType}-${Date.now()}`,
        type: widgetType,
        title: catalogItem.title,
        description: catalogItem.description,
        position: { x: 0, y: widgets.length * 3, ...catalogItem.defaultSize },
        dataMapping: [],
        config: {
          animate: true,
          showTooltip: true,
        },
      };
      onUpdate([...widgets, newWidget]);
    }
  };

  const availableWidgets = WIDGET_CATALOG.filter(w => w.minPlan <= plan);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Preview do Dashboard
        </h2>
        <p className="text-muted-foreground">
          Visualize como ficará o dashboard antes de finalizar. Selecione os widgets desejados.
        </p>
      </div>

      {/* Widget Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Widgets Disponíveis</Label>
          <div className="flex items-center gap-2">
            <Label htmlFor="show-preview" className="text-sm text-muted-foreground">
              Mostrar Preview
            </Label>
            <Switch
              id="show-preview"
              checked={showPreview}
              onCheckedChange={setShowPreview}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {availableWidgets.map((widget) => {
            const isSelected = widgets.some(w => w.type === widget.type);

            return (
              <Card
                key={widget.type}
                className={cn(
                  "p-3 cursor-pointer transition-all hover:border-accent/50",
                  isSelected && "border-accent bg-accent/5 ring-1 ring-accent/20"
                )}
                onClick={() => toggleWidget(widget.type)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{widget.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{widget.description}</p>
                  </div>
                  {isSelected && (
                    <Badge className="bg-accent text-accent-foreground text-[10px] px-1.5">
                      ✓
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Preview Banner */}
      <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
        <Eye className="w-4 h-4 text-amber-500" />
        <p className="text-sm text-amber-600">
          <strong>Preview com dados simulados</strong> - Os gráficos mostram dados de exemplo que serão substituídos pelos dados reais após a integração.
        </p>
      </div>

      {/* Dashboard Preview */}
      {showPreview && widgets.length > 0 && (
        <div className="border rounded-xl overflow-hidden bg-muted/30">
          <div className="p-4 border-b bg-card flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <span className="font-medium">Dashboard Preview</span>
            </div>
            <Badge variant="outline">{widgets.length} widgets</Badge>
          </div>
          <div className="p-6">
            <DashboardPreview widgets={widgets} />
          </div>
        </div>
      )}

      {widgets.length < 3 && (
        <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Selecione mais widgets</p>
              <p className="text-sm text-muted-foreground">
                Escolha pelo menos 3 widgets para criar um dashboard completo e informativo.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewStep;
