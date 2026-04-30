import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  useIntegrations,
  useDeleteIntegration,
} from '@/hooks/useIntegrations';
import { supabase } from '@/integrations/supabase/client';
import type { Integration, IntegrationType } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { toast as sonner } from 'sonner';
import {
  Plug, PlugZap, Trash2, CheckCircle2, AlertCircle, Clock, Loader2,
  RefreshCw, Database, Globe, Search, History, Download, FileText, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ProviderCategory = 'data' | 'crm' | 'messaging' | 'paid_traffic';
type StatusFilter = 'all' | 'connected' | 'pending' | 'error' | 'syncing';
type SortMode = 'recent' | 'name';

// Slug "estendido" — inclui plataformas de tráfego pago que vivem em outra tabela
type ExtendedSlug = IntegrationType | 'meta_ads' | 'google_ads';

type ProviderDef = {
  slug: ExtendedSlug;
  name: string;
  description: string;
  category: ProviderCategory;
  logo: string;
  syncFn?: string;
  /** Redireciona para uma rota específica em vez do /import padrão. */
  customConnectPath?: (orgId: string) => string;
};

const PROVIDERS: ReadonlyArray<ProviderDef> = [
  { slug: 'supabase',      name: 'Supabase',           description: 'Conecte um banco Postgres externo via Supabase.',         category: 'data',         logo: '⚡' },
  { slug: 'google_sheets', name: 'Google Sheets',      description: 'Importe dados de planilhas do Google Sheets.',            category: 'data',         logo: '🟩' },
  { slug: 'csv',           name: 'Upload CSV',         description: 'Faça upload manual de arquivos CSV.',                     category: 'data',         logo: '📄' },
  { slug: 'api',           name: 'API REST',           description: 'Conecte qualquer API REST com autenticação por token.',   category: 'data',         logo: '🔌', syncFn: 'sync-external-api' },
  { slug: 'ploomes',       name: 'Ploomes CRM',        description: 'Sincronize negócios e contatos do Ploomes.',              category: 'crm',          logo: '🟦', syncFn: 'sync-ploomes' },
  { slug: 'coldmail',      name: 'Cold Mail Hackers',  description: 'Importe campanhas e respostas do CMH (LinkedIn).',        category: 'messaging',    logo: '✉️', syncFn: 'sync-coldmail' },
  { slug: 'smartlead',     name: 'Smartlead',          description: 'Sincronize cold email e métricas do Smartlead.',          category: 'messaging',    logo: '📧', syncFn: 'sync-smartlead' },
  { slug: 'meta_ads',      name: 'Meta Ads',           description: 'Campanhas, gastos, leads e ROAS do Facebook/Instagram.',  category: 'paid_traffic', logo: '🔵', customConnectPath: (orgId) => `/client/${orgId}/paid-traffic/connect?platform=meta_ads` },
  { slug: 'google_ads',    name: 'Google Ads',         description: 'Campanhas e conversões do Google Ads via OAuth.',          category: 'paid_traffic', logo: '🔴', customConnectPath: (orgId) => `/client/${orgId}/paid-traffic/connect?platform=google_ads` },
];

const CATEGORIES: ReadonlyArray<{ value: ProviderCategory | 'all'; label: string }> = [
  { value: 'all',          label: 'Todas' },
  { value: 'data',         label: 'Dados' },
  { value: 'crm',          label: 'CRM' },
  { value: 'paid_traffic', label: 'Tráfego Pago' },
  { value: 'messaging',    label: 'Mensageria' },
];

const STATUS_CONFIG = {
  connected: { label: 'Conectado',     icon: CheckCircle2, color: 'text-emerald-500' },
  pending:   { label: 'Pendente',      icon: Clock,        color: 'text-amber-500'   },
  error:     { label: 'Erro',          icon: AlertCircle,  color: 'text-destructive' },
  syncing:   { label: 'Sincronizando', icon: Loader2,      color: 'text-blue-500'    },
} as const;

const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'all',       label: 'Todos' },
  { value: 'connected', label: 'Conectados' },
  { value: 'syncing',   label: 'Sincronizando' },
  { value: 'pending',   label: 'Pendentes' },
  { value: 'error',     label: 'Com erro' },
];

