import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { SlidersHorizontal, Loader2, Save } from 'lucide-react';

/**
 * Tela F1 — Admin → Org → Features & Navegação.
 * Edita o gating por org que antes era hardcoded em featureFlags.ts/
 * ClientLayout.tsx: org_type/is_demo_org/default_landing_path (colunas de
 * organizations), org_feature_flags e org_menu_visibility.
 *
 * O frontend lê isso via OrganizationBrandingContext -> featureFlags helpers.
 */

interface OrgFeaturesCardProps {
  orgId: string;
}

const ORG_TYPES = [
  { value: 'client', label: 'Cliente' },
  { value: 'demo', label: 'Demonstração' },
  { value: 'pinn_internal', label: 'Pinn (interna)' },
];

// Feature flags conhecidas. Adicionar aqui quando um novo módulo virar flag.
const KNOWN_FLAGS: Array<{ key: string; label: string; desc: string }> = [
  { key: 'rfm_churn', label: 'Análise RFM / Churn', desc: 'Segmentação RFM e previsão de churn no dashboard.' },
];

// Itens de menu gerenciáveis. MANTER EM SINCRONIA com baseNavItems em
// ClientLayout.tsx (itens adminOnly ficam de fora — são gated por papel).
// `def` = visibilidade padrão quando não há override (arguto só aparece p/ a org Arguto).
const MENU_ITEMS: Array<{ key: string; label: string; def: boolean }> = [
  { key: 'dashboard',       label: 'Dashboard',       def: true },
  { key: 'arguto',          label: 'Arguto · BAI',    def: false },
  { key: 'import',          label: 'Dados',           def: true },
  { key: 'insights',        label: 'Inteligência IA', def: true },
  { key: 'pdca',            label: 'Revisão semanal', def: true },
  { key: 'customer-health', label: 'Saúde do Cliente', def: true },
  { key: 'unit-economics',  label: 'CAC + LTV',       def: true },
  { key: 'goals',           label: 'Metas & Alertas', def: true },
];

// Landing pós-login: leaf do path (default_landing_path). '' => dashboard.
const LANDING_OPTIONS = [
  { value: '__default__', label: 'Dashboard (padrão)' },
  ...MENU_ITEMS.filter((m) => m.key !== 'dashboard').map((m) => ({ value: m.key, label: m.label })),
];

interface GatingState {
  orgType: string;
  isDemoOrg: boolean;
  landing: string;                      // '__default__' => null
  flags: Record<string, boolean>;       // flag_key -> enabled
  menu: Record<string, boolean | undefined>; // menu_key -> override (undefined = padrão)
}

