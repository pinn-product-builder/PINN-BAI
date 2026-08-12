import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, InputLabel,
  MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { AutoAwesome, Close } from '@mui/icons-material';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDataSources } from '@/hooks/useDataSources';
import { useSourceFields, isChartableCategory, type SourceSchema } from '@/hooks/useSourceFields';
import { useKommoFields, isChartableDimension, isFlagDimension, type KommoField } from '../hooks/useKommoFields';

/**
 * Construtor de dashboard inicial — AGNÓSTICO DE FONTE e MULTI-FONTE.
 *
 * Lista as fontes que a org tem (catálogo: views CRM, integrações, etc.), e pra
 * CADA fonte escolhida descobre o schema (useSourceFields) e SUGERE widgets pelo
 * tipo das colunas — numérico→KPI, categórico→pizza/barra, data→série temporal.
 * Funciona igual pra Kommo, Omie, Ploomes, Supabase, Sheets, CSV, API.
 *
 * Caso especial: a view de campos customizados do CRM (formato "longo":
 * field_name/value) usa o catálogo de campos pra sugerir "Leads por <campo>".
 *
 * Seleção acumula entre fontes → dá pra montar um dashboard com widgets de mais
 * de uma fonte. Nada hardcoded por cliente.
 */

interface Props {
  open: boolean;
  orgId: string;
  dashboardId: string | null;
  connectedProviders: string[];
  onClose: () => void;
  onApplied: () => void;
}

type WidgetType = 'metric_card' | 'funnel' | 'pie_chart' | 'bar_chart' | 'area_chart' | 'line_chart' | 'table' | 'insight_card';
type DashboardForm = 'auto' | 'sdr_funnel' | 'executive' | 'commercial';

interface Suggestion {
  key: string;
  source: string;
  title: string;
  type: WidgetType;
  size: 'small' | 'medium' | 'large';
  config: Record<string, unknown>;
  note: string;
  defaultOn: boolean;
}

const CRM_CUSTOM_FIELDS_SOURCE = 'vw_bai_crm_custom_field_distribution';

// Dicionário PT pras colunas conhecidas das views CRM — garante títulos em
// português também no caminho heurístico (não só na IA). Fallback: title-case.
const PT_LABELS: Record<string, string> = {
  total_leads: 'Total de Leads', active_leads: 'Leads Ativos', lost_leads: 'Leads Perdidos',
  won_leads: 'Negócios Ganhos', open_leads: 'Leads em Aberto', leads_with_interaction: 'Leads com Interação',
  leads_total: 'Total de Leads', entrada: 'Entrada', leads_created: 'Leads Criados',
  open_pipeline_value: 'Valor em Aberto', won_value: 'Valor Ganho', conversion_rate: 'Taxa de Conversão',
  avg_ticket: 'Ticket Médio', leads_without_owner: 'Leads sem Responsável',
  leads_without_source: 'Leads sem Origem', leads_without_value: 'Leads sem Valor',
  stage_name: 'Etapa', lost_reason: 'Motivo da Perda', owner_name: 'Vendedor',
  owner_performance: 'Performance por Vendedor', day: 'Dia', value: 'Valor', field_name: 'Campo',
  lead_count: 'Leads', field_type: 'Tipo', distinct_values: 'Valores distintos', leads_with_field: 'Leads',
};
function labelize(s: string): string {
  const key = s.toLowerCase();
  if (PT_LABELS[key]) return PT_LABELS[key];
  return s.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
}
function guessFormat(name: string): 'number' | 'currency' | 'percentage' {
  const n = name.toLowerCase();
  // Contagens nunca são moeda, mesmo que o nome contenha "value"
  // (ex.: leads_without_value é um count, não R$).
  if (/leads|count|qtd|quant|without|sem_|num_/.test(n)) return 'number';
  if (/rate|taxa|pct|percent|conversa|conversão|churn/.test(n)) return 'percentage';
  if (/valor|value|receita|revenue|preco|price|ticket|mrr|spend|custo|cac|ltv/.test(n)) return 'currency';
  return 'number';
}