const SNAPSHOT_TABLES: Partial<Record<IntegrationType, 'ploomes_sync_snapshots' | 'cmh_sync_snapshots' | 'smartlead_sync_snapshots'>> = {
  ploomes: 'ploomes_sync_snapshots',
  coldmail: 'cmh_sync_snapshots',
  smartlead: 'smartlead_sync_snapshots',
};

interface SyncSnapshot {
  id: string;
  snapshot_type: string;
  synced_at: string;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportHistoryCsv(integrationName: string, rows: SyncSnapshot[]) {
  const header = ['Tipo', 'Sincronizado em', 'ID'];
  const lines = rows.map((r) => [
    `"${r.snapshot_type.replace(/"/g, '""')}"`,
    `"${format(new Date(r.synced_at), 'dd/MM/yyyy HH:mm:ss')}"`,
    `"${r.id}"`,
  ].join(';'));
  const csv = '\uFEFF' + [header.join(';'), ...lines].join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `historico-${integrationName.replace(/\s+/g, '_')}.csv`);
}

function exportHistoryPdf(integrationName: string, rows: SyncSnapshot[]) {
  // Lightweight printable HTML → user prints to PDF (no extra deps)
  const win = window.open('', '_blank');
  if (!win) return;
  const tableRows = rows.map((r) => `
    <tr>
      <td>${r.snapshot_type}</td>
      <td>${format(new Date(r.synced_at), 'dd/MM/yyyy HH:mm:ss')}</td>
      <td style="font-family:monospace;font-size:11px">${r.id}</td>
    </tr>`).join('');
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
    <title>Histórico — ${integrationName}</title>
    <style>
      body{font-family:system-ui,-apple-system,sans-serif;padding:32px;color:#111}
      h1{font-size:18px;margin:0 0 4px}
      p{color:#555;margin:0 0 16px;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e5e7eb}
      th{background:#f3f4f6;text-transform:uppercase;font-size:11px;letter-spacing:0.05em}
      @media print{button{display:none}}
    </style></head><body>
    <h1>Histórico de sincronização</h1>
    <p>${integrationName} — gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
    <button onclick="window.print()" style="margin-bottom:16px;padding:6px 12px">Imprimir / Salvar PDF</button>
    <table><thead><tr><th>Tipo</th><th>Data</th><th>ID</th></tr></thead>
    <tbody>${tableRows || '<tr><td colspan="3" style="text-align:center;color:#888;padding:24px">Sem registros</td></tr>'}</tbody></table>
    </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

export default function Integrations() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: integrations = [], isLoading, refetch } = useIntegrations(orgId);
  const deleteIntegration = useDeleteIntegration();

  const [activeCategory, setActiveCategory] = useState<ProviderCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [search, setSearch] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<Integration | null>(null);
  const [history, setHistory] = useState<SyncSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [errorFor, setErrorFor] = useState<Integration | null>(null);

  // Track previous statuses to fire success/error toasts when sync completes
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const prev = prevStatusRef.current;
    integrations.forEach((i) => {
      const before = prev.get(i.id);
      if (before === 'syncing' && i.status === 'connected') {
        sonner.success(`${i.name}: sincronização concluída.`);
      } else if (before === 'syncing' && i.status === 'error') {
        sonner.error(`${i.name}: falha na sincronização.`, {
          description: i.sync_error?.slice(0, 140) ?? 'Veja detalhes na central.',
        });
      }
      prev.set(i.id, i.status);
    });
  }, [integrations]);

  // Auto-refresh on tab focus
  useEffect(() => {
    const onFocus = () => queryClient.invalidateQueries({ queryKey: ['integrations', orgId] });
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [orgId, queryClient]);

  // Poll while syncing
  useEffect(() => {
    const isSyncing = integrations.some((i) => i.status === 'syncing') || !!syncingId;
    if (!isSyncing) return;
    const id = setInterval(() => refetch(), 4000);
    return () => clearInterval(id);
  }, [integrations, syncingId, refetch]);

  const providerBySlug = useMemo(
    () => Object.fromEntries(PROVIDERS.map((p) => [p.slug, p])) as Record<IntegrationType, ProviderDef>,
    [],
  );
  const connectedSlugs = useMemo(
    () => new Set<IntegrationType>(integrations.map((i) => i.type)),
    [integrations],
  );

  const visibleIntegrations = useMemo(() => {
    let list = [...integrations];
    if (statusFilter !== 'all') list = list.filter((i) => i.status === statusFilter);
    if (sortMode === 'recent') {
      list.sort((a, b) => {
        const ta = a.last_sync_at ? new Date(a.last_sync_at).getTime() : 0;
        const tb = b.last_sync_at ? new Date(b.last_sync_at).getTime() : 0;
        return tb - ta;
      });
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }
    return list;
  }, [integrations, statusFilter, sortMode]);

  const statusCounts = useMemo(() => {
    const c = { connected: 0, pending: 0, error: 0, syncing: 0 } as Record<string, number>;
    integrations.forEach((i) => { c[i.status] = (c[i.status] ?? 0) + 1; });
    return c;
  }, [integrations]);

  const filteredProviders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return PROVIDERS.filter((p) => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (!term) return true;
      return p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term);
    });
  }, [activeCategory, search]);

  const handleConnect = (slug: IntegrationType): void => {
    navigate(`/client/${orgId}/import?provider=${slug}`);
  };

  const handleSync = async (integration: Integration): Promise<void> => {
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
      sonner.info(`Sincronização iniciada — ${integration.name}`);
      refetch();
    } catch (err) {
      sonner.error('Falha ao iniciar sincronização', {
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
      sonner.success('Integração removida.');
    } catch {
      sonner.error('Falha ao remover.');
    }
  };

  const openHistory = async (integration: Integration) => {
    setHistoryFor(integration);
    setHistory([]);
    const table = SNAPSHOT_TABLES[integration.type];
    if (!table || !orgId) return;
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id, snapshot_type, synced_at')
        .eq('org_id', orgId)
        .order('synced_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setHistory((data ?? []) as SyncSnapshot[]);
    } catch (err) {
      sonner.error('Não foi possível carregar histórico', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setHistoryLoading(false);
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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <PlugZap className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Conexões Ativas</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1 flex-wrap">
                {STATUS_FILTERS.map((s) => {
                  const count = s.value === 'all' ? integrations.length : statusCounts[s.value] ?? 0;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStatusFilter(s.value)}
                      className={cn(
                        'h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1',
                        statusFilter === s.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {s.label}
                      <span className="opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger className="h-7 w-[180px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Última sincronização</SelectItem>
                  <SelectItem value="name">Nome (A–Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            {visibleIntegrations.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-6 border border-dashed rounded-lg">
                Nenhuma integração corresponde a este filtro.
              </div>
            ) : visibleIntegrations.map((conn) => {
              const provider = providerBySlug[conn.type];
              const status = STATUS_CONFIG[conn.status] ?? STATUS_CONFIG.pending;
              const StatusIcon = status.icon;
              const isSyncingNow = syncingId === conn.id || conn.status === 'syncing';
              const isError = conn.status === 'error';
              return (
                <div
                  key={conn.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                    isError ? 'border-destructive/40 bg-destructive/5' : 'border-border/50 hover:border-border',
                  )}
                >
                  <span className="text-xl">{provider?.logo ?? '🔌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conn.name}</p>
                    <p className="text-xs text-muted-foreground">{provider?.name ?? conn.type}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusIcon className={cn('w-4 h-4', status.color, isSyncingNow && 'animate-spin')} />
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {isSyncingNow ? 'Sincronizando' : status.label}
                    </span>
                    {conn.last_sync_at && (
                      <span className="text-[10px] text-muted-foreground hidden md:block">
                        {format(new Date(conn.last_sync_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </span>
                    )}
                    {isError && (
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                        onClick={() => setErrorFor(conn)} title="Ver erro"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {SNAPSHOT_TABLES[conn.type] && (
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => openHistory(conn)} title="Ver histórico"
                      >
                        <History className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {provider?.syncFn && (
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => handleSync(conn)}
                        disabled={isSyncingNow}
                        title="Sincronizar agora"
                      >
                        {isSyncingNow
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(conn.id, conn.name)}
                      disabled={deleteIntegration.isPending}
                      title="Desconectar"
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Marketplace de Integrações</h2>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar integração..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs pl-8"
            />
          </div>
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
            <p className="font-medium">Nenhuma integração encontrada.</p>
            <p className="text-sm mt-1">Tente outro filtro ou termo de busca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProviders.map((provider) => {
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
                        <span className="text-2xl">{provider.logo}</span>
                        <div>
                          <CardTitle className="text-sm font-semibold leading-tight">
                            {provider.name}
                          </CardTitle>
                          <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0 capitalize">
                            {provider.category}
                          </Badge>
                        </div>
                      </div>
                      {isConnected && (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0 gap-1">
                          <CheckCircle2 className="w-3 h-3" />Conectado
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <CardDescription className="text-xs leading-relaxed">
                      {provider.description}
                    </CardDescription>
                    <Button
                      size="sm"
                      variant={isConnected ? 'outline' : 'default'}
                      className="w-full h-8 text-xs"
                      onClick={() => handleConnect(provider.slug)}
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

      {/* History dialog with CSV/PDF export */}
      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Histórico — {historyFor?.name}
            </DialogTitle>
            <DialogDescription>
              Últimas execuções de sincronização registradas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm" variant="outline" className="h-8 text-xs"
              disabled={historyLoading || history.length === 0}
              onClick={() => historyFor && exportHistoryCsv(historyFor.name, history)}
            >
              <FileDown className="w-3.5 h-3.5 mr-1.5" /> CSV
            </Button>
            <Button
              size="sm" variant="outline" className="h-8 text-xs"
              disabled={historyLoading || history.length === 0}
              onClick={() => historyFor && exportHistoryPdf(historyFor.name, history)}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" /> PDF
            </Button>
          </div>

          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma sincronização registrada ainda.
            </p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between p-2.5 rounded-md border border-border/50 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="font-medium capitalize">{h.snapshot_type}</span>
                  </div>
                  <div className="text-right">
                    <div>{format(new Date(h.synced_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(h.synced_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Error dialog */}
      <Dialog open={!!errorFor} onOpenChange={(o) => !o && setErrorFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              Erro de sincronização — {errorFor?.name}
            </DialogTitle>
            <DialogDescription>
              Detalhes reportados pelo conector na última tentativa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Conector</p>
                <p className="font-medium">{providerBySlug[errorFor?.type as IntegrationType]?.name ?? errorFor?.type}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Última tentativa</p>
                <p className="font-medium">
                  {errorFor?.last_sync_at
                    ? format(new Date(errorFor.last_sync_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                    : '—'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Mensagem</p>
              <pre className="bg-muted p-3 rounded-md text-[11px] whitespace-pre-wrap break-words max-h-64 overflow-auto font-mono">
{errorFor?.sync_error?.trim() || 'Sem detalhes registrados.'}
              </pre>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setErrorFor(null)}>Fechar</Button>
            {errorFor && providerBySlug[errorFor.type]?.syncFn && (
              <Button
                onClick={() => { const i = errorFor; setErrorFor(null); handleSync(i); }}
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
