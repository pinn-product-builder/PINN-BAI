import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardWidgetConfig } from '@/lib/mock-data';

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
  const renderWidget = (widget: DashboardWidgetConfig) => {
    const commonProps = {
      title: widget.title,
      description: widget.description,
    };

    switch (widget.type) {
      case 'metric_card':
        return (
          <MetricCard
            {...commonProps}
            value={2450}
            previousValue={2100}
            format="number"
            showSparkline
          />
        );
      case 'area_chart':
        return <AreaChartWidget {...commonProps} />;
      case 'bar_chart':
        return <BarChartWidget {...commonProps} />;
      case 'line_chart':
        return <LineChartWidget {...commonProps} />;
      case 'pie_chart':
      case 'donut_chart':
        return <PieChartWidget {...commonProps} isDonut={widget.type === 'donut_chart'} />;
      case 'funnel':
        return <FunnelWidget {...commonProps} />;
      case 'insight_card':
        return <InsightCard {...commonProps} />;
      default:
        return (
          <Card className="p-4 h-full flex items-center justify-center text-muted-foreground">
            Widget: {widget.type}
          </Card>
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
            <div key={widget.id}>
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
            <div key={widget.id}>
              {renderWidget(widget)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardPreview;