/** Sugestões genéricas a partir do schema de qualquer fonte (wide). */
function genericSuggestions(source: string, schema: SourceSchema): Suggestion[] {
  const out: Suggestion[] = [];
  const numeric = schema.fields.filter((f) => f.kind === 'numeric');
  const categorical = schema.fields.filter(isChartableCategory);
  const dates = schema.fields.filter((f) => f.kind === 'date');

  if (schema.rowCount === 1) {
    // Fonte pré-agregada (1 linha = KPIs) → cada numérico COM SINAL vira um card.
    // Pula métricas zeradas (ex.: pipeline/ticket/conversão sem valor no CRM) pra
    // não poluir o dashboard com R$ 0,00 / 0%. Métricas de higiene (without_*)
    // ficam disponíveis mas desmarcadas por padrão.
    numeric.filter((f) => f.hasSignal).forEach((f, i) => {
      const hygiene = /without|sem_/.test(f.name.toLowerCase());
      out.push({
        key: `${source}:kpi:${f.name}`, source, title: labelize(f.name), type: 'metric_card', size: 'small',
        config: { dataSource: source, metric: f.name, isAggregatedView: true, format: guessFormat(f.name) },
        note: hygiene ? 'higiene' : 'KPI', defaultOn: !hygiene && i < 6,
      });
    });
    return out;
  }

  // Fonte multi-linha → série temporal + distribuições.
  const valueMetric = numeric[0]?.name;
  if (dates[0] && valueMetric) {
    out.push({
      key: `${source}:time`, source, title: `${labelize(valueMetric)} ao longo do tempo`, type: 'area_chart', size: 'large',
      config: { dataSource: source, groupBy: dates[0].name, metric: valueMetric, aggregation: 'sum', dataKeys: [valueMetric] },
      note: 'série temporal', defaultOn: true,
    });
  }
  categorical.slice(0, 4).forEach((f, i) => out.push({
    key: `${source}:cat:${f.name}`, source, title: `Por ${labelize(f.name)}`, type: i === 0 ? 'pie_chart' : 'bar_chart', size: 'medium',
    config: { dataSource: source, groupBy: f.name, metric: valueMetric ?? f.name, aggregation: valueMetric ? 'sum' : 'count' },
    note: `${f.distinctValues} valores`, defaultOn: i < 2,
  }));
  return out;
}

/** Sugestões do CRM a partir do catálogo de campos customizados (formato longo). */
function crmCustomFieldSuggestions(fields: KommoField[]): Suggestion[] {
  const out: Suggestion[] = [];
  fields.filter(isFlagDimension).slice(0, 2).forEach((f) => out.push({
    key: `cf:flag:${f.field_name}`, source: CRM_CUSTOM_FIELDS_SOURCE, title: labelize(f.field_name), type: 'metric_card', size: 'small',
    config: { dataSource: CRM_CUSTOM_FIELDS_SOURCE, metric: 'lead_count', isAggregatedView: true, format: 'number', filters: { field_name: f.field_name, value: 'true' } },
    note: `${f.leads_with_field} leads`, defaultOn: true,
  }));
  fields.filter(isChartableDimension).slice(0, 4).forEach((f, i) => out.push({
    key: `cf:dim:${f.field_name}`, source: CRM_CUSTOM_FIELDS_SOURCE, title: `Leads por ${labelize(f.field_name)}`, type: i === 0 ? 'pie_chart' : 'bar_chart', size: 'medium',
    config: { dataSource: CRM_CUSTOM_FIELDS_SOURCE, groupBy: 'value', metric: 'lead_count', aggregation: 'sum', filters: { field_name: f.field_name } },
    note: `${f.distinct_values} valores · ${f.leads_with_field} leads`, defaultOn: true,
  }));
  return out;
}

