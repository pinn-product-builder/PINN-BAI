import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, RotateCcw, Workflow, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Setup CRM → Mapeamento (Etapas e Campos).
 *
 * Lê o que a sync DESCOBRIU do CRM (crm_stages, crm_custom_fields) e deixa o
 * cliente ajustar a APRESENTAÇÃO/semântica sem hardcode:
 *   • Etapas: nome de exibição, cor, ordem, visível, tipo (won/lost/progress)
 *     → grava overrides em org_crm_stage_mappings (overlay; a sync nunca apaga).
 *   • Campos: qual campo descoberto corresponde a email/phone/etc. → org_field_mappings.
 */

interface RawStage {
  pipeline_external_id: string;
  external_id: string;
  name: string;
  sort_order: number | null;
  stage_type: string | null;
}
interface StageOverride {
  pipeline_external_id: string;
  stage_external_id: string;
  display_name: string | null;
  color: string | null;
  sort_order: number | null;
  is_visible: boolean | null;
  stage_type_override: string | null;
}
interface CustomField {
  external_id: string;
  entity_type: string;
  name: string;
  field_type: string | null;
}
interface FieldMapping {
  id?: string;
  provider: string;
  entity_type: string;
  logical_field: string;
  source_external_id: string | null;
  source_code: string | null;
  confirmed: boolean;
}

const STAGE_TYPES = [
  { value: 'progress', label: 'Em andamento' },
  { value: 'won', label: 'Ganho' },
  { value: 'lost', label: 'Perdido' },
];

const LOGICAL_FIELDS = [
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone' },
];

