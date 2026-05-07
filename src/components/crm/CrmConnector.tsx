/**
 * CrmConnector — plug-and-play CRM connection UI.
 *
 * Fluxo:
 *  1. Lista as conexões existentes via GET /crm/connections/:orgId
 *  2. Formulário de conexão por CRM (Kommo por enquanto)
 *  3. POST /crm/connect/:orgId  → valida credenciais + salva
 *  4. POST /crm/sync/:orgId/:slug → sincronização completa
 *  5. DELETE /crm/connections/:orgId/:slug → desconectar
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Plus,
  Plug,
  PlugZap,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Users,
  Calendar,
  TrendingUp,
  Activity,
  Clock,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CrmConnection {
  crm_slug: string;
  sync_status: 'idle' | 'syncing' | 'success' | 'error';
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
  contacts: number;
  deals: number;
  appointments: number;
  activities: number;
}

interface CrmDefinition {
  slug: string;
  name: string;
  logo: string;          // emoji placeholder
  description: string;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
}

// ── CRM catalogue ──────────────────────────────────────────────────────────────

const CRM_CATALOGUE: CrmDefinition[] = [
  {
    slug: 'kommo',
    name: 'Kommo (amoCRM)',
    logo: '🟦',
    description: 'CRM de conversas líder na América Latina. Integre leads, negócios e atividades.',
    fields: [
      {
        key: 'subdomain',
        label: 'Subdomínio',
        placeholder: 'minha-empresa  (sem .kommo.com)',
      },
      {
        key: 'access_token',
        label: 'Access Token',
        placeholder: 'Bearer token OAuth2',
        type: 'password',
      },
    ],
  },
];

// ── API helpers ────────────────────────────────────────────────────────────────

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.PROD ? 'https://bai.srv879715.hstgr.cloud' : 'http://localhost:8010');

async function fetchConnections(orgId: string): Promise<CrmConnection[]> {
  const res = await fetch(`${BACKEND}/crm/connections/${orgId}`);
  if (!res.ok) throw new Error('Falha ao buscar conexões');
  const body = await res.json();
  return body.connections as CrmConnection[];
}

async function connectCrm(orgId: string, crm_slug: string, credentials: Record<string, string>) {
  const res = await fetch(`${BACKEND}/crm/connect/${orgId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crm_slug, credentials }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Falha ao conectar');
  }
  return res.json();
}

async function syncCrm(orgId: string, crm_slug: string) {
  const res = await fetch(`${BACKEND}/crm/sync/${orgId}/${crm_slug}`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Falha ao sincronizar');
  }
  return res.json();
}

async function disconnectCrm(orgId: string, crm_slug: string) {
  const res = await fetch(`${BACKEND}/crm/connections/${orgId}/${crm_slug}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Falha ao desconectar');
  return res.json();
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CrmConnection['sync_status'] }) {
  const map: Record<string, { label: string; className: string }> = {
    idle:    { label: 'Aguardando',    className: 'bg-muted/60 text-muted-foreground' },
    syncing: { label: 'Sincronizando', className: 'bg-yellow-500/10 text-yellow-500' },
    success: { label: 'Sincronizado',  className: 'bg-success/10 text-success' },
    error:   { label: 'Erro',          className: 'bg-destructive/10 text-destructive' },
  };
  const { label, className } = map[status] ?? map.idle;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${className}`}>
      {status === 'syncing' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {status === 'success' && <CheckCircle2 className="w-2.5 h-2.5" />}
      {status === 'error'   && <AlertCircle className="w-2.5 h-2.5" />}
      {label}
    </span>
  );
}

function CountChip({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[56px]">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-base font-extrabold tabular-nums">{value.toLocaleString('pt-BR')}</span>
      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ── Connected card ─────────────────────────────────────────────────────────────

function ConnectedCard({
  conn,
  orgId,
  def,
}: {
  conn: CrmConnection;
  orgId: string;
  def: CrmDefinition;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const syncMutation = useMutation({
    mutationFn: () => syncCrm(orgId, conn.crm_slug),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['crm-connections', orgId] });
      toast({
        title: 'Sincronização concluída',
        description: `${data.synced.contacts} contatos · ${data.synced.deals} negócios`,
      });
    },
    onError: (err: Error) => {
      qc.invalidateQueries({ queryKey: ['crm-connections', orgId] });
      toast({ variant: 'destructive', title: 'Erro na sincronização', description: err.message });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectCrm(orgId, conn.crm_slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-connections', orgId] });
      toast({ title: 'CRM desconectado', description: `${def.name} foi removido.` });
    },
  });

  const lastSync = conn.last_sync_at
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(conn.last_sync_at)
      )
    : null;

  const isSyncing = syncMutation.isPending || conn.sync_status === 'syncing';

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-4 p-5">
        <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl shrink-0">
          {def.logo}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">{def.name}</span>
            <StatusBadge status={conn.sync_status} />
          </div>
          {lastSync && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              Última sync: {lastSync}
            </p>
          )}
          {conn.sync_error && (
            <p className="text-[11px] text-destructive mt-0.5 truncate">{conn.sync_error}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs font-bold"
            onClick={() => syncMutation.mutate()}
            disabled={isSyncing}
          >
            {isSyncing
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />}
            {isSyncing ? 'Sincronizando…' : 'Sincronizar'}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
          >
            {disconnectMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Record counts */}
      <div className="border-t border-border/50 px-5 py-3 flex items-center gap-6 bg-muted/20">
        <CountChip icon={Users}     label="Contatos"   value={conn.contacts} />
        <CountChip icon={TrendingUp} label="Negócios"  value={conn.deals} />
        <CountChip icon={Calendar}  label="Agendamentos" value={conn.appointments} />
        <CountChip icon={Activity}  label="Atividades" value={conn.activities} />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border/50 px-5 py-4 bg-muted/10 text-xs text-muted-foreground space-y-1">
          <p><span className="font-semibold text-foreground">CRM:</span> {conn.crm_slug}</p>
          <p><span className="font-semibold text-foreground">Conectado em:</span>{' '}
            {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(conn.created_at))}
          </p>
          <p className="text-[10px] italic">
            Credenciais armazenadas de forma segura no Supabase (nunca expostas ao cliente).
          </p>
        </div>
      )}
    </div>
  );
}

