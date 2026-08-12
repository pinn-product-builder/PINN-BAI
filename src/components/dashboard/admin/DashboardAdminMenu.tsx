import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Settings, Plus, Copy, Trash2, Edit3, Save, ChevronDown, Loader2, PlusSquare, FileText, ClipboardCopy, Sparkles, ArrowUp, ArrowDown, ListOrdered } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useToast } from '@/hooks/use-toast';
import {
  useCreateDashboard,
  useUpdateDashboard,
  useDeleteDashboard,
  useDuplicateDashboard,
  useCreateDashboardWidgets,
  useDashboards,
  useReorderDashboards,
} from '@/hooks/useDashboard';
import { useCreateTemplate } from '@/hooks/useTemplates';
import { useDataSources } from '@/hooks/useDataSources';
import { useGoogleCalendarEvents, type CalendarEvent } from '@/hooks/useGoogleCalendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { captureDashboardSnapshot } from '@/lib/dashboardSnapshot';
import { supabase } from '@/integrations/supabase/client';
import type { Dashboard } from '@/lib/types';

type DialogMode = null | 'create' | 'rename' | 'delete' | 'save-template' | 'meeting-brief' | 'meeting-brief-context' | 'live-generate' | 'reorder';

interface Props {
  orgId: string;
  activeDash: Dashboard | null | undefined;
  onAfterChange?: (dashboardId?: string) => void;
}

/**
 * Menu admin in-place para CRUD de dashboards e templates.
 * Renderizado no header do Dashboard quando o usuário tem role platform_admin.
 */
