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
  if (!rawData || rawData.length === 0) {
    console.warn('[processChartData] No data provided', { widgetType, config });
    return [];
  }
  
  const { metric = 'value', groupBy, aggregation = 'count' } = config;
  
  console.log('[processChartData] Processing:', {
    widgetType,
    metric,
    groupBy,
    aggregation,
    dataRows: rawData.length,
    firstRowKeys: Object.keys(rawData[0] || {}),
  });
  
  // For tables, return raw data
  if (widgetType === 'table') {
    return rawData;
  }
  
  // If no groupBy, create a single aggregated value
  if (!groupBy) {
    // Filter out invalid values (null, undefined, NaN)
    const values = rawData
      .map(row => {
        const val = row[metric];
        if (val === null || val === undefined) return null;
        if (typeof val === 'number') return isNaN(val) ? null : val;
        const parsed = parseFloat(String(val));
        return isNaN(parsed) ? null : parsed;
      })
      .filter((v): v is number => v !== null);
    
    if (values.length === 0) {
      console.warn('[processChartData] No valid values found for metric:', metric);
      return [];
    }
    
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
    
    const val = row[metric];
    let value: number | null = null;
    
    if (val !== null && val !== undefined) {
      if (typeof val === 'number' && !isNaN(val)) {
        value = val;
      } else {
        const parsed = parseFloat(String(val));
        if (!isNaN(parsed)) {
          value = parsed;
        }
      }
    }
    
    // Only add valid values
    if (value !== null) {
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(value);
    }
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
  
  // Debug logging - sempre logar para debug
  if (!tableName) {
    console.warn(`[WidgetRenderer] ${widget.title} (${widget.type}): NO TABLE NAME configured!`, {
      config: config,
      widgetId: widget.id,
    });
  }
  
  console.log(`[WidgetRenderer] ${widget.title} (${widget.type}):`, {
    tableName: tableName || 'NOT SET',
    hasData: rawData.length > 0,
    dataCount: rawData.length,
    firstRow: rawData[0] || null,
    availableFields: rawData[0] ? Object.keys(rawData[0]) : [],
    config: {
      metric: config.metric,
      aggregation: config.aggregation,
      targetMetric: config.targetMetric,
      dataSource: config.dataSource,
      sourceTable: config.sourceTable,
    },
    externalDataSuccess: externalData?.success,
    externalDataError: externalData?.error,
    isLoading,
    hasError: !!error,
  });
  
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
    if (rawData.length === 0) {
      console.warn('[DashboardEngine] No data available for metric calculation');
      return undefined;
    }
    
    let metricField = config.metric;
    const aggregation = config.aggregation || 'count';
    
    console.log('[DashboardEngine] Calculating metric:', {
      metricField,
      aggregation,
      dataRows: rawData.length,
      availableFields: Object.keys(rawData[0] || {}),
    });
    
    // If no metric field specified, try to find numeric columns
    if (!metricField) {
      console.warn('[DashboardEngine] No metric field specified, trying to find numeric columns');
      
      // Try common metric field names (prioritize by widget title if available)
      const widgetTitle = widget.title?.toLowerCase() || '';
      const targetMetric = config.targetMetric?.toLowerCase() || '';
      
      // Build field suggestions based on widget title and target metric
      const commonFields = [
        // Try to match based on widget title
        ...(widgetTitle.includes('lead') ? ['total_leads', 'leads_total', 'leads', 'new_leads', 'lead_count', 'leads_total_30d', 'leads_new'] : []),
        ...(widgetTitle.includes('receita') || widgetTitle.includes('revenue') || targetMetric.includes('revenue') ? 
          ['revenue', 'receita', 'valor', 'value', 'amount', 'total_value', 'spend_30d', 'custo_total', 'spend', 'total_spent_usd'] : []),
        ...(widgetTitle.includes('convers') || targetMetric.includes('convers') ? 
          ['conversions', 'conversao', 'converted', 'conversion_count', 'meetings_done', 'reuniao_realizada_total'] : []),
        ...(widgetTitle.includes('taxa') || widgetTitle.includes('rate') || targetMetric.includes('rate') ? 
          ['conversion_rate', 'rate', 'taxa', 'percent', 'conv_lead_to_meeting_30d', 'taxa_entrada', 'taxa_atendimento'] : []),
        ...(widgetTitle.includes('reuni') || targetMetric.includes('meeting') ? 
          ['meetings_scheduled', 'meetings_done', 'reuniao_agendada_total', 'reuniao_realizada_total', 'meetings_total_30d'] : []),
        ...(widgetTitle.includes('mensagem') || targetMetric.includes('msg') ? 
          ['msg_in', 'msg_in_total', 'msg_in_30d', 'mensagens', 'message'] : []),
        ...(widgetTitle.includes('ligacao') || widgetTitle.includes('chamada') || targetMetric.includes('call') ? 
          ['calls_done', 'calls_answered', 'calls_total', 'ligacoes'] : []),
        // Generic fields - prioritize columns with _total suffix (aggregated views)
        'custo_total', 'leads_total', 'entrada_total', 'reuniao_agendada_total', 'reuniao_realizada_total',
        'value', 'total', 'count', 'amount', 'valor', 'total_leads', 'revenue', 'receita', 'leads', 'conversions',
      ];
      
      // Also check all numeric columns in the data
      const firstRow = rawData[0];
      const numericFields = Object.keys(firstRow || {}).filter(key => {
        // Skip IDs and technical fields
        if (/^id$|^uuid$|^pk$|_id$|_uuid$/i.test(key)) return false;
        const val = firstRow[key];
        return val !== undefined && val !== null && (typeof val === 'number' || !isNaN(parseFloat(String(val))));
      });
      
      // Prioritize fields with common suffixes that indicate metrics
      const prioritizedFields = numericFields.sort((a, b) => {
        const aScore = (a.includes('_total') ? 10 : 0) + (a.includes('_30d') || a.includes('_60d') || a.includes('_7d') ? 5 : 0);
        const bScore = (b.includes('_total') ? 10 : 0) + (b.includes('_30d') || b.includes('_60d') || b.includes('_7d') ? 5 : 0);
        return bScore - aScore;
      });
      
      // Combine and deduplicate - prioritize common fields first, then numeric fields
      const allFields = [...new Set([...commonFields, ...prioritizedFields, ...numericFields])];
      
      const foundField = allFields.find(field => 
        rawData.some(row => {
          const val = row[field];
          return val !== undefined && val !== null && (typeof val === 'number' || !isNaN(parseFloat(String(val))));
        })
      );
      
      if (foundField) {
        console.log('[DashboardEngine] Found field:', foundField);
        const values = rawData
          .map((row) => {
            const val = row[foundField];
            if (val === null || val === undefined) return null;
            if (typeof val === 'number') return isNaN(val) ? null : val;
            const parsed = parseFloat(String(val));
            return isNaN(parsed) ? null : parsed;
          })
          .filter((v): v is number => v !== null);
        
        if (values.length === 0) {
          console.warn('[DashboardEngine] No valid numeric values found in field:', foundField);
          // For aggregated views with single row, try to return the value anyway
          if (rawData.length === 1) {
            const singleVal = rawData[0][foundField];
            if (singleVal !== null && singleVal !== undefined) {
              const parsed = typeof singleVal === 'number' ? singleVal : parseFloat(String(singleVal));
              if (!isNaN(parsed)) {
                console.log('[DashboardEngine] Using single value from aggregated view:', parsed);
                return parsed;
              }
            }
          }
          return aggregation === 'count' ? rawData.length : undefined;
        }
        
        // For single row (aggregated view), return the value directly
        if (rawData.length === 1 && values.length === 1) {
          console.log('[DashboardEngine] Single row aggregated view, returning value directly:', values[0]);
          return values[0];
        }
        
        let result = 0;
        switch (aggregation) {
          case 'sum':
            result = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            result = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'min':
            result = Math.min(...values);
            break;
          case 'max':
            result = Math.max(...values);
            break;
          case 'count':
          default:
            result = values.length;
        }
        console.log('[DashboardEngine] Calculated value:', result, 'from', values.length, 'values');
        return result;
      }
      
      // Fallback: if it's a single row (aggregated view), try to get first numeric value
      if (rawData.length === 1) {
        const firstRow = rawData[0];
        const firstNumericValue = Object.values(firstRow).find(val => 
          val !== null && val !== undefined && typeof val === 'number' && !isNaN(val)
        ) as number | undefined;
        if (firstNumericValue !== undefined) {
          console.log('[DashboardEngine] Using first numeric value from single row:', firstNumericValue);
          return firstNumericValue;
        }
      }
      
      // Last resort: count of rows (but log warning)
      console.warn('[DashboardEngine] No field found, using row count as fallback:', rawData.length);
      return rawData.length;
    }
    
    // Check if field exists in data
    const firstRow = rawData[0] || {};
    const availableFields = Object.keys(firstRow);
    const widgetTitle = widget.title?.toLowerCase() || '';
    const targetMetric = config.targetMetric?.toLowerCase() || '';
    
    // Smart validation: check if the configured field makes sense for the widget title
    // If widget is about "Receita" but field is "total_leads", ignore the configured field
    let shouldIgnoreConfiguredField = false;
    if (metricField) {
      const metricLower = metricField.toLowerCase();
      
      // Always ignore date fields as metrics (they're for grouping, not aggregation)
      if (metricLower.includes('date') || metricLower.includes('_at') || metricLower.includes('created') || metricLower.includes('updated')) {
        shouldIgnoreConfiguredField = true;
        console.warn('[DashboardEngine] Ignoring date field as metric:', metricField, 'for widget:', widget.title);
      }
      // Check if field matches widget purpose
      else if (widgetTitle.includes('receita') || widgetTitle.includes('revenue') || widgetTitle.includes('investimento')) {
        shouldIgnoreConfiguredField = !metricLower.includes('spend') && !metricLower.includes('custo') && !metricLower.includes('receita') && !metricLower.includes('revenue') && !metricLower.includes('valor') && !metricLower.includes('investimento');
      } else if (widgetTitle.includes('convers') && !widgetTitle.includes('taxa')) {
        shouldIgnoreConfiguredField = !metricLower.includes('meeting') && !metricLower.includes('convers') && !metricLower.includes('reuniao') && !metricLower.includes('done');
      } else if (widgetTitle.includes('taxa') || widgetTitle.includes('rate')) {
        shouldIgnoreConfiguredField = !metricLower.includes('rate') && !metricLower.includes('taxa') && !metricLower.includes('conv_') && !metricLower.includes('cpl') && !metricLower.includes('cp_');
      } else if (widgetTitle.includes('novos') || widgetTitle.includes('new')) {
        // For "Novos Leads", ignore date fields and non-lead fields
        shouldIgnoreConfiguredField = metricLower.includes('date') || metricLower.includes('_at') || (!metricLower.includes('lead') && !metricLower.includes('new') && !metricLower.includes('entrada'));
      }
    }
    
    let matchingField: string | undefined = undefined;
    
    // If field doesn't exist OR doesn't make sense for the widget, find a better one
    if (!rawData[0] || !(metricField in rawData[0]) || shouldIgnoreConfiguredField) {
      if (shouldIgnoreConfiguredField) {
        console.warn('[DashboardEngine] Configured field does not match widget title:', metricField, 'Widget:', widget.title, 'Available fields:', availableFields);
      } else {
        console.warn('[DashboardEngine] Metric field not found in data:', metricField, 'Available fields:', availableFields);
      }
      
      // Try exact case-insensitive match first
      matchingField = availableFields.find(key => 
        key.toLowerCase() === metricField?.toLowerCase()
      );
      
      // If not found, try partial matches (e.g., "leads_total" matches "total_leads")
      if (!matchingField && metricField) {
        const metricLower = metricField.toLowerCase();
        matchingField = availableFields.find(key => {
          const keyLower = key.toLowerCase();
          return keyLower.includes(metricLower) || metricLower.includes(keyLower);
        });
      }
      
      // If still not found, try to find fields with similar patterns
      if (!matchingField && metricField?.includes('_')) {
        const parts = metricField.split('_');
        matchingField = availableFields.find(key => {
          const keyLower = key.toLowerCase();
          return parts.some(part => keyLower.includes(part.toLowerCase()));
        });
      }
      
      // Use widget title to find better field (ALWAYS try this if configured field doesn't make sense)
      if (!matchingField || shouldIgnoreConfiguredField) {
        // Build smart field suggestions based on widget title
        // Using actual field names from vw_dashboard_kpis_30d_v3 and vw_dashboard_daily_60d_v3
        const titleBasedFields: string[] = [];
        
        if (widgetTitle.includes('receita') || widgetTitle.includes('revenue') || widgetTitle.includes('investimento') || targetMetric.includes('revenue') || targetMetric.includes('spend')) {
          // Campos reais das views para receita/investimento
          titleBasedFields.push('spend_30d', 'spend_total_30d', 'custo_total', 'custo_30d', 'receita', 'revenue', 'valor', 'value', 'amount', 'total_spent_usd', 'investimento');
        }
        if (widgetTitle.includes('convers') && !widgetTitle.includes('taxa') || targetMetric.includes('convers') && !targetMetric.includes('rate')) {
          // Campos reais para conversões (reuniões realizadas)
          titleBasedFields.push('meetings_done', 'meetings_done_30d', 'reuniao_realizada_total', 'conversions', 'conversao', 'converted', 'conversion_count');
        }
        if (widgetTitle.includes('lead') || targetMetric.includes('lead')) {
          // Campos reais para leads
          if (widgetTitle.includes('novos') || widgetTitle.includes('new')) {
            // Para "Novos Leads", priorizar campos específicos de novos leads
            titleBasedFields.push('new_leads', 'leads_new', 'leads_30d', 'entradas_30d', 'leads_total_30d', 'total_leads', 'leads_total', 'lead_count');
          } else {
            titleBasedFields.push('leads_total_30d', 'leads_30d', 'total_leads', 'leads_total', 'new_leads', 'leads_new', 'lead_count', 'entradas_30d');
          }
        }
        if (widgetTitle.includes('taxa') || widgetTitle.includes('rate') || targetMetric.includes('rate')) {
          // Campos reais para taxas
          titleBasedFields.push('conv_lead_to_meeting_30d', 'taxa_entrada_30d', 'taxa_entrada', 'conversion_rate', 'rate', 'taxa', 'taxa_atendimento', 'cpl_30d', 'cp_meeting_booked_30d');
        }
        if (widgetTitle.includes('reuni') || targetMetric.includes('meeting')) {
          // Campos reais para reuniões
          titleBasedFields.push('meetings_scheduled_30d', 'meetings_booked_30d', 'meetings_done_30d', 'meetings_done', 'reuniao_agendada_total', 'reuniao_realizada_total');
        }
        if (widgetTitle.includes('mensagem') || widgetTitle.includes('msg') || targetMetric.includes('msg')) {
          // Campos reais para mensagens
          titleBasedFields.push('msg_in_30d', 'msg_in_total', 'msg_in', 'mensagens', 'message');
        }
        
        // Try to find any of these fields in available fields
        const foundField = titleBasedFields.find(field => 
          availableFields.some(af => af.toLowerCase().includes(field.toLowerCase()) || field.toLowerCase().includes(af.toLowerCase()))
        );
        
        if (foundField) {
          // Find the actual field name in availableFields
          matchingField = availableFields.find(af => 
            af.toLowerCase().includes(foundField.toLowerCase()) || foundField.toLowerCase().includes(af.toLowerCase())
          ) || foundField;
        }
      }
      
      if (matchingField) {
        console.log('[DashboardEngine] Found matching field:', matchingField, 'for requested:', metricField, '(based on widget title:', widget.title, ')');
        // Use the matching field instead of the configured one
        metricField = matchingField;
      } else {
        // If still not found, try one more time: search ALL available fields for numeric values
        // and match based on widget title
        console.warn('[DashboardEngine] No direct match found, searching all numeric fields...');
        
        const numericFields = availableFields.filter(key => {
          // Skip IDs, dates, and technical fields
          if (/^id$|^uuid$|^pk$|_id$|_uuid$|date|_at$|created|updated/i.test(key)) return false;
          const val = firstRow[key];
          return val !== undefined && val !== null && (typeof val === 'number' || !isNaN(parseFloat(String(val))));
        });
        
        // Try to find a field that matches the widget title
        if (numericFields.length > 0) {
          const titleBasedMatch = numericFields.find(field => {
            const fieldLower = field.toLowerCase();
            if (widgetTitle.includes('receita') || widgetTitle.includes('revenue') || widgetTitle.includes('investimento')) {
              return fieldLower.includes('spend') || fieldLower.includes('custo') || fieldLower.includes('receita') || fieldLower.includes('revenue') || fieldLower.includes('valor') || fieldLower.includes('investimento');
            }
            if (widgetTitle.includes('convers') && !widgetTitle.includes('taxa')) {
              return fieldLower.includes('meeting') || fieldLower.includes('convers') || fieldLower.includes('reuniao') || fieldLower.includes('done');
            }
            if (widgetTitle.includes('taxa') || widgetTitle.includes('rate')) {
              return fieldLower.includes('rate') || fieldLower.includes('taxa') || fieldLower.includes('conv_') || fieldLower.includes('cpl') || fieldLower.includes('cp_');
            }
            if (widgetTitle.includes('novos') || widgetTitle.includes('new')) {
              return fieldLower.includes('new') || fieldLower.includes('leads') || fieldLower.includes('entrada');
            }
            if (widgetTitle.includes('lead')) {
              return fieldLower.includes('lead') || fieldLower.includes('entrada');
            }
            return false;
          });
          
          if (titleBasedMatch) {
            console.log('[DashboardEngine] Found title-based match in numeric fields:', titleBasedMatch);
            metricField = titleBasedMatch;
          } else {
            // Last resort: use first numeric field (but log warning)
            console.warn('[DashboardEngine] Using first available numeric field as fallback:', numericFields[0]);
            metricField = numericFields[0];
          }
        } else {
          // If still not found, log available fields for debugging
          console.error('[DashboardEngine] Could not find metric field:', metricField, 'Available fields:', availableFields, 'Widget title:', widget.title);
          
          // If aggregation is count, return total rows (but log warning)
          if (aggregation === 'count') {
            console.warn('[DashboardEngine] Using row count as fallback for count aggregation');
            return rawData.length;
          }
          return undefined;
        }
      }
    }
    
    // Now use metricField (either original or the matching one) to calculate the value
    if (!metricField || !rawData[0] || !(metricField in rawData[0])) {
      console.error('[DashboardEngine] Final metric field not available:', metricField, 'Available fields:', Object.keys(rawData[0] || {}));
      return undefined;
    }
    
    // Extract values from the specified metric field
    const values = rawData
      .map((row) => {
        const val = row[metricField];
        if (val === null || val === undefined) return null;
        if (typeof val === 'number') return isNaN(val) ? null : val;
        const parsed = parseFloat(String(val));
        return isNaN(parsed) ? null : parsed;
      })
      .filter((v): v is number => v !== null);

    if (values.length === 0) {
      console.warn('[DashboardEngine] No numeric values found in field:', metricField);
      // If no numeric values found, return count of rows that have the field
      const rowsWithField = rawData.filter(row => row[metricField] !== undefined && row[metricField] !== null);
      return aggregation === 'count' ? rowsWithField.length : undefined;
    }

    // For views aggregated (usually single row with pre-aggregated values), 
    // if we have only one row, return the value directly (it's already aggregated)
    // This handles cases like vw_dashboard_kpis_30d_v3 which has one row with all KPIs
    if (rawData.length === 1) {
      const singleValue = values[0];
      if (singleValue !== null && singleValue !== undefined && !isNaN(singleValue)) {
        console.log('[DashboardEngine] Single row detected (likely aggregated view), returning value directly:', singleValue);
        return singleValue;
      }
    }

    let result = 0;
    switch (aggregation) {
      case 'sum':
        result = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        result = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'min':
        result = Math.min(...values);
        break;
      case 'max':
        result = Math.max(...values);
        break;
      case 'count':
      default:
        // For count, return number of non-null values
        result = values.length;
    }
    
    console.log('[DashboardEngine] Calculated metric value:', result, 'from field:', metricField, 'with aggregation:', aggregation, 'from', values.length, 'values');
    return result;
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
      // Determine format based on transformation, targetMetric, or metric field name
      let format: 'number' | 'currency' | 'percentage' = 'number';
      
      // First check transformation from mapping
      if (config.transformation === 'currency') {
        format = 'currency';
      } else if (config.transformation === 'percentage') {
        format = 'percentage';
      } else if (config.transformation === 'number') {
        format = 'number';
      }
      // Fallback to targetMetric name
      else if (config.targetMetric) {
        const targetMetric = config.targetMetric.toLowerCase();
        if (targetMetric.includes('revenue') || 
            targetMetric.includes('receita') ||
            targetMetric.includes('mrr') ||
            targetMetric.includes('valor') ||
            targetMetric.includes('value') ||
            targetMetric.includes('investimento')) {
          format = 'currency';
        } else if (targetMetric.includes('rate') || 
                   targetMetric.includes('taxa') ||
                   targetMetric.includes('percent') ||
                   targetMetric.includes('conversion_rate') ||
                   targetMetric.includes('growth_rate')) {
          format = 'percentage';
        }
      }
      // Last fallback to metric field name
      else if (config.metric) {
        const metricName = config.metric.toLowerCase();
        if (metricName.includes('revenue') || 
            metricName.includes('receita') ||
            metricName.includes('valor') ||
            metricName.includes('value')) {
          format = 'currency';
        } else if (metricName.includes('rate') || 
                   metricName.includes('taxa') ||
                   metricName.includes('percent')) {
          format = 'percentage';
        }
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
  // Log básico que sempre aparece
  console.log('[DashboardEngine] STARTED', dashboardId);
  
  const { orgId } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  console.log('[DashboardEngine] Component mounted:', { dashboardId, orgId });

  const { data: widgets, isLoading } = useQuery({
    queryKey: ['dashboard-widgets', dashboardId],
    queryFn: async () => {
      console.log('[DashboardEngine] Fetching widgets for dashboard:', dashboardId);
      const { data, error } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .eq('is_visible', true)
        .order('position', { ascending: true });

      if (error) {
        console.error('[DashboardEngine] Error fetching widgets:', error);
        throw error;
      }
      
      console.log('[DashboardEngine] Widgets loaded:', {
        count: data?.length || 0,
        widgets: data?.map((w: any) => ({
          id: w.id,
          title: w.title,
          type: w.type,
          tableName: w.config?.dataSource || w.config?.sourceTable || 'NOT SET',
        })),
      });
      
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

  console.log('[DashboardEngine] Render check:', {
    isLoading,
    widgetsCount: widgets?.length || 0,
    hasWidgets: !!(widgets && widgets.length > 0),
  });

  if (!widgets || widgets.length === 0) {
    console.warn('[DashboardEngine] No widgets found!', { dashboardId, widgets });
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

  // Layout premium inspirado nos templates Pinn (hero KPIs + seções bem definidas)
  // Ordena widgets pela posição definida no template
  const sortedWidgets = [...widgets].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // Agrupamentos por tipo
  const metricWidgets = sortedWidgets.filter(w => w.type === 'metric_card');
  const timeSeriesCharts = sortedWidgets.filter(w => ['area_chart', 'line_chart'].includes(w.type));
  const barCharts = sortedWidgets.filter(w => w.type === 'bar_chart');
  const pieCharts = sortedWidgets.filter(w => w.type === 'pie_chart');
  const funnelWidgets = sortedWidgets.filter(w => w.type === 'funnel');
  const tableWidgets = sortedWidgets.filter(w => w.type === 'table');
  const insightWidgets = sortedWidgets.filter(w => w.type === 'insight_card');

  // KPIs principais (hero) - até 4 cards no topo
  const heroMetrics = metricWidgets.slice(0, 4);
  const secondaryMetrics = metricWidgets.slice(4);

  // Marca widgets já usados para evitar duplicação em "outras visões"
  const usedIds = new Set<string>([
    ...heroMetrics,
    ...secondaryMetrics,
    ...timeSeriesCharts,
    ...barCharts,
    ...pieCharts,
    ...funnelWidgets,
    ...tableWidgets,
    ...insightWidgets,
  ].map(w => w.id));

  const otherWidgets = sortedWidgets.filter(w => !usedIds.has(w.id));

  // Helper para mapear "size" do template em col-span responsivo
  const sizeToCols = (size?: string | null) => {
    switch (size) {
      case 'small':
        return 'lg:col-span-3'; // 1/4
      case 'medium':
        return 'lg:col-span-6'; // 1/2
      case 'large':
        return 'lg:col-span-8'; // 2/3
      case 'full':
        return 'lg:col-span-12'; // full
      default:
        return 'lg:col-span-4'; // fallback agradável
    }
  };

  return (
    <div className="space-y-10 pb-24">
      {/* Hero KPIs no topo */}
      {heroMetrics.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-[0.18em]">
              Visão Geral
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {heroMetrics.map(widget => (
              <div key={widget.id} className="min-h-[140px]">
                <WidgetRenderer 
                  widget={widget} 
                  orgId={orgId || ''}
                  onRemove={handleDelete}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Métricas secundárias em grid fluido */}
      {secondaryMetrics.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.18em]">
              KPIs Secundários
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {secondaryMetrics.map(widget => (
              <div key={widget.id} className="min-h-[130px]">
                <WidgetRenderer 
                  widget={widget} 
                  orgId={orgId || ''}
                  onRemove={handleDelete}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Seção de evolução ao longo do tempo (linha/área) */}
      {timeSeriesCharts.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.18em]">
              Evolução no Tempo
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {timeSeriesCharts.map(widget => (
              <div 
                key={widget.id} 
                className={`min-h-[320px] ${widget.type === 'area_chart' ? 'lg:col-span-2' : ''}`}
              >
                <WidgetRenderer 
                  widget={widget} 
                  orgId={orgId || ''}
                  onRemove={handleDelete}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Distribuição por origem / comparativos (barras, pizza, funil) */}
      {(barCharts.length > 0 || pieCharts.length > 0 || funnelWidgets.length > 0) && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.18em]">
              Distribuição & Funil
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {barCharts.map(widget => (
              <div 
                key={widget.id} 
                className={`min-h-[320px] ${sizeToCols(widget.size)}`}
              >
                <WidgetRenderer 
                  widget={widget} 
                  orgId={orgId || ''}
                  onRemove={handleDelete}
                />
              </div>
            ))}
            {pieCharts.map(widget => (
              <div 
                key={widget.id} 
                className={`min-h-[320px] ${sizeToCols(widget.size)}`}
              >
                <WidgetRenderer 
                  widget={widget} 
                  orgId={orgId || ''}
                  onRemove={handleDelete}
                />
              </div>
            ))}
            {funnelWidgets.map(widget => (
              <div 
                key={widget.id} 
                className={`min-h-[320px] ${sizeToCols(widget.size)}`}
              >
                <WidgetRenderer 
                  widget={widget} 
                  orgId={orgId || ''}
                  onRemove={handleDelete}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tabelas em largura quase total */}
      {tableWidgets.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.18em]">
              Detalhamento
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {tableWidgets.map(widget => (
              <div key={widget.id} className="min-h-[420px]">
                <WidgetRenderer 
                  widget={widget} 
                  orgId={orgId || ''}
                  onRemove={handleDelete}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cartas de insight da IA */}
      {insightWidgets.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justifyBetween gap-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.18em]">
              Insights da IA
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {insightWidgets.map(widget => (
              <div key={widget.id} className="min-h-[220px]">
                <WidgetRenderer 
                  widget={widget} 
                  orgId={orgId || ''}
                  onRemove={handleDelete}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Widgets extras em um grid premium responsivo usando o size do template */}
      {otherWidgets.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.18em]">
              Outras Visões
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {otherWidgets.map(widget => (
              <div 
                key={widget.id} 
                className={`min-h-[260px] ${sizeToCols(widget.size)}`}
              >
                <WidgetRenderer 
                  widget={widget} 
                  orgId={orgId || ''}
                  onRemove={handleDelete}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardEngine;
