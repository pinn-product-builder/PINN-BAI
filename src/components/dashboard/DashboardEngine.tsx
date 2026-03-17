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
import { resolveByWidgetTitle } from '@/lib/referenceMappings';
import { REFERENCE_MAPPINGS } from '@/lib/referenceMappings';

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
  metricField?: string; // Alias usado em configs da BF Company
  groupBy?: string;
  aggregation?: 'sum' | 'count' | 'avg' | 'min' | 'max';
  columns?: string[];
  funnelField?: string;
  funnelFields?: string[];
  funnelStages?: string[];
  dateFormat?: string;
  sourceTable?: string;
  targetMetric?: string;
  transformation?: string;
  format?: 'number' | 'currency' | 'percentage';
  // Flag: view já retorna dados agregados (1 row = 1 período de KPIs)
  // Quando true, o engine NÃO aplica SUM/COUNT — retorna o valor direto do campo
  isAggregatedView?: boolean;
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
 * Resolve o campo de agrupamento real nos dados.
 * Se o groupBy configurado não existe, tenta alternativas comuns.
 */
const resolveGroupByField = (
  data: Record<string, unknown>[],
  configGroupBy: string,
  preferDate: boolean
): string | null => {
  if (data.length === 0) return null;
  const available = Object.keys(data[0]);
  
  // 1. Campo exato
  if (available.includes(configGroupBy)) return configGroupBy;
  
  // 2. Case-insensitive
  const lower = configGroupBy.toLowerCase();
  const found = available.find(k => k.toLowerCase() === lower);
  if (found) return found;
  
  // 3. Match parcial
  const partial = available.find(k => {
    const kl = k.toLowerCase();
    return kl.includes(lower) || lower.includes(kl);
  });
  if (partial) return partial;
  
  // 4. Fallback: procurar qualquer campo de data ou categórico
  if (preferDate) {
    const datePatterns = ['created_at', 'date', 'day', 'dia', 'data', 'created', 'updated_at', 'timestamp'];
    for (const pattern of datePatterns) {
      const match = available.find(k => k.toLowerCase().includes(pattern));
      if (match) return match;
    }
  } else {
    const catPatterns = ['source', 'origem', 'status', 'stage', 'etapa', 'tipo', 'type', 'category', 'canal', 'channel'];
    for (const pattern of catPatterns) {
      const match = available.find(k => k.toLowerCase().includes(pattern));
      if (match) return match;
    }
    // Último recurso: primeiro campo de texto (não numérico, não id)
    const textField = available.find(k => {
      if (/^id$|^uuid$|^pk$|_id$|_uuid$/i.test(k)) return false;
      const val = data[0][k];
      return typeof val === 'string' && val.length > 0;
    });
    if (textField) return textField;
  }
  
  return null;
};

/**
 * Ordem canônica das séries para fontes conhecidas.
 * Garante que as cores sejam sempre consistentes independente da ordem
 * em que os campos chegam nos dados.
 */
const CANONICAL_SERIES_ORDER: Record<string, string[]> = {
  kommo_leads: [
    'encaminhado',
    'atendimento_feito',
    'reuniao_confirmada',
    'reuniao_realizada',
    'venda',
    'desqualificado',
    'hermes_entrada',
  ],
};

/**
 * Processa dados multi-série para gráficos de evolução temporal.
 * Retorna dados no formato Recharts: [{ day: "15 Jan", new_leads: 12, msg_in: 45, ... }, ...]
 */
