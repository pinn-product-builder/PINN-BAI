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
import { findWidgetConfig } from '@/lib/afonsinaWidgetConfig';
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
    const numericKeys = Object.keys(firstRow).filter(key => {
      if (/^(id|uuid|pk|org_id|dashboard_id)$/i.test(key)) return false;
      const val = firstRow[key];
      return val !== null && val !== undefined && (typeof val === 'number' || !isNaN(parseFloat(String(val))));
    });
    if (numericKeys.length === 0) return { chartData: [], detectedKeys: [] };
    const chartData = rawData.map((row, i) => {
      const entry: Record<string, unknown> = { label: `#${i + 1}` };
      numericKeys.forEach(key => {
        const val = row[key];
        entry[key] = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
      });
      return entry;
    });
    return { chartData, detectedKeys: numericKeys };
  }

  console.log('[processMultiSeriesData] groupBy resolvido:', configGroupBy, '→', groupBy);

  const explicitKeys = config.dataKeys || [];
  
  // Se temos dataKeys explícitos, verificar se existem nos dados
  const availableColumns = Object.keys(rawData[0]);
  const validExplicitKeys = explicitKeys.filter(k => availableColumns.includes(k));
  
  if (validExplicitKeys.length > 0) {
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
  
  // Auto-detectar colunas numéricas (excluindo groupBy e IDs)
  const firstRow = rawData[0];
  const skipPatterns = /^(id|uuid|pk|org_id|dashboard_id|created_at|updated_at)$/i;
  const numericKeys = Object.keys(firstRow).filter(key => {
    if (key === groupBy) return false;
    if (skipPatterns.test(key)) return false;
    const val = firstRow[key];
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
        entry[key] = val !== null && val !== undefined ? (typeof val === 'number' ? val : parseFloat(String(val)) || 0) : 0;
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
    const afonsinaConfig = findWidgetConfig(title, widget.type);
    if (afonsinaConfig && numericFields.length > 0) {
      const afonsinaField = afonsinaConfig.metricField.toLowerCase();
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
        // Procurar os fieldNames do reference mapping nos dados disponíveis
        for (const view of refMapping.views) {
          const fieldLower = view.fieldName.toLowerCase();
          const match = numericFields.find(k => k.toLowerCase() === fieldLower);
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
      // Campo encontrado mas sem valores numéricos → contagem de registros
      console.warn('[DashboardEngine] Sem valores numéricos no campo:', metricField, '→ usando row count');
      return rawData.length;
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
        result = rawData.length; // count = número de registros, NÃO de valores
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

  // Reference layout: 5 hero KPIs + 4 secondary KPIs
  const heroCount = Math.min(metricWidgets.length, 5);
  const heroMetrics = metricWidgets.slice(0, heroCount);
  const secondaryMetrics = metricWidgets.slice(heroCount);

  // Pair tables for side-by-side layout
  const firstTablePair = tableWidgets.slice(0, 2);
  const remainingTables = tableWidgets.slice(2);

  return (
    <div className="space-y-8 pb-24">
      {/* Section: Indicadores Principais */}
      {heroMetrics.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">Indicadores Principais</h2>
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
            heroMetrics.length >= 5 ? 'xl:grid-cols-5' : 
            heroMetrics.length === 4 ? 'xl:grid-cols-4' : 
            heroMetrics.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-2'
          }`}>
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
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
            secondaryMetrics.length >= 4 ? 'xl:grid-cols-4' : 
            secondaryMetrics.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-2'
          }`}>
            {secondaryMetrics.map(widget => (
              <div key={widget.id} className="min-h-[120px]">
                <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Evolução Diária (area/line) + Pipeline de Conversão (funnel) — side by side */}
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
            {funnelWidgets.map(widget => (
              <div 
                key={widget.id} 
                className={`min-h-[380px] ${
                  timeSeriesCharts.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'
                }`}
              >
                <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* First table pair + Insights IA — side by side */}
      {(firstTablePair.length > 0 || insightWidgets.length > 0) && (
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {firstTablePair[0] && (
              <div className="min-h-[340px]">
                <WidgetRenderer widget={firstTablePair[0]} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            )}
            {insightWidgets.length > 0 ? (
              insightWidgets.map(widget => (
                <div key={widget.id} className="min-h-[340px]">
                  <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
                </div>
              ))
            ) : firstTablePair[1] ? (
              <div className="min-h-[340px]">
                <WidgetRenderer widget={firstTablePair[1]} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            ) : null}
          </div>
        </section>
      )}

      {/* Second table pair (Reuniões do Mês + Lista de Leads) — side by side */}
      {(firstTablePair[1] && insightWidgets.length > 0) || remainingTables.length > 0 ? (
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* If insights took the spot of table[1], render table[1] here */}
            {firstTablePair[1] && insightWidgets.length > 0 && (
              <div className="min-h-[340px]">
                <WidgetRenderer widget={firstTablePair[1]} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            )}
            {remainingTables.map(widget => (
              <div key={widget.id} className="min-h-[340px]">
                <WidgetRenderer widget={widget} orgId={orgId || ''} onRemove={handleDelete} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Bar charts + Pie charts if any */}
      {(barCharts.length > 0 || pieCharts.length > 0) && (
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {barCharts.map(widget => (
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
    </div>
  );
};

export default DashboardEngine;
