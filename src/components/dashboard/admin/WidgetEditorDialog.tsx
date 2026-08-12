import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUpdateDashboardWidget, useDeleteDashboardWidget } from '@/hooks/useDashboard';
import { useDataSources } from '@/hooks/useDataSources';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { evaluateFormula, extractFormulaVariables } from '@/lib/widgetFormula';
import { useMemo } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { DashboardWidget, WidgetConfig, WidgetType } from '@/lib/types';

const WIDGET_TYPES: { value: WidgetType; label: string }[] = [
  { value: 'metric_card', label: 'Card de métrica (KPI)' },
  { value: 'area_chart', label: 'Gráfico de área' },
  { value: 'bar_chart', label: 'Gráfico de barras' },
  { value: 'line_chart', label: 'Gráfico de linhas' },
  { value: 'pie_chart', label: 'Gráfico de pizza' },
  { value: 'funnel', label: 'Funil' },
  { value: 'table', label: 'Tabela' },
  { value: 'insight_card', label: 'Card de insight' },
];

const AGGREGATIONS: { value: NonNullable<WidgetConfig['aggregation']>; label: string }[] = [
  { value: 'sum', label: 'Soma' },
  { value: 'count', label: 'Contagem' },
  { value: 'avg', label: 'Média' },
  { value: 'min', label: 'Mínimo' },
  { value: 'max', label: 'Máximo' },
];

const FORMATS: { value: NonNullable<WidgetConfig['format']>; label: string }[] = [
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moeda (BRL)' },
  { value: 'percentage', label: 'Percentual' },
];

