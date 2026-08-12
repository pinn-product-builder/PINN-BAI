import React, { useState, useEffect, useMemo } from 'react';
import { DashboardGrid, normalizeLayouts, layoutsDifferMaterially } from './DashboardGrid';
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
  Pencil,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DashboardWidget } from '@/lib/types';
import { useExternalData } from '@/hooks/useExternalData';
import { useFilters } from '@/hooks/useFilters';
// Construtor de dashboard no estado vazio (descobre fontes + sugere widgets).
import { useFirstSyncDetector } from '@/modules/crm-auditor/hooks/useFirstSyncDetector';
import AutoBuildDashboardDialog from '@/modules/crm-auditor/components/AutoBuildDashboardDialog';
import { resolveByWidgetTitle } from '@/lib/referenceMappings';
import { REFERENCE_MAPPINGS } from '@/lib/referenceMappings';
import { evaluateFormula, buildFormulaVarsFromRows } from '@/lib/widgetFormula';

// Import chart widgets
import { WidgetEditorDialog } from '@/components/dashboard/admin/WidgetEditorDialog';
import { useAuth } from '@/contexts/AuthContext';
import MetricCard from '@/components/dashboard/widgets/MetricCard';
import { buildWidgetExplanation } from '@/lib/buildWidgetExplanation';
import AreaChartWidget from '@/components/dashboard/widgets/AreaChartWidget';
import BarChartWidget from '@/components/dashboard/widgets/BarChartWidget';
import LineChartWidget from '@/components/dashboard/widgets/LineChartWidget';
import PieChartWidget from '@/components/dashboard/widgets/PieChartWidget';
import FunnelWidget from '@/components/dashboard/widgets/FunnelWidget';
import TableWidget from '@/components/dashboard/widgets/TableWidget';
import InsightCard from '@/components/dashboard/widgets/InsightCard';
import RFMMatrixWidget from '@/components/dashboard/widgets/RFMMatrixWidget';
import ChurnPredictionWidget from '@/components/dashboard/widgets/ChurnPredictionWidget';

