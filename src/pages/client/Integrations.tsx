import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntegrations, useDeleteIntegration } from '@/hooks/useIntegrations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Plug, PlugZap, Trash2, CheckCircle2, AlertCircle, Clock, Loader2,
  RefreshCw, Database, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ProviderDef = {
  slug: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  syncFn?: string;
};

const PROVIDERS: ProviderDef[] = [
  { slug: 'supabase', name: 'Supabase', description: 'Conecte um banco Postgres externo via Supabase.', category: 'data', logo: '⚡' },
  { slug: 'google_sheets', name: 'Google Sheets', description: 'Importe dados de planilhas do Google.', category: 'data', logo: '🟩' },
  { slug: 'csv', name: 'Upload CSV', description: 'Faça upload de arquivos CSV manualmente.', category: 'data', logo: '📄' },
  { slug: 'api', name: 'API REST', description: 'Conecte qualquer API REST com autenticação.', category: 'data', logo: '🔌', syncFn: 'sync-external-api' },
  { slug: 'ploomes', name: 'Ploomes CRM', description: 'Sincronize deals e contatos do Ploomes.', category: 'crm', logo: '🟦', syncFn: 'sync-ploomes' },
  { slug: 'coldmail', name: 'Cold Mail Hackers', description: 'Importe campanhas e respostas do CMH.', category: 'messaging', logo: '✉️', syncFn: 'sync-coldmail' },
  { slug: 'smartlead', name: 'Smartlead', description: 'Sincronize cold email do Smartlead.', category: 'messaging', logo: '📧', syncFn: 'sync-smartlead' },
];

const CATEGORIES = [
  { value: 'all', label: 'Todos' },
  { value: 'crm', label: 'CRM' },
  { value: 'data', label: 'Dados' },
  { value: 'messaging', label: 'Mensageria' },
];

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  connected: { label: 'Conectado', icon: CheckCircle2, color: 'text-emerald-500' },
  active: { label: 'Conectado', icon: CheckCircle2, color: 'text-emerald-500' },
  error: { label: 'Erro', icon: AlertCircle, color: 'text-destructive' },
  pending: { label: 'Pendente', icon: Clock, color: 'text-amber-500' },
  syncing: { label: 'Sincronizando', icon: Loader2, color: 'text-blue-500' },
};

export default function Integrations() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: integrations = [], isLoading, refetch } = useIntegrations(orgId);
  const deleteIntegration = useDeleteIntegration();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const providerBySlug = Object.fromEntries(PROVIDERS.map((p) => [p.slug, p]));
  const connectedSlugs = new Set<string>(integrations.map((i) => i.type as string));

  const filteredProviders = activeCategory === 'all'
    ? PROVIDERS
    : PROVIDERS.filter((p) => p.category === activeCategory);

  const handleConnect = (slug: string) => {
    navigate(`/client/${orgId}/import?provider=${slug}`);
  };

  const handleSync = async (integration: typeof integrations[0]) => {
    const provider = providerBySlug[integration.type];
    if (!provider?.syncFn) {
      toast({ title: 'Sincronização manual não disponível para este conector.' });
      return;
    }
    setSyncingId(integration.id);
    try {
      const { error } = await supabase.functions.invoke(provider.syncFn, {
        body: { integrationId: integration.id, orgId },
      });
      if (error) throw error;
      toast({ title: 'Sincronização iniciada com sucesso!' });
      refetch();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Falha na sincronização',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Desconectar "${name}"?`)) return;
    try {
      await deleteIntegration.mutateAsync(id);
      toast({ title: 'Integração removida.' });
    } catch {
      toast({ variant: 'destructive', title: 'Falha ao remover.' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central de Integrações</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Conecte suas fontes de dados para alimentar dashboards, IA e relatórios.
          </p>
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          {integrations.length} ativa{integrations.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {integrations.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <PlugZap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Conexões Ativas ({integrations.length})</h2>
          </div>
          <div className="space-y-2">
            {integrations.map((conn) => {
              const provider = providerBySlug[conn.type];
              const status = STATUS_CONFIG[conn.status] ?? STATUS_CONFIG.pending;
              const StatusIcon = status.icon;
              return (
                <div key={conn.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                  <span className="text-xl">{provider?.logo ?? '🔌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conn.name}</p>
                    <p className="text-xs text-muted-foreground">{provider?.name ?? conn.type}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusIcon className={cn('w-4 h-4', status.color)} />
                    <span className="text-xs text-muted-foreground hidden sm:block">{status.label}</span>
                    {conn.last_sync_at && (
                      <span className="text-[10px] text-muted-foreground hidden md:block">
                        {format(new Date(conn.last_sync_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </span>
                    )}
                    {provider?.syncFn && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleSync(conn)}
                        disabled={syncingId === conn.id}
                      >
                        {syncingId === conn.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(conn.id, conn.name)}
                      disabled={deleteIntegration.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Marketplace de Integrações</h2>
        </div>

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

        {filteredProviders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma integração nessa categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProviders.map((provider) => {
              const isConnected = connectedSlugs.has(provider.slug);
              return (
                <Card key={provider.slug} className={cn(
                  'transition-all hover:shadow-md',
                  isConnected && 'border-emerald-500/30 bg-emerald-500/5',
                )}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{provider.logo}</span>
                        <div>
                          <CardTitle className="text-sm font-semibold leading-tight">{provider.name}</CardTitle>
                          <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0 capitalize">
                            {provider.category}
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
                      onClick={() => handleConnect(provider.slug as never)}
                    >
                      <Plug className="w-3.5 h-3.5 mr-1.5" />
                      {isConnected ? 'Adicionar outra' : 'Conectar'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