// ── Connect form ───────────────────────────────────────────────────────────────

function ConnectForm({
  orgId,
  onClose,
}: {
  orgId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedSlug, setSelectedSlug] = useState<string>(CRM_CATALOGUE[0].slug);
  const [fields, setFields] = useState<Record<string, string>>({});

  const def = CRM_CATALOGUE.find(c => c.slug === selectedSlug)!;

  const connectMutation = useMutation({
    mutationFn: () => connectCrm(orgId, selectedSlug, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-connections', orgId] });
      toast({
        title: 'CRM conectado!',
        description: `${def.name} está pronto. Clique em "Sincronizar" para importar os dados.`,
      });
      onClose();
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Falha na conexão', description: err.message });
    },
  });

  const filled = def.fields.every(f => (fields[f.key] ?? '').trim() !== '');

  return (
    <div className="rounded-2xl border border-accent/30 bg-card/80 backdrop-blur-sm overflow-hidden">
      {/* Form header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <PlugZap className="w-4 h-4 text-accent" />
          <span className="font-bold text-sm">Conectar CRM</span>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-5 space-y-5">
        {/* CRM selector — grid of cards */}
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
            Escolha o CRM
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CRM_CATALOGUE.map(crm => (
              <button
                key={crm.slug}
                onClick={() => { setSelectedSlug(crm.slug); setFields({}); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all text-xs font-semibold ${
                  selectedSlug === crm.slug
                    ? 'border-accent bg-accent/10 text-accent shadow-sm shadow-accent/20'
                    : 'border-border bg-muted/20 text-muted-foreground hover:border-accent/40 hover:bg-accent/5'
                }`}
              >
                <span className="text-xl">{crm.logo}</span>
                {crm.name}
              </button>
            ))}
            {/* Placeholder: more CRMs coming */}
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-dashed border-border text-center text-[10px] text-muted-foreground opacity-50 cursor-default">
              <span className="text-xl">➕</span>
              Em breve
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">{def.description}</p>
        </div>

        {/* Credential fields */}
        <div className="space-y-3 border-t border-border/50 pt-4">
          {def.fields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`crm-field-${f.key}`} className="text-xs font-semibold">
                {f.label}
              </Label>
              <Input
                id={`crm-field-${f.key}`}
                type={f.type ?? 'text'}
                placeholder={f.placeholder}
                value={fields[f.key] ?? ''}
                onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="h-9 text-sm"
                autoComplete="off"
              />
            </div>
          ))}
        </div>

        {/* Action */}
        <Button
          className="w-full h-10 font-bold bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
          onClick={() => connectMutation.mutate()}
          disabled={!filled || connectMutation.isPending}
        >
          {connectMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Verificando credenciais…
            </>
          ) : (
            <>
              <Plug className="w-4 h-4" />
              Conectar e validar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface CrmConnectorProps {
  orgId: string;
}

export function CrmConnector({ orgId }: CrmConnectorProps) {
  const [showForm, setShowForm] = useState(false);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['crm-connections', orgId],
    queryFn: () => fetchConnections(orgId),
    refetchInterval: (query) =>
      query.state.data?.some(c => c.sync_status === 'syncing') ? 3000 : false,
  });

  const connectedSlugs = new Set(connections.map(c => c.crm_slug));
  const hasConnections = connections.length > 0;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Integração CRM</h2>
          <p className="text-sm text-muted-foreground">
            Conecte seu CRM para importar contatos, negócios e atividades automaticamente.
          </p>
        </div>
        {!showForm && (
          <Button
            size="sm"
            className="gap-2 font-bold bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4" />
            Conectar CRM
          </Button>
        )}
      </div>

      {/* Connect form */}
      {showForm && (
        <ConnectForm orgId={orgId} onClose={() => setShowForm(false)} />
      )}

      {/* Connections list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : hasConnections ? (
        <div className="space-y-3">
          {connections.map(conn => {
            const def = CRM_CATALOGUE.find(c => c.slug === conn.crm_slug) ?? {
              slug: conn.crm_slug,
              name: conn.crm_slug,
              logo: '🔌',
              description: '',
              fields: [],
            };
            return (
              <ConnectedCard key={conn.crm_slug} conn={conn} orgId={orgId} def={def} />
            );
          })}
        </div>
      ) : !showForm ? (
        /* Empty state */
        <div
          className="rounded-2xl border-2 border-dashed border-border/50 bg-muted/10 p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-accent/30 hover:bg-accent/5 transition-all group"
          onClick={() => setShowForm(true)}
        >
          <div className="w-14 h-14 rounded-2xl bg-muted/30 group-hover:bg-accent/10 flex items-center justify-center transition-colors">
            <PlugZap className="w-6 h-6 text-muted-foreground group-hover:text-accent transition-colors" />
          </div>
          <div className="text-center">
            <p className="font-bold text-sm">Nenhum CRM conectado</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Clique para conectar o Kommo e importar seus dados.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
