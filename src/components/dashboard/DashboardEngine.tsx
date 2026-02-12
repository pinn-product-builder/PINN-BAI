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
  targetMetric?: string;
  transformation?: string;
  format?: 'number' | 'currency' | 'percentage';
  // Multi-série para gráficos de evolução
  dataKeys?: string[];
  seriesLabels?: Record<string, string>;
  showTrend?: boolean;
  showSparkline?: boolean;
}

// ============================================================
// PROCESSAMENTO DE DADOS PARA GRÁFICOS
// ============================================================

/**
 * Formata uma data string para label curto (ex: "15 Jan", "23 Fev")
 */
const formatDateLabel = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  } catch {
    return dateStr;
  }
};

/**
 * Verifica se um campo de groupBy é temporal (dia/data)
 */
const isDateField = (field: string): boolean => {
  const lower = field.toLowerCase();
  return ['day', 'date', 'created_at', 'updated_at', 'dia', 'data'].some(k => lower.includes(k));
};

/**
 * Processa dados multi-série para gráficos de evolução temporal.
 * Retorna dados no formato Recharts: [{ day: "15 Jan", new_leads: 12, msg_in: 45, ... }, ...]
 */
const processMultiSeriesData = (
  rawData: Record<string, unknown>[],
  config: WidgetConfig,
): { chartData: any[]; detectedKeys: string[] } => {
  const groupBy = config.groupBy || 'day';
  const explicitKeys = config.dataKeys || [];
  
  // Se temos dataKeys explícitos, usar diretamente
  if (explicitKeys.length > 0) {
    const chartData = rawData
      .sort((a, b) => String(a[groupBy] || '').localeCompare(String(b[groupBy] || '')))
      .map(row => {
        const entry: Record<string, unknown> = {
          label: isDateField(groupBy) ? formatDateLabel(String(row[groupBy])) : String(row[groupBy] || ''),
        };
        explicitKeys.forEach(key => {
          const val = row[key];
          entry[key] = val !== null && val !== undefined ? (typeof val === 'number' ? val : parseFloat(String(val)) || 0) : 0;
        });
        return entry;
      });
    return { chartData, detectedKeys: explicitKeys };
  }
  
  // Auto-detectar colunas numéricas (excluindo groupBy e IDs)
  if (rawData.length === 0) return { chartData: [], detectedKeys: [] };
  
  const firstRow = rawData[0];
  const skipPatterns = /^(id|uuid|pk|org_id|dashboard_id|created_at|updated_at)$/i;
  const numericKeys = Object.keys(firstRow).filter(key => {
    if (key === groupBy) return false;
    if (skipPatterns.test(key)) return false;
    const val = firstRow[key];
    return val !== null && val !== undefined && (typeof val === 'number' || !isNaN(parseFloat(String(val))));
  });
  
  const chartData = rawData
    .sort((a, b) => String(a[groupBy] || '').localeCompare(String(b[groupBy] || '')))
    .map(row => {
      const entry: Record<string, unknown> = {
        label: isDateField(groupBy) ? formatDateLabel(String(row[groupBy])) : String(row[groupBy] || ''),
      };
      numericKeys.forEach(key => {
        const val = row[key];
        entry[key] = val !== null && val !== undefined ? (typeof val === 'number' ? val : parseFloat(String(val)) || 0) : 0;
      });
      return entry;
    });
  
  return { chartData, detectedKeys: numericKeys };
};

/**
 * Processa dados agrupados com aggregation (para pie, bar, funnel).
 * Suporta count sem campo numérico obrigatório.
 */
