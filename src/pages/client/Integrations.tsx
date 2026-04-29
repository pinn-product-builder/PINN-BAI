import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useIntegrationProviders, useHubConnections, useHubConnect, useHubDisconnect } from '@/hooks/useIntegrationHub';
import type { IntegrationProvider, ProviderCategory } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Plug, PlugZap, Trash2, RefreshCw, CheckCircle2,
  AlertCircle, Clock, Loader2, ExternalLink,
  Megaphone, BarChart3, Database, MessageSquare, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  crm: 'CRM',
  paid_traffic: 'Tráfego Pago',
  analytics: 'Analytics',
  data: 'Dados',
  messaging: 'Mensageria',
};

const CATEGORY_ICONS: Record<ProviderCategory, React.ElementType> = {
  crm: PlugZap,
  paid_traffic: Megaphone,
  analytics: BarChart3,
  data: Database,
  messaging: MessageSquare,
};

const STATUS_CONFIG = {
  connected: { label: 'Conectado', icon: CheckCircle2, color: 'text-emerald-500' },
  error:     { label: 'Erro',      icon: AlertCircle,  color: 'text-destructive' },
  pending:   { label: 'Pendente',  icon: Clock,        color: 'text-amber-500' },
  paused:    { label: 'Pausado',   icon: Clock,        color: 'text-muted-foreground' },
};

const SYNC_STATUS_CONFIG = {
  idle:     { label: 'Aguardando', color: 'bg-muted text-muted-foreground' },
  syncing:  { label: 'Sincronizando', color: 'bg-blue-500/10 text-blue-500' },
  success:  { label: 'Sincronizado', color: 'bg-emerald-500/10 text-emerald-500' },
  error:    { label: 'Erro no sync', color: 'bg-destructive/10 text-destructive' },
};

const PLATFORM_LOGOS: Record<string, string> = {
  kommo:          '🟦',
  hubspot:        '🟠',
  rd_station:     '🟢',
  meta_ads:       '🔵',
  google_ads:     '🔴',
  google_analytics: '📊',
  google_sheets:  '🟩',
  supabase:       '⚡',
  webhook:        '🔗',
  stripe:         '🟣',
};

// ── Connect Dialog ─────────────────────────────────────────────────────────────