// Logs de debug do dashboard engine só rodam em DEV — evita poluir o DevTools do cliente.
// Nota: usar notação bracket pra não ser pego se alguém rodar replace_all em 'console.log' depois.
const dbg: (...args: unknown[]) => void = import.meta.env.DEV
  ? (...args) => { console['log'](...args); }
  : () => {};

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
  /** Coluna de data usada pelo filtro de período (ex.: created_at, day). Opt-in. */
  dateField?: string;
  sourceTable?: string;
  // Filtros server-side aplicados no fetch (ex.: { field_name: 'Origem Lead' }
  // pra views genéricas de campos customizados do CRM).
  filters?: Record<string, unknown>;
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
  // Fórmula custom: usa nomes de colunas como variáveis. Ex.: "conv_30d / leads_30d * 100".
  // Quando setada, tem prioridade sobre metric/aggregation no metric_card.
  formula?: string;
  // Exibir como percentual: multiplica o valor final por 100 (proporção → %). Reversível.
  percentScale?: boolean;
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
  // Ignorar campos de timestamp Unix (sufixo _ts) — preferimos campos ISO/legíveis
  if (lower.endsWith('_ts') || lower.endsWith('_unix') || lower.endsWith('_epoch')) return false;
  return ['day', 'date', 'created_at', 'updated_at', 'dia', 'data', '_iso', '_at'].some(k => lower.includes(k));
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
): { chartData: any[]; detectedKeys: string[]; seriesLabels?: Record<string, string>; seriesColors?: Record<string, string> } => {
  if (rawData.length === 0) return { chartData: [], detectedKeys: [] };

  // ── Caminho CANÔNICO (DB-driven) — saída de rpc:crm_stage_entries_daily ─────
  // Linhas "long": {day, stage_external_id, stage_name, stage_color,
  // stage_sort_order, lead_count}. Pivotamos pra wide (1 série por etapa) e
  // montamos label/cor/ordem das séries A PARTIR DO BANCO (vw_org_stage_
  // presentation) — sem CANONICAL_SERIES_ORDER/SERIES_LABELS hardcoded.
  const probe = rawData[0];
  if (probe && 'stage_external_id' in probe && 'lead_count' in probe &&
      'stage_sort_order' in probe && 'day' in probe) {
    const seriesLabels: Record<string, string> = {};
    const seriesColors: Record<string, string> = {};
    const order = new Map<string, number>();              // stage_external_id → sort_order
    const byDay = new Map<string, Record<string, number>>(); // iso day → {ext: count}
    for (const row of rawData) {
      const ext = String(row.stage_external_id ?? '');
      if (!ext) continue;
      const sort = Number(row.stage_sort_order) || 0;
      if (!(ext in seriesLabels)) seriesLabels[ext] = String(row.stage_name ?? ext);
      if (row.stage_color && !(ext in seriesColors)) seriesColors[ext] = String(row.stage_color);
      if (!order.has(ext) || sort < (order.get(ext) as number)) order.set(ext, sort);
      const iso = String(row.day ?? '');
      if (!byDay.has(iso)) byDay.set(iso, {});
      const bucket = byDay.get(iso)!;
      bucket[ext] = (bucket[ext] ?? 0) + (Number(row.lead_count) || 0);
    }
    // Ordem das séries = stage_sort_order do banco; desempata por nome.
    const detectedKeys = [...order.keys()].sort((a, b) => {
      const d = (order.get(a) as number) - (order.get(b) as number);
      return d !== 0 ? d : (seriesLabels[a] || '').localeCompare(seriesLabels[b] || '');
    });
    const chartData = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))   // ISO ordena cronologicamente
      .map(([iso, bucket]) => {
        const entry: Record<string, unknown> = { label: formatDateLabel(iso) };
        detectedKeys.forEach(k => { entry[k] = bucket[k] ?? 0; });
        return entry;
      });
    return { chartData, detectedKeys, seriesLabels, seriesColors };
  }

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

  dbg('[processMultiSeriesData] groupBy resolvido:', configGroupBy, '→', groupBy);

  // Resolver dataKeys: explícito no config > auto-detect.
  // (A ordem/label/cor canônica de ETAPA vem do banco no branch canônico acima,
  // via rpc:crm_stage_entries_daily — não há mais lista hardcoded por cliente.)
  const availableColumns = Object.keys(rawData[0]);
  const explicitKeys: string[] = config.dataKeys || [];

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
  
  dbg('[processGroupedData] groupBy:', configGroupBy, '→', resolvedGroupBy);
  
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
  onEdit,
  isRefreshing,
  error
}: {
  children: React.ReactNode;
  sourceTable?: string;
  onRefresh?: () => void;
  onRemove?: () => void;
  onEdit?: () => void;
  isRefreshing?: boolean;
  error?: string | null;
}) => (
  <div className="relative group h-full">
    {/* Controles — top-right. O lápis (editar conteúdo) fica SEMPRE visível p/ admin;
        refresh/remover (organização) só aparecem no hover. */}
    <div className="absolute -top-2.5 right-3 z-10 flex gap-1">
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 bg-amber-500/90 backdrop-blur-sm border border-amber-600/50 rounded-md text-white hover:bg-amber-500 shadow-sm"
          onClick={onEdit}
          title="Editar widget (fonte de dados, métrica, cores)"
        >
          <Pencil className="h-2.5 w-2.5" />
        </Button>
      )}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
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
export const WidgetRenderer = ({
  widget,
  orgId,
  onRemove,
  onEdit,
  isEditing = false,
}: {
  widget: DashboardWidget;
  orgId: string;
  onRemove?: (widgetId: string) => void;
  onEdit?: (widget: DashboardWidget) => void;
  /** Em modo edição de grid, desativa interações de conteúdo (ex.: popup de
   *  explicação ao clicar no card) pra não atrapalhar o arrasto. */
  isEditing?: boolean;
}) => {
  const rawConfig = (widget.config || {}) as WidgetConfig;
  // Normalizar: metricField → metric (BF Company usa metricField no DB)
  const config: WidgetConfig = {
    ...rawConfig,
    metric: rawConfig.metric || rawConfig.metricField,
  };
  const tableName = config.dataSource || config.sourceTable;
  const { dateRangeISO } = useFilters();
  const widgetQueryClient = useQueryClient();

  const { data: externalData, isLoading, error, refetch } = useExternalData(
    orgId,
    tableName
      ? { tableName, limit: 1000, dateRange: dateRangeISO, dateField: config.dateField, filters: config.filters }
      : undefined
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

  const handleEdit = onEdit ? () => onEdit(widget) : undefined;

  const unfilteredData = externalData?.data || [];

  // Client-side date filter: detect date field from config or common column names
  const rawData = (() => {
    if (!unfilteredData.length) return unfilteredData;
    const start = dateRangeISO.start;
    const end = dateRangeISO.end;
    // Detect which column holds the date value
    const candidate = config.groupBy && isDateField(config.groupBy)
      ? config.groupBy
      : Object.keys(unfilteredData[0] as Record<string, unknown>).find(isDateField);
    if (!candidate) return unfilteredData;
    return unfilteredData.filter((row) => {
      const val = (row as Record<string, unknown>)[candidate];
      if (!val) return true;
      const ts = new Date(val as string).getTime();
      return ts >= new Date(start).getTime() && ts <= new Date(end).getTime();
    });
  })();

  // Debug logging
  dbg(`[WidgetRenderer] ${widget.title} (${widget.type}):`, {
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
      return cl.includes('date') || cl.endsWith('_at') || cl.includes('_at_') || cl.endsWith('_ts') || cl.endsWith('_iso') || cl.endsWith('_unix') || cl.endsWith('_epoch') || cl === 'created' || cl === 'updated' || cl === 'timestamp' || cl === 'day' || cl === 'dia';
    };
    
    // Helper: rejeitar campos de ID
    const isIdColumn = (col: string): boolean => /^id$|^uuid$|^pk$|_id$|_uuid$|^org_/i.test(col);
    
    // Helper: verificar se coluna tem valores numéricos
    const isNumericColumn = (col: string): boolean => {
      const v = data[0][col];
      return v !== undefined && v !== null && (typeof v === 'number' || !isNaN(parseFloat(String(v))));
    };

    const allowsIdCount = cfg.aggregation === 'count';

    // 1. Campo exato presente nos dados. IDs são válidos apenas para contagem explícita.
    if (cfg.metric && available.includes(cfg.metric) && !isDateColumn(cfg.metric) && (!isIdColumn(cfg.metric) || allowsIdCount)) {
      return cfg.metric;
    }

    // 2. Match case-insensitive (excluindo datas)
    if (cfg.metric) {
      const lower = cfg.metric.toLowerCase();
      const found = available.find(k => k.toLowerCase() === lower && !isDateColumn(k) && (!isIdColumn(k) || allowsIdCount));
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
        dbg(`[resolveMetricField] Afonsina match: ${title} → ${match}`);
        return match;
      }
      // Match parcial com campo Afonsina
      const partialMatch = numericFields.find(k => {
        const kl = k.toLowerCase();
        return kl.includes(afonsinaField) || afonsinaField.includes(kl);
      });
      if (partialMatch) {
        dbg(`[resolveMetricField] Afonsina partial match: ${title} → ${partialMatch}`);
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
            dbg(`[resolveMetricField] Reference mapping: ${cfg.targetMetric} → ${match}`);
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

    // FORMULA CUSTOM (config.formula): tem prioridade sobre metric/aggregation.
    // Cada identificador na expressão = coluna da view. KPI view (1 linha) =
    // valor direto; demais = soma da coluna.
    if (config.formula && config.formula.trim()) {
      try {
        const vars = buildFormulaVarsFromRows(rawData);
        const result = evaluateFormula(config.formula, vars);
        if (isNaN(result) || !isFinite(result)) {
          console.warn('[DashboardEngine] Fórmula retornou NaN/Inf:', config.formula, '| vars:', vars);
          return 0;
        }
        dbg('[DashboardEngine] Fórmula avaliada:', config.formula, '→', result, '| vars:', vars);
        return result;
      } catch (err) {
        console.error('[DashboardEngine] Erro avaliando fórmula:', config.formula, err);
        // cai pro caminho padrão abaixo
      }
    }

    const requestedAggregation = config.aggregation || 'count';
    const metricField = resolveMetricField(rawData, config, widget.title || '');
    const fieldConfigured = Boolean(config.metric || config.metricField || config.targetMetric);
    const aggregation = requestedAggregation === 'count' && fieldConfigured ? 'count_values' : requestedAggregation;

    dbg('[DashboardEngine] Resolução de campo:', {
      configMetric: config.metric,
      targetMetric: config.targetMetric,
      resolvedField: metricField,
      aggregation,
      requestedAggregation,
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
      // percentScale: devolve a PROPORÇÃO (0–1); o ×100 é aplicado no call site
      // (evita dupla escala com o ramo legado de percentage abaixo).
      if (config.percentScale) {
        return rawData.length > 0 ? trueCount / rawData.length : 0;
      }
      const format = resolveFormat(config, widget.title || '');

      if (format === 'percentage') {
        const rate = rawData.length > 0 ? (trueCount / rawData.length) * 100 : 0;
        dbg('[DashboardEngine] Boolean percentage:', metricField, '→', rate.toFixed(1), '%');
        return parseFloat(rate.toFixed(1));
      }
      
      dbg('[DashboardEngine] Boolean count:', metricField, '→', trueCount, 'de', rawData.length);
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
      if (aggregation === 'count_values') {
        const nonEmptyCount = rawData.filter(row => {
          const value = row[metricField];
          return value !== null && value !== undefined && value !== '';
        }).length;
        console.warn('[DashboardEngine] Campo não numérico contado por presença:', metricField, '→', nonEmptyCount);
        return nonEmptyCount;
      }
      console.warn('[DashboardEngine] Sem valores numéricos no campo:', metricField, '→ usando 0');
      return 0;
    }

    // View KPI pré-agregada → retorna valor direto SEM re-agregar
    // IMPORTANTE: views diárias/horárias (_dia, _daily, _hora) NUNCA são KPI — precisam somar período.
    // Só é KPI quando: flag explícita, OU nome indica janela fechada (kpi, _30d, _60d, _7d, summary, overview),
    // OU resultado tem exatamente 1 linha (visivelmente agregado).
    const tableName = (config.dataSource || config.sourceTable || '').toLowerCase();
    const isDailyView = /(_dia|_daily|_diario|_hora|_hourly|_min|_minute)\b/i.test(tableName);
    const hasKpiMarker = /kpi|_30d|_60d|_90d|_7d|_mtd|_ytd|summary|overview|_resumo|_total/i.test(tableName);
    const canUseDirectKpiValue = !['count', 'count_values'].includes(aggregation);
    // isAggregatedView=true FORÇA valor direto do campo (mesmo sem aggregation explícito,
    // que cairia em count_values e retornaria a contagem de linhas = 1). Sem essa
    // precedência, cards de KPI pré-agregado (vw_bai_crm_kpis, distribution filtrada)
    // mostravam "1" em vez do valor real.
    const isViewKpi = !isDailyView && (
      config.isAggregatedView === true ||
      (canUseDirectKpiValue && (
        hasKpiMarker ||
        (rawData.length === 1 && values.length === 1)
      ))
    );

    if (isViewKpi && values.length >= 1) {
      dbg('[DashboardEngine] View KPI pré-agregada, valor direto:', values[0], '| tabela:', tableName);
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
        result = rawData.length;
        break;
      case 'count_values':
        result = values.length;
        break;
      default:
        result = rawData.length;
    }

    dbg('[DashboardEngine] Valor calculado:', result, '| campo:', metricField, '| agregação:', aggregation, '| linhas:', values.length);
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
    onEdit: handleEdit,
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
    // Nomes de ETAPA não são mais hardcoded aqui: vêm do banco
    // (vw_org_stage_presentation) via rpc:crm_stage_entries_daily. config
    // ainda pode rotular séries não-etapa de fontes legadas.
    ...(config.seriesLabels || {}),
  };

  switch (widget.type) {
    case 'metric_card': {
      let metricValue = calculateMetricValue();
      // percentScale: ×100 p/ exibir proporção como % — desacoplado da fórmula,
      // então liga/desliga sem mexer no cálculo (reversível).
      if (metricValue !== undefined && config.percentScale) metricValue = metricValue * 100;
      const format = resolveFormat(config, widget.title || '');

      // Publica o valor calculado no cache pra que o BAI Copilot (snapshot
      // do dashboardContext) veja EXATAMENTE o número que o usuário vê na
      // tela — sem precisar replicar a fórmula no servidor. Bug recorrente:
      // IA respondia 22% pra "taxa de conversão" enquanto o widget mostrava
      // 1,1% porque ela recomputava a partir dos 1000 leads crus.
      if (metricValue !== undefined && !isLoading && !errorMessage) {
        widgetQueryClient.setQueryData(['widget-snapshot', widget.id], {
          widgetId: widget.id,
          title: widget.title,
          metric: config.metric,
          dataSource: tableName,
          aggregation: config.aggregation,
          format,
          value: metricValue,
          metricLabel: getMetricSubtitle(),
          capturedAt: new Date().toISOString(),
        });
      }

      const explanation = buildWidgetExplanation({
        widget: { title: widget.title, description: widget.description, type: widget.type },
        config,
        value: metricValue,
        format,
        rawCount: rawData?.length,
        rawSample: rawData?.slice(0, 20) as Array<Record<string, unknown>> | undefined,
      });

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
            explanation={isEditing ? null : explanation}
          />
        </WidgetWrapper>
      );
    }
      
    case 'area_chart':
    case 'line_chart': {
      // Multi-série: processamento especial para gráficos temporais
      const { chartData: multiData, detectedKeys, seriesLabels: dbLabels, seriesColors: dbColors } =
        processMultiSeriesData(rawData, config);
      const seriesKeys = detectedKeys.length > 0 ? detectedKeys : ['value'];

      // Traduzir labels das séries
      const translatedKeys = seriesKeys;

      // Label/cor das séries: banco (vw_org_stage_presentation, via RPC canônica)
      // vence o hardcode; SERIES_LABELS fica só como fallback p/ fontes legadas
      // (slug-coluna). config.seriesColors ainda pode sobrepor manualmente.
      const resolvedLabels = dbLabels ? { ...SERIES_LABELS, ...dbLabels } : SERIES_LABELS;
      const resolvedColors = { ...(dbColors || {}), ...(config.seriesColors || {}) };

      const ChartComponent = widget.type === 'area_chart' ? AreaChartWidget : LineChartWidget;

      return (
        <WidgetWrapper {...wrapperProps}>
          <ChartComponent
            title={widget.title}
            description={widget.description || ''}
            data={multiData}
            xAxisKey="label"
            dataKeys={translatedKeys}
            seriesLabels={resolvedLabels}
            seriesColors={resolvedColors}
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
      let pipelines: Array<{ id: string; label: string; data: any[] }> | undefined;
      let stageMapped = false;

      // Funil baseado em campos booleanos (BF Company: funnelFields + funnelStages)
      if (config.funnelFields && config.funnelStages && rawData.length > 0) {
        funnelData = config.funnelFields.map((field, i) => {
          const label = config.funnelStages?.[i] || field;
          const count = rawData.filter(row => row[field] === true).length;
          return { label, value: count, name: label, stage: label };
        });
      } else if (rawData.length > 0 && rawData[0].stage_sort_order !== undefined) {
        // Funil mapeado pelo CRM: snapshot exato por etapa (igual ao Kommo), na
        // ORDEM do pipeline, com nome/cor do mapeamento — mostra todas as etapas.
        // Quando há mais de um funil (pipeline), monta o filtro "Todos / Funil A / B".
        stageMapped = true;
        const toDatum = (r: Record<string, unknown>) => {
          const label = String(r.stage_name ?? r.stage_external_id ?? '');
          return {
            stage: label, name: label, label,
            value: Number(r.lead_count ?? r.value ?? 0),
            color: (r.stage_color as string) || undefined,
            sort: Number(r.stage_sort_order) || 0,
          };
        };
        const byPipe = new Map<string, Record<string, unknown>[]>();
        for (const r of rawData) {
          const pid = String(r.pipeline_external_id ?? '—');
          if (!byPipe.has(pid)) byPipe.set(pid, []);
          byPipe.get(pid)!.push(r);
        }
        const perPipeline = [...byPipe.entries()].map(([pid, rows]) => ({
          id: pid,
          label: String(rows[0].pipeline_name ?? `Funil ${pid}`),
          data: rows.map(toDatum).sort((a, b) => a.sort - b.sort).map(({ sort: _s, ...d }) => d),
        }));
        // "Todos os funis": soma os leads por etapa (nome) entre os funis.
        const allMap = new Map<string, { value: number; sort: number; color?: string }>();
        for (const r of rawData) {
          const d = toDatum(r);
          const prev = allMap.get(d.name) ?? { value: 0, sort: d.sort, color: d.color };
          prev.value += d.value;
          prev.sort = Math.min(prev.sort, d.sort);
          if (!prev.color && d.color) prev.color = d.color;
          allMap.set(d.name, prev);
        }
        const allData = [...allMap.entries()]
          .map(([name, v]) => ({ stage: name, name, label: name, value: v.value, color: v.color, sort: v.sort }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ sort: _s, ...d }) => d);

        // "Todos os funis" sempre presente como opção (padrão) → o filtro de funil
        // aparece mesmo com um único funil; com vários, "Todos" agrega de verdade.
        pipelines = [{ id: '__all__', label: 'Todos os funis', data: allData }, ...perPipeline];
        funnelData = allData;
      } else {
        funnelData = processGroupedData(rawData, config);

        // Multi-funil — quando os dados crus têm campo de pipeline (caso Kitou:
        // 2 funis "disparos" e "tráfego pago" no Kommo), agrupar antes de
        // processar. O usuário escolhe qual ver via dropdown no widget.
        const pipelineField = (config as WidgetConfig & { pipelineField?: string }).pipelineField
          ?? (rawData[0] && (rawData[0].pipeline_id_name ?? rawData[0].pipeline_name ?? rawData[0].funnel_name) !== undefined
              ? (rawData[0].pipeline_id_name !== undefined ? 'pipeline_id_name'
                : rawData[0].pipeline_name !== undefined ? 'pipeline_name'
                : 'funnel_name')
              : null);
        if (pipelineField && rawData.length > 0) {
          const byPipeline = new Map<string, Record<string, unknown>[]>();
          for (const row of rawData) {
            const key = String(row[pipelineField] ?? '—');
            if (!byPipeline.has(key)) byPipeline.set(key, []);
            byPipeline.get(key)!.push(row);
          }
          if (byPipeline.size > 1) {
            pipelines = Array.from(byPipeline.entries()).map(([id, rows]) => ({
              id,
              label: id,
              data: processGroupedData(rows, config),
            }));
          }
        }
      }

      return (
        <WidgetWrapper {...wrapperProps}>
          <FunnelWidget
            title={widget.title}
            description={widget.description || ''}
            data={funnelData}
            pipelines={pipelines}
            showEmptyStages={stageMapped}
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

    case 'rfm_matrix':
      return (
        <WidgetWrapper {...wrapperProps}>
          <RFMMatrixWidget
            orgId={orgId}
            title={widget.title}
            description={widget.description || 'Distribuição de segmentos da matriz RFM.'}
          />
        </WidgetWrapper>
      );

    case 'churn_prediction':
      return (
        <WidgetWrapper {...wrapperProps}>
          <ChurnPredictionWidget
            orgId={orgId}
            title={widget.title}
            description={widget.description || 'Clientes com maior risco de churn e nível de risco.'}
          />
        </WidgetWrapper>
      );
      
    default:
      return null;
  }
};

const DashboardEngine = ({ dashboardId, isEditing = false }: { dashboardId: string; isEditing?: boolean }) => {
  // Log básico que sempre aparece
  dbg('[DashboardEngine] STARTED', dashboardId);
  
  const { orgId } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Construtor de dashboard: quando a org tem fonte sincronizada e o dashboard
  // está vazio, oferece montar (abre automático na 1ª vez; botão sempre disponível).
  const firstSync = useFirstSyncDetector(orgId);
  const [buildOpen, setBuildOpen] = useState(false);
  const [buildDismissed, setBuildDismissed] = useState(false);
  useEffect(() => {
    if (firstSync.data?.ready && !buildDismissed) setBuildOpen(true);
  }, [firstSync.data?.ready, buildDismissed]);

  dbg('[DashboardEngine] Component mounted:', { dashboardId, orgId });

  const { data: widgets, isLoading } = useQuery({
    queryKey: ['dashboard-widgets', dashboardId],
    queryFn: async () => {
      dbg('[DashboardEngine] Fetching widgets for dashboard:', dashboardId);
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
      
      dbg('[DashboardEngine] Widgets loaded:', {
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

  dbg('[DashboardEngine] Render check:', {
    isLoading,
    widgetsCount: widgets?.length || 0,
    hasWidgets: !!(widgets && widgets.length > 0),
  });

  if (!widgets || widgets.length === 0) {
    console.warn('[DashboardEngine] No widgets found!', { dashboardId, widgets });
    return (
      <>
        <Card className="p-12 border-dashed flex flex-col items-center justify-center text-center gap-4 bg-muted/20 rounded-3xl">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Dashboard Vazio</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {firstSync.data?.ready
                ? 'Seus dados estão sincronizados. Monte o dashboard escolhendo a fonte e os widgets — sugerimos pelo que a fonte tem.'
                : 'Ainda não há widgets. Conecte uma fonte de dados (Auditoria CRM / Dados) — depois você monta o dashboard escolhendo o que mostrar.'}
            </p>
          </div>
          <Button onClick={() => { setBuildDismissed(false); setBuildOpen(true); }} disabled={!orgId}>
            Montar dashboard
          </Button>
        </Card>
        {orgId && (
          <AutoBuildDashboardDialog
            open={buildOpen}
            orgId={orgId}
            dashboardId={dashboardId}
            connectedProviders={firstSync.data?.connectedProviders ?? []}
            onClose={() => { setBuildOpen(false); setBuildDismissed(true); }}
            onApplied={() => { setBuildOpen(false); setBuildDismissed(true); }}
          />
        )}
      </>
    );
  }

  // Layout com drag-and-drop (react-grid-layout). Salva em dashboards.layout (jsonb).
  const sortedWidgets = [...widgets].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <DashboardEngineGrid
      dashboardId={dashboardId}
      widgets={sortedWidgets}
      orgId={orgId || ''}
      isEditing={isEditing}
      onDelete={handleDelete}
    />
  );
};

// ─── Botão de edição por widget (só renderiza em modo isEditing + admin) ───────
function WidgetEditableSlot({
  widget,
  orgId,
  onDelete,
  isEditing,
}: {
  widget: DashboardWidget;
  orgId: string;
  onDelete: (id: string) => void;
  isEditing: boolean;
}) {
  const { isPlatformAdmin } = useAuth();
  const [editing, setEditing] = useState<DashboardWidget | null>(null);
  // Editar CONTEÚDO do widget (lápis) é independente do "Editar layout": fica
  // disponível fora do modo de organização, pra não confundir as duas coisas.
  // Já REMOVER o widget é ação de organização → só dentro do "Editar layout".
  const canEdit = isPlatformAdmin;
  return (
    <div className="h-full">
      <WidgetRenderer
        widget={widget}
        orgId={orgId}
        isEditing={isEditing}
        onRemove={isEditing && isPlatformAdmin ? onDelete : undefined}
        onEdit={canEdit ? setEditing : undefined}
      />
      <WidgetEditorDialog
        widget={editing}
        orgId={orgId}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}

// ─── Grid wrapper: lê/salva layout em dashboards.layout ────────────────────────
function DashboardEngineGrid({
  dashboardId,
  widgets,
  orgId,
  isEditing,
  onDelete,
}: {
  dashboardId: string;
  widgets: DashboardWidget[];
  orgId: string;
  isEditing: boolean;
  onDelete: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [savedLayouts, setSavedLayouts] = useState<any | null>(null);
  const [pendingLayouts, setPendingLayouts] = useState<any | null>(null);

  // Referência ESTÁVEL da lista de widgets do grid (id+type). Sem isto, o `.map`
  // inline criava um array novo a cada render → o DashboardGrid resetava o layout
  // a cada re-render (drag/resize "voltavam" pra posição inicial).
  const gridWidgets = useMemo(
    () => widgets.map((w) => ({ id: w.id, type: w.type as string })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [widgets.map((w) => `${w.id}:${w.type}`).join('|')],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('dashboards')
        .select('layout')
        .eq('id', dashboardId)
        .single();
      if (cancelled) return;
      const layout = (data?.layout as any) ?? null;
      if (layout && typeof layout === 'object' && Object.keys(layout).length > 0) {
        // Auto-cura: se o layout salvo está quebrado (KPIs apertados,
        // widgets stackados, charts espremidos), o normalizeLayouts
        // regenera os defaults limpos. Quando isso acontece, persistimos
        // a versão limpa no Supabase imediatamente — caso contrário o
        // user veria o layout bom na tela mas o broken voltaria em
        // qualquer re-render que dependesse do dado salvo.
        const cleaned = normalizeLayouts(layout, gridWidgets);
        const layoutWasBroken = layoutsDifferMaterially(layout, cleaned);
        setSavedLayouts(layoutWasBroken ? cleaned : layout);
        if (layoutWasBroken) {
          dbg('[DashboardEngineGrid] Layout salvo estava quebrado, persistindo versão regenerada');
          // Fire-and-forget: não bloqueia render. Se falhar, próxima
          // visualização reaplica o normalize e tenta de novo.
          // Cast unknown: react-grid-layout `Layouts` é serializável mas o tipo
          // gerado do Supabase exige `Json`. Não há transformação em runtime.
          supabase
            .from('dashboards')
            .update({ layout: cleaned as unknown as never, updated_at: new Date().toISOString() })
            .eq('id', dashboardId)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
            });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [dashboardId, gridWidgets, queryClient]);

  // Auto-save (debounce) durante edição
  useEffect(() => {
    if (!isEditing || !pendingLayouts) return;
    const t = setTimeout(async () => {
      await supabase
        .from('dashboards')
        .update({ layout: pendingLayouts as unknown as never, updated_at: new Date().toISOString() })
        .eq('id', dashboardId);
      queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
    }, 600);
    return () => clearTimeout(t);
  }, [pendingLayouts, isEditing, dashboardId, queryClient]);

  return (
    <div className="pb-24">
      <DashboardGrid
        widgets={gridWidgets}
        savedLayouts={savedLayouts}
        isEditing={isEditing}
        onLayoutChange={setPendingLayouts}
        renderWidget={(gw) => {
          const widget = widgets.find((w) => w.id === gw.id);
          if (!widget) return null;
          return (
            <WidgetEditableSlot
              widget={widget}
              orgId={orgId}
              onDelete={onDelete}
              isEditing={isEditing}
            />
          );
        }}
      />
    </div>
  );
}


export default DashboardEngine;