export default function CrmMapping() {
  const { orgId } = useParams<{ orgId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const tenantId = orgId ?? '';

  // ── Dados descobertos + overrides ────────────────────────────────────────
  const stagesQ = useQuery({
    queryKey: ['crm-stages', orgId],
    queryFn: async (): Promise<RawStage[]> => {
      const { data, error } = await supabase
        .from('crm_stages')
        .select('pipeline_external_id, external_id, name, sort_order, stage_type')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return (data ?? []) as RawStage[];
    },
  });
  const overridesQ = useQuery({
    queryKey: ['org-stage-mappings', orgId],
    queryFn: async (): Promise<StageOverride[]> => {
      const { data, error } = await supabase
        .from('org_crm_stage_mappings')
        .select('pipeline_external_id, stage_external_id, display_name, color, sort_order, is_visible, stage_type_override')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return (data ?? []) as StageOverride[];
    },
  });
  const pipelinesQ = useQuery({
    queryKey: ['crm-pipelines', orgId],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from('crm_pipelines')
        .select('external_id, name')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      const m: Record<string, string> = {};
      (data ?? []).forEach((p: { external_id: string; name: string }) => { m[p.external_id] = p.name; });
      return m;
    },
  });
  const fieldsQ = useQuery({
    queryKey: ['crm-custom-fields', orgId],
    queryFn: async (): Promise<CustomField[]> => {
      const { data, error } = await supabase
        .from('crm_custom_fields')
        .select('external_id, entity_type, name, field_type')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return (data ?? []) as CustomField[];
    },
  });
  const fieldMapQ = useQuery({
    queryKey: ['org-field-mappings', orgId],
    queryFn: async (): Promise<FieldMapping[]> => {
      const { data, error } = await supabase
        .from('org_field_mappings')
        .select('id, provider, entity_type, logical_field, source_external_id, source_code, confirmed')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return (data ?? []) as FieldMapping[];
    },
  });

  // ── Estado editável das etapas (override por stage) ──────────────────────
  const [edits, setEdits] = useState<Record<string, Partial<StageOverride>>>({});

  // Semente do estado a partir dos overrides salvos quando carregam.
  useEffect(() => {
    if (!stagesQ.data || !overridesQ.data) return;
    const seed: Record<string, Partial<StageOverride>> = {};
    for (const s of stagesQ.data) {
      const o = overridesQ.data.find(
        (x) => x.pipeline_external_id === s.pipeline_external_id && x.stage_external_id === s.external_id,
      );
      seed[s.external_id] = {
        display_name: o?.display_name ?? null,
        color: o?.color ?? null,
        sort_order: o?.sort_order ?? null,
        is_visible: o?.is_visible ?? true,
        stage_type_override: o?.stage_type_override ?? null,
      };
    }
    setEdits(seed);
  }, [stagesQ.data, overridesQ.data]);

  const setField = (stageId: string, patch: Partial<StageOverride>) =>
    setEdits((m) => ({ ...m, [stageId]: { ...m[stageId], ...patch } }));

  const stagesByPipeline = useMemo(() => {
    const groups: Record<string, RawStage[]> = {};
    (stagesQ.data ?? []).forEach((s) => {
      (groups[s.pipeline_external_id] ||= []).push(s);
    });
    // ordena cada pipeline pela ordem efetiva (override > descoberto)
    Object.values(groups).forEach((arr) =>
      arr.sort((a, b) => {
        const ao = edits[a.external_id]?.sort_order ?? a.sort_order ?? 0;
        const bo = edits[b.external_id]?.sort_order ?? b.sort_order ?? 0;
        return ao - bo;
      }),
    );
    return groups;
  }, [stagesQ.data, edits]);

  const saveStages = useMutation({
    mutationFn: async () => {
      const rows = (stagesQ.data ?? []).map((s) => {
        const e = edits[s.external_id] ?? {};
        return {
          tenant_id: tenantId,
          pipeline_external_id: s.pipeline_external_id,
          stage_external_id: s.external_id,
          display_name: e.display_name?.trim() ? e.display_name.trim() : null,
          color: e.color ?? null,
          sort_order: e.sort_order ?? null,
          is_visible: e.is_visible ?? true,
          stage_type_override: e.stage_type_override ?? null,
          source: 'manual',
        };
      });
      const { error } = await supabase
        .from('org_crm_stage_mappings')
        .upsert(rows, { onConflict: 'tenant_id,pipeline_external_id,stage_external_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Mapeamento de etapas salvo' });
      qc.invalidateQueries({ queryKey: ['org-stage-mappings', orgId] });
    },
    onError: (e: unknown) =>
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: e instanceof Error ? e.message : String(e) }),
  });

  // ── Campos: mapear logical_field → campo descoberto ──────────────────────
  const contactFields = (fieldsQ.data ?? []).filter((f) => f.entity_type === 'contact');
  const [fieldEdits, setFieldEdits] = useState<Record<string, string>>({}); // logical_field → external_id

  useEffect(() => {
    if (!fieldMapQ.data) return;
    const seed: Record<string, string> = {};
    fieldMapQ.data.forEach((m) => { if (m.source_external_id) seed[m.logical_field] = m.source_external_id; });
    setFieldEdits(seed);
  }, [fieldMapQ.data]);

  const saveFields = useMutation({
    mutationFn: async () => {
      const rows = LOGICAL_FIELDS.filter((lf) => fieldEdits[lf.key]).map((lf) => {
        return {
          tenant_id: tenantId,
          provider: 'kommo',
          entity_type: 'contact',
          logical_field: lf.key,
          source_external_id: fieldEdits[lf.key],
          confirmed: true,
          source: 'manual',
        };
      });
      if (!rows.length) return;
      const { error } = await supabase
        .from('org_field_mappings')
        .upsert(rows, { onConflict: 'tenant_id,provider,entity_type,logical_field' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Mapeamento de campos salvo' });
      qc.invalidateQueries({ queryKey: ['org-field-mappings', orgId] });
    },
    onError: (e: unknown) =>
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: e instanceof Error ? e.message : String(e) }),
  });

  const loading = stagesQ.isLoading || overridesQ.isLoading;

  if (!orgId) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Mapeamento do CRM</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ajuste como as etapas e campos descobertos no seu CRM aparecem nos dashboards. A sincronização
          nunca sobrescreve esses ajustes.
        </p>
      </div>

      <Tabs defaultValue="stages">
        <TabsList>
          <TabsTrigger value="stages"><Workflow className="w-3.5 h-3.5 mr-1.5" /> Etapas do funil</TabsTrigger>
          <TabsTrigger value="fields"><Tag className="w-3.5 h-3.5 mr-1.5" /> Campos</TabsTrigger>
        </TabsList>

        {/* ── ETAPAS ── */}
        <TabsContent value="stages" className="space-y-4 pt-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando etapas descobertas…</div>
          ) : (stagesQ.data ?? []).length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma etapa sincronizada ainda. Conecte o CRM e rode a sincronização.
            </CardContent></Card>
          ) : (
            <>
              {Object.entries(stagesByPipeline).map(([pipeId, arr]) => (
                <Card key={pipeId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{pipelinesQ.data?.[pipeId] ?? `Funil ${pipeId}`}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-2 text-[11px] text-muted-foreground px-1">
                      <span>Etapa (Kommo)</span><span>Nome de exibição</span><span>Cor</span><span>Ordem</span><span>Visível / Tipo</span>
                    </div>
                    {arr.map((s) => {
                      const e = edits[s.external_id] ?? {};
                      return (
                        <div key={s.external_id} className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-2 items-center">
                          <span className="text-xs font-mono text-muted-foreground truncate" title={s.name}>{s.name || s.external_id}</span>
                          <Input
                            value={e.display_name ?? ''}
                            onChange={(ev) => setField(s.external_id, { display_name: ev.target.value })}
                            placeholder={s.name || s.external_id}
                            className="h-8"
                          />
                          <input
                            type="color"
                            value={e.color ?? '#888888'}
                            onChange={(ev) => setField(s.external_id, { color: ev.target.value })}
                            className="h-8 w-9 rounded border border-border/60 bg-transparent p-0 cursor-pointer"
                            title="Cor da etapa"
                          />
                          <Input
                            type="number"
                            value={e.sort_order ?? s.sort_order ?? 0}
                            onChange={(ev) => setField(s.external_id, { sort_order: ev.target.value === '' ? null : Number(ev.target.value) })}
                            className="h-8 w-16"
                          />
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={e.is_visible ?? true}
                              onCheckedChange={(v) => setField(s.external_id, { is_visible: v })}
                            />
                            <Select
                              value={e.stage_type_override ?? s.stage_type ?? 'progress'}
                              onValueChange={(v) => setField(s.external_id, { stage_type_override: v })}
                            >
                              <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {STAGE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setEdits({}); overridesQ.refetch(); stagesQ.refetch(); }}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reverter
                </Button>
                <Button onClick={() => saveStages.mutate()} disabled={saveStages.isPending}>
                  {saveStages.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                  Salvar etapas
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── CAMPOS ── */}
        <TabsContent value="fields" className="space-y-4 pt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Campos lógicos → campo do Kommo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Qual campo descoberto do seu CRM corresponde a cada informação. Detectado automaticamente na
                sincronização; ajuste se necessário.
              </p>
              {LOGICAL_FIELDS.map((lf) => (
                <div key={lf.key} className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <Label className="text-sm">{lf.label}</Label>
                  <Select
                    value={fieldEdits[lf.key] ?? ''}
                    onValueChange={(v) => setFieldEdits((m) => ({ ...m, [lf.key]: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o campo do CRM…" /></SelectTrigger>
                    <SelectContent>
                      {contactFields.map((c) => (
                        <SelectItem key={c.external_id} value={c.external_id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="flex justify-end">
                <Button onClick={() => saveFields.mutate()} disabled={saveFields.isPending}>
                  {saveFields.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                  Salvar campos
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