const processMultiSeriesData = (
  rawData: Record<string, unknown>[],
  config: WidgetConfig,
): { chartData: any[]; detectedKeys: string[] } => {
  if (rawData.length === 0) return { chartData: [], detectedKeys: [] };

  // Resolver groupBy REAL (pode não existir nos dados)
  const configGroupBy = config.groupBy || 'day';
  const groupBy = resolveGroupByField(rawData, configGroupBy, true);
  
  if (!groupBy) {
    console.warn('[processMultiSeriesData] Nenhum campo de agrupamento encontrado. Config:', configGroupBy, 'Disponíveis:', Object.keys(rawData[0]));
    // Fallback: agrupar por índice
    const firstRow = rawData[0];
    const isSkipField = (k: string) => {
      const l = k.toLowerCase();
      return l === 'id' || l.endsWith('_id') || l === 'uuid' || l === 'pk' ||
        l.endsWith('_at') || l.endsWith('_at_ts') || l.endsWith('_at_iso') || l.endsWith('_in_db_at') ||
        ['timestamp', 'date', 'datetime', 'time', 'day', 'dia', 'data'].includes(l);
    };
    const numericKeys = Object.keys(firstRow).filter(key => {
      if (isSkipField(key)) return false;
      const val = firstRow[key];
      if (typeof val === 'boolean') return true;
      return val !== null && val !== undefined && (typeof val === 'number' || !isNaN(parseFloat(String(val))));
    });
    if (numericKeys.length === 0) return { chartData: [], detectedKeys: [] };
    const chartData = rawData.map((row, i) => {
      const entry: Record<string, unknown> = { label: `#${i + 1}` };
      numericKeys.forEach(key => {
        const val = row[key];
        entry[key] = typeof val === 'boolean' ? (val ? 1 : 0) : (typeof val === 'number' ? val : parseFloat(String(val)) || 0);
      });
      return entry;
    });
    return { chartData, detectedKeys: numericKeys };
  }

  console.log('[processMultiSeriesData] groupBy resolvido:', configGroupBy, '→', groupBy);

  // Resolver dataKeys: explícito no config > ordem canônica por fonte > auto-detect
  const availableColumns = Object.keys(rawData[0]);
  const dataSource = (config.dataSource || config.sourceTable || '').toLowerCase();
  const canonicalOrder = Object.entries(CANONICAL_SERIES_ORDER).find(([src]) =>
    dataSource.includes(src)
  )?.[1];

  let explicitKeys: string[] = config.dataKeys || [];

  // Se não há dataKeys explícitos mas existe ordem canônica para a fonte,
  // usar os campos canônicos que realmente existem nos dados
  if (explicitKeys.length === 0 && canonicalOrder) {
    explicitKeys = canonicalOrder.filter(k => availableColumns.includes(k));
    console.log('[processMultiSeriesData] Usando ordem canônica para', dataSource, '→', explicitKeys);
  }

  // Se temos dataKeys explícitos, verificar se existem nos dados
  const validExplicitKeys = explicitKeys.filter(k => availableColumns.includes(k));
  
  if (validExplicitKeys.length > 0) {
    // Detect if fields are boolean (need aggregation per group)
    const sampleRow = rawData.find(r => validExplicitKeys.some(k => r[k] !== null && r[k] !== undefined));
    const hasBooleanFields = sampleRow && validExplicitKeys.some(k => typeof sampleRow[k] === 'boolean');

    if (hasBooleanFields) {
      // Aggregate boolean fields: count true values per groupBy period
      const grouped = new Map<string, Record<string, number>>();
      rawData.forEach(row => {
        const rawLabel = String(row[groupBy] || '');
        const label = isDateField(groupBy) ? formatDateLabel(rawLabel) : rawLabel;
        if (!grouped.has(label)) {
          const entry: Record<string, number> = {};
          validExplicitKeys.forEach(k => { entry[k] = 0; });
          grouped.set(label, entry);
        }
        const bucket = grouped.get(label)!;
        validExplicitKeys.forEach(k => {
          const val = row[k];
          if (typeof val === 'boolean') {
            if (val) bucket[k]++;
          } else {
            bucket[k] += (typeof val === 'number' ? val : parseFloat(String(val)) || 0);
          }
        });
      });
      // Sort by original date order
      const sortedLabels = [...grouped.keys()].sort();
      const chartData = sortedLabels.map(label => ({ label, ...grouped.get(label)! }));
      return { chartData, detectedKeys: validExplicitKeys };
    }

    const chartData = rawData
      .sort((a, b) => String(a[groupBy] || '').localeCompare(String(b[groupBy] || '')))
      .map(row => {
        const entry: Record<string, unknown> = {
          label: isDateField(groupBy) ? formatDateLabel(String(row[groupBy])) : String(row[groupBy] || ''),
        };
        validExplicitKeys.forEach(key => {
          const val = row[key];
          entry[key] = val !== null && val !== undefined ? (typeof val === 'number' ? val : parseFloat(String(val)) || 0) : 0;
        });
        return entry;
      });
    return { chartData, detectedKeys: validExplicitKeys };
  }
  
  // Auto-detectar colunas numéricas usando detecção semântica genérica.
  // Rejeita: IDs, timestamps, textos, colunas com cardinalidade baixa (categorias).
  const firstRow = rawData[0];

  const isSkippableField = (key: string): boolean => {
    const lower = key.toLowerCase();
    // IDs e chaves estrangeiras — nunca são métricas
    if (/^id$|^uuid$|^pk$|_id$|_uuid$|^org_id$|^user_id$|^integration_id$/i.test(key)) return true;
    // Timestamps e datas — usados só como groupBy, não como série
    if (lower.endsWith('_at') || lower.endsWith('_ts') || lower.endsWith('_date') ||
        ['created', 'updated', 'deleted', 'timestamp', 'datetime'].some(t => lower.includes(t))) return true;
    // Campos claramente textuais ou de baixa utilidade
    if (['name', 'nome', 'email', 'phone', 'telefone', 'descr', 'observ', 'comment',
         'label', 'slug', 'url', 'token', 'hash', 'type', 'tipo', 'category', 'categoria'].some(t => lower.includes(t))) return true;
    // Campos de status/origem são boas dimensões mas não séries temporais
    if (['status', 'stage', 'etapa', 'fase', 'source', 'origem', 'canal', 'channel'].some(t => lower === t)) return true;
    return false;
  };

  const numericKeys = Object.keys(firstRow).filter(key => {
    if (key === groupBy) return false;
    if (isSkippableField(key)) return false;
    const val = firstRow[key];
    // Aceitar booleanos como numéricos (true=1, false=0)
    if (typeof val === 'boolean') return true;
    return val !== null && val !== undefined && (typeof val === 'number' || !isNaN(parseFloat(String(val))));
  });
  
  // Se não há colunas numéricas, contar registros agrupados por data
  if (numericKeys.length === 0 && isDateField(groupBy)) {
    const grouped = new Map<string, number>();
    rawData.forEach(row => {
      const key = formatDateLabel(String(row[groupBy] || ''));
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });
    const chartData = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count]) => ({ label, total: count }));
    return { chartData, detectedKeys: ['total'] };
  }
  
  const chartData = rawData
    .sort((a, b) => String(a[groupBy] || '').localeCompare(String(b[groupBy] || '')))
    .map(row => {
      const entry: Record<string, unknown> = {
        label: isDateField(groupBy) ? formatDateLabel(String(row[groupBy])) : String(row[groupBy] || ''),
      };
      numericKeys.forEach(key => {
        const val = row[key];
        entry[key] = typeof val === 'boolean' ? (val ? 1 : 0) : (val !== null && val !== undefined ? (typeof val === 'number' ? val : parseFloat(String(val)) || 0) : 0);
      });
      return entry;
    });
  
  return { chartData, detectedKeys: numericKeys };
};