function ConnectDialog({
  provider,
  orgId,
  onClose,
}: {
  provider: IntegrationProvider;
  orgId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const connect = useHubConnect();
  const [displayName, setDisplayName] = useState(provider.name);
  const [creds, setCreds] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    try {
      await connect.mutateAsync({
        orgId,
        providerSlug: provider.slug,
        displayName,
        credentials: creds,
      });
      toast({ title: 'Integração conectada com sucesso!' });
      onClose();
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Falha na conexão',
        description: err instanceof Error ? err.message : 'Verifique as credenciais.',
      });
    }
  };

  const allRequired = provider.credentials_schema
    .filter((f) => f.required !== false)
    .every((f) => !!creds[f.key]?.trim());

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span>{PLATFORM_LOGOS[provider.slug] ?? '🔌'}</span>
            Conectar {provider.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome da conexão</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: Meta Ads — Conta Principal"
            />
          </div>

          {provider.credentials_schema.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label>{field.label}{field.required !== false && <span className="text-destructive ml-1">*</span>}</Label>
              {field.type === 'textarea' ? (
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder={field.placeholder}
                  value={creds[field.key] ?? ''}
                  onChange={(e) => setCreds((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              ) : (
                <Input
                  type={field.type === 'password' ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  value={creds[field.key] ?? ''}
                  onChange={(e) => setCreds((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              )}
            </div>
          ))}

          {provider.docs_url && (
            <a
              href={provider.docs_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Ver documentação
            </a>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!allRequired || !displayName.trim() || connect.isPending}
          >
            {connect.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Conectar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Provider Card ──────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  isConnected,
  onConnect,
}: {
  provider: IntegrationProvider;
  isConnected: boolean;
  onConnect: () => void;
}) {
  return (
    <Card className={cn(
      'relative transition-all hover:shadow-md cursor-default',
      isConnected && 'border-emerald-500/30 bg-emerald-500/5',
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{PLATFORM_LOGOS[provider.slug] ?? '🔌'}</span>
            <div>
              <CardTitle className="text-sm font-semibold leading-tight">{provider.name}</CardTitle>
              <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                {CATEGORY_LABELS[provider.category]}
              </Badge>
            </div>
          </div>
          {isConnected && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <CardDescription className="text-xs leading-relaxed">{provider.description}</CardDescription>
        <Button
          size="sm"
          variant={isConnected ? 'outline' : 'default'}
          className="w-full h-8 text-xs"
          onClick={onConnect}
        >
          <Plug className="w-3.5 h-3.5 mr-1.5" />
          {isConnected ? 'Adicionar outra conta' : 'Conectar'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Connected Connection Row ───────────────────────────────────────────────────

function ConnectionRow({
  connection,
  orgId,
  providerName,
}: {
  connection: ReturnType<typeof useHubConnections>['data'][0];
  orgId: string;
  providerName: string;
}) {
  const { toast } = useToast();
  const disconnect = useHubDisconnect();
  const status = STATUS_CONFIG[connection.status] ?? STATUS_CONFIG.pending;
  const syncBadge = SYNC_STATUS_CONFIG[connection.sync_status] ?? SYNC_STATUS_CONFIG.idle;

  const handleDisconnect = async () => {
    if (!confirm(`Desconectar "${connection.display_name}"?`)) return;
    try {
      await disconnect.mutateAsync({ orgId, connectionId: connection.id });
      toast({ title: 'Integração desconectada.' });
    } catch {
      toast({ variant: 'destructive', title: 'Falha ao desconectar.' });
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
      <span className="text-xl">{PLATFORM_LOGOS[connection.provider_slug] ?? '🔌'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{connection.display_name}</p>
        <p className="text-xs text-muted-foreground">{providerName}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge className={cn('text-[10px]', syncBadge.color)}>{syncBadge.label}</Badge>
        <status.icon className={cn('w-4 h-4', status.color)} />
        {connection.last_sync_at && (
          <span className="text-[10px] text-muted-foreground hidden sm:block">
            {format(new Date(connection.last_sync_at), "dd/MM HH:mm", { locale: ptBR })}
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={handleDisconnect}
          disabled={disconnect.isPending}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const CATEGORIES: { value: ProviderCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'crm', label: 'CRM' },
  { value: 'paid_traffic', label: 'Tráfego Pago' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'data', label: 'Dados' },
];

export default function Integrations() {
  const { orgId } = useParams<{ orgId: string }>();
  const { data: providers = [], isLoading: loadingProviders } = useIntegrationProviders();
  const { data: connections = [], isLoading: loadingConnections } = useHubConnections(orgId);
  const [activeCategory, setActiveCategory] = useState<ProviderCategory | 'all'>('all');
  const [connectingProvider, setConnectingProvider] = useState<IntegrationProvider | null>(null);

  const connectedSlugs = new Set(connections.map((c) => c.provider_slug));
  const providerBySlug = Object.fromEntries(providers.map((p) => [p.slug, p]));

  const filteredProviders = activeCategory === 'all'
    ? providers
    : providers.filter((p) => p.category === activeCategory);

  if (loadingProviders || loadingConnections) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Central de Integrações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte suas fontes de dados e operações para gerar dashboards completos e atualizados em tempo real.
        </p>
      </div>

      {/* Active connections */}
      {connections.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <PlugZap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Conexões Ativas ({connections.length})</h2>
          </div>
          <div className="space-y-2">
            {connections.map((conn) => (
              <ConnectionRow
                key={conn.id}
                connection={conn}
                orgId={orgId!}
                providerName={providerBySlug[conn.provider_slug]?.name ?? conn.provider_slug}
              />
            ))}
          </div>
        </section>
      )}

      {/* Marketplace */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Marketplace de Integrações</h2>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveCategory(value)}
              className={cn(
                'h-7 px-3 rounded-full text-xs font-medium transition-colors',
                activeCategory === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isConnected={connectedSlugs.has(provider.slug)}
              onConnect={() => setConnectingProvider(provider)}
            />
          ))}
        </div>
      </section>

      {/* Connect dialog */}
      {connectingProvider && orgId && (
        <ConnectDialog
          provider={connectingProvider}
          orgId={orgId}
          onClose={() => setConnectingProvider(null)}
        />
      )}
    </div>
  );
}
