import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
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

interface WidgetConfig {
  dataSource?: string;
  metric?: string;
  groupBy?: string;
  aggregation?: 'sum' | 'count' | 'avg' | 'min' | 'max';
  columns?: string[];
  funnelField?: string;
  dateFormat?: string;
  sourceTable?: string;
}

// Process raw data into chart-compatible format
const processChartData = (
  rawData: Record<string, unknown>[],
  config: WidgetConfig,
  widgetType: string
): any[] => {
  if (!rawData || rawData.length === 0) return [];
  
  const { metric = 'value', groupBy, aggregation = 'count' } = config;
  
  // For tables, return raw data
  if (widgetType === 'table') {
    return rawData;
  }
  
  // If no groupBy, create a single aggregated value
  if (!groupBy) {
    const values = rawData.map(row => {
      const val = row[metric];
      return typeof val === 'number' ? val : parseFloat(String(val)) || 1;
    });
    
    const aggregatedValue = aggregation === 'sum'
      ? values.reduce((a, b) => a + b, 0)
      : aggregation === 'avg'
      ? values.reduce((a, b) => a + b, 0) / values.length
      : values.length;
      
    return [{ label: metric, value: aggregatedValue, name: metric, stage: metric }];
  }
  
  // Group by the specified field
  const grouped = new Map<string, number[]>();
  
  rawData.forEach(row => {
    let key = String(row[groupBy] || 'Outros');
    
    // Handle date grouping - extract month/year
    if (groupBy.includes('date') || groupBy.includes('created_at') || groupBy.includes('updated_at')) {
      try {
        const date = new Date(String(row[groupBy]));
        if (!isNaN(date.getTime())) {
          const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          key = months[date.getMonth()];
        }
      } catch {
        // Keep original key if date parsing fails
      }
    }
    
    const value = typeof row[metric] === 'number'
      ? row[metric] as number
      : parseFloat(String(row[metric])) || 1;
    
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(value);
  });
  
  // Apply aggregation
  const result = Array.from(grouped.entries()).map(([label, values]) => {
    let value: number;
    switch (aggregation) {
      case 'sum':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'min':
        value = Math.min(...values);
        break;
      case 'max':
        value = Math.max(...values);
        break;
      default:
        value = values.length;
    }
    return { label, value, name: label, stage: label };
  });
  
  return result;
};

// Widget wrapper with source badge and controls
const WidgetWrapper = ({ 
  children, 
  sourceTable, 
  onRefresh,
  onRemove,
  isRefreshing,
  error
}: { 
  children: React.ReactNode; 
  sourceTable?: string;
  onRefresh?: () => void;
  onRemove?: () => void;
  isRefreshing?: boolean;
  error?: string | null;
}) => (
  <div className="relative group animate-fade-up h-full">
    {sourceTable && (
      <Badge 
        variant="secondary" 
        className="absolute -top-2 left-3 z-10 text-[10px] px-1.5 py-0 flex items-center gap-1"
      >
        <Database className="w-3 h-3" />
        {sourceTable}
      </Badge>
    )}
    <div className="absolute -top-2 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
      {onRefresh && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-background/80 backdrop-blur-sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      )}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-background/80 backdrop-blur-sm text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
    {error && (
      <div className="absolute inset-0 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center justify-center z-20">
        <div className="text-center p-4">
          <AlertCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
          <p className="text-xs text-destructive font-medium">Erro ao carregar dados</p>
          <p className="text-[10px] text-destructive/70 mt-1 max-w-[200px]">{error}</p>
        </div>
      </div>
    )}
    {children}
    {/* Source data button at bottom - estilo do print */}
    {sourceTable && (
      <div className="absolute bottom-2 left-0 right-0 px-3 z-10">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-[10px] text-muted-foreground hover:text-foreground bg-background/50 backdrop-blur-sm border border-border/50"
          onClick={onRefresh}
        >
          Dados em tempo real de {sourceTable}
        </Button>
      </div>
    )}
  </div>
);

