import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Plug, PlugZap, Trash2, RefreshCw, CheckCircle2,
  AlertCircle, Clock, Loader2, Database, FileSpreadsheet, FileUp, Globe,
  Mail, Building2, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Types ──────────────────────────────────────────────────────────────────────

type IntegrationRow = {
  id: string;
  org_id: string;
  name: string;
  type: string;
  status: 'pending' | 'connected' | 'error' | 'syncing' | 'paused';
  last_sync_at: string | null;
  sync_error: string | null;
  config: Record<string, unknown>;
  created_at: string;
};

type ProviderDef = {
  slug: string;
  name: string;
  description: string;
  category: 'data' | 'crm' | 'marketing' | 'sheets';
  icon: React.ElementType;
  color: string;
  syncFn?: string; // edge function name for manual sync
  available: boolean;
  setupRoute?: string;
};

// ── Catalog of providers actually supported ───────────────────────────────────

const PROVIDERS: ProviderDef[] = [
  {
    slug: 'supabase',
    name: 'Supabase',
    description: 'Conecte um banco PostgreSQL externo (Supabase) para sincronizar tabelas e gerar dashboards em tempo real.',
    category: 'data',
    icon: Database,
    color: 'text-emerald-500',
    available: true,
  },
  {
    slug: 'google_sheets',
    name: 'Google Sheets',
    description: 'Importe dados diretamente de uma planilha pública do Google Sheets.',
    category: 'sheets',
    icon: FileSpreadsheet,
    color: 'text-emerald-600',
    available: true,
  },
  {
    slug: 'csv',
    name: 'Upload CSV',
    description: 'Faça upload de um arquivo CSV local — ideal para análises pontuais.',
    category: 'data',
    icon: FileUp,
    color: 'text-blue-500',
    available: true,
  },
  {
    slug: 'api',
    name: 'API REST',
    description: 'Conecte qualquer endpoint REST público ou autenticado por token.',
    category: 'data',
    icon: Globe,
    color: 'text-violet-500',
    available: true,
    syncFn: 'sync-external-api',
  },
  {
    slug: 'ploomes',
    name: 'Ploomes CRM',
    description: 'Sincronize negócios, contatos e pipelines do Ploomes via API key.',
    category: 'crm',
    icon: Building2,
    color: 'text-orange-500',
    available: true,
    syncFn: 'sync-ploomes',
  },
  {
    slug: 'cold_mail_hackers',
    name: 'Cold Mail Hackers',
    description: 'Acompanhe campanhas, taxas de resposta e leads gerados pela CMH.',
    category: 'marketing',
    icon: Mail,
    color: 'text-cyan-500',
    available: true,
    syncFn: 'sync-coldmail',
  },
  {
    slug: 'smartlead',
    name: 'Smartlead',
    description: 'Monitore campanhas de cold email e métricas de envio do Smartlead.',
    category: 'marketing',
    icon: Send,
    color: 'text-indigo-500',
    available: true,
    syncFn: 'sync-smartlead',
  },
];

const CATEGORY_LABELS = {
  all: 'Todas',
  data: 'Dados',
  sheets: 'Planilhas',
  crm: 'CRM',
  marketing: 'Marketing',
} as const;