export function DashboardAdminMenu({ orgId, activeDash, onAfterChange }: Props) {
  const [open, setOpen] = useState<DialogMode>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [templatePlan, setTemplatePlan] = useState('1');
  const { toast } = useToast();

  const createMut = useCreateDashboard();
  const updateMut = useUpdateDashboard();
  const deleteMut = useDeleteDashboard();
  const duplicateMut = useDuplicateDashboard();
  const reorderMut = useReorderDashboards();
  const allDashboards = useDashboards(orgId);
  const dataSources = useDataSources({ orgId });
  // Ordem em edição no dialog "Reordenar". Inicializada quando o dialog abre.
  const [reorderList, setReorderList] = useState<{ id: string; name: string }[]>([]);
  // Pra capturar snapshot do estado renderizado quando gera pauta IA.
  const queryClient = useQueryClient();
  const location = useLocation();
  const createTemplateMut = useCreateTemplate();
  const createWidgetsMut = useCreateDashboardWidgets();
  const [briefMarkdown, setBriefMarkdown] = useState<string>('');
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefTitle, setBriefTitle] = useState('');
  const [briefWhen, setBriefWhen] = useState('');
  const [briefAttendees, setBriefAttendees] = useState('');
  const [briefFocus, setBriefFocus] = useState('');
  // Eventos do Google Calendar — populados quando o dialog de contexto abre.
  const calendarEvents = useGoogleCalendarEvents(
    open === 'meeting-brief-context' ? orgId : undefined,
    { maxDays: 14 },
  );
  const [liveIntent, setLiveIntent] = useState('');
  const [liveLoading, setLiveLoading] = useState(false);

  const reset = () => {
    setName('');
    setDescription('');
    setIsDefault(false);
    setTemplatePlan('1');
  };
  const close = () => {
    setOpen(null);
    reset();
  };

  const openRename = () => {
    if (!activeDash) return;
    setName(activeDash.name ?? '');
    setDescription(activeDash.description ?? '');
    setIsDefault(!!activeDash.is_default);
    setOpen('rename');
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' });
      return;
    }
    try {
      const dash = await createMut.mutateAsync({
        org_id: orgId,
        name: name.trim(),
        description: description.trim() || undefined,
        is_default: isDefault,
      });
      toast({ title: 'Dashboard criado', description: dash.name });
      onAfterChange?.(dash.id);
      close();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: 'Erro ao criar', description: msg });
    }
  };

  const handleRename = async () => {
    if (!activeDash || !name.trim()) return;
    try {
      await updateMut.mutateAsync({
        id: activeDash.id,
        org_id: orgId,
        name: name.trim(),
        description: description.trim() || null,
        is_default: isDefault,
      });
      toast({ title: 'Dashboard atualizado' });
      onAfterChange?.(activeDash.id);
      close();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: msg });
    }
  };

  const handleDelete = async () => {
    if (!activeDash) return;
    try {
      await deleteMut.mutateAsync(activeDash.id);
      toast({ title: 'Dashboard removido' });
      onAfterChange?.();
      close();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: 'Erro ao apagar', description: msg });
    }
  };

  const handleDuplicate = async () => {
    if (!activeDash) return;
    try {
      const copy = await duplicateMut.mutateAsync({
        dashboardId: activeDash.id,
        name: `${activeDash.name} (cópia)`,
      });
      toast({ title: 'Dashboard duplicado', description: copy.name });
      onAfterChange?.(copy.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: 'Erro ao duplicar', description: msg });
    }
  };

  const handleLiveGenerate = async () => {
    if (!activeDash || !liveIntent.trim()) return;
    setLiveLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-data-chat`;
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          orgId,
          mode: 'live_generate',
          intent: liveIntent.trim(),
          // Catálogo curado em dashboard_data_sources. Admin gerencia em
          // /admin/data-sources sem deploy. Fallback p/ lista mínima se vazio.
          availableTables: (dataSources.data?.length ?? 0) > 0
            ? dataSources.data!.map((d) => d.key)
            : ['crm_leads', 'crm_norm_contacts', 'bai_kpi_snapshots'],
        }),
      });
      if (!resp.ok) throw new Error(`Edge respondeu ${resp.status}`);
      const json = await resp.json();
      const widgets = (json.widgets ?? []) as Array<{
        type: string; title: string; description?: string;
        dataSource?: string; metric?: string;
        aggregation?: string; format?: string; groupBy?: string;
      }>;
      if (widgets.length === 0) {
        toast({ variant: 'destructive', title: 'IA não retornou widgets', description: 'Tente ser mais específico no pedido.' });
        return;
      }
      // Insere via hook existente.
      await createWidgetsMut.mutateAsync({
        dashboardId: activeDash.id,
        widgets: widgets.map((w) => ({
          type: w.type as 'metric_card',
          title: w.title,
          description: w.description ?? null,
          config: {
            dataSource: w.dataSource,
            metric: w.metric,
            aggregation: w.aggregation,
            format: w.format,
            groupBy: w.groupBy,
          },
        })),
      });
      toast({ title: `${widgets.length} widgets criados`, description: 'Use o modo edição para ajustar fórmulas se necessário.' });
      setLiveIntent('');
      setOpen(null);
      onAfterChange?.(activeDash.id);
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Erro ao gerar', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLiveLoading(false);
    }
  };

  // Abre o form de contexto da reunião. Admin pode preencher (título/quando/
  // participantes/foco) ou pular pra gerar sem contexto.
  const handleGenerateBrief = () => {
    setBriefTitle('');
    setBriefWhen('');
    setBriefAttendees('');
    setBriefFocus('');
    setBriefMarkdown('');
    setOpen('meeting-brief-context');
  };

  // Preenche campos a partir de um evento do Google Calendar.
  const applyCalendarEvent = (event: CalendarEvent) => {
    setBriefTitle(event.title);
    if (event.start) {
      try {
        const d = new Date(event.start);
        const dateStr = d.toLocaleDateString('pt-BR', {
          weekday: 'long', day: '2-digit', month: 'long',
        });
        const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setBriefWhen(`${dateStr} às ${timeStr}`);
      } catch {
        setBriefWhen(event.start);
      }
    }
    if (event.attendees.length > 0) {
      setBriefAttendees(event.attendees.join(', '));
    }
    if (event.description) {
      setBriefFocus(event.description.slice(0, 500));
    }
  };

  const runMeetingBrief = async (withContext: boolean) => {
    setOpen('meeting-brief');
    setBriefMarkdown('');
    setBriefLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-data-chat`;
      const meetingPayload = withContext && (briefTitle || briefWhen || briefAttendees || briefFocus)
        ? {
            title: briefTitle.trim() || undefined,
            when: briefWhen.trim() || undefined,
            attendees: briefAttendees.trim() || undefined,
            focus: briefFocus.trim() || undefined,
          }
        : undefined;
      // Snapshot do estado renderizado AGORA (KPIs calculados, widgets, etc).
      // Edge function injeta como seção "0.1 Métricas visíveis na sessão".
      const dashboardSnapshot = captureDashboardSnapshot(queryClient, location.pathname);
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          orgId,
          mode: 'meeting_brief',
          pathname: location.pathname,
          dashboardName: activeDash?.name,
          dashboardContext: dashboardSnapshot,
          ...(meetingPayload ? { meeting_context: meetingPayload } : {}),
        }),
      });
      if (!resp.ok) throw new Error(`Edge function respondeu ${resp.status}`);
      const json = await resp.json();
      setBriefMarkdown(json.markdown ?? '');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: 'Erro ao gerar pauta', description: msg });
      setOpen(null);
    } finally {
      setBriefLoading(false);
    }
  };

  const handleCopyBrief = async () => {
    try {
      await navigator.clipboard.writeText(briefMarkdown);
      toast({ title: 'Pauta copiada', description: 'Texto em Markdown disponível na área de transferência.' });
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível copiar' });
    }
  };

  const handleAddWidget = async () => {
    if (!activeDash) return;
    try {
      const created = await createWidgetsMut.mutateAsync({
        dashboardId: activeDash.id,
        widgets: [{
          type: 'metric_card',
          title: 'Novo widget',
          description: 'Configure título, fonte de dados e fórmula no editor.',
          config: { format: 'number', aggregation: 'sum' },
        }],
      });
      toast({
        title: 'Widget adicionado',
        description: 'Clique no lápis amarelo no canto do widget pra escolher a fonte de dados e montá-lo.',
      });
      onAfterChange?.(activeDash.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: 'Erro ao adicionar widget', description: msg });
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!activeDash || !name.trim()) return;
    try {
      // Lê os widgets atuais do dashboard para guardar no template.
      const { data: widgets, error } = await supabase
        .from('dashboard_widgets')
        .select('type,title,description,config,position,size,is_visible')
        .eq('dashboard_id', activeDash.id)
        .order('position', { ascending: true });
      if (error) throw error;

      await createTemplateMut.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        plan: Number(templatePlan) || 1,
        category: 'custom',
        widgets: (widgets ?? []) as unknown as Record<string, unknown>[],
        is_active: true,
      });
      toast({ title: 'Template salvo', description: 'Disponível em /admin/templates' });
      close();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: 'Erro ao salvar template', description: msg });
    }
  };

  const busy = createMut.isPending || updateMut.isPending || deleteMut.isPending || duplicateMut.isPending || createTemplateMut.isPending || createWidgetsMut.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
          >
            <Settings className="w-3.5 h-3.5" />
            Gerenciar
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs">Admin de dashboard</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen('create')}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Criar novo dashboard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openRename} disabled={!activeDash}>
            <Edit3 className="w-3.5 h-3.5 mr-2" /> Renomear / editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDuplicate} disabled={!activeDash || busy}>
            <Copy className="w-3.5 h-3.5 mr-2" /> Duplicar atual
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleAddWidget} disabled={!activeDash || busy}>
            <PlusSquare className="w-3.5 h-3.5 mr-2" /> Adicionar widget
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setLiveIntent(''); setOpen('live-generate'); }} disabled={!activeDash}>
            <Sparkles className="w-3.5 h-3.5 mr-2" /> Criar com IA…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGenerateBrief} disabled={!activeDash || briefLoading}>
            <FileText className="w-3.5 h-3.5 mr-2" /> Gerar pauta de reunião (IA)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setName(activeDash?.name ?? ''); setDescription(activeDash?.description ?? ''); setOpen('save-template'); }} disabled={!activeDash}>
            <Save className="w-3.5 h-3.5 mr-2" /> Salvar como template
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setReorderList((allDashboards.data ?? []).map((d) => ({ id: d.id, name: d.name })));
              setOpen('reorder');
            }}
            disabled={(allDashboards.data?.length ?? 0) < 2}
          >
            <ListOrdered className="w-3.5 h-3.5 mr-2" /> Reordenar dashboards
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setOpen('delete')}
            disabled={!activeDash || busy}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Apagar este dashboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Criar / Renomear (compartilham campos) */}
      <Dialog open={open === 'create' || open === 'rename'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{open === 'create' ? 'Novo dashboard' : 'Editar dashboard'}</DialogTitle>
            <DialogDescription>
              {open === 'create'
                ? 'Cria um dashboard vazio para esta organização. Você adiciona widgets em seguida.'
                : 'Atualiza nome, descrição e flag de dashboard padrão.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="dash-name">Nome</Label>
              <Input id="dash-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Tráfego pago" />
            </div>
            <div>
              <Label htmlFor="dash-desc">Descrição</Label>
              <Textarea id="dash-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Aparece como subtítulo do dashboard" rows={2} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="dash-default" className="text-sm">Dashboard padrão da org</Label>
                <p className="text-xs text-muted-foreground">Carregado por padrão quando o cliente abre /client/&lt;org&gt;.</p>
              </div>
              <Switch id="dash-default" checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>Cancelar</Button>
            <Button onClick={open === 'create' ? handleCreate : handleRename} disabled={busy || !name.trim()}>
              {busy && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              {open === 'create' ? 'Criar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de apagar */}
      <AlertDialog open={open === 'delete'} onOpenChange={(v) => !v && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar dashboard?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o dashboard <strong>{activeDash?.name}</strong> e todos os seus widgets. Não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Salvar como template */}
      <Dialog open={open === 'save-template'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar como template</DialogTitle>
            <DialogDescription>
              Snapshot dos widgets atuais. Aparece em <code>/admin/templates</code> e pode ser aplicado em outras orgs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="tpl-name">Nome do template</Label>
              <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="tpl-desc">Descrição</Label>
              <Textarea id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div>
              <Label htmlFor="tpl-plan">Plano mínimo (1=Free, 2=Pro, 3=Enterprise)</Label>
              <Input id="tpl-plan" type="number" min={1} max={3} value={templatePlan} onChange={(e) => setTemplatePlan(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>Cancelar</Button>
            <Button onClick={handleSaveAsTemplate} disabled={busy || !name.trim()}>
              {busy && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Salvar template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* E4.S3 — Live Generative Dashboard: IA gera widgets a partir de pedido em linguagem natural */}
      <Dialog open={open === 'live-generate'} onOpenChange={(v) => !v && !liveLoading && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar widgets com IA</DialogTitle>
            <DialogDescription>
              Descreva o que você quer ver. A IA escolhe os tipos, fontes e agregações e os widgets aparecem no dashboard atual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="live-intent">O que você quer ver?</Label>
            <Textarea
              id="live-intent"
              value={liveIntent}
              onChange={(e) => setLiveIntent(e.target.value)}
              rows={4}
              placeholder="Ex: Quero ver pipeline em aberto, tempo médio por etapa, leads PJ vs PF e taxa de conversão lead→reunião dos últimos 30 dias."
            />
            <p className="text-[11px] text-muted-foreground">
              Inseridos diretamente no dashboard. Use o modo edição depois para refinar fórmula ou ajustar layout.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={liveLoading}>Cancelar</Button>
            <Button onClick={handleLiveGenerate} disabled={liveLoading || !liveIntent.trim()}>
              {liveLoading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
              Gerar widgets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* F13 — Pauta de reunião gerada pela IA */}
      {/* Reordenar dashboards — usa up/down buttons (sem dep DND nova). */}
      <Dialog open={open === 'reorder'} onOpenChange={(v) => !v && !reorderMut.isPending && close()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reordenar dashboards</DialogTitle>
            <DialogDescription>
              Use as setas para mudar a ordem no seletor. A primeira da lista vira o atalho padrão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {reorderList.map((d, idx) => (
              <div key={d.id} className="flex items-center gap-2 rounded-md border p-2">
                <span className="text-xs font-mono text-muted-foreground w-6">{idx + 1}</span>
                <span className="flex-1 text-sm truncate">{d.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={idx === 0}
                  onClick={() => setReorderList((list) => {
                    const next = [...list];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    return next;
                  })}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={idx === reorderList.length - 1}
                  onClick={() => setReorderList((list) => {
                    const next = [...list];
                    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                    return next;
                  })}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={reorderMut.isPending}>Cancelar</Button>
            <Button
              onClick={async () => {
                try {
                  await reorderMut.mutateAsync({ orgId, dashboardIds: reorderList.map((d) => d.id) });
                  toast({ title: 'Ordem salva' });
                  close();
                } catch (e) {
                  toast({ variant: 'destructive', title: 'Falha ao salvar', description: (e as Error).message });
                }
              }}
              disabled={reorderMut.isPending}
            >
              {reorderMut.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Salvar ordem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form de contexto da reunião — opcional. Admin pode pular pra
          gerar pauta genérica (mesmo comportamento legado). */}
      <Dialog open={open === 'meeting-brief-context'} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Pauta IA — contexto da reunião</DialogTitle>
            <DialogDescription>
              Opcional. Preencha pra a IA priorizar pontos relacionados ao encontro.
              Sem preenchimento, gera pauta genérica com os dados do dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Seletor de evento do Google Calendar — aparece se conectado.
                Preenche os campos abaixo automaticamente. */}
            {calendarEvents.data?.connected && (calendarEvents.data.events.length > 0) && (
              <div className="rounded-md border border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20 p-2 space-y-1">
                <Label className="text-xs font-semibold">
                  Importar de evento do Google Calendar
                </Label>
                <Select onValueChange={(eventId) => {
                  const ev = calendarEvents.data?.events.find((e) => e.id === eventId);
                  if (ev) applyCalendarEvent(ev);
                }}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecione um evento dos próximos 14 dias…" />
                  </SelectTrigger>
                  <SelectContent>
                    {calendarEvents.data.events.map((e) => (
                      <SelectItem key={e.id} value={e.id} className="text-sm">
                        <span className="font-medium">{e.title}</span>
                        {e.start && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            {new Date(e.start).toLocaleString('pt-BR', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="brief-title">Encontro / cliente</Label>
              <Input
                id="brief-title"
                value={briefTitle}
                onChange={(e) => setBriefTitle(e.target.value)}
                placeholder="ex: Check-in mensal com Kitou"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="brief-when">Quando</Label>
                <Input
                  id="brief-when"
                  value={briefWhen}
                  onChange={(e) => setBriefWhen(e.target.value)}
                  placeholder="ex: amanhã 10h"
                />
              </div>
              <div>
                <Label htmlFor="brief-attendees">Participantes</Label>
                <Input
                  id="brief-attendees"
                  value={briefAttendees}
                  onChange={(e) => setBriefAttendees(e.target.value)}
                  placeholder="ex: CEO + Head Comercial"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="brief-focus">Foco / tópicos prévios</Label>
              <Textarea
                id="brief-focus"
                value={briefFocus}
                onChange={(e) => setBriefFocus(e.target.value)}
                placeholder="ex: revisar conversão SDR, alinhar ramp do novo closer, discutir Q3"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between gap-2">
            <Button variant="ghost" onClick={() => runMeetingBrief(false)} disabled={briefLoading}>
              Pular contexto
            </Button>
            <Button onClick={() => runMeetingBrief(true)} disabled={briefLoading}>
              <Sparkles className="w-3.5 h-3.5 mr-2" /> Gerar pauta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'meeting-brief'} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pauta da próxima reunião consultiva</DialogTitle>
            <DialogDescription>
              Gerada pela IA com base nos dados do dashboard atual. Use como roteiro — ajuste antes de levar para o cliente.
            </DialogDescription>
          </DialogHeader>
          {briefLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando snapshot e cruzando métricas...</p>
            </div>
          ) : briefMarkdown ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{briefMarkdown}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem conteúdo gerado.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={close}>Fechar</Button>
            <Button onClick={handleCopyBrief} disabled={!briefMarkdown || briefLoading}>
              <ClipboardCopy className="w-3.5 h-3.5 mr-2" /> Copiar pauta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DashboardAdminMenu;