export function AutoBuildDashboardDialog({ open, orgId, dashboardId, connectedProviders, onClose, onApplied }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const dataSources = useDataSources();

  // Fontes disponíveis pra org (catálogo). Default: a 1ª view CRM, se houver.
  const sources = useMemo(
    () => (dataSources.data ?? []).map((s) => ({ key: s.key, label: s.display_name })),
    [dataSources.data],
  );
  const [source, setSource] = useState('');
  useEffect(() => {
    if (!source && sources.length) {
      const crm = sources.find((s) => s.key === 'vw_bai_crm_kpis') ?? sources[0];
      setSource(crm.key);
    }
  }, [sources, source]);

  const schema = useSourceFields(open ? orgId : undefined, source || undefined);
  const isCrmCustom = source === CRM_CUSTOM_FIELDS_SOURCE;
  const crmFields = useKommoFields(open && isCrmCustom ? orgId : undefined);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (isCrmCustom) return crmCustomFieldSuggestions(crmFields.data ?? []);
    if (schema.data) return genericSuggestions(source, schema.data);
    return [];
  }, [isCrmCustom, crmFields.data, schema.data, source]);

  // chosen acumula entre trocas de fonte (dashboard multi-fonte).
  const [chosen, setChosen] = useState<Record<string, Suggestion>>({});
  // Compositor com IA: a IA entende as fontes e propõe o dashboard completo.
  const [form, setForm] = useState<DashboardForm>('auto');
  const [goal, setGoal] = useState('');
  const [aiWidgets, setAiWidgets] = useState<Suggestion[]>([]);
  // Pré-marca os defaults da fonte atual ao carregar suas sugestões.
  useEffect(() => {
    // Se a IA já compôs, NÃO pré-marcar defaults do heurístico — senão mistura
    // títulos em inglês + duplica KPIs que a IA já trouxe em PT.
    if (suggestions.length === 0 || aiWidgets.length > 0) return;
    setChosen((prev) => {
      const next = { ...prev };
      for (const s of suggestions) if (s.defaultOn && !(s.key in next)) next[s.key] = s;
      return next;
    });
  }, [suggestions, aiWidgets.length]);

  const toggle = (s: Suggestion, on: boolean) =>
    setChosen((prev) => {
      const next = { ...prev };
      if (on) next[s.key] = s; else delete next[s.key];
      return next;
    });

  const chosenList = Object.values(chosen);
  const loading = (isCrmCustom ? crmFields.isLoading : schema.isLoading) || dataSources.isLoading;

  // Gera o dashboard via IA (edge compose-dashboard): descobre fontes, infere
  // schema e propõe widgets variados. O resultado entra na MESMA lista editável.
  const composeAI = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('compose-dashboard', {
        body: { orgId, form, goal: goal.trim() || undefined },
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = data as any;
      if (payload?.error) throw new Error(payload.error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const widgets: Suggestion[] = ((payload?.widgets ?? []) as any[]).map((w, i) => ({
        key: `ai:${i}`,
        source: String(w?.config?.dataSource ?? 'ia'),
        title: String(w?.title ?? 'Widget'),
        type: w?.type as WidgetType,
        size: (['small', 'medium', 'large'].includes(w?.size) ? w.size : 'medium') as Suggestion['size'],
        config: (w?.config ?? {}) as Record<string, unknown>,
        note: String(w?.note ?? 'IA'),
        defaultOn: true,
      }));
      return { title: String(payload?.title ?? ''), widgets };
    },
    onSuccess: ({ widgets }) => {
      setAiWidgets(widgets);
      // Substitui a seleção pela proposta da IA (PT, sem duplicar com o heurístico).
      setChosen(Object.fromEntries(widgets.map((w) => [w.key, w])));
      toast({ title: `IA propôs ${widgets.length} widgets`, description: 'Edite/desmarque o que quiser e clique em Montar.' });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Falha ao gerar com IA', description: err.message }),
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!dashboardId) throw new Error('Dashboard não encontrado.');
      if (chosenList.length === 0) throw new Error('Selecione ao menos 1 widget.');
      const rows = chosenList.map((s, idx) => ({
        dashboard_id: dashboardId, title: s.title, type: s.type, position: idx, size: s.size, config: s.config, is_visible: true,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('dashboard_widgets').insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast({ title: `${count} widgets aplicados`, description: 'Dashboard montado. Edite/adicione em "Editar layout".' });
      qc.invalidateQueries({ queryKey: ['dashboard-widgets'] });
      qc.invalidateQueries({ queryKey: ['crm-auditor', orgId, 'first-sync-detector'] });
      onApplied();
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Falha ao montar', description: err.message }),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Montar dashboard</Typography>
            <Typography variant="caption" color="text.secondary">
              Escolha a fonte, marque os widgets sugeridos. Pode trocar de fonte e ir somando — a seleção acumula.
            </Typography>
          </Box>
          <Button size="small" onClick={onClose} startIcon={<Close />}>Pular</Button>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {/* Compositor com IA — a IA entende as fontes e propõe o dashboard inteiro. */}
        <Box sx={{ p: 1.5, mb: 2, border: 1, borderColor: 'primary.light', borderRadius: 1.5, bgcolor: 'action.hover' }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <AutoAwesome fontSize="small" color="primary" />
            <Typography variant="body2" fontWeight={700}>Montar com IA</Typography>
            <Typography variant="caption" color="text.secondary">
              A IA lê suas fontes e propõe um dashboard completo. Você edita antes de aplicar.
            </Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="form-label">Estilo</InputLabel>
              <Select labelId="form-label" label="Estilo" value={form} onChange={(e) => setForm(e.target.value as DashboardForm)}>
                <MenuItem value="auto">Automático</MenuItem>
                <MenuItem value="sdr_funnel">Funil SDR</MenuItem>
                <MenuItem value="executive">Executivo</MenuItem>
                <MenuItem value="commercial">Comercial</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small" fullWidth value={goal} onChange={(e) => setGoal(e.target.value)}
              placeholder="Objetivo (opcional): ex. acompanhar reuniões e conversão"
            />
            <Button
              variant="contained" onClick={() => composeAI.mutate()} disabled={composeAI.isPending}
              startIcon={composeAI.isPending ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {composeAI.isPending ? 'Gerando…' : 'Gerar com IA'}
            </Button>
          </Stack>
          {aiWidgets.length > 0 && (
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Proposta da IA ({aiWidgets.length}) — desmarque o que não quiser:
              </Typography>
              {aiWidgets.map((s) => (
                <Box key={s.key} sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: chosen[s.key] ? 'background.paper' : 'transparent' }}>
                  <FormControlLabel
                    control={<Checkbox checked={!!chosen[s.key]} onChange={(e) => toggle(s, e.target.checked)} />}
                    label={
                      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="body2" fontWeight={700}>{s.title}</Typography>
                        <Chip label={s.type} size="small" variant="outlined" />
                        <Typography variant="caption" color="text.secondary">{s.note}</Typography>
                      </Stack>
                    }
                  />
                </Box>
              ))}
            </Stack>
          )}
        </Box>

        <Divider sx={{ mb: 2 }}>ou monte manualmente por fonte</Divider>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel id="src-label">Fonte de dados</InputLabel>
          <Select labelId="src-label" label="Fonte de dados" value={source} onChange={(e) => setSource(e.target.value)}>
            {sources.map((s) => (
              <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <Stack alignItems="center" spacing={1}>
              <CircularProgress size={22} />
              <Typography variant="caption" color="text.secondary">Descobrindo o schema da fonte…</Typography>
            </Stack>
          </Box>
        )}

        {!loading && (
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              Sugestões desta fonte ({suggestions.length}) · {chosenList.length} no dashboard
            </Typography>
            {suggestions.map((s) => (
              <Box key={s.key} sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: chosen[s.key] ? 'action.hover' : 'transparent' }}>
                <FormControlLabel
                  control={<Checkbox checked={!!chosen[s.key]} onChange={(e) => toggle(s, e.target.checked)} />}
                  label={
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography variant="body2" fontWeight={700}>{s.title}</Typography>
                      <Chip label={s.type} size="small" variant="outlined" />
                      <Typography variant="caption" color="text.secondary">{s.note}</Typography>
                    </Stack>
                  }
                />
              </Box>
            ))}
            {suggestions.length === 0 && (
              <Typography variant="body2" color="text.secondary">Sem sugestões automáticas pra esta fonte — use "Adicionar widget" pra montar manualmente.</Typography>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="text">Configurar depois</Button>
        <Button variant="contained" onClick={() => apply.mutate()} disabled={apply.isPending || chosenList.length === 0}>
          {apply.isPending ? 'Montando…' : `Montar ${chosenList.length} widget${chosenList.length === 1 ? '' : 's'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AutoBuildDashboardDialog;
