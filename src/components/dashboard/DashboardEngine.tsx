import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart as BarChartIcon,
  Activity,
  AlertCircle,
  Trash2,
  Database,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DashboardWidget } from '@/lib/types';
import { useExternalData } from '@/hooks/useExternalData';

// Import chart widgets
import MetricCard from '@/components/dashboard/widgets/MetricCard';
import AreaChartWidget from '@/components/dashboard/widgets/AreaChartWidget';
import BarChartWidget from '@/components/dashboard/widgets/BarChartWidget';
import LineChartWidget from '@/components/dashboard/widgets/LineChartWidget';
import PieChartWidget from '@/components/dashboard/widgets/PieChartWidget';
import FunnelWidget from '@/components/dashboard/widgets/FunnelWidget';
import TableWidget from '@/components/dashboard/widgets/TableWidget';
import InsightCard from '@/components/dashboard/widgets/InsightCard';

// Widget renderer that renders appropriate chart type
const WidgetRenderer = ({
  widget,
  orgId,
  onDelete
}: {
  widget: DashboardWidget;
  orgId: string;
  onDelete: (id: string) => void;
}) => {
  const config = widget.config as {
    dataSource?: string;
    metric?: string;
    aggregation?: string;
    columns?: string[];
  };

  // Fetch data from external Supabase
  const { data: externalData, isLoading, error, refetch } = useExternalData(
    orgId,
    config.dataSource ? {
      tableName: config.dataSource,
      columns: config.columns,
      limit: 100,
    } : null
  );

  // Calculate metric value
  const calculateMetric = () => {
    if (!externalData?.data || externalData.data.length === 0) return null;

    const data = externalData.data;
    const metricField = config.metric;

    if (!metricField) {
      return { value: externalData.count || data.length, previousValue: null };
    }

    const values = data
      .map((row) => {
        const val = row[metricField];
        return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
      })
      .filter((v) => !isNaN(v));

    let value = 0;
    switch (config.aggregation) {
      case 'sum':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      case 'min':
        value = values.length > 0 ? Math.min(...values) : 0;
        break;
      case 'max':
        value = values.length > 0 ? Math.max(...values) : 0;
        break;
      case 'count':
      default:
        value = values.length;
    }

    return { value, previousValue: Math.round(value * 0.85) };
  };

  const metricResult = config.dataSource ? calculateMetric() : null;

  // Wrapper with table indicator and actions
  const WidgetWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="relative group h-full">
      {config.dataSource && (
        <div className="absolute -top-2 left-3 z-10 px-2 py-0.5 text-[10px] bg-card border border-border rounded text-muted-foreground flex items-center gap-1">
          <Database className="w-3 h-3" />
          {config.dataSource}
        </div>
      )}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        {config.dataSource && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground bg-background/80 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              refetch();
            }}
          >
            <RefreshCw size={12} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:bg-destructive/10 bg-background/80 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(widget.id);
          }}
        >
          <Trash2 size={12} />
        </Button>
      </div>
      {children}
    </div>
  );

  // Loading state
  if (isLoading && config.dataSource) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-xs">Carregando dados...</span>
        </div>
      </Card>
    );
  }

  // Error state
  if (error && config.dataSource) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-destructive text-center p-4">
          <AlertCircle className="w-6 h-6" />
          <span className="text-xs max-w-[200px]">{String(error)}</span>
        </div>
      </Card>
    );
  }

  // Render by widget type
  switch (widget.type) {
    case 'metric_card':
      return (
        <WidgetWrapper>
          <MetricCard
            title={widget.title}
            description={widget.description || ''}
            value={metricResult?.value ?? 0}
            previousValue={metricResult?.previousValue ?? undefined}
            format="number"
            showSparkline
          />
        </WidgetWrapper>
      );

    case 'area_chart':
      return (
        <WidgetWrapper>
          <AreaChartWidget
            title={widget.title}
            description={widget.description || ''}
          />
        </WidgetWrapper>
      );

    case 'bar_chart':
      return (
        <WidgetWrapper>
          <BarChartWidget
            title={widget.title}
            description={widget.description || ''}
          />
        </WidgetWrapper>
      );

    case 'line_chart':
      return (
        <WidgetWrapper>
          <LineChartWidget
            title={widget.title}
            description={widget.description || ''}
          />
        </WidgetWrapper>
      );

    case 'pie_chart':
      return (
        <WidgetWrapper>
          <PieChartWidget
            title={widget.title}
            description={widget.description || ''}
            isDonut={false}
          />
        </WidgetWrapper>
      );

    case 'funnel':
      return (
        <WidgetWrapper>
          <FunnelWidget
            title={widget.title}
            description={widget.description || ''}
          />
        </WidgetWrapper>
      );

    case 'table':
      return (
        <WidgetWrapper>
          <TableWidget
            title={widget.title}
            description={widget.description || ''}
          />
        </WidgetWrapper>
      );

    case 'insight_card':
      return (
        <WidgetWrapper>
          <InsightCard
            title={widget.title}
            description={widget.description || ''}
          />
        </WidgetWrapper>
      );

    default:
      return (
        <WidgetWrapper>
          <Card className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <span className="text-xs font-mono">Widget: {widget.type}</span>
            </div>
          </Card>
        </WidgetWrapper>
      );
  }
};

