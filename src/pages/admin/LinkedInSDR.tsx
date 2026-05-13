import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Target, Users, Send, CheckCircle, Play, Pause, Eye, Search,
  UserCircle2, Settings2, Save, Linkedin, SlidersHorizontal, Trash2,
  LayoutDashboard, Calendar, ExternalLink, Copy, MessageSquare, Filter,
} from 'lucide-react';
import { OverviewTab } from './sdr-overview/OverviewTab';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  useLinkedInCampaigns,
  useCampaignLeads,
  useLinkedInAccounts,
  useLinkedInAccountSelectOptions,
  useCreateCampaign,
  useLinkedInConversations,
  useSessionMessages,
  INSTANCE_PROFILE_MAP,
  type LinkedInCampaign,
  type LinkedInSession,
  type CampaignLead,
} from '@/hooks/useLinkedInCampaigns';
import { isMariSupabaseConfigured } from '@/integrations/supabase/mariClient';
import {
  dispatch, discover, pause, deleteCampaign, getMariRuntimeSettings, patchMariRuntimeSettings,
} from '@/hooks/useMariAPI';
import {
  useLinkedInProfiles,
  useUpdateHuntingConfig,
  DEFAULT_HUNTING_CONFIG_RENAN,
  DEFAULT_HUNTING_CONFIG_JAQUELINE,
  type HuntingConfig,
} from '@/hooks/useLinkedInProfiles';

// ─── MetricCard (padrão PinnSDR) ─────────────────────────────────────────────

