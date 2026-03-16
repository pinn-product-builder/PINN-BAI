import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Database } from 'lucide-react';
import type { DashboardWidgetConfig } from '../steps/PreviewStep';

import MetricCard from '@/components/dashboard/widgets/MetricCard';
import AreaChartWidget from '@/components/dashboard/widgets/AreaChartWidget';
import BarChartWidget from '@/components/dashboard/widgets/BarChartWidget';
import LineChartWidget from '@/components/dashboard/widgets/LineChartWidget';
import PieChartWidget from '@/components/dashboard/widgets/PieChartWidget';
import FunnelWidget from '@/components/dashboard/widgets/FunnelWidget';
import InsightCard from '@/components/dashboard/widgets/InsightCard';

interface DashboardPreviewProps {
  widgets: DashboardWidgetConfig[];
}

const DashboardPreview = ({ widgets }: DashboardPreviewProps) => {
  // Extract unique tables from widget data mappings
  const getWidgetTable = (widget: DashboardWidgetConfig): string | null => {
    if (widget.dataMapping && widget.dataMapping.length > 0) {
      return widget.dataMapping[0].sourceTable;
    }
    return null;
  };

  const renderWidget = (widget: DashboardWidgetConfig) => {
    const tableName = getWidgetTable(widget);
    
    const commonProps = {
      title: widget.title,
      description: widget.description,
    };

    // Wrapper with table indicator
    const WidgetWrapper = ({ children }: { children: React.ReactNode }) => (
      <div className="relative group">
        {tableName && (
          <Badge 
            variant="outline" 
            className="absolute -top-2 left-3 z-10 text-[10px] bg-card border-border text-muted-foreground flex items-center gap-1"
          >
            <Database className="w-3 h-3" />
            {tableName}
          </Badge>
        )}
        {children}
      </div>
    );

    switch (widget.type) {
      case 'metric_card':
        return (
          <WidgetWrapper>
            <MetricCard
              {...commonProps}
              value={2450}
              previousValue={2100}
              format="number"
              showSparkline
            />
          </WidgetWrapper>
        );
      case 'area_chart':
        return (
          <WidgetWrapper>
            <AreaChartWidget {...commonProps} />
          </WidgetWrapper>
        );
      case 'bar_chart':
        return (
          <WidgetWrapper>
            <BarChartWidget {...commonProps} />
          </WidgetWrapper>
        );
      case 'line_chart':
        return (
          <WidgetWrapper>
            <LineChartWidget {...commonProps} />
          </WidgetWrapper>
        );
      case 'pie_chart':
      case 'donut_chart':
        return (
          <WidgetWrapper>
            <PieChartWidget {...commonProps} isDonut={widget.type === 'donut_chart'} />
          </WidgetWrapper>
        );
      case 'funnel':
        return (
          <WidgetWrapper>
            <FunnelWidget {...commonProps} />
          </WidgetWrapper>
        );
      case 'insight_card':
        return (
          <WidgetWrapper>
            <InsightCard {...commonProps} />
          </WidgetWrapper>
        );
      default:
        return (
          <WidgetWrapper>
            <Card className="p-4 h-full flex items-center justify-center text-muted-foreground">
              Widget: {widget.type}
            </Card>
          </WidgetWrapper>
        );
    }
  };

  // Simple grid layout for preview
  const metricWidgets = widgets.filter(w => w.type === 'metric_card');
  const chartWidgets = widgets.filter(w => !['metric_card', 'insight_card'].includes(w.type));
  const insightWidgets = widgets.filter(w => w.type === 'insight_card');

  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      {metricWidgets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metricWidgets.map((widget) => (
            <div key={widget.id} className="pt-2">
              {renderWidget(widget)}
            </div>
          ))}
        </div>
      )}

      {/* Charts Grid */}
      {chartWidgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chartWidgets.map((widget) => (
            <div 
              key={widget.id}
              className={cn(
                "pt-2",
                widget.type === 'area_chart' || widget.type === 'line_chart' 
                  ? 'lg:col-span-2' 
                  : ''
              )}
            >
              {renderWidget(widget)}
            </div>
          ))}
        </div>
      )}

      {/* Insights Row */}
      {insightWidgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insightWidgets.map((widget) => (
            <div key={widget.id} className="pt-2">
              {renderWidget(widget)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardPreview;