const OrgFeaturesCard = ({ orgId }: OrgFeaturesCardProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [state, setState] = useState<GatingState | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['org-features', orgId],
    queryFn: async (): Promise<GatingState> => {
      const [orgRes, flagsRes, menuRes] = await Promise.all([
        supabase.from('organizations').select('org_type, is_demo_org, default_landing_path').eq('id', orgId).single(),
        supabase.from('org_feature_flags').select('flag_key, enabled').eq('org_id', orgId),
        supabase.from('org_menu_visibility').select('menu_key, visible').eq('org_id', orgId),
      ]);
      const org = (orgRes.data ?? {}) as { org_type?: string | null; is_demo_org?: boolean | null; default_landing_path?: string | null };
      const flags: Record<string, boolean> = {};
      for (const f of KNOWN_FLAGS) flags[f.key] = false;
      for (const r of (flagsRes.data ?? []) as Array<{ flag_key: string; enabled: boolean }>) flags[r.flag_key] = r.enabled;
      const menu: Record<string, boolean | undefined> = {};
      for (const r of (menuRes.data ?? []) as Array<{ menu_key: string; visible: boolean }>) menu[r.menu_key] = r.visible;
      return {
        orgType: org.org_type ?? 'client',
        isDemoOrg: !!org.is_demo_org,
        landing: org.default_landing_path || '__default__',
        flags,
        menu,
      };
    },
  });

  useEffect(() => { if (data) setState(data); }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (s: GatingState) => {
      // 1. colunas de organizations
      const { error: orgErr } = await supabase.from('organizations').update({
        org_type: s.orgType,
        is_demo_org: s.isDemoOrg,
        default_landing_path: s.landing === '__default__' ? null : s.landing,
      }).eq('id', orgId);
      if (orgErr) throw orgErr;

      // 2. feature flags (upsert de todas as conhecidas)
      const flagRows = KNOWN_FLAGS.map((f) => ({ org_id: orgId, flag_key: f.key, enabled: !!s.flags[f.key] }));
      const { error: flagErr } = await supabase.from('org_feature_flags').upsert(flagRows, { onConflict: 'org_id,flag_key' });
      if (flagErr) throw flagErr;

      // 3. menu: override explícito (upsert) ou volta ao padrão (delete)
      const upserts = MENU_ITEMS.filter((m) => s.menu[m.key] !== undefined)
        .map((m) => ({ org_id: orgId, menu_key: m.key, visible: s.menu[m.key] as boolean }));
      const deletes = MENU_ITEMS.filter((m) => s.menu[m.key] === undefined).map((m) => m.key);
      if (upserts.length) {
        const { error } = await supabase.from('org_menu_visibility').upsert(upserts, { onConflict: 'org_id,menu_key' });
        if (error) throw error;
      }
      if (deletes.length) {
        const { error } = await supabase.from('org_menu_visibility').delete().eq('org_id', orgId).in('menu_key', deletes);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-features', orgId] });
      // Avisa o OrganizationBrandingContext pra recarregar o gating da org ativa.
      window.dispatchEvent(new Event('org-settings-updated'));
      toast({ title: 'Gating salvo', description: 'Features e navegação atualizadas para esta organização.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });

  const set = <K extends keyof GatingState>(k: K, v: GatingState[K]) =>
    setState((prev) => (prev ? { ...prev, [k]: v } : prev));

  return (
    <Card className="border border-border bg-card/80 backdrop-blur-xl shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-foreground">Features & Navegação</CardTitle>
            <CardDescription>
              Módulos, itens de menu e landing desta org — lido do banco (sem hardcode).
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading || !state ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Tipo / demo / landing */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm">Tipo da organização</Label>
                <Select value={state.orgType} onValueChange={(v) => set('orgType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORG_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Landing pós-login</Label>
                <Select value={state.landing} onValueChange={(v) => set('landing', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANDING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="demo-toggle" className="text-foreground font-medium">Organização de demonstração</Label>
                <p className="text-xs text-muted-foreground">Serve dados mock pré-populados (hooks de demo) em vez de dados reais.</p>
              </div>
              <Switch id="demo-toggle" checked={state.isDemoOrg} onCheckedChange={(v) => set('isDemoOrg', v)} />
            </div>

            <Separator />

            {/* Feature flags */}
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Módulos</p>
              {KNOWN_FLAGS.map((f) => (
                <div key={f.key} className="flex items-center justify-between">
                  <div className="space-y-1 pr-4">
                    <Label className="text-foreground font-medium">{f.label}</Label>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                  <Switch
                    checked={!!state.flags[f.key]}
                    onCheckedChange={(v) => set('flags', { ...state.flags, [f.key]: v })}
                  />
                </div>
              ))}
            </div>

            <Separator />

            {/* Menu */}
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Itens de menu</p>
              {MENU_ITEMS.map((m) => {
                const override = state.menu[m.key];
                const effective = override ?? m.def;
                return (
                  <div key={m.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 pr-4">
                      <Label className="text-foreground">{m.label}</Label>
                      {override === undefined
                        ? <Badge variant="outline" className="text-[10px] text-muted-foreground">padrão</Badge>
                        : (
                          <button
                            type="button"
                            className="text-[10px] uppercase tracking-wide text-primary hover:underline"
                            onClick={() => set('menu', (() => { const c = { ...state.menu }; delete c[m.key]; return c; })())}
                          >
                            resetar
                          </button>
                        )}
                    </div>
                    <Switch checked={effective} onCheckedChange={(v) => set('menu', { ...state.menu, [m.key]: v })} />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => state && saveMutation.mutate(state)}
                disabled={saveMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default OrgFeaturesCard;
