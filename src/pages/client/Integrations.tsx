import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useIntegrationProviders, useHubConnections, useHubConnect, useHubDisconnect } from '@/hooks/useIntegrationHub';
import type { IntegrationProvider, ProviderCategory } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Plug, PlugZap, Trash2, CheckCircle2,
  AlertCircle, Clock, Loader2, ExternalLink,
  Megaphone, BarChart3, Database, MessageSquare, Globe,
  ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Setup guides per provider ──────────────────────────────────────────────────

const SETUP_GUIDES: Record<string, { steps: string[]; tip?: string; helpUrl?: string }> = {
  kommo: {
    steps: [
      'Acesse sua conta Kommo e vá em Configurações → Integrações.',
      'Clique em "Chaves de API" no menu lateral.',
      'Copie o domínio da sua conta (ex: suaempresa.kommo.com) e o token de longa duração.',
      'Cole ambos nos campos abaixo e clique em Conectar.',
    ],
    tip: 'Use um token de longa duração (Long-term token) para evitar reautenticações.',
    helpUrl: 'https://www.kommo.com/developers/api/',
  },
  hubspot: {
    steps: [
      'No HubSpot, vá em Configurações → Integrações → Aplicativos Privados.',
      'Clique em "Criar aplicativo privado" e dê um nome (ex: Pinn BAI).',
      'Em Escopos, habilite: crm.objects.contacts.read, crm.objects.deals.read.',
      'Clique em "Criar token" e copie o valor gerado.',
      'Cole o token no campo abaixo.',
    ],
    tip: 'Tokens de aplicativos privados nunca expiram e são mais seguros que chaves de API legadas.',
    helpUrl: 'https://developers.hubspot.com/docs/api/private-apps',
  },
  rd_station: {
    steps: [
      'No RD Station Marketing, vá em Integrações → Gerador de Token.',
      'Clique em "Gerar novo token de API".',
      'Copie o token gerado e cole no campo abaixo.',
    ],
    tip: 'Apenas usuários administradores conseguem gerar tokens de API no RD Station.',
    helpUrl: 'https://developers.rdstation.com/reference/autenticacao',
  },
  meta_ads: {
    steps: [
      'Acesse business.facebook.com → Configurações → Usuários do Sistema.',
      'Crie um Usuário do Sistema com permissão de Analista ou superior.',
      'Clique em "Gerar token" e selecione o aplicativo e as contas de anúncio desejadas.',
      'Habilite as permissões: ads_read, ads_management.',
      'Copie o token e o ID da conta de anúncio (formato: act_XXXXXXXXX).',
    ],
    tip: 'Tokens de Usuário do Sistema não expiram. Evite usar tokens pessoais.',
    helpUrl: 'https://developers.facebook.com/docs/marketing-api/access',
  },
  google_ads: {
    steps: [
      'Acesse ads.google.com → Ferramentas → API do Google Ads.',
      'Crie um token de desenvolvedor (se ainda não tiver).',
      'Gere credenciais OAuth2 no Google Cloud Console para o produto Pinn.',
      'Cole o ID de cliente, ID de conta e o token de atualização (refresh token) abaixo.',
    ],
    tip: 'Para a maioria dos casos, você precisa de acesso básico à API (não test account).',
    helpUrl: 'https://developers.google.com/google-ads/api/docs/first-call/overview',
  },
  google_analytics: {
    steps: [
      'No Google Analytics 4, vá em Administrador → Conta → Gerenciamento de acesso.',
      'Adicione a conta de serviço do Pinn como Leitor.',
      'No Google Cloud Console, baixe o JSON da conta de serviço.',
      'Cole o conteúdo do JSON no campo abaixo (ou só o e-mail + chave privada).',
    ],
    tip: 'Use uma conta de serviço para integração estável, sem dependência de conta pessoal.',
    helpUrl: 'https://support.google.com/analytics/answer/1009702',
  },
  google_sheets: {
    steps: [
      'Abra a planilha no Google Sheets e clique em Compartilhar.',
      'Compartilhe com o e-mail da conta de serviço do Pinn (fornecido na documentação).',
      'Copie o ID da planilha da URL (entre /d/ e /edit).',
      'Cole o ID no campo abaixo.',
    ],
    tip: 'O Pinn atualiza os dados da planilha a cada hora. Certifique-se de que a aba principal está nomeada corretamente.',
  },
  supabase: {
    steps: [
      'No painel do Supabase, vá em Configurações → API.',
      'Copie a "Project URL" e a "anon public key".',
      'Cole os valores nos campos abaixo.',
    ],
    tip: 'Use a anon key (não a service_role key) para que as políticas de segurança (RLS) continuem ativas.',
    helpUrl: 'https://supabase.com/docs/guides/api',
  },
  webhook: {
    steps: [
      'Clique em Conectar para gerar a URL do webhook.',
      'Copie a URL gerada e configure-a no sistema externo como destino de webhook.',
      'O Pinn aceitará requisições POST com payload JSON.',
    ],
    tip: 'Você pode enviar dados de qualquer sistema que suporte webhooks (ex: Zapier, Make, n8n).',
  },
  stripe: {
    steps: [
      'No Stripe, vá em Desenvolvedores → Chaves de API.',
      'Copie a Chave Secreta (começa com sk_live_ ou sk_test_).',
      'Cole no campo abaixo.',
    ],
    tip: 'Use a chave de teste (sk_test_) para validar antes de ir para produção.',
    helpUrl: 'https://stripe.com/docs/keys',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  crm: 'CRM',
  paid_traffic: 'Tráfego Pago',
  analytics: 'Analytics',
  data: 'Dados',
  messaging: 'Mensageria',
};

const STATUS_CONFIG = {
  connected: { label: 'Conectado', icon: CheckCircle2, color: 'text-emerald-500' },
  error:     { label: 'Erro',      icon: AlertCircle,  color: 'text-destructive' },
  pending:   { label: 'Pendente',  icon: Clock,        color: 'text-amber-500' },
  paused:    { label: 'Pausado',   icon: Clock,        color: 'text-muted-foreground' },
};

const SYNC_STATUS_CONFIG = {
  idle:     { label: 'Aguardando',    color: 'bg-muted text-muted-foreground' },
  syncing:  { label: 'Sincronizando', color: 'bg-blue-500/10 text-blue-500' },
  success:  { label: 'Sincronizado',  color: 'bg-emerald-500/10 text-emerald-500' },
  error:    { label: 'Erro no sync',  color: 'bg-destructive/10 text-destructive' },
};

const PLATFORM_LOGOS: Record<string, string> = {
  kommo:            '🟦',
  hubspot:          '🟠',
  rd_station:       '🟢',
  meta_ads:         '🔵',
  google_ads:       '🔴',
  google_analytics: '📊',
  google_sheets:    '🟩',
  supabase:         '⚡',
  webhook:          '🔗',
  stripe:           '🟣',
};

// ── Setup Guide component ──────────────────────────────────────────────────────

function SetupGuide({ slug }: { slug: string }) {
  const [open, setOpen] = useState(true);
  const guide = SETUP_GUIDES[slug];
  if (!guide) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300"
      >
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          Como obter as credenciais
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          <ol className="space-y-1.5 list-none">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-blue-800 dark:text-blue-200">
                <span className="shrink-0 w-4 h-4 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-bold mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {guide.tip && (
            <p className="text-[11px] text-blue-600 dark:text-blue-400 italic border-t border-blue-200 dark:border-blue-800 pt-2">
              💡 {guide.tip}
            </p>
          )}
          {guide.helpUrl && (
            <a
              href={guide.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Documentação oficial
            </a>
          )}
        </div>
      )}
    </div>
  );
}

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
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span>{PLATFORM_LOGOS[provider.slug] ?? '🔌'}</span>
            Conectar {provider.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <SetupGuide slug={provider.slug} />

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
              <Label>
                {field.label}
                {field.required !== false && <span className="text-destructive ml-1">*</span>}
              </Label>
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

          {provider.docs_url && !SETUP_GUIDES[provider.slug] && (
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
        {SETUP_GUIDES[provider.slug] && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Info className="w-3 h-3" />
            {SETUP_GUIDES[provider.slug].steps.length} passos para conectar
          </p>
        )}
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
            {format(new Date(connection.last_sync_at), 'dd/MM HH:mm', { locale: ptBR })}
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

// ── How it works banner ────────────────────────────────────────────────────────

function HowItWorksBanner() {
  return (
    <div className="rounded-xl border bg-gradient-to-r from-primary/5 to-primary/0 p-4">
      <h3 className="text-sm font-semibold mb-3">Como funciona a integração?</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-muted-foreground">
        <div className="flex gap-3">
          <span className="text-xl">🔌</span>
          <div>
            <p className="font-semibold text-foreground">1. Conecte</p>
            <p>Cole as credenciais da plataforma desejada. Os dados são criptografados em repouso.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="text-xl">🔄</span>
          <div>
            <p className="font-semibold text-foreground">2. Sincronize</p>
            <p>O Pinn busca leads, campanhas e métricas automaticamente a cada hora.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="text-xl">📊</span>
          <div>
            <p className="font-semibold text-foreground">3. Analise</p>
            <p>Os dados aparecem no Dashboard, Tráfego Pago, Saúde do Cliente e IA.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const CATEGORIES: { value: ProviderCategory | 'all'; label: string }[] = [
  { value: 'all',          label: 'Todos' },
  { value: 'crm',          label: 'CRM' },
  { value: 'paid_traffic', label: 'Tráfego Pago' },
  { value: 'analytics',    label: 'Analytics' },
  { value: 'data',         label: 'Dados' },
  { value: 'messaging',    label: 'Mensageria' },
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central de Integrações</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Conecte suas fontes de dados para alimentar dashboards, IA e relatórios automaticamente.
          </p>
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          {connections.length} ativa{connections.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <HowItWorksBanner />

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
            <p className="font-medium">Nenhuma integração encontrada</p>
            <p className="text-sm mt-1">Tente outro filtro ou entre em contato com o suporte.</p>
          </div>
        ) : (
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
        )}
      </section>

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
