import { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, Sparkles } from 'lucide-react';

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

const PreviewStep = ({ mappings, widgets, plan, onUpdate }: PreviewStepProps) => {
  const [showPreview, setShowPreview] = useState(true);

  // Use the recommendation hook
  const {
    data: recommendations,
    isLoading,
    isError,
    refetch,
  } = useWidgetRecommendations({
    mappings,
    plan,
    enabled: mappings.length >= 2,
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

      const widget: DashboardWidgetConfig = {
        id: `widget-${rec.type}-${index}`,
        type: rec.type as DashboardWidgetType,
        title: rec.title,
        description: rec.description,
        position: { x: xPos, y: yPos, ...size },
        dataMapping: mappings.filter(m => 
          rec.basedOn.toLowerCase().includes(m.targetMetric.toLowerCase())
        ),
        config: {
          ...rec.config,
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
          Preview do Dashboard
        </h2>
        <p className="text-muted-foreground">
          Baseado nos seus mapeamentos, sugerimos os widgets mais adequados. 
          Aceite, rejeite ou customize cada recomendação.
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
            <div className="flex items-center gap-2 p-3 flex-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <Eye className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-600">
                <strong>Preview com dados simulados</strong> - Os gráficos serão atualizados com dados reais após a integração.
              </p>
            </div>
            
            <div className="flex items-center gap-2 ml-4">
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

          {/* Dashboard Preview */}
          {showPreview && (
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
        </>
      )}
    </div>
  );
};

export default PreviewStep;