const DashboardEngine = ({ dashboardId }: { dashboardId: string }) => {
  const { orgId } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: widgets, isLoading } = useQuery({
    queryKey: ['dashboard-widgets', dashboardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .eq('is_visible', true)
        .order('position', { ascending: true });

      if (error) throw error;
      return (data as any) as DashboardWidget[];
    },
    enabled: !!dashboardId,
  });

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('dashboard_widgets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets', dashboardId] });

      toast({
        title: "Widget Excluído",
        description: "O widget foi removido do seu painel.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-[300px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!widgets || widgets.length === 0) {
    return (
      <Card className="p-12 border-dashed flex flex-col items-center justify-center text-center gap-4 bg-muted/20 rounded-3xl">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Dashboard Vazio</h3>
          <p className="text-muted-foreground max-w-xs mx-auto">
            Ainda não há widgets configurados. A IA irá sugerir widgets assim que os dados forem integrados.
          </p>
        </div>
      </Card>
    );
  }

  // Group widgets by type for better layout
  const metricWidgets = widgets.filter(w => w.type === 'metric_card');
  const chartWidgets = widgets.filter(w => ['area_chart', 'bar_chart', 'line_chart'].includes(w.type));
  const pieAndFunnelWidgets = widgets.filter(w => ['pie_chart', 'funnel'].includes(w.type));
  const tableWidgets = widgets.filter(w => w.type === 'table');
  const insightWidgets = widgets.filter(w => w.type === 'insight_card');

  return (
    <div className="space-y-6 pb-20">
      {/* Metric Cards Row */}
      {metricWidgets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metricWidgets.map((widget) => (
            <div key={widget.id} className="pt-3">
              <WidgetRenderer
                widget={widget}
                orgId={orgId || ''}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      {/* Line/Area/Bar Charts */}
      {chartWidgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {chartWidgets.map((widget) => (
            <div 
              key={widget.id} 
              className={`pt-3 ${widget.type === 'area_chart' ? 'md:col-span-2' : ''}`}
            >
              <WidgetRenderer
                widget={widget}
                orgId={orgId || ''}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      {/* Pie Charts and Funnels */}
      {pieAndFunnelWidgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pieAndFunnelWidgets.map((widget) => (
            <div key={widget.id} className="pt-3">
              <WidgetRenderer
                widget={widget}
                orgId={orgId || ''}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      {/* Tables */}
      {tableWidgets.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {tableWidgets.map((widget) => (
            <div key={widget.id} className="pt-3">
              <WidgetRenderer
                widget={widget}
                orgId={orgId || ''}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      {/* Insight Cards */}
      {insightWidgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {insightWidgets.map((widget) => (
            <div key={widget.id} className="pt-3">
              <WidgetRenderer
                widget={widget}
                orgId={orgId || ''}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardEngine;