interface Props {
  widget: DashboardWidget | null;
  /** Org/tenant atual — usado pra carregar os campos REAIS do Kommo (catálogo descoberto). */
  orgId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dimensões padrão de um lead no Kommo (colunas de crm_leads) — provider-level,
 * iguais pra todo cliente. São os campos mapeáveis "de fábrica" do widget.
 */
const KOMMO_STANDARD_FIELDS: { key: string; label: string; kind: 'dim' | 'metric' }[] = [
  { key: 'stage_external_id', label: 'Etapa do funil', kind: 'dim' },
  { key: 'pipeline_external_id', label: 'Funil', kind: 'dim' },
  { key: 'lead_status', label: 'Status (ganho/perdido/aberto)', kind: 'dim' },
  { key: 'owner_external_id', label: 'Responsável', kind: 'dim' },
  { key: 'source', label: 'Origem', kind: 'dim' },
  { key: 'lost_reason', label: 'Motivo de perda', kind: 'dim' },
  { key: 'created_at', label: 'Data de criação', kind: 'dim' },
  { key: 'value', label: 'Valor', kind: 'metric' },
];

/** Detecta se uma fórmula salva cabe no construtor simples ("A op B" ou "A op B * 100"). */
function parseSimpleFormula(
  f: string,
): { a: string; op: '+' | '-' | '*' | '/'; b: string; pct: boolean } | null {
  const m = f.trim().match(/^([\w.]+)\s*([+\-*/])\s*([\w.]+)(\s*\*\s*100)?$/);
  if (!m) return null;
  return { a: m[1], op: m[2] as '+' | '-' | '*' | '/', b: m[3], pct: !!m[4] };
}

/**
 * Editor de widget único — edita título, descrição (tooltip ℹ), tipo, fonte de
 * dados (metric, dataSource, aggregation, format) e fórmula derivada opcional.
 *
 * A aba "Fórmula" permite definir um cálculo arbitrário sobre as colunas da
 * dataSource (ex: "conv_30d / leads_30d * 100"). É persistido em config.formula
 * e tem precedência sobre `metric` quando preenchido.
 */
export function WidgetEditorDialog({ widget, orgId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const updateMut = useUpdateDashboardWidget();
  const deleteMut = useDeleteDashboardWidget();
  const dataSources = useDataSources();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<WidgetType>('metric_card');
  const [dataSource, setDataSource] = useState('');
  const [metric, setMetric] = useState('');
  const [aggregation, setAggregation] = useState<NonNullable<WidgetConfig['aggregation']>>('sum');
  const [format, setFormat] = useState<NonNullable<WidgetConfig['format']>>('number');
  const [groupBy, setGroupBy] = useState('');
  // Filtro de campo customizado do CRM (ex.: field_name='Destino de Interesse').
  // Permite montar "Leads por X" sobre vw_bai_crm_custom_field_distribution sem hardcode.
  const [filterField, setFilterField] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [formula, setFormula] = useState('');
  // Construtor SIMPLES de cálculo: "campoA [op] campoB [× 100]". Gera config.formula.
  // O textarea cru fica no modo "avançado".
  const [formulaMode, setFormulaMode] = useState<'simple' | 'advanced'>('simple');
  const [simpleA, setSimpleA] = useState('');
  const [simpleOp, setSimpleOp] = useState<'+' | '-' | '*' | '/'>('/');
  const [simpleB, setSimpleB] = useState('');
  const [simplePct, setSimplePct] = useState(false);
  const [showTrend, setShowTrend] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  // Cor por série (nome da coluna → hex) — editável; sobrepõe paleta/defaults do widget.
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>({});

  // Sample 1 linha da dataSource pra exibir colunas disponíveis no editor
  // de fórmula. Não bloqueia salvar — só ajuda o admin a saber o que pode
  // referenciar.
  const dataSourceSample = useQuery<{ columns: string[]; row: Record<string, unknown> | null }>({
    queryKey: ['datasource-columns', dataSource],
    enabled: !!dataSource.trim(),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from(dataSource.trim())
        .select('*')
        .limit(1);
      if (error) {
        console.warn('[WidgetEditor] não foi possível inferir colunas:', error.message);
        return { columns: [], row: null };
      }
      const row = (data ?? [])[0] ?? null;
      return { columns: row ? Object.keys(row) : [], row };
    },
    staleTime: 60_000,
  });

  // Catálogo de campos REAIS do Kommo (descobertos na sync → crm_custom_fields),
  // por org. É a fonte mapeável do widget — NÃO amostragem de view do Supabase.
  const kommoFields = useQuery<{ name: string; entity_type: string; field_type: string | null }[]>({
    queryKey: ['kommo-fields', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_custom_fields')
        .select('name, entity_type, field_type')
        .eq('tenant_id', orgId as string)
        .order('name');
      if (error) {
        console.warn('[WidgetEditor] catálogo Kommo indisponível:', error.message);
        return [];
      }
      return (data ?? []) as { name: string; entity_type: string; field_type: string | null }[];
    },
    staleTime: 60_000,
  });
  const kommoLeadFields = (kommoFields.data ?? []).filter((f) => f.entity_type === 'lead');
  // Campos válidos p/ o construtor de cálculo: dimensão numérica padrão + colunas reais
  // da fonte + campos custom com nome de identificador (sem espaço).
  const formulaFields = Array.from(
    new Set([
      ...KOMMO_STANDARD_FIELDS.filter((f) => f.kind === 'metric').map((f) => f.key),
      ...(dataSourceSample.data?.columns ?? []),
      ...kommoLeadFields.filter((cf) => /^[A-Za-z_]\w*$/.test(cf.name)).map((cf) => cf.name),
    ]),
  );

  // Validação live: sintaxe + referência de colunas + preview (se sample existe).
  const formulaValidation = useMemo(() => {
    const expr = formula.trim();
    if (!expr) return null;
    const columns = dataSourceSample.data?.columns ?? [];
    const row = dataSourceSample.data?.row ?? null;
    try {
      const vars = extractFormulaVariables(expr);
      // Colunas referenciadas mas ausentes na dataSource.
      const missing = columns.length > 0 ? vars.filter((v) => !columns.includes(v)) : [];
      // Preview: só calcula se sample existe E todas as vars são números na linha.
      let preview: number | null = null;
      let previewError: string | null = null;
      if (row) {
        const vals: Record<string, number> = {};
        for (const v of vars) {
          const raw = row[v];
          const num = typeof raw === 'number' ? raw : raw != null ? parseFloat(String(raw)) : NaN;
          if (!isNaN(num)) vals[v] = num;
        }
        try {
          const r = evaluateFormula(expr, vals);
          if (isNaN(r) || !isFinite(r)) previewError = 'resultado inválido (divisão por zero ou variável vazia)';
          else preview = r;
        } catch (e) {
          previewError = (e as Error).message;
        }
      }
      return { ok: true, vars, missing, preview, previewError } as const;
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [formula, dataSourceSample.data]);

  useEffect(() => {
    if (!widget) return;
    const cfg = (widget.config ?? {}) as WidgetConfig & { formula?: string };
    setTitle(widget.title ?? '');
    setDescription(widget.description ?? '');
    setType(widget.type);
    setDataSource(cfg.dataSource ?? cfg.sourceTable ?? '');
    setMetric(cfg.metric ?? '');
    setAggregation((cfg.aggregation as NonNullable<WidgetConfig['aggregation']>) ?? 'sum');
    setFormat((cfg.format as NonNullable<WidgetConfig['format']>) ?? 'number');
    setGroupBy(cfg.groupBy ?? '');
    setFilterField(((cfg.filters as Record<string, unknown> | undefined)?.field_name as string) ?? '');
    setFilterValue(((cfg.filters as Record<string, unknown> | undefined)?.value as string) ?? '');
    const f = (cfg.formula ?? '').trim();
    setFormula(f);
    const parsed = parseSimpleFormula(f);
    if (!f || parsed) {
      setFormulaMode('simple');
      setSimpleA(parsed?.a ?? '');
      setSimpleOp(parsed?.op ?? '/');
      setSimpleB(parsed?.b ?? '');
      // percentScale (novo) tem prioridade; *100 na fórmula é fallback legado.
      setSimplePct((cfg.percentScale as boolean | undefined) ?? parsed?.pct ?? false);
    } else {
      setFormulaMode('advanced'); // fórmula complexa → edita no textarea
    }
    setShowTrend(!!cfg.showTrend);
    setIsVisible(widget.is_visible ?? true);
    setSeriesColors((cfg.seriesColors as Record<string, string>) ?? {});
  }, [widget]);

  // Modo simples: deriva config.formula dos campos do construtor (campoA op campoB).
  // O "× 100" NÃO entra na fórmula — vira config.percentScale (aplicado no engine),
  // pra ligar/desligar o percentual sem mexer no cálculo.
  useEffect(() => {
    if (formulaMode !== 'simple') return;
    const a = simpleA.trim();
    const b = simpleB.trim();
    setFormula(a && b ? `${a} ${simpleOp} ${b}` : '');
  }, [formulaMode, simpleA, simpleOp, simpleB]);

  if (!widget) return null;

  const busy = updateMut.isPending || deleteMut.isPending;

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Título obrigatório' });
      return;
    }
    const baseConfig = (widget.config ?? {}) as Record<string, unknown>;
    const nextConfig = {
      ...baseConfig,
      dataSource: dataSource.trim() || undefined,
      metric: metric.trim() || undefined,
      aggregation,
      format,
      groupBy: groupBy.trim() || undefined,
      filters: filterField.trim()
        ? { field_name: filterField.trim(), ...(filterValue.trim() ? { value: filterValue.trim() } : {}) }
        : undefined,
      formula: formula.trim() || undefined,
      showTrend,
      seriesColors: Object.keys(seriesColors).length ? seriesColors : undefined,
      // "× 100" desacoplado da fórmula → liga/desliga o percentual de forma reversível.
      percentScale:
        (formulaMode === 'simple' ? simplePct : (baseConfig.percentScale as boolean | undefined)) || undefined,
    };
    try {
      await updateMut.mutateAsync({
        id: widget.id,
        title: title.trim(),
        description: description.trim() || null,
        type,
        config: nextConfig,
        is_visible: isVisible,
      });
      toast({ title: 'Widget atualizado' });
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: msg });
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm(`Apagar o widget "${widget.title}"? Esta ação não pode ser desfeita.`);
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(widget.id);
      toast({ title: 'Widget removido' });
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: 'Erro ao apagar', description: msg });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar widget</DialogTitle>
          <DialogDescription>
            Configura título, fonte de dados, agregação e fórmula deste widget. Mudanças salvam diretamente no banco.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="data">Fonte de dados</TabsTrigger>
            <TabsTrigger value="formula">Fórmula</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-3 pt-3">
            <div>
              <Label htmlFor="w-title">Título</Label>
              <Input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="w-desc">Descrição (tooltip ℹ)</Label>
              <Textarea
                id="w-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Aparece quando o usuário passa o mouse sobre o ícone de info"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="w-type">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as WidgetType)}>
                <SelectTrigger id="w-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WIDGET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="w-visible" className="text-sm">Visível no dashboard</Label>
                <p className="text-xs text-muted-foreground">Desligar oculta sem apagar (útil para esconder temporariamente).</p>
              </div>
              <Switch id="w-visible" checked={isVisible} onCheckedChange={setIsVisible} />
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-3 pt-3">
            <div>
              <Label htmlFor="w-source">Tabela / view de origem (dataSource)</Label>
              <Input
                id="w-source"
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                placeholder="ex: vw_dashboard_kpis_30d_v3"
                list="data-sources-catalog"
              />
              <datalist id="data-sources-catalog">
                {(dataSources.data ?? []).map((d) => (
                  <option key={d.id} value={d.key} label={d.display_name} />
                ))}
              </datalist>
              <p className="text-[11px] text-muted-foreground mt-1">
                Sugestões vêm do catálogo curado (gerenciado em /admin/data-sources).
                Você ainda pode digitar qualquer view existente no Supabase.
              </p>
            </div>

            {/* Fonte mapeável = campos REAIS do Kommo (catálogo descoberto na sync),
                NÃO amostragem de view do Supabase. */}
            <div className="rounded-md border border-dashed p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold">Campos do Kommo (integração)</Label>
                {kommoFields.isFetching && (
                  <span className="text-[11px] text-muted-foreground">carregando catálogo…</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Monte o widget sobre os campos reais descobertos no seu CRM (Kommo). Clique pra usar.
              </p>
              <div>
                <span className="text-[11px] text-muted-foreground">Dimensões padrão</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {KOMMO_STANDARD_FIELDS.map((f) => (
                    <Badge
                      key={f.key}
                      variant="secondary"
                      className="text-[11px] cursor-pointer hover:bg-accent"
                      onClick={() => (f.kind === 'metric' ? setMetric(f.key) : setGroupBy(f.key))}
                      title={f.kind === 'metric' ? 'Usar como métrica' : 'Usar como agrupamento (groupBy)'}
                    >
                      {f.label}
                    </Badge>
                  ))}
                </div>
              </div>
              {!orgId ? (
                <p className="text-[11px] text-muted-foreground">
                  Abra o editor pelo dashboard da org pra carregar os campos do Kommo.
                </p>
              ) : kommoLeadFields.length > 0 ? (
                <div>
                  <span className="text-[11px] text-muted-foreground">
                    Campos personalizados ({kommoLeadFields.length})
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1 max-h-28 overflow-auto">
                    {kommoLeadFields.map((cf) => (
                      <Badge
                        key={cf.name}
                        variant="outline"
                        className="font-mono text-[11px] cursor-pointer hover:bg-accent"
                        onClick={() => {
                          setFilterField(cf.name);
                          if (!dataSource.trim()) setDataSource('vw_bai_crm_custom_field_distribution');
                          if (!groupBy.trim()) setGroupBy('value');
                        }}
                        title="Usar como filtro do CRM → monta 'Leads por este campo'"
                      >
                        {cf.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : !kommoFields.isFetching && (
                <p className="text-[11px] text-muted-foreground">
                  Nenhum campo personalizado sincronizado — rode a sync do Kommo primeiro.
                </p>
              )}
              <datalist id="kommo-fields">
                {KOMMO_STANDARD_FIELDS.map((f) => (
                  <option key={f.key} value={f.key} label={f.label} />
                ))}
                {kommoLeadFields.map((cf) => (
                  <option key={cf.name} value={cf.name} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="w-metric">Coluna da métrica</Label>
              <Input
                id="w-metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                placeholder="ex: leads_total_30d"
                list="kommo-fields"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="w-agg">Agregação</Label>
                <Select value={aggregation} onValueChange={(v) => setAggregation(v as NonNullable<WidgetConfig['aggregation']>)}>
                  <SelectTrigger id="w-agg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGGREGATIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="w-fmt">Formato</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as NonNullable<WidgetConfig['format']>)}>
                  <SelectTrigger id="w-fmt"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="w-group">Campo para agrupar (séries / categorias)</Label>
              <Input
                id="w-group"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                placeholder="ex: created_at, day, value, stage_name"
                list="kommo-fields"
              />
            </div>
            <div className="rounded-md border p-3 space-y-2">
              <Label className="text-sm font-semibold">Filtro de campo do CRM (Kommo) — opcional</Label>
              <p className="text-xs text-muted-foreground">
                Sobre <code>vw_bai_crm_custom_field_distribution</code>: filtre por um campo do seu CRM
                (ex.: <code>Destino de Interesse</code>) e use <strong>groupBy = value</strong> pra montar
                "Leads por …". Para um KPID de checkbox, preencha valor = <code>true</code>.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="w-filter-field" className="text-xs">field_name</Label>
                  <Input id="w-filter-field" value={filterField} onChange={(e) => setFilterField(e.target.value)} placeholder="ex: Destino de Interesse" list="kommo-fields" />
                </div>
                <div>
                  <Label htmlFor="w-filter-value" className="text-xs">value (opcional)</Label>
                  <Input id="w-filter-value" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder="ex: true" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="w-trend" className="text-sm">Mostrar comparação vs período anterior</Label>
              <Switch id="w-trend" checked={showTrend} onCheckedChange={setShowTrend} />
            </div>

            {['area_chart', 'line_chart', 'bar_chart'].includes(type) && (
              <div className="rounded-md border p-3 space-y-2">
                <Label className="text-sm font-semibold">Cores das séries — opcional</Label>
                <p className="text-xs text-muted-foreground">
                  Define a cor de cada série (coluna) deste gráfico. Sem cor definida, usa a paleta padrão.
                  Substitui a cor fixa por etapa (sem hardcode).
                </p>
                {dataSourceSample.data && dataSourceSample.data.columns.length > 0 ? (
                  <div className="space-y-1.5">
                    {dataSourceSample.data.columns
                      .filter((c) => !['label', 'day', 'date', 'created_at', 'period'].includes(c.toLowerCase()))
                      .map((col) => {
                        const current = seriesColors[col];
                        return (
                          <div key={col} className="flex items-center gap-2">
                            <input
                              type="color"
                              value={current ?? '#888888'}
                              onChange={(e) => setSeriesColors((m) => ({ ...m, [col]: e.target.value }))}
                              className="h-6 w-8 rounded border border-border/60 bg-transparent p-0 cursor-pointer"
                              title={`Cor da série ${col}`}
                            />
                            <code className="font-mono text-[11px] flex-1">{col}</code>
                            {current && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px]"
                                onClick={() =>
                                  setSeriesColors((m) => {
                                    const next = { ...m };
                                    delete next[col];
                                    return next;
                                  })
                                }
                              >
                                padrão
                              </Button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Preencha a dataSource acima pra listar as séries disponíveis.
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="formula" className="space-y-3 pt-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">Cálculo deste widget (opcional)</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={formulaMode === 'simple' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    const p = parseSimpleFormula(formula);
                    if (p) { setSimpleA(p.a); setSimpleOp(p.op); setSimpleB(p.b); setSimplePct(p.pct); }
                    setFormulaMode('simple');
                  }}
                >
                  Simples
                </Button>
                <Button
                  type="button"
                  variant={formulaMode === 'advanced' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setFormulaMode('advanced')}
                >
                  Avançado
                </Button>
              </div>
            </div>

            {formulaMode === 'simple' ? (
              <div className="space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Campo ou número</Label>
                    <Input
                      value={simpleA}
                      onChange={(e) => setSimpleA(e.target.value)}
                      placeholder="ex: won_30d ou 100"
                      list="formula-fields"
                    />
                  </div>
                  <Select value={simpleOp} onValueChange={(v) => setSimpleOp(v as '+' | '-' | '*' | '/')}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="/">÷ dividir</SelectItem>
                      <SelectItem value="*">× multiplicar</SelectItem>
                      <SelectItem value="+">+ somar</SelectItem>
                      <SelectItem value="-">− subtrair</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex-1">
                    <Label className="text-xs">Campo ou número</Label>
                    <Input
                      value={simpleB}
                      onChange={(e) => setSimpleB(e.target.value)}
                      placeholder="ex: leads_30d"
                      list="formula-fields"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border p-2.5">
                  <div>
                    <Label htmlFor="w-pct" className="text-xs">Mostrar como percentual (× 100)</Label>
                    <p className="text-[10px] text-muted-foreground">Multiplica por 100 e exibe com "%".</p>
                  </div>
                  <Switch
                    id="w-pct"
                    checked={simplePct}
                    onCheckedChange={(checked) => {
                      setSimplePct(checked);
                      // O formatador do card só anexa "%", não multiplica — então ligar o
                      // percentual precisa setar o format do widget também, senão sai sem "%".
                      setFormat(checked ? 'percentage' : 'number');
                    }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {formula ? (
                    <>Cálculo: <code className="font-mono">{formula}</code>{simplePct ? ' × 100 (exibido como %)' : ''} · tem precedência sobre métrica + agregação.</>
                  ) : simplePct ? (
                    <>Sem fórmula: o percentual (× 100 e "%") é aplicado sobre a métrica + agregação do widget.</>
                  ) : (
                    <>Escolha os dois campos pra um cálculo, ou deixe vazio pra usar métrica + agregação.</>
                  )}
                </p>
                <datalist id="formula-fields">
                  {formulaFields.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
            ) : (
              <div>
                <Textarea
                  id="w-formula"
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="ex: (won_30d / leads_30d) * 100"
                  rows={4}
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Modo livre — referencie campos pelo nome. Operadores: <code>+ - * /</code> e parênteses.
                </p>
              </div>
            )}

            {formulaValidation && (
              <div
                className={`rounded-md border p-2.5 text-xs ${
                  !formulaValidation.ok
                    ? 'border-destructive/40 bg-destructive/5'
                    : formulaValidation.missing.length > 0
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-emerald-500/30 bg-emerald-500/5'
                }`}
              >
                {!formulaValidation.ok ? (
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-destructive" />
                    <div>
                      <strong>Erro de sintaxe:</strong> {formulaValidation.error}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-start gap-1.5">
                      {formulaValidation.missing.length > 0 ? (
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-600" />
                      )}
                      <div className="flex-1">
                        <span className="font-medium">Variáveis referenciadas:</span>{' '}
                        {formulaValidation.vars.length === 0 ? (
                          <span className="text-muted-foreground">nenhuma (apenas constantes)</span>
                        ) : (
                          formulaValidation.vars.map((v, i) => (
                            <span key={v}>
                              {i > 0 && ', '}
                              <code
                                className={
                                  formulaValidation.missing.includes(v)
                                    ? 'text-amber-700 line-through'
                                    : ''
                                }
                              >
                                {v}
                              </code>
                            </span>
                          ))
                        )}
                        {formulaValidation.missing.length > 0 && (
                          <div className="text-amber-700 mt-0.5">
                            ⚠ Não existe na dataSource: {formulaValidation.missing.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                    {formulaValidation.preview !== null && (
                      <div className="text-emerald-700 pl-5">
                        Preview com a 1ª linha:{' '}
                        <code className="font-mono">
                          {Number.isInteger(formulaValidation.preview)
                            ? formulaValidation.preview
                            : formulaValidation.preview.toFixed(2)}
                        </code>
                      </div>
                    )}
                    {formulaValidation.previewError && (
                      <div className="text-muted-foreground pl-5">
                        Preview indisponível: {formulaValidation.previewError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {formulaMode === 'advanced' && dataSource.trim() && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-xs">
                    Colunas disponíveis em <code className="font-mono">{dataSource.trim()}</code>
                  </Label>
                  {dataSourceSample.isFetching && (
                    <span className="text-[11px] text-muted-foreground">carregando…</span>
                  )}
                </div>
                {dataSourceSample.data && dataSourceSample.data.columns.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {dataSourceSample.data.columns.map((col) => (
                      <Badge
                        key={col}
                        variant="outline"
                        className="font-mono text-[11px] cursor-pointer hover:bg-accent"
                        onClick={() => {
                          // Insere o nome da coluna no fim da fórmula
                          setFormula((f) => (f ? `${f} ${col}` : col));
                        }}
                        title="Clique para inserir na fórmula"
                      >
                        {col}
                      </Badge>
                    ))}
                  </div>
                ) : !dataSourceSample.isFetching && (
                  <p className="text-[11px] text-muted-foreground">
                    Não foi possível ler colunas (view vazia, sem permissão, ou nome inválido).
                  </p>
                )}
              </div>
            )}

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <strong>Como funciona:</strong> se a dataSource é uma view KPI (1 linha), o engine usa o valor direto
              de cada coluna. Se retorna várias linhas, o engine soma cada coluna referenciada antes de avaliar a fórmula.
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="destructive" onClick={handleDelete} disabled={busy} className="sm:mr-auto">
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Apagar widget
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={handleSave} disabled={busy || !title.trim()}>
              {busy && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WidgetEditorDialog;