const STATUS_CONFIG = {
  connected: { label: 'Conectado', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  error:     { label: 'Erro',      icon: AlertCircle,  color: 'text-destructive', bg: 'bg-destructive/10' },
  pending:   { label: 'Pendente',  icon: Clock,        color: 'text-amber-500', bg: 'bg-amber-500/10' },
  paused:    { label: 'Pausado',   icon: Clock,        color: 'text-muted-foreground', bg: 'bg-muted' },
  syncing:   { label: 'Sincronizando', icon: Loader2,  color: 'text-blue-500', bg: 'bg-blue-500/10' },
} as const;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Integrations() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<keyof typeof CATEGORY_LABELS>('all');

  // Active connections from the integrations table
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['integrations', orgId],
    queryFn: async (): Promise<IntegrationRow[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as IntegrationRow[];
    },
    enabled: !!orgId,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async ({ integration, fnName }: { integration: IntegrationRow; fnName: string }) => {
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { org_id: orgId, integration_id: integration.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Sincronização iniciada', description: 'Os dados serão atualizados em instantes.' });
      queryClient.invalidateQueries({ queryKey: ['integrations', orgId] });
    },
    onError: (err: unknown) => {
      toast({
        variant: 'destructive',
        title: 'Falha na sincronização',
        description: err instanceof Error ? err.message : 'Tente novamente em alguns segundos.',
      });
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('integrations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Integração removida.' });
      queryClient.invalidateQueries({ queryKey: ['integrations', orgId] });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Falha ao remover integração.' });
    },
  });

  const connectedSlugs = new Set(connections.map((c) => c.type));

  const filtered = activeCategory === 'all'
    ? PROVIDERS
    : PROVIDERS.filter((p) => p.category === activeCategory);

  const handleConnect = (provider: ProviderDef) => {
    // All connections go through the onboarding wizard / Import page
    navigate(`/client/${orgId}/import?provider=${provider.slug}`);
  };

  const handleSync = (conn: IntegrationRow) => {
    const provider = PROVIDERS.find((p) => p.slug === conn.type);
    if (!provider?.syncFn) {
      toast({
        variant: 'destructive',
        title: 'Sincronização indisponível',
        description: 'Este tipo de integração é atualizado automaticamente ou via re-importação.',
      });
      return;
    }
    syncMutation.mutate({ integration: conn, fnName: provider.syncFn });
  };

  const handleDisconnect = (conn: IntegrationRow) => {
    if (!confirm(`Remover a integração "${conn.name}"? Esta ação não pode ser desfeita.`)) return;
    disconnectMutation.mutate(conn.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Central de Integrações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte suas fontes de dados e operações para alimentar dashboards completos e atualizados.
        </p>
      </div>

      {/* Active connections */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <PlugZap className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Conexões Ativas ({connections.length})</h2>
        </div>

        {connections.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <Plug className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma integração conectada ainda. Escolha uma fonte abaixo para começar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {connections.map((conn) => {
              const provider = PROVIDERS.find((p) => p.slug === conn.type);
              const Icon = provider?.icon ?? Plug;
              const status = STATUS_CONFIG[conn.status] ?? STATUS_CONFIG.pending;
              const StatusIcon = status.icon;
              const isSyncing = syncMutation.isPending && syncMutation.variables?.integration.id === conn.id;

              return (
                <div
                  key={conn.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors bg-card"
                >
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', status.bg)}>
                    <Icon className={cn('w-4 h-4', provider?.color ?? 'text-muted-foreground')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conn.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {provider?.name ?? conn.type}
                      {conn.last_sync_at && (
                        <> · Última sync {format(new Date(conn.last_sync_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</>
                      )}
                    </p>
                    {conn.sync_error && (
                      <p className="text-xs text-destructive mt-0.5 truncate">{conn.sync_error}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={cn('gap-1.5 text-[10px]', status.color)}>
                    <StatusIcon className={cn('w-3 h-3', conn.status === 'syncing' && 'animate-spin')} />
                    {status.label}
                  </Badge>
                  {provider?.syncFn && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => handleSync(conn)}
                      disabled={isSyncing}
                      title="Sincronizar agora"
                    >
                      <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDisconnect(conn)}
                    disabled={disconnectMutation.isPending}
                    title="Remover integração"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Marketplace */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Integrações Disponíveis</h2>
        </div>

        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as keyof typeof CATEGORY_LABELS)}>
          <TabsList>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <TabsTrigger key={value} value={value} className="text-xs">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeCategory} className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((provider) => {
                const Icon = provider.icon;
                const isConnected = connectedSlugs.has(provider.slug);
                return (
                  <Card
                    key={provider.slug}
                    className={cn(
                      'transition-all hover:shadow-md',
                      isConnected && 'border-emerald-500/30 bg-emerald-500/5',
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Icon className={cn('w-5 h-5', provider.color)} />
                          </div>
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
                      <CardDescription className="text-xs leading-relaxed min-h-[3rem]">
                        {provider.description}
                      </CardDescription>
                      <Button
                        size="sm"
                        variant={isConnected ? 'outline' : 'default'}
                        className="w-full h-8 text-xs"
                        onClick={() => handleConnect(provider)}
                      >
                        <Plug className="w-3.5 h-3.5 mr-1.5" />
                        {isConnected ? 'Adicionar outra conta' : 'Conectar'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