/**
 * Processa dados agrupados com aggregation (para pie, bar, funnel).
 * Suporta count sem campo numérico obrigatório.
 * Resolve groupBy automaticamente se o campo configurado não existe.
 */
const processGroupedData = (
  rawData: Record<string, unknown>[],
  config: WidgetConfig,
): any[] => {
  if (rawData.length === 0) return [];
  
  const { metric = 'value', aggregation = 'count' } = config;
  
  // Resolver groupBy REAL
  const configGroupBy = config.groupBy;
  const resolvedGroupBy = configGroupBy 
    ? resolveGroupByField(rawData, configGroupBy, false) 
    : null;
  
  console.log('[processGroupedData] groupBy:', configGroupBy, '→', resolvedGroupBy);
  
  if (!resolvedGroupBy) {
    // Sem groupBy válido: retorna valor agregado único
    if (aggregation === 'count') {
      return [{ label: 'Total', value: rawData.length, name: 'Total', stage: 'Total' }];
    }
    // Tentar encontrar metric nos dados
    const available = Object.keys(rawData[0]);
    const realMetric = available.includes(metric) ? metric : available.find(k => {
      if (/^(id|uuid|pk|org_id)$/i.test(k)) return false;
      const v = rawData[0][k];
      return typeof v === 'number';
    });
    
    if (!realMetric) return [{ label: 'Total', value: rawData.length, name: 'Total', stage: 'Total' }];
    
    const values = rawData
      .map(row => {
        const val = row[realMetric];
        if (val === null || val === undefined) return null;
        return typeof val === 'number' ? val : parseFloat(String(val)) || null;
      })
      .filter((v): v is number => v !== null);
    
    if (values.length === 0) return [{ label: 'Total', value: rawData.length, name: 'Total', stage: 'Total' }];
    
    const agg = aggregation === 'sum'
      ? values.reduce((a, b) => a + b, 0)
      : aggregation === 'avg'
      ? values.reduce((a, b) => a + b, 0) / values.length
      : values.length;
    
    return [{ label: realMetric, value: agg, name: realMetric, stage: realMetric }];
  }
  
  // Agrupar por campo resolvido
  const grouped = new Map<string, { count: number; values: number[] }>();
  
  // Resolver metric real nos dados
  const available = Object.keys(rawData[0]);
  const realMetric = available.includes(metric) ? metric : null;
  
  rawData.forEach(row => {
    const rawKey = row[resolvedGroupBy];
    const key = rawKey != null && String(rawKey).trim() !== '' ? String(rawKey) : 'Outros';
    
    if (!grouped.has(key)) grouped.set(key, { count: 0, values: [] });
    const bucket = grouped.get(key)!;
    bucket.count++;
    
    // Extrair valor numérico do metric real (se existir)
    if (realMetric) {
      const val = row[realMetric];
      if (val !== null && val !== undefined) {
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        if (!isNaN(num)) bucket.values.push(num);
      }
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
  const rawConfig = (widget.config || {}) as WidgetConfig;
  // Normalizar: metricField → metric (BF Company usa metricField no DB)
  const config: WidgetConfig = {
    ...rawConfig,
    metric: rawConfig.metric || rawConfig.metricField,
  };
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
  // Estratégia: config.metric (coluna real) → case-insensitive → targetMetric guia → primeiro numérico
  // IMPORTANTE: campos de data (created_at, etc) NÃO são métricas válidas
  const resolveMetricField = (
    data: Record<string, unknown>[],
    cfg: WidgetConfig,
    title: string,
  ): string | null => {
    if (data.length === 0) return null;
    const available = Object.keys(data[0]);
    
    // Helper: rejeitar campos de data/timestamp como métrica
    const isDateColumn = (col: string): boolean => {
      const cl = col.toLowerCase();
      return cl.includes('date') || cl.endsWith('_at') || cl === 'created' || cl === 'updated' || cl === 'timestamp' || cl === 'day' || cl === 'dia';
    };
    
    // Helper: rejeitar campos de ID
    const isIdColumn = (col: string): boolean => /^id$|^uuid$|^pk$|_id$|_uuid$|^org_/i.test(col);
    
    // Helper: verificar se coluna tem valores numéricos
    const isNumericColumn = (col: string): boolean => {
      const v = data[0][col];
      return v !== undefined && v !== null && (typeof v === 'number' || !isNaN(parseFloat(String(v))));
    };

    // 1. Campo exato presente nos dados (e não é data/ID)
    if (cfg.metric && available.includes(cfg.metric) && !isDateColumn(cfg.metric) && !isIdColumn(cfg.metric)) {
      return cfg.metric;
    }

    // 2. Match case-insensitive (excluindo datas)
    if (cfg.metric) {
      const lower = cfg.metric.toLowerCase();
      const found = available.find(k => k.toLowerCase() === lower && !isDateColumn(k) && !isIdColumn(k));
      if (found) return found;
    }

    // 3. Filtrar para campos numéricos úteis
    const numericFields = available.filter(k => !isDateColumn(k) && !isIdColumn(k) && isNumericColumn(k));

    // 4. Match parcial com cfg.metric (substring)
    if (cfg.metric && numericFields.length > 0) {
      const lower = cfg.metric.toLowerCase();
      const found = numericFields.find(k => {
        const kl = k.toLowerCase();
        return kl.includes(lower) || lower.includes(kl);
      });
      if (found) return found;
    }

    // 5. Usar targetMetric como guia semântico
    if (cfg.targetMetric && numericFields.length > 0) {
      const target = cfg.targetMetric.toLowerCase();
      const parts = target.split(/[_\s]+/).filter(p => p.length >= 3);
      if (parts.length > 0) {
        const found = numericFields.find(k => {
          const kl = k.toLowerCase();
          return parts.some(p => kl.includes(p));
        });
        if (found) return found;
      }
    }

    // 5.5. NOVO: Usar Afonsina config como lookup inteligente
    // Se o widget tem um título que corresponde a um widget Afonsina,
    // usar o metricField da configuração para encontrar o campo nos dados
    const afonsinaConfig = resolveByWidgetTitle(title, []);
    if (afonsinaConfig && numericFields.length > 0) {
      const afonsinaField = afonsinaConfig.fieldName.toLowerCase();
      const match = numericFields.find(k => k.toLowerCase() === afonsinaField);
      if (match) {
        console.log(`[resolveMetricField] Afonsina match: ${title} → ${match}`);
        return match;
      }
      // Match parcial com campo Afonsina
      const partialMatch = numericFields.find(k => {
        const kl = k.toLowerCase();
        return kl.includes(afonsinaField) || afonsinaField.includes(kl);
      });
      if (partialMatch) {
        console.log(`[resolveMetricField] Afonsina partial match: ${title} → ${partialMatch}`);
        return partialMatch;
      }
    }

    // 5.6. NOVO: Usar reference mappings como fallback
    if (cfg.targetMetric && numericFields.length > 0) {
      const refMapping = REFERENCE_MAPPINGS.find(m => {
        const tl = cfg.targetMetric!.toLowerCase();
        const ml = m.targetMetric.toLowerCase();
        return tl === ml || tl.includes(ml) || ml.includes(tl);
      });
      if (refMapping) {
        // Procurar campos que batem com os fieldPatterns do reference mapping
        for (const view of refMapping.viewPatterns) {
          const match = numericFields.find(k => view.fieldPattern.test(k));
          if (match) {
            console.log(`[resolveMetricField] Reference mapping: ${cfg.targetMetric} → ${match}`);
            return match;
          }
        }
      }
    }

    // 6. Buscar pelo título do widget (termos-chave)
    const tl = title.toLowerCase();
    if (numericFields.length > 0) {
      const hints: Array<{ keywords: string[]; fragments: string[] }> = [
        { keywords: ['lead', 'leads', 'total de'], fragments: ['lead', 'entrada', 'total', 'count'] },
        { keywords: ['receita', 'revenue', 'investimento', 'custo', 'spend', 'valor'], fragments: ['spend', 'custo', 'receita', 'revenue', 'valor', 'investimento', 'price', 'amount', 'value'] },
        { keywords: ['convers', 'conversion'], fragments: ['meeting', 'convers', 'reuniao', 'done'] },
        { keywords: ['taxa', 'rate', 'cpl', 'cpm'], fragments: ['rate', 'taxa', 'conv', 'cpl', 'cp', 'percent'] },
        { keywords: ['reuni', 'meeting'], fragments: ['meeting', 'reuniao'] },
        { keywords: ['mensagem', 'msg', 'message'], fragments: ['msg', 'mensag', 'message'] },
        { keywords: ['ligac', 'chamad', 'call'], fragments: ['call', 'ligac', 'phone'] },
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
          const fl = f.toLowerCase();
          let s = 0;
          if (fl.includes('total')) s += 10;
          if (fl.includes('count')) s += 8;
          if (/_\d+d/.test(fl)) s += 5;
          if (fl.includes('value') || fl.includes('valor')) s += 3;
          return s;
        };
        return score(b) - score(a);
      });
      return prioritized[0];
    }

    // 7. Nenhum campo numérico → retorna null (fallback será count)
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
      // Sem campo resolvido → contagem de registros é SEMPRE um fallback válido
      console.warn('[DashboardEngine] Nenhum campo encontrado. Fallback: row count =', rawData.length);
      return rawData.length;
    }

    // Check if the metric field is boolean (e.g., reuniao, reuniao_agendada)
    const sampleVal = rawData.find(r => r[metricField] !== null && r[metricField] !== undefined)?.[metricField];
    const isBooleanField = typeof sampleVal === 'boolean';

    if (isBooleanField) {
      const trueCount = rawData.filter(r => r[metricField] === true).length;
      const format = resolveFormat(config, widget.title || '');
      
      if (format === 'percentage') {
        const rate = rawData.length > 0 ? (trueCount / rawData.length) * 100 : 0;
        console.log('[DashboardEngine] Boolean percentage:', metricField, '→', rate.toFixed(1), '%');
        return parseFloat(rate.toFixed(1));
      }
      
      console.log('[DashboardEngine] Boolean count:', metricField, '→', trueCount, 'de', rawData.length);
      return trueCount;
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
      console.warn('[DashboardEngine] Sem valores numéricos no campo:', metricField, '→ usando row count');
      return rawData.length;
    }

    // View agregada (flag explícita OU 1 row com KPIs pré-calculados) → retorna valor direto
    // Detectar automaticamente se a view é KPI: nome contém vw_*, kpi, _30d, _60d, summary
    const tableName = (config.dataSource || config.sourceTable || '').toLowerCase();
    const isViewKpi = config.isAggregatedView ||
      /^vw_|^view_/i.test(tableName) ||
      /kpi|_30d|_60d|_7d|summary|overview/i.test(tableName);

    if (isViewKpi && values.length >= 1) {
      // View KPI: retorna o primeiro valor sem re-agregar (evita double-sum)
      console.log('[DashboardEngine] View KPI detectada, valor direto:', values[0], '| tabela:', tableName);
      return values[0];
    }

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
        result = rawData.length;
    }

    console.log('[DashboardEngine] Valor calculado:', result, '| campo:', metricField, '| agregação:', aggregation, '| linhas:', values.length);
    return result;
  };
  
  // Friendly subtitle based on metric/widget context
  const METRIC_SUBTITLES: Record<string, string> = {
    custo_total: 'Acumulado do mês',
    spend: 'Acumulado do mês',
    spend_30d: 'Acumulado do mês',
    investimento: 'Acumulado do mês',
    leads: 'Últimos 30 dias',
    leads_total_30d: 'Últimos 30 dias',
    leads_new: 'Últimos 30 dias',
    new_leads: 'Últimos 30 dias',
    entradas: 'Últimos 30 dias',
    msg_in_30d: 'Últimos 30 dias',
    taxa_entrada: 'Média 30 dias',
    conversion_rate: 'Média 30 dias',
    conv_lead_to_meeting_30d: 'Média 30 dias',
    cpl: 'Média 30 dias',
    cpl_30d: 'Média 30 dias',
    cpm: 'Média 30 dias',
    cp_meeting_booked_30d: 'Média 30 dias',
    meetings_booked: 'Últimos 30 dias',
    meetings_booked_30d: 'Últimos 30 dias',
    meetings_done: 'Últimos 30 dias',
    meetings_done_30d: 'Últimos 30 dias',
    calls_done: 'Últimos 30 dias',
  };

  const getMetricSubtitle = (): string => {
    const metricField = config.metric;
    if (metricField) {
      const lower = metricField.toLowerCase().trim();
      if (METRIC_SUBTITLES[lower]) return METRIC_SUBTITLES[lower];
    }
    return 'Últimos 30 dias';
  };
  
  const wrapperProps = {
    onRefresh: tableName ? handleRefresh : undefined,
    onRemove: handleRemove,
    isRefreshing,
    error: errorMessage,
  };
  
  // Tradução de nomes de colunas para labels amigáveis
  const SERIES_LABELS: Record<string, string> = {
    new_leads: 'Novos Leads',
    leads_new: 'Novos Leads',
    leads_total: 'Total de Leads',
    msg_in: 'Mensagens',
    meetings_scheduled: 'Reuniões Agendadas',
    meetings_booked: 'Reuniões Agendadas',
    meetings_done: 'Reuniões Realizadas',
    spend: 'Investimento',
    calls_done: 'Ligações',
    cpl: 'CPL',
    total: 'Total',
    // Campos Kommo
    hermes_entrada: 'Entrada',
    hermes_encaminhado: 'Encaminhado',
    encaminhado: 'Encaminhado',
    atendimento_feito: 'Atendimento Feito',
    reuniao_confirmada: 'Reunião Confirmada',
    reuniao_realizada: 'Reunião Realizada',
    venda: 'Venda',
    desqualificado: 'Desqualificado',
    ...(config.seriesLabels || {}),
  };

  switch (widget.type) {
    case 'metric_card': {
      let metricValue = calculateMetricValue();
      const format = resolveFormat(config, widget.title || '');
      
      // Override: "Reuniões Realizadas" forçado a 0 (não está sendo marcado no CRM)
      if (widget.title && widget.title.toLowerCase().includes('reuniões realizadas')) {
        metricValue = 0;
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
            metricLabel={getMetricSubtitle()}
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
      let funnelData: any[];
      
      // Funil baseado em campos booleanos (BF Company: funnelFields + funnelStages)
      if (config.funnelFields && config.funnelStages && rawData.length > 0) {
        funnelData = config.funnelFields.map((field, i) => {
          const label = config.funnelStages?.[i] || field;
          const count = rawData.filter(row => row[field] === true).length;
          return { label, value: count, name: label, stage: label };
        });
      } else {
        funnelData = processGroupedData(rawData, config);
      }
      
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

  // Layout premium inspirado no dashboard Afonsina de referência
  const sortedWidgets = [...widgets].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // Agrupamentos por tipo
  const metricWidgets = sortedWidgets.filter(w => w.type === 'metric_card');
  const timeSeriesCharts = sortedWidgets.filter(w => ['area_chart', 'line_chart'].includes(w.type));
  const funnelWidgets = sortedWidgets.filter(w => w.type === 'funnel');
  const barCharts = sortedWidgets.filter(w => w.type === 'bar_chart');
  const pieCharts = sortedWidgets.filter(w => w.type === 'pie_chart');
  const tableWidgets = sortedWidgets.filter(w => w.type === 'table');
  const insightWidgets = sortedWidgets.filter(w => w.type === 'insight_card');

  // Combine tables + bar charts sorted by position for side-by-side pairing
  const tablesAndBars = [...tableWidgets, ...barCharts].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const heroCount = Math.min(metricWidgets.length, 4);
  const heroMetrics = metricWidgets.slice(0, heroCount);
  const secondaryMetrics = metricWidgets.slice(heroCount, heroCount + 4);
  const extraMetrics = metricWidgets.slice(heroCount + 4);

  return (
    <div className="space-y-8 pb-24">
      {/* Section: Indicadores Principais */}
      {heroMetrics.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">Últimos 30 Dias</h2>
          <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`}>
            {heroMetrics.map(widget => (
              <div key={widget.id} className="min-h-[130px]">
                <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Secondary KPIs row */}
      {secondaryMetrics.length > 0 && (
        <section>
          <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`}>
            {secondaryMetrics.map(widget => (
              <div key={widget.id} className="min-h-[120px]">
                <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Extra metrics if any */}
      {extraMetrics.length > 0 && (
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {extraMetrics.map(widget => (
              <div key={widget.id} className="min-h-[120px]">
                <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Evolução Diária (area/line) + first funnel — side by side */}
      {(timeSeriesCharts.length > 0 || funnelWidgets.length > 0) && (
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {timeSeriesCharts.map(widget => (
              <div 
                key={widget.id} 
                className={`min-h-[380px] ${
                  funnelWidgets.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
                }`}
              >
                <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            ))}
            {funnelWidgets.length > 0 && (
              <div 
                key={funnelWidgets[0].id} 
                className={`min-h-[380px] ${
                  timeSeriesCharts.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'
                }`}
              >
                <WidgetRenderer widget={funnelWidgets[0]} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Additional funnels — paired side by side */}
      {funnelWidgets.length > 1 && (
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {funnelWidgets.slice(1).map(widget => (
              <div key={widget.id} className="min-h-[380px]">
                <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tables, Bar charts & Insights — paired side-by-side */}
      {(tablesAndBars.length > 0 || insightWidgets.length > 0) && (
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...tablesAndBars, ...insightWidgets].map(widget => (
              <div key={widget.id} className="min-h-[340px]">
                <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pie charts if any */}
      {pieCharts.length > 0 && (
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pieCharts.map(widget => (
              <div key={widget.id} className="min-h-[320px]">
                <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardEngine;