const MetricCard = ({
  title, value, icon: Icon, color, small = false, subtitle,
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  small?: boolean;
  subtitle?: string;
}) => (
  <Card className="shadow-sm hover:shadow-md transition-shadow rounded-xl border border-border">
    <CardContent className={small ? 'p-4' : 'p-5'}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
          <p className={`font-bold text-foreground ${small ? 'text-lg mt-1' : 'text-2xl mt-1.5'}`}>
            {value ?? '—'}
          </p>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className={`${small ? 'w-9 h-9' : 'w-11 h-11'} rounded-xl bg-primary/8 dark:bg-muted/50 flex items-center justify-center`}>
          <Icon className={`${small ? 'w-4 h-4' : 'w-5 h-5'} ${color}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ─── Badge helpers ────────────────────────────────────────────────────────────

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  paused: 'Pausada',
  completed: 'Concluída',
};

function CampaignStatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <Badge className="text-xs bg-green-600/10 text-green-600 border-green-600/20">
        Ativa
      </Badge>
    );
  }
  const variantMap: Record<string, 'secondary' | 'outline' | 'default' | 'destructive'> = {
    draft: 'secondary',
    paused: 'secondary',
    completed: 'outline',
  };
  return (
    <Badge variant={variantMap[status] ?? 'secondary'} className="text-xs">
      {CAMPAIGN_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

const LEAD_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  invite_sent: 'Convite Enviado',
  invite_accepted: 'Convite Aceito',
  sent: 'Enviado',
  failed: 'Falhou',
  skipped: 'Ignorado',
};

/** Data mais relevante: convite → aceite → disparo DM */
function formatCampaignLeadTimestamp(lead: CampaignLead): string {
  const ts = lead.invited_at || lead.accepted_at || lead.sent_at;
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LeadStatusBadge({ status }: { status: string }) {
  if (status === 'invite_accepted' || status === 'sent') {
    return (
      <Badge className="text-xs bg-green-600/10 text-green-600 border-green-600/20">
        {LEAD_STATUS_LABEL[status] ?? status}
      </Badge>
    );
  }
  if (status === 'invite_sent') {
    return (
      <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-500">
        {LEAD_STATUS_LABEL[status] ?? status}
      </Badge>
    );
  }
  const variantMap: Record<string, 'secondary' | 'outline' | 'destructive'> = {
    pending: 'secondary',
    failed: 'destructive',
    skipped: 'outline',
  };
  return (
    <Badge variant={variantMap[status] ?? 'secondary'} className="text-xs">
      {LEAD_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

const STAGE_LABEL: Record<string, string> = {
  qualifying: 'Qualificando',
  scheduling: 'Agendando',
  confirmed: 'Confirmado',
  handoff: 'Handoff',
  optout: 'Optout',
  cancelled: 'Cancelado',
};

function StageBadge({ stage }: { stage: string }) {
  const variantMap: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    qualifying: 'secondary',
    scheduling: 'default',
    confirmed: 'default',
    handoff: 'outline',
    optout: 'destructive',
    cancelled: 'destructive',
  };
  return (
    <Badge variant={variantMap[stage] ?? 'secondary'} className="text-xs">
      {STAGE_LABEL[stage] ?? stage}
    </Badge>
  );
}

// ─── Modal de criação de campanha ─────────────────────────────────────────────

interface NewCampaignForm {
  name: string;
  linkedin_account_id: string;
  mode: 'hunting' | 'direct';
  delay_seconds: number;
  leads_raw: string;
}

const DEFAULT_FORM: NewCampaignForm = {
  name: '',
  linkedin_account_id: '',
  mode: 'hunting',
  delay_seconds: 30,
  leads_raw: '',
};

function parseLeadsRaw(raw: string) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return {
        linkedin_url: parts[0] ?? '',
        lead_name: parts[1] ?? '',
        company: parts[2] ?? '',
        sector: parts[3] ?? '',
        role: parts[4] ?? '',
      };
    })
    .filter((l) => l.linkedin_url);
}

function NewCampaignDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { options: accountOptions } = useLinkedInAccountSelectOptions();
  const createCampaign = useCreateCampaign();
  const [form, setForm] = useState<NewCampaignForm>(DEFAULT_FORM);

  // Radix Select com value="" fica quebrado; ao abrir, pré-seleciona o 1º perfil (Renan/Jaqueline).
  useEffect(() => {
    if (!open) return;
    setForm((prev) => {
      if (prev.linkedin_account_id) return prev;
      const first = accountOptions[0]?.unipile_account_id;
      if (!first) return prev;
      return { ...prev, linkedin_account_id: first };
    });
  }, [open, accountOptions]);

  const set = (k: keyof NewCampaignForm, v: any) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome da campanha');
      return;
    }
    if (!form.linkedin_account_id) {
      toast.error('Selecione um perfil LinkedIn');
      return;
    }

    const leads = form.mode === 'direct' ? parseLeadsRaw(form.leads_raw) : undefined;

    try {
      await createCampaign.mutateAsync({
        name: form.name.trim(),
        linkedin_account_id: form.linkedin_account_id,
        mode: form.mode,
        delay_seconds: Number(form.delay_seconds),
        leads,
      });
      toast.success('Campanha criada com sucesso!');
      setForm(DEFAULT_FORM);
      onClose();
    } catch (err: any) {
      toast.error(`Erro ao criar campanha: ${err?.message ?? 'Erro desconhecido'}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Campanha LinkedIn</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome da campanha</label>
            <Input
              placeholder="Ex: Prospecção CEOs SaaS — Maio 2026"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Perfil LinkedIn</label>
            <Select
              value={form.linkedin_account_id || undefined}
              onValueChange={(v) => set('linkedin_account_id', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um perfil..." />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[250]">
                {accountOptions.map((acc) => (
                  <SelectItem key={acc.unipile_account_id} value={acc.unipile_account_id}>
                    {acc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Modo</label>
              <Select value={form.mode} onValueChange={(v) => set('mode', v as 'hunting' | 'direct')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[250]">
                  <SelectItem value="hunting">Hunting</SelectItem>
                  <SelectItem value="direct">Direto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Delay entre envios (s)</label>
              <Input
                type="number"
                min={20}
                value={form.delay_seconds}
                onChange={(e) => set('delay_seconds', Number(e.target.value))}
              />
            </div>
          </div>

          {form.mode === 'direct' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Leads</label>
              <p className="text-xs text-muted-foreground">
                Um lead por linha: URL LinkedIn, Nome, Empresa, Setor, Cargo
              </p>
              <Textarea
                rows={6}
                placeholder="https://linkedin.com/in/joao, João Silva, Empresa X, Tecnologia, CEO"
                value={form.leads_raw}
                onChange={(e) => set('leads_raw', e.target.value)}
                className="font-mono text-xs"
              />
              {form.leads_raw && (
                <p className="text-xs text-muted-foreground">
                  {parseLeadsRaw(form.leads_raw).length} lead(s) detectado(s)
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createCampaign.isPending}>
            {createCampaign.isPending ? 'Criando...' : 'Criar Campanha'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sheet de leads da campanha ───────────────────────────────────────────────

function CampaignLeadsSheet({
  campaign,
  onClose,
}: {
  campaign: LinkedInCampaign | null;
  onClose: () => void;
}) {
  const { data: leads = [], isLoading } = useCampaignLeads(campaign?.id ?? null);

  const inviteTargets = useMemo(
    () => leads.filter((l) => l.status === 'invite_sent' || l.status === 'invite_accepted'),
    [leads],
  );

  return (
    <Sheet open={!!campaign} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{campaign?.name ?? 'Leads da Campanha'}</SheetTitle>
        </SheetHeader>

        {campaign?.mode === 'hunting' && inviteTargets.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 dark:bg-muted/20 p-3 mb-4 space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Send className="w-3.5 h-3.5 shrink-0" />
              Para quem o convite foi enviado ({inviteTargets.length})
            </p>
            <ul className="text-xs space-y-2 max-h-44 overflow-y-auto">
              {inviteTargets.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-col gap-0.5 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                >
                  <span className="font-medium text-foreground">
                    {l.lead_name?.trim() || 'Sem nome'}
                    {l.company ? ` · ${l.company}` : ''}
                  </span>
                  {l.linkedin_url ? (
                    <a
                      href={l.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline truncate text-[11px]"
                      title={l.linkedin_url}
                    >
                      {l.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com\//i, 'linkedin.com/')}
                    </a>
                  ) : (
                    <span className="text-muted-foreground italic text-[11px]">URL não cadastrada</span>
                  )}
                  <div className="flex flex-wrap gap-x-2 gap-y-0 text-[10px] text-muted-foreground">
                    {l.invited_at && (
                      <span>
                        Enviado:{' '}
                        {new Date(l.invited_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                    {l.accepted_at && (
                      <span className="text-green-600 dark:text-green-500">
                        Aceito:{' '}
                        {new Date(l.accepted_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Nenhum lead nesta campanha ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Lead</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Empresa</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Cargo</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">LinkedIn</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Convite / DM</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-2 font-medium max-w-[120px] truncate">
                      {lead.lead_name || <span className="text-muted-foreground italic">sem nome</span>}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground text-xs max-w-[100px] truncate">
                      {lead.company || '—'}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground text-xs max-w-[100px] truncate">
                      {lead.role || '—'}
                    </td>
                    <td className="py-2 px-2">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="py-2 px-2">
                      {lead.linkedin_url ? (
                        <a
                          href={lead.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline truncate block max-w-[120px]"
                        >
                          Ver perfil
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground text-xs whitespace-nowrap">
                      {formatCampaignLeadTimestamp(lead)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Card de campanha ─────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  accountName,
  onViewLeads,
  onRefresh,
}: {
  campaign: LinkedInCampaign;
  accountName: string;
  onViewLeads: () => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);

  const total = campaign.total_leads || 0;
  const sent = campaign.sent_count || 0;
  const progress = total > 0 ? Math.round((sent / total) * 100) : 0;

  const handleAction = async (
    action: 'dispatch' | 'discover' | 'pause' | 'delete',
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string }>
  ) => {
    setLoading(action);
    const res = await fn();
    setLoading(null);
    if (res.ok) {
      toast.success(`${label}: solicitação enviada com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['linkedin-campaigns'] });
    } else {
      toast.error(`Erro ao ${label.toLowerCase()}: ${res.error ?? 'Erro desconhecido'}`);
    }
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow rounded-xl border border-border">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-foreground leading-tight">
            {campaign.name}
          </CardTitle>
          <CampaignStatusBadge status={campaign.status} />
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-muted-foreground">{accountName || '—'}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground capitalize">{campaign.mode}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{campaign.delay_seconds}s delay</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Barra de progresso */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{sent} enviados</span>
            <span>{total} total</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right mt-0.5">{progress}%</p>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/50 rounded-lg py-1.5">
            <p className="text-xs font-bold text-foreground">{total}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
          <div className="bg-muted/50 rounded-lg py-1.5">
            <p className="text-xs font-bold text-foreground">{sent}</p>
            <p className="text-[10px] text-muted-foreground">Enviados</p>
          </div>
          <div className="bg-muted/50 rounded-lg py-1.5">
            <p className="text-xs font-bold text-destructive">{campaign.failed_count || 0}</p>
            <p className="text-[10px] text-muted-foreground">Falhas</p>
          </div>
        </div>

        {/* Datas */}
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>Criada: {new Date(campaign.created_at).toLocaleDateString('pt-BR')}</p>
          {campaign.started_at && (
            <p>Iniciada: {new Date(campaign.started_at).toLocaleDateString('pt-BR')}</p>
          )}
        </div>

        {/* Botões */}
        <div className="flex flex-wrap gap-2 pt-1">
          {(campaign.status === 'draft' || campaign.status === 'paused') && (
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs gap-1.5"
              disabled={!!loading}
              onClick={() =>
                handleAction('dispatch', 'Disparar', () => dispatch(campaign.id))
              }
            >
              <Play className="w-3 h-3" />
              {loading === 'dispatch' ? 'Disparando...' : 'Disparar'}
            </Button>
          )}

          {campaign.mode === 'hunting' &&
            (campaign.status === 'draft' || campaign.status === 'paused') && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                disabled={!!loading}
                onClick={() =>
                  handleAction('discover', 'Descobrir Leads', () => discover(campaign.id))
                }
              >
                <Search className="w-3 h-3" />
                {loading === 'discover' ? 'Descobrindo...' : 'Descobrir Leads'}
              </Button>
            )}

          {campaign.status === 'active' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              disabled={!!loading}
              onClick={() =>
                handleAction('pause', 'Pausar', () => pause(campaign.id))
              }
            >
              <Pause className="w-3 h-3" />
              {loading === 'pause' ? 'Pausando...' : 'Pausar'}
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                disabled={!!loading}
                type="button"
              >
                <Trash2 className="w-3 h-3" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                <AlertDialogDescription>
                  Remove a campanha <strong>{campaign.name}</strong> e todos os leads no Mari.
                  Use para criar uma campanha nova do zero. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    void handleAction('delete', 'Excluir campanha', () =>
                      deleteCampaign(campaign.id, true)
                    );
                  }}
                >
                  Excluir definitivamente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1.5 ml-auto"
            onClick={onViewLeads}
          >
            <Eye className="w-3 h-3" />
            Ver Leads
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab 1: Campanhas ─────────────────────────────────────────────────────────

function CampanhasTab() {
  const { data: campaigns = [], isLoading } = useLinkedInCampaigns();
  const { data: accounts = [] } = useLinkedInAccounts();
  const [showModal, setShowModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<LinkedInCampaign | null>(null);
  const queryClient = useQueryClient();

  const accountMap = useMemo(() => {
    const m: Record<string, string> = {};
    accounts.forEach((a) => {
      m[a.unipile_account_id] = a.profile_name;
    });
    return m;
  }, [accounts]);

  const totalLeads = campaigns.reduce((acc, c) => acc + (c.total_leads || 0), 0);
  const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
  const totalAccepted = campaigns.reduce((acc, c) => {
    // accepted = total_leads - pending - failed - sent não aceitos
    // Estimativa: não temos accepted direto no campaign, apenas no leads
    return acc;
  }, 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Campanhas"
          value={campaigns.length}
          icon={Target}
          color="text-primary"
        />
        <MetricCard
          title="Leads em Fila"
          value={totalLeads}
          icon={Users}
          color="text-chart-2"
        />
        <MetricCard
          title="Convites Enviados"
          value={totalSent}
          icon={Send}
          color="text-chart-3"
        />
        <MetricCard
          title="Campanhas Ativas"
          value={campaigns.filter((c) => c.status === 'active').length}
          icon={CheckCircle}
          color="text-chart-4"
        />
      </div>

      {/* Header com botão */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Campanhas ({campaigns.length})
        </h2>
        <Button size="sm" className="gap-2" onClick={() => setShowModal(true)}>
          <Target className="w-4 h-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Grid de campanhas */}
      {campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Linkedin className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">Nenhuma campanha criada ainda.</p>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => setShowModal(true)}
            >
              Criar primeira campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              accountName={accountMap[campaign.linkedin_account_id ?? ''] ?? '—'}
              onViewLeads={() => setSelectedCampaign(campaign)}
              onRefresh={() =>
                queryClient.invalidateQueries({ queryKey: ['linkedin-campaigns'] })
              }
            />
          ))}
        </div>
      )}

      {/* Modal nova campanha */}
      <NewCampaignDialog open={showModal} onClose={() => setShowModal(false)} />

      {/* Sheet leads */}
      <CampaignLeadsSheet
        campaign={selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
      />
    </div>
  );
}

// ─── Sheet de mensagens ───────────────────────────────────────────────────────

// Agrupa mensagens por dia (yyyy-mm-dd no fuso pt-BR). Retorna lista ordenada
// do mais recente para o mais antigo, com cada grupo já ordenado cronologicamente.
function groupMessagesByDay(messages: Array<{ id: string; created_at: string; direction: string; text: string | null; intent: string | null }>) {
  const groups = new Map<string, typeof messages>();
  for (const m of messages) {
    const d = new Date(m.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const arr = groups.get(key);
    if (arr) arr.push(m); else groups.set(key, [m]);
  }
  // ordenado do mais recente para o mais antigo
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, msgs]) => ({ key, messages: msgs }));
}

function formatDayHeader(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today))     return 'Hoje';
  if (sameDay(date, yesterday)) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
}

const DATE_PRESETS = [
  { id: 'all',  label: 'Tudo' },
  { id: 'today', label: 'Hoje' },
  { id: '7d',  label: '7 dias' },
  { id: '30d', label: '30 dias' },
] as const;

type DatePresetId = (typeof DATE_PRESETS)[number]['id'];

function inDateRange(iso: string, preset: DatePresetId): boolean {
  if (preset === 'all') return true;
  const d = new Date(iso);
  const now = new Date();
  if (preset === 'today') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }
  const days = preset === '7d' ? 7 : 30;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  return d.getTime() >= cutoff.getTime();
}

function MessagesSheet({
  session,
  onClose,
}: {
  session: LinkedInSession | null;
  onClose: () => void;
}) {
  const { data: messages = [], isLoading } = useSessionMessages(
    session?.session_id ?? null
  );
  const [datePreset, setDatePreset] = useState<DatePresetId>('all');

  const filtered = useMemo(
    () => messages.filter((m) => inDateRange(m.created_at, datePreset)),
    [messages, datePreset],
  );
  const grouped = useMemo(() => groupMessagesByDay(filtered), [filtered]);
  const inboundCount  = filtered.filter((m) => m.direction === 'inbound').length;
  const outboundCount = filtered.filter((m) => m.direction === 'outbound').length;

  const handleCopyAll = () => {
    const text = filtered
      .map((m) => {
        const who = m.direction === 'inbound' ? (session?.lead_name || 'Lead') : 'Mari/SDR';
        const when = new Date(m.created_at).toLocaleString('pt-BR');
        return `[${when}] ${who}: ${m.text ?? ''}`;
      })
      .join('\n');
    navigator.clipboard?.writeText(text).then(
      () => toast.success('Conversa copiada para a área de transferência'),
      () => toast.error('Falha ao copiar conversa'),
    );
  };

  const profileLabel = session?.instance ? (INSTANCE_PROFILE_MAP[session.instance] ?? '—') : '—';

  return (
    <Sheet open={!!session} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto flex flex-col">
        <SheetHeader className="mb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex items-center gap-2 flex-wrap">
                {session?.lead_name || 'Conversa'}
                {session && <StageBadge stage={session.stage} />}
                {session?.is_outbound && (
                  <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-500">Outbound</Badge>
                )}
              </SheetTitle>
              {session && (
                <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  <p>{session.company || '—'} · {session.role || '—'}</p>
                  <p>
                    Perfil Mari: <span className="font-medium text-foreground">{profileLabel}</span>
                    {session.lead_score != null && (
                      <>
                        {' · Score: '}
                        <span className={(session.lead_score ?? 0) >= 68 ? 'text-orange-500 font-semibold' : 'font-semibold text-foreground'}>
                          {session.lead_score}
                        </span>
                      </>
                    )}
                    {session.confirmed_slot && (
                      <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-3 h-3" /> Reunião: {session.confirmed_slot}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 shrink-0"
              onClick={handleCopyAll}
              disabled={filtered.length === 0}
              title="Copiar conversa filtrada"
            >
              <Copy className="w-3 h-3" />
              Copiar
            </Button>
          </div>
        </SheetHeader>

        {/* Toolbar: filtros de data + contadores */}
        <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-border">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setDatePreset(p.id)}
              className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors border ${
                datePreset === p.id
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
            <span><MessageSquare className="w-3 h-3 inline mr-1" />{filtered.length} msgs</span>
            <span className="text-blue-500">↓ {inboundCount} recebidas</span>
            <span className="text-foreground">↑ {outboundCount} enviadas</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-3/4" />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {datePreset === 'all'
                ? 'Nenhuma mensagem encontrada.'
                : 'Nenhuma mensagem no período selecionado.'}
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.key} className="space-y-2">
                <div className="sticky top-0 z-10 bg-background py-1 -mx-1 px-1 border-b border-border/60">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {formatDayHeader(group.key)}
                    <span className="ml-2 font-normal text-muted-foreground/70 normal-case tracking-normal">
                      ({group.messages.length} {group.messages.length === 1 ? 'mensagem' : 'mensagens'})
                    </span>
                  </p>
                </div>
                {group.messages.map((msg) => {
                  const isInbound = msg.direction === 'inbound';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isInbound ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                          isInbound
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap">
                          {msg.text || <span className="italic text-muted-foreground">(sem texto)</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 px-1">
                        {!isInbound && msg.intent && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {msg.intent}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Tab 2: Conversas ─────────────────────────────────────────────────────────

function ConversasTab() {
  const { data: sessions = [], isLoading } = useLinkedInConversations();
  const [filterProfile, setFilterProfile] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [filterDate, setFilterDate] = useState<DatePresetId>('all');
  const [search, setSearch] = useState('');
  const [groupByDay, setGroupByDay] = useState(true);
  const [selectedSession, setSelectedSession] = useState<LinkedInSession | null>(null);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (filterProfile !== 'all') {
        const profileName = INSTANCE_PROFILE_MAP[s.instance ?? ''] ?? '';
        if (profileName.toLowerCase() !== filterProfile) return false;
      }
      if (filterStage !== 'all' && s.stage !== filterStage) return false;
      if (filterDate !== 'all') {
        const lastTs = s.last_inbound_at ?? s.last_outbound_at ?? s.created_at;
        if (!lastTs || !inDateRange(lastTs, filterDate)) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          (s.lead_name ?? '').toLowerCase().includes(q) ||
          (s.company ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sessions, filterProfile, filterStage, filterDate, search]);

  // Agrupa conversas pelo dia da última mensagem (inbound preferido) para visão "tipo Inbox por dia".
  const groupedByDay = useMemo(() => {
    if (!groupByDay) return null;
    const map = new Map<string, typeof filtered>();
    for (const s of filtered) {
      const ts = s.last_inbound_at ?? s.last_outbound_at ?? s.created_at;
      const d = new Date(ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const arr = map.get(key);
      if (arr) arr.push(s); else map.set(key, [s]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1));
  }, [filtered, groupByDay]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const renderRow = (s: LinkedInSession) => {
    const profileLabel = INSTANCE_PROFILE_MAP[s.instance ?? ''] ?? '—';
    const lastMsg = s.last_inbound_at ?? s.last_outbound_at;
    const lastIsoTime = lastMsg
      ? new Date(lastMsg).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : null;
    return (
      <tr
        key={s.session_id}
        className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => setSelectedSession(s)}
      >
        <td className="py-2.5 px-3 font-medium max-w-[180px] truncate">
          {s.lead_name || (
            <span className="text-muted-foreground italic">sem nome</span>
          )}
        </td>
        <td className="py-2.5 px-3 text-muted-foreground max-w-[160px] truncate">
          {s.company || '—'}
        </td>
        <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[160px] truncate">
          {s.role || '—'}
        </td>
        <td className="py-2.5 px-3">
          <StageBadge stage={s.stage} />
        </td>
        <td className="py-2.5 px-3">
          <span
            className={`font-semibold text-xs ${
              (s.lead_score ?? 0) >= 68
                ? 'text-orange-500'
                : (s.lead_score ?? 0) >= 40
                ? 'text-chart-2'
                : 'text-muted-foreground'
            }`}
          >
            {s.lead_score ?? '—'}
          </span>
        </td>
        <td className="py-2.5 px-3">
          {s.is_outbound ? (
            <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-500">
              Outbound
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Inbound
            </Badge>
          )}
          <span className="ml-1.5 text-xs text-muted-foreground">
            {profileLabel}
          </span>
        </td>
        <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
          {lastMsg ? (
            <>
              {new Date(lastMsg).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              {lastIsoTime && <span className="ml-1 text-muted-foreground/70">{lastIsoTime}</span>}
            </>
          ) : '—'}
        </td>
        <td className="py-2.5 px-3">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSession(s);
            }}
          >
            <Eye className="w-3 h-3" />
            Abrir
          </Button>
        </td>
      </tr>
    );
  };

  const tableHead = (
    <thead>
      <tr className="border-b border-border">
        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Lead</th>
        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Empresa</th>
        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Cargo</th>
        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Stage</th>
        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Score</th>
        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Origem</th>
        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Última msg</th>
        <th className="py-2.5 px-3" />
      </tr>
    </thead>
  );

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterProfile} onValueChange={setFilterProfile}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os perfis</SelectItem>
            <SelectItem value="renan">Renan</SelectItem>
            <SelectItem value="jaqueline">Jaqueline</SelectItem>
            <SelectItem value="pedro">Pedro</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os stages</SelectItem>
            <SelectItem value="qualifying">Qualificando</SelectItem>
            <SelectItem value="scheduling">Agendando</SelectItem>
            <SelectItem value="confirmed">Confirmado</SelectItem>
            <SelectItem value="handoff">Handoff</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterDate} onValueChange={(v) => setFilterDate(v as DatePresetId)}>
          <SelectTrigger className="w-40">
            <Calendar className="w-3.5 h-3.5 mr-1" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {DATE_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label === 'Tudo' ? 'Todos os períodos' : p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={() => setGroupByDay((v) => !v)}
          className={`h-9 px-3 rounded-md text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
            groupByDay
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'border-border bg-card hover:bg-muted text-muted-foreground'
          }`}
          title="Agrupar conversas por dia da última mensagem"
        >
          <Filter className="w-3.5 h-3.5" />
          {groupByDay ? 'Agrupado por dia' : 'Sem agrupamento'}
        </button>

        <p className="text-xs text-muted-foreground ml-auto">
          {filtered.length} conversa(s)
        </p>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhuma conversa encontrada com os filtros aplicados.
            </p>
          </CardContent>
        </Card>
      ) : groupByDay && groupedByDay ? (
        <div className="space-y-5">
          {groupedByDay.map(([dayKey, dayConvs]) => (
            <div key={dayKey} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                  {formatDayHeader(dayKey)}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {dayConvs.length} {dayConvs.length === 1 ? 'conversa' : 'conversas'}
                </span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      {tableHead}
                      <tbody>{dayConvs.map(renderRow)}</tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {tableHead}
                <tbody>{filtered.map(renderRow)}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <MessagesSheet
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </div>
  );
}

// ─── Tab 3: Perfis ────────────────────────────────────────────────────────────

function profileToLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('renan')) return 'Renan';
  if (lower.includes('jaqueline') || lower.includes('jacqueline')) return 'Jaqueline';
  return name;
}

function getDefaultConfig(profileName: string): HuntingConfig {
  const label = profileToLabel(profileName);
  return label === 'Jaqueline'
    ? DEFAULT_HUNTING_CONFIG_JAQUELINE
    : DEFAULT_HUNTING_CONFIG_RENAN;
}

function ProfileCard({ accountId }: { accountId: string }) {
  const { data: profiles = [] } = useLinkedInProfiles();
  const updateConfig = useUpdateHuntingConfig(accountId);

  const profile = profiles.find((p) => p.id === accountId);
  const label = profile ? profileToLabel(profile.profile_name) : '—';
  const defaultCfg = profile ? getDefaultConfig(profile.profile_name) : DEFAULT_HUNTING_CONFIG_RENAN;
  const initialCfg: HuntingConfig = profile?.hunting_config
    ? { ...defaultCfg, ...(profile.hunting_config as HuntingConfig) }
    : defaultCfg;

  const [cfg, setCfg] = useState<HuntingConfig>(initialCfg);

  // Sync quando o profile carregar
  const [synced, setSynced] = useState(false);
  if (profile && !synced) {
    const merged: HuntingConfig = profile.hunting_config
      ? { ...defaultCfg, ...(profile.hunting_config as HuntingConfig) }
      : defaultCfg;
    setCfg(merged);
    setSynced(true);
  }

  const setField = <K extends keyof HuntingConfig>(key: K, value: HuntingConfig[K]) =>
    setCfg((prev) => ({ ...prev, [key]: value }));

  const textareaToArray = (text: string) =>
    text.split('\n').map((l) => l.trim()).filter(Boolean);

  const arrayToTextarea = (arr: string[]) => arr.join('\n');

  const handleSave = async () => {
    try {
      await updateConfig.mutateAsync(cfg);
      toast.success(`Configuração de ${label} salva com sucesso!`);
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err?.message ?? 'Erro desconhecido'}`);
    }
  };

  if (!profile) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Skeleton className="h-6 w-32 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Carregando perfil...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm rounded-xl border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCircle2 className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">{label}</CardTitle>
          </div>
          <Badge
            variant={profile.is_active ? 'default' : 'secondary'}
            className={`text-xs ${
              profile.is_active
                ? 'bg-green-600/10 text-green-600 border-green-600/20'
                : ''
            }`}
          >
            {profile.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{profile.profile_name}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Settings2 className="w-4 h-4" />
          Configuração de Targeting
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Convites por rodada</label>
            <Input
              type="number"
              min={1}
              max={50}
              value={cfg.max_invites_per_run}
              onChange={(e) => setField('max_invites_per_run', Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Profundidade de rede</label>
            <Select
              value={cfg.preferred_network_depth}
              onValueChange={(v) => setField('preferred_network_depth', v as '2' | '3')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2º grau</SelectItem>
                <SelectItem value="3">3º grau</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">Palavras-chave de busca</label>
          <p className="text-[10px] text-muted-foreground">Uma por linha</p>
          <Textarea
            rows={3}
            className="text-xs font-mono"
            value={arrayToTextarea(cfg.search_keywords)}
            onChange={(e) => setField('search_keywords', textareaToArray(e.target.value))}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">Cargos alvo</label>
          <p className="text-[10px] text-muted-foreground">Um por linha</p>
          <Textarea
            rows={3}
            className="text-xs font-mono"
            value={arrayToTextarea(cfg.target_titles)}
            onChange={(e) => setField('target_titles', textareaToArray(e.target.value))}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">Cargos excluídos</label>
          <p className="text-[10px] text-muted-foreground">Um por linha</p>
          <Textarea
            rows={3}
            className="text-xs font-mono"
            value={arrayToTextarea(cfg.excluded_titles)}
            onChange={(e) => setField('excluded_titles', textareaToArray(e.target.value))}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">Setores alvo</label>
          <p className="text-[10px] text-muted-foreground">Um por linha</p>
          <Textarea
            rows={3}
            className="text-xs font-mono"
            value={arrayToTextarea(cfg.target_sectors)}
            onChange={(e) => setField('target_sectors', textareaToArray(e.target.value))}
          />
        </div>

        <Button
          className="w-full gap-2"
          onClick={handleSave}
          disabled={updateConfig.isPending}
        >
          <Save className="w-4 h-4" />
          {updateConfig.isPending ? 'Salvando...' : 'Salvar Configuração'}
        </Button>

        <p className="text-[11px] text-muted-foreground text-center border-t border-border pt-3">
          Alterações são aplicadas imediatamente nos próximos disparos de hunting.
        </p>
      </CardContent>
    </Card>
  );
}

function PerfisTab() {
  const { data: profiles = [], isLoading } = useLinkedInProfiles();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-[600px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <UserCircle2 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">
            Nenhum perfil LinkedIn encontrado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {profiles.map((profile) => (
        <ProfileCard key={profile.id} accountId={profile.id} />
      ))}
    </div>
  );
}

// ─── Tab: Configuração Mari (sem hardcode — persiste no Supabase via API) ─────

function MariOperacaoConfigTab() {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(true);
  const [cycleSeconds, setCycleSeconds] = useState(1800);
  const [corsOrigins, setCorsOrigins] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mari-runtime-settings'],
    queryFn: async () => {
      const r = await getMariRuntimeSettings();
      if (!r.ok) throw new Error(r.error ?? 'Falha ao carregar /settings');
      return r.data as {
        linkedin_hunting_scheduler_enabled: boolean;
        linkedin_hunting_cycle_seconds: number;
        linkedin_hunting_last_cycle_started_at: string | null;
        cors_allowed_origins: string;
        updated_at?: string | null;
      };
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!data) return;
    setEnabled(!!data.linkedin_hunting_scheduler_enabled);
    setCycleSeconds(Math.max(300, Number(data.linkedin_hunting_cycle_seconds) || 1800));
    setCorsOrigins(data.cors_allowed_origins ?? '');
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await patchMariRuntimeSettings({
        linkedin_hunting_scheduler_enabled: enabled,
        linkedin_hunting_cycle_seconds: cycleSeconds,
        cors_allowed_origins: corsOrigins,
      });
      if (!r.ok) {
        toast.error(r.error ?? 'Erro ao salvar');
        return;
      }
      toast.success('Configurações da Mari salvas.');
      await queryClient.invalidateQueries({ queryKey: ['mari-runtime-settings'] });
      refetch();
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40 max-w-2xl">
        <CardContent className="py-8 text-sm text-destructive">
          Não foi possível ler <code className="text-xs">GET https://mari.pinnpb.com/settings</code>
          . Confira CORS e se a Mari está no ar. {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-primary" />
            Operação LinkedIn (Mari)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Persistido na tabela <code className="text-[10px]">mari_settings</code> no Supabase da Mari.
            O agendador interno consulta a cada 5 minutos; o intervalo abaixo é o tempo mínimo entre rodadas
            completas (discover + convites).
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="hunt-sched">Agendador hunting full-time</Label>
              <p className="text-[11px] text-muted-foreground">
                Enquanto houver campanhas <strong>hunting</strong> em status <strong>ativa</strong>,
                repete discover + convites conforme o intervalo.
              </p>
            </div>
            <Switch
              id="hunt-sched"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cycle-sec">Intervalo entre rodadas (segundos)</Label>
            <Input
              id="cycle-sec"
              type="number"
              min={300}
              max={86400}
              value={cycleSeconds}
              onChange={(e) => setCycleSeconds(Number(e.target.value))}
            />
            <p className="text-[11px] text-muted-foreground">Mínimo 300 (5 min), máximo 86400 (24 h).</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cors">Origens CORS (browser → Mari)</Label>
            <Textarea
              id="cors"
              rows={4}
              className="text-xs font-mono"
              placeholder="https://bai.pinnpb.com&#10;http://localhost:5173"
              value={corsOrigins}
              onChange={(e) => setCorsOrigins(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Uma URL por linha ou separadas por vírgula (http/https). Mescla com{' '}
              <code className="text-[10px]">MARI_CORS_ORIGINS</code> no .env da Mari, se existir.
            </p>
          </div>

          {(data?.linkedin_hunting_last_cycle_started_at || data?.updated_at) && (
            <div className="text-[11px] text-muted-foreground space-y-1 border-t border-border pt-4">
              {data.linkedin_hunting_last_cycle_started_at && (
                <p>
                  Último ciclo agendado (marca de tempo):{' '}
                  <span className="text-foreground font-mono">
                    {data.linkedin_hunting_last_cycle_started_at}
                  </span>
                </p>
              )}
              {data.updated_at && (
                <p>
                  Settings atualizados em:{' '}
                  <span className="text-foreground font-mono">{data.updated_at}</span>
                </p>
              )}
            </div>
          )}

          <Button className="gap-2" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar na Mari'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

const LinkedInSDR = () => {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Linkedin className="w-6 h-6 text-primary" />
          LinkedIn SDR Manager
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Campanhas, conversas e perfis LinkedIn via Mari SDR
        </p>
        {!isMariSupabaseConfigured && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            O cliente Supabase da Mari não está no build (
            <code className="text-xs">VITE_MARI_SUPABASE_URL</code> /{' '}
            <code className="text-xs">VITE_MARI_SUPABASE_KEY</code>
            ). Os perfis aparecem no seletor, mas criar campanhas e listar dados só funcionam após configurar essas variáveis no{' '}
            <code className="text-xs">.env</code> e refazer o deploy do frontend.
          </p>
        )}
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="campanhas" className="gap-2">
            <Target className="w-4 h-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="conversas" className="gap-2">
            <Users className="w-4 h-4" />
            Conversas
          </TabsTrigger>
          <TabsTrigger value="perfis" className="gap-2">
            <UserCircle2 className="w-4 h-4" />
            Perfis
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Config Mari
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="campanhas" className="mt-6">
          <CampanhasTab />
        </TabsContent>

        <TabsContent value="conversas" className="mt-6">
          <ConversasTab />
        </TabsContent>

        <TabsContent value="perfis" className="mt-6">
          <PerfisTab />
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <MariOperacaoConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LinkedInSDR;