const processGroupedData = (
  rawData: Record<string, unknown>[],
  config: WidgetConfig,
): any[] => {
  const { metric = 'value', groupBy, aggregation = 'count' } = config;
  
  if (!groupBy) {
    // Sem groupBy: retorna valor agregado único
    if (aggregation === 'count') {
      return [{ label: 'Total', value: rawData.length, name: 'Total', stage: 'Total' }];
    }
    const values = rawData
      .map(row => {
        const val = row[metric];
        if (val === null || val === undefined) return null;
        return typeof val === 'number' ? val : parseFloat(String(val)) || null;
      })
      .filter((v): v is number => v !== null);
    
    if (values.length === 0) return [];
    
    const agg = aggregation === 'sum'
      ? values.reduce((a, b) => a + b, 0)
      : aggregation === 'avg'
      ? values.reduce((a, b) => a + b, 0) / values.length
      : values.length;
    
    return [{ label: metric, value: agg, name: metric, stage: metric }];
  }
  
  // Agrupar por campo
  const grouped = new Map<string, { count: number; values: number[] }>();
  
  rawData.forEach(row => {
    const rawKey = row[groupBy];
    const key = rawKey != null && String(rawKey).trim() !== '' ? String(rawKey) : 'Outros';
    
    if (!grouped.has(key)) grouped.set(key, { count: 0, values: [] });
    const bucket = grouped.get(key)!;
    bucket.count++;
    
    // Extrair valor numérico do metric (se existir)
    const val = row[metric];
    if (val !== null && val !== undefined) {
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      if (!isNaN(num)) bucket.values.push(num);
    }
  });
  
  return Array.from(grouped.entries()).map(([label, bucket]) => {
    let value: number;
    if (aggregation === 'count') {
      value = bucket.count;
    } else if (bucket.values.length === 0) {
      value = bucket.count; // Fallback para count se não há valores numéricos
    } else {
      switch (aggregation) {
        case 'sum': value = bucket.values.reduce((a, b) => a + b, 0); break;
        case 'avg': value = bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length; break;
        case 'min': value = Math.min(...bucket.values); break;
        case 'max': value = Math.max(...bucket.values); break;
        default: value = bucket.count;
      }
    }
    return { label, value, name: label, stage: label };
  }).sort((a, b) => b.value - a.value); // Ordenar por valor descendente
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
  <div className="relative group h-full">
    {/* Source badge — discrete top-left */}
    {sourceTable && (
      <Badge 
        variant="secondary" 
        className="absolute -top-2.5 left-3 z-10 text-[9px] px-1.5 py-0 h-[18px] flex items-center gap-1 bg-muted/80 backdrop-blur-sm border-border/50 font-mono"
      >
        <Database className="w-2.5 h-2.5" />
        {sourceTable}
      </Badge>
    )}
    {/* Hover controls — top-right */}
    <div className="absolute -top-2.5 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
      {onRefresh && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 bg-muted/80 backdrop-blur-sm border border-border/50 rounded-md"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-2.5 w-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      )}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 bg-muted/80 backdrop-blur-sm border border-border/50 rounded-md text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-2.5 w-2.5" />
        </Button>
      )}
    </div>
    {/* Error overlay */}
    {error && (
      <div className="absolute inset-0 bg-destructive/5 border border-destructive/20 rounded-xl flex items-center justify-center z-20 backdrop-blur-[2px]">
        <div className="text-center p-4">
          <AlertCircle className="w-5 h-5 text-destructive/70 mx-auto mb-2" />
          <p className="text-xs text-destructive font-medium">Erro ao carregar dados</p>
          <p className="text-[10px] text-destructive/60 mt-1 max-w-[200px]">{error}</p>
        </div>
      </div>
    )}
    {children}
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
  
  // Debug logging
  console.log(`[WidgetRenderer] ${widget.title} (${widget.type}):`, {
    tableName: tableName || 'NOT SET',
    dataCount: rawData.length,
    firstRowKeys: rawData[0] ? Object.keys(rawData[0]) : [],
    config: { metric: config.metric, aggregation: config.aggregation, dataSource: config.dataSource, groupBy: config.groupBy, dataKeys: config.dataKeys },
  });
  
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
  
  // ========== Resolução de formato ==========
  const resolveFormat = (cfg: WidgetConfig, title: string): 'number' | 'currency' | 'percentage' => {
    // 1. Formato explícito no config
    if (cfg.format && ['currency', 'percentage', 'number'].includes(cfg.format)) {
      return cfg.format as 'number' | 'currency' | 'percentage';
    }

    // 2. Deduzir da transformação
    if (cfg.transformation === 'currency') return 'currency';
    if (cfg.transformation === 'percentage') return 'percentage';

    // 3. Deduzir do targetMetric ou metric
    const hints = [cfg.targetMetric, cfg.metric, title].filter(Boolean).join(' ').toLowerCase();
    const currencyTerms = ['revenue', 'receita', 'mrr', 'valor', 'value', 'spend', 'custo', 'investimento', 'cpl', 'cpm', 'cac'];
    const percentTerms = ['rate', 'taxa', 'percent', 'conversão', 'growth', 'churn'];

    if (currencyTerms.some(t => hints.includes(t))) return 'currency';
    if (percentTerms.some(t => hints.includes(t))) return 'percentage';

    return 'number';
  };

  // ========== Resolução de campo métrico ==========
  // Estratégia limpa: config.metric (coluna real) → case-insensitive → targetMetric guia → primeiro numérico
  const resolveMetricField = (
    data: Record<string, unknown>[],
    cfg: WidgetConfig,
    title: string,
  ): string | null => {
    if (data.length === 0) return null;
    const available = Object.keys(data[0]);

    // 1. Campo exato presente nos dados
    if (cfg.metric && available.includes(cfg.metric)) {
      // Rejeitar campos de data como métrica (são para groupBy)
      const m = cfg.metric.toLowerCase();
      if (m.includes('date') || m.endsWith('_at') || m === 'created' || m === 'updated') {
        console.warn('[resolveMetricField] Ignorando campo de data como métrica:', cfg.metric);
      } else {
        return cfg.metric;
      }
    }

    // 2. Match case-insensitive
    if (cfg.metric) {
      const lower = cfg.metric.toLowerCase();
      const found = available.find(k => k.toLowerCase() === lower);
      if (found) return found;
    }

    // 3. Match parcial (substring nos dois sentidos)
    if (cfg.metric) {
      const lower = cfg.metric.toLowerCase();
      const found = available.find(k => {
        const kl = k.toLowerCase();
        return kl.includes(lower) || lower.includes(kl);
      });
      if (found) return found;
    }

    // 4. Usar targetMetric como guia semântico para encontrar o campo nos dados
    if (cfg.targetMetric) {
      const target = cfg.targetMetric.toLowerCase();
      const found = available.find(k => {
        const kl = k.toLowerCase();
        return kl.includes(target) || target.includes(kl);
      });
      if (found) return found;

      // Decomposição por partes (ex: "total_leads" → procurar campos com "total" ou "leads")
      const parts = target.split(/[_\s]+/).filter(p => p.length >= 3);
      if (parts.length > 0) {
        const found2 = available.find(k => {
          const kl = k.toLowerCase();
          return parts.some(p => kl.includes(p));
        });
        if (found2) return found2;
      }
    }

    // 5. Buscar pelo título do widget (termos-chave)
    const tl = title.toLowerCase();
    const numericFields = available.filter(k => {
      if (/^id$|^uuid$|^pk$|_id$|_uuid$/i.test(k)) return false;
      const v = data[0][k];
      return v !== undefined && v !== null && (typeof v === 'number' || !isNaN(parseFloat(String(v))));
    });

    if (numericFields.length > 0) {
      // Mapeia termos do título para fragmentos de nome de campo
      const hints: Array<{ keywords: string[]; fragments: string[] }> = [
        { keywords: ['lead', 'leads'], fragments: ['lead', 'entrada'] },
        { keywords: ['receita', 'revenue', 'investimento', 'custo', 'spend'], fragments: ['spend', 'custo', 'receita', 'revenue', 'valor', 'investimento'] },
        { keywords: ['convers', 'conversion'], fragments: ['meeting', 'convers', 'reuniao', 'done'] },
        { keywords: ['taxa', 'rate'], fragments: ['rate', 'taxa', 'conv_', 'cpl', 'cp_'] },
        { keywords: ['reuni', 'meeting'], fragments: ['meeting', 'reuniao'] },
        { keywords: ['mensagem', 'msg', 'message'], fragments: ['msg', 'mensag'] },
        { keywords: ['ligac', 'chamad', 'call'], fragments: ['call', 'ligac'] },
      ];

      for (const h of hints) {
        if (h.keywords.some(kw => tl.includes(kw))) {
          const match = numericFields.find(f => {
            const fl = f.toLowerCase();
            return h.fragments.some(frag => fl.includes(frag));
          });
          if (match) return match;
        }
      }

      // Priorizar campos com sufixos de agregação (_total, _30d, etc.)
      const prioritized = [...numericFields].sort((a, b) => {
        const score = (f: string) => {
          let s = 0;
          if (f.includes('_total')) s += 10;
          if (/_\d+d/.test(f)) s += 5;
          return s;
        };
        return score(b) - score(a);
      });
      return prioritized[0];
    }

    return null;
  };

  // ========== Cálculo do valor da métrica ==========
  const calculateMetricValue = (): number | undefined => {
    if (rawData.length === 0) {
      console.warn('[DashboardEngine] Sem dados para cálculo de métrica');
      return undefined;
    }

    const aggregation = config.aggregation || 'count';
    const metricField = resolveMetricField(rawData, config, widget.title || '');

    console.log('[DashboardEngine] Resolução de campo:', {
      configMetric: config.metric,
      targetMetric: config.targetMetric,
      resolvedField: metricField,
      aggregation,
      dataRows: rawData.length,
      availableFields: Object.keys(rawData[0] || {}),
    });

    if (!metricField) {
      console.warn('[DashboardEngine] Nenhum campo encontrado. Fallback: row count =', rawData.length);
      return aggregation === 'count' ? rawData.length : undefined;
    }

    // Extrair valores numéricos do campo
    const values = rawData
      .map(row => {
        const val = row[metricField];
        if (val === null || val === undefined) return null;
        if (typeof val === 'number') return isNaN(val) ? null : val;
        const parsed = parseFloat(String(val));
        return isNaN(parsed) ? null : parsed;
      })
      .filter((v): v is number => v !== null);

    if (values.length === 0) {
      console.warn('[DashboardEngine] Sem valores numéricos no campo:', metricField);
      return aggregation === 'count' ? rawData.length : undefined;
    }

    // View agregada (1 row com KPIs pré-calculados) → retorna valor direto
    if (rawData.length === 1 && values.length === 1) {
      console.log('[DashboardEngine] View agregada (1 row), retornando valor direto:', values[0]);
      return values[0];
    }

    // Aplicar agregação
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

    console.log('[DashboardEngine] Valor calculado:', result, '| campo:', metricField, '| agregação:', aggregation, '| linhas:', values.length);
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
  
  // Tradução de nomes de colunas para labels amigáveis
  const SERIES_LABELS: Record<string, string> = {
    new_leads: 'Novos Leads',
    leads_new: 'Novos Leads',
    msg_in: 'Mensagens',
    meetings_scheduled: 'Reuniões Agendadas',
    meetings_booked: 'Reuniões Agendadas',
    meetings_done: 'Reuniões Realizadas',
    spend: 'Investimento',
    calls_done: 'Ligações',
    cpl: 'CPL',
    ...(config.seriesLabels || {}),
  };

  switch (widget.type) {
    case 'metric_card': {
      const metricValue = calculateMetricValue();
      const format = resolveFormat(config, widget.title || '');
      
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
    }
      
    case 'area_chart':
    case 'line_chart': {
      // Multi-série: processamento especial para gráficos temporais
      const { chartData: multiData, detectedKeys } = processMultiSeriesData(rawData, config);
      const seriesKeys = detectedKeys.length > 0 ? detectedKeys : ['value'];
      
      // Traduzir labels das séries
      const translatedKeys = seriesKeys;
      
      const ChartComponent = widget.type === 'area_chart' ? AreaChartWidget : LineChartWidget;
      
      return (
        <WidgetWrapper {...wrapperProps}>
          <ChartComponent
            title={widget.title}
            description={widget.description || ''}
            data={multiData}
            xAxisKey="label"
            dataKeys={translatedKeys}
            seriesLabels={SERIES_LABELS}
            isLoading={isLoading}
          />
        </WidgetWrapper>
      );
    }
      
    case 'bar_chart': {
      const barData = processGroupedData(rawData, config);
      return (
        <WidgetWrapper {...wrapperProps}>
          <BarChartWidget
            title={widget.title}
            description={widget.description || ''}
            data={barData}
            isLoading={isLoading}
          />
        </WidgetWrapper>
      );
    }
      
    case 'pie_chart': {
      const pieData = processGroupedData(rawData, config);
      return (
        <WidgetWrapper {...wrapperProps}>
          <PieChartWidget
            title={widget.title}
            description={widget.description || ''}
            data={pieData}
            isDonut={true}
            isLoading={isLoading}
          />
        </WidgetWrapper>
      );
    }
      
    case 'funnel': {
      const funnelData = processGroupedData(rawData, config);
      return (
        <WidgetWrapper {...wrapperProps}>
          <FunnelWidget
            title={widget.title}
            description={widget.description || ''}
            data={funnelData}
            isLoading={isLoading}
          />
        </WidgetWrapper>
      );
    }
      
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
      <div className="space-y-8">
        {/* Skeleton KPIs */}
        <div>
          <Skeleton className="h-4 w-24 mb-3 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-xl" />
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="h-4 w-32 mb-3 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-xl" />
            ))}
          </div>
        </div>
        {/* Skeleton charts */}
        <div>
          <Skeleton className="h-4 w-32 mb-3 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-[320px] rounded-xl" />
            ))}
          </div>
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

  // KPIs: adaptar quantidade ao que existe (3→3cols, 4→4cols, 5+→5cols)
  const heroCount = Math.min(metricWidgets.length, 5);
  const heroMetrics = metricWidgets.slice(0, heroCount);
  const secondaryMetrics = metricWidgets.slice(heroCount);

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
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
            heroMetrics.length >= 5 ? 'xl:grid-cols-5' : 
            heroMetrics.length === 4 ? 'xl:grid-cols-4' : 
            heroMetrics.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-2'
          }`}>
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

      {/* Gráficos principais (time series + distribuição lado a lado) */}
      {(timeSeriesCharts.length > 0 || barCharts.length > 0 || pieCharts.length > 0 || funnelWidgets.length > 0) && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-[0.18em]">
              Análise Visual
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Evolução temporal: largura total se só 1 gráfico */}
            {timeSeriesCharts.map(widget => (
              <div 
                key={widget.id} 
                className={`min-h-[320px] ${timeSeriesCharts.length === 1 ? 'lg:col-span-2' : ''}`}
              >
                <WidgetRenderer 
                  widget={widget} 
                  orgId={orgId || ''}
                  onRemove={handleDelete}
                />
              </div>
            ))}
            {/* Barras, pizza e funil em grid de 2 colunas */}
            {barCharts.map(widget => (
              <div key={widget.id} className="min-h-[320px]">
                <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            ))}
            {funnelWidgets.map(widget => (
              <div key={widget.id} className="min-h-[320px]">
                <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            ))}
            {pieCharts.map(widget => (
              <div key={widget.id} className="min-h-[320px]">
                <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
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
          <div className="mb-3 flex items-center justify-between gap-2">
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