// Individual widget renderer that fetches its own data
const WidgetRenderer = ({ 
  widget, 
  orgId,
  onRemove
}: { 
  widget: DashboardWidget;
  orgId: string;
  onRemove?: (widgetId: string) => void;
}) => {
  const config = (widget.config || {}) as WidgetConfig;
  const tableName = config.dataSource || config.sourceTable;
  
  const { data: externalData, isLoading, error, refetch } = useExternalData(
    orgId,
    tableName ? { tableName, limit: 1000 } : undefined
  );
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      console.error('Error refreshing widget:', err);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const handleRemove = () => {
    if (onRemove) onRemove(widget.id);
  };
  
  const rawData = externalData?.data || [];
  const chartData = processChartData(rawData, config, widget.type);
  
  // Extract error message
  let errorMessage: string | null = null;
  if (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  } else if (externalData?.error) {
    errorMessage = typeof externalData.error === 'string' ? externalData.error : 'Erro desconhecido';
  }
  
  // Check if Edge Function returned error
  if (externalData && !externalData.success && externalData.error) {
    errorMessage = typeof externalData.error === 'string' ? externalData.error : 'Erro ao buscar dados';
  }
  
  // Calculate metric value for metric cards
  const calculateMetricValue = (): number | undefined => {
    if (rawData.length === 0) return undefined;
    
    const metricField = config.metric;
    
    // If no metric field specified, try to find numeric columns
    if (!metricField) {
      // Try common metric field names
      const commonFields = ['value', 'total', 'count', 'amount', 'valor', 'total_leads', 'revenue', 'receita'];
      const foundField = commonFields.find(field => 
        rawData.some(row => row[field] !== undefined && typeof row[field] === 'number')
      );
      
      if (foundField) {
        const values = rawData
          .map((row) => {
            const val = row[foundField];
            return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
          })
          .filter((v) => !isNaN(v));
        
        return config.aggregation === 'sum'
          ? values.reduce((a, b) => a + b, 0)
          : config.aggregation === 'avg'
          ? values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
          : values.length;
      }
      
      // Fallback to count
      return rawData.length;
    }
    
    const values = rawData
      .map((row) => {
        const val = row[metricField];
        return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
      })
      .filter((v) => !isNaN(v));

    if (values.length === 0) return undefined;

    switch (config.aggregation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
      default:
        return values.length;
    }
  };
  
  // Get metric label for display (estilo do print)
  const getMetricLabel = (): string | undefined => {
    if (!rawData.length) return undefined;
    const metricField = config.metric;
    if (!metricField) {
      // Try to find the first numeric field
      const firstRow = rawData[0];
      const numericField = Object.keys(firstRow).find(key => 
        typeof firstRow[key] === 'number'
      );
      return numericField || undefined;
    }
    return metricField;
  };
  
  const wrapperProps = {
    sourceTable: tableName,
    onRefresh: tableName ? handleRefresh : undefined,
    onRemove: handleRemove,
    isRefreshing,
    error: errorMessage,
  };
  
  switch (widget.type) {
    case 'metric_card':
      const metricValue = calculateMetricValue();
      // Determine format based on metric name or config
      let format: 'number' | 'currency' | 'percentage' = 'number';
      if (config.metric?.toLowerCase().includes('revenue') || 
          config.metric?.toLowerCase().includes('receita') ||
          config.metric?.toLowerCase().includes('valor') ||
          config.metric?.toLowerCase().includes('value')) {
        format = 'currency';
      } else if (config.metric?.toLowerCase().includes('rate') || 
                 config.metric?.toLowerCase().includes('taxa') ||
                 config.metric?.toLowerCase().includes('percent')) {
        format = 'percentage';
      }
      
      return (
        <WidgetWrapper {...wrapperProps}>
          <MetricCard
            title={widget.title}
            description={widget.description || config.metric || ''}
            value={metricValue}
            format={format}
            isLoading={isLoading && !errorMessage}
            showSparkline={!!metricValue}
            metricLabel={getMetricLabel()}
          />
        </WidgetWrapper>
      );
      
    case 'area_chart':
      return (
        <WidgetWrapper {...wrapperProps}>
          <AreaChartWidget
            title={widget.title}
            description={widget.description || ''}
            data={chartData}
            xAxisKey="label"
            dataKeys={['value']}
            isLoading={isLoading}
          />
        </WidgetWrapper>
      );
      
    case 'bar_chart':
      return (
        <WidgetWrapper {...wrapperProps}>
          <BarChartWidget
            title={widget.title}
            description={widget.description || ''}
            data={chartData}
            isLoading={isLoading}
          />
        </WidgetWrapper>
      );
      
    case 'line_chart':
      return (
        <WidgetWrapper {...wrapperProps}>
          <LineChartWidget
            title={widget.title}
            description={widget.description || ''}
            data={chartData}
            dataKeys={['value']}
            xAxisKey="label"
            isLoading={isLoading}
          />
        </WidgetWrapper>
      );
      
    case 'pie_chart':
      return (
        <WidgetWrapper {...wrapperProps}>
          <PieChartWidget
            title={widget.title}
            description={widget.description || ''}
            data={chartData}
            isDonut={false}
            isLoading={isLoading}
          />
        </WidgetWrapper>
      );
      
    case 'funnel':
      return (
        <WidgetWrapper {...wrapperProps}>
          <FunnelWidget
            title={widget.title}
            description={widget.description || ''}
            data={chartData}
            isLoading={isLoading}
          />
        </WidgetWrapper>
      );
      
    case 'table':
      return (
        <WidgetWrapper {...wrapperProps}>
          <TableWidget
            title={widget.title}
            description={widget.description || ''}
            data={rawData}
            columns={config.columns?.map(col => ({ key: col, label: col, type: 'text' as const }))}
            isLoading={isLoading}
          />
        </WidgetWrapper>
      );
      
    case 'insight_card':
      return (
        <WidgetWrapper {...wrapperProps}>
          <InsightCard
            title={widget.title}
            description={widget.description || ''}
          />
        </WidgetWrapper>
      );
      
    default:
      return null;
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
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-lg" />
          ))}
        </div>
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

  // Organize widgets in a 3x3 grid layout (estilo do print)
  // Primeiro, separar widgets por tipo
  const metricWidgets = widgets.filter(w => w.type === 'metric_card');
  const chartWidgets = widgets.filter(w => ['area_chart', 'bar_chart', 'line_chart'].includes(w.type));
  const pieWidgets = widgets.filter(w => w.type === 'pie_chart');
  const funnelWidgets = widgets.filter(w => w.type === 'funnel');
  const tableWidgets = widgets.filter(w => w.type === 'table');
  const insightWidgets = widgets.filter(w => w.type === 'insight_card');

  // Layout em grid 3x3 para widgets principais (estilo do print)
  const allWidgets = [...widgets];
  const gridWidgets = allWidgets.slice(0, 9); // Primeiros 9 widgets em grid 3x3
  const remainingWidgets = allWidgets.slice(9);

  return (
    <div className="space-y-6 pb-20">
      {/* Grid 3x3 Principal - Estilo do Print */}
      {gridWidgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gridWidgets.map(widget => (
            <div key={widget.id} className="min-h-[280px]">
              <WidgetRenderer 
                widget={widget} 
                orgId={orgId || ''}
                onRemove={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      {/* Widgets Restantes - Layout Flexível */}
      {remainingWidgets.length > 0 && (
        <>
          {/* Metric Cards Adicionais */}
          {remainingWidgets.filter(w => w.type === 'metric_card').length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {remainingWidgets.filter(w => w.type === 'metric_card').map(widget => (
                <div key={widget.id} className="min-h-[140px]">
                  <WidgetRenderer 
                    widget={widget} 
                    orgId={orgId || ''}
                    onRemove={handleDelete}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Charts Adicionais */}
          {remainingWidgets.filter(w => ['area_chart', 'bar_chart', 'line_chart'].includes(w.type)).length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {remainingWidgets.filter(w => ['area_chart', 'bar_chart', 'line_chart'].includes(w.type)).map(widget => (
                <div 
                  key={widget.id} 
                  className={`min-h-[350px] ${widget.type === 'area_chart' ? 'lg:col-span-2' : ''}`}
                >
                  <WidgetRenderer 
                    widget={widget} 
                    orgId={orgId || ''}
                    onRemove={handleDelete}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Funnels e Pie Charts Adicionais */}
          {(remainingWidgets.filter(w => w.type === 'pie_chart').length > 0 || 
            remainingWidgets.filter(w => w.type === 'funnel').length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {remainingWidgets.filter(w => w.type === 'pie_chart').map(widget => (
                <div key={widget.id} className="min-h-[350px]">
                  <WidgetRenderer 
                    widget={widget} 
                    orgId={orgId || ''}
                    onRemove={handleDelete}
                  />
                </div>
              ))}
              {remainingWidgets.filter(w => w.type === 'funnel').map(widget => (
                <div key={widget.id} className="min-h-[350px]">
                  <WidgetRenderer 
                    widget={widget} 
                    orgId={orgId || ''}
                    onRemove={handleDelete}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Tables Adicionais */}
          {remainingWidgets.filter(w => w.type === 'table').length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {remainingWidgets.filter(w => w.type === 'table').map(widget => (
                <div key={widget.id} className="min-h-[400px]">
                  <WidgetRenderer 
                    widget={widget} 
                    orgId={orgId || ''}
                    onRemove={handleDelete}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Insights Adicionais */}
          {remainingWidgets.filter(w => w.type === 'insight_card').length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {remainingWidgets.filter(w => w.type === 'insight_card').map(widget => (
                <div key={widget.id} className="min-h-[200px]">
                  <WidgetRenderer 
                    widget={widget} 
                    orgId={orgId || ''}
                    onRemove={handleDelete}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardEngine;
