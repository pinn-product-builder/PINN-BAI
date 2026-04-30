import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePaidTrafficSummary, usePaidTrafficCampaigns, useSyncAdPlatform } from '@/hooks/usePaidTraffic';
import { useFilters } from '@/hooks/useFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useToast } from '@/hooks/use-toast';
import {
  Megaphone, RefreshCw, Loader2, TrendingUp,
  MousePointerClick, DollarSign, Target, Plug,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Helpers ────────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const PCT = (v: number) => `${v.toFixed(2)}%`;

const PLATFORM_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  meta_ads:   { label: 'Meta Ads',   color: '#1877f2', emoji: '🔵' },
  google_ads: { label: 'Google Ads', color: '#ea4335', emoji: '🔴' },
};

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiTile({
  label, value, sub, icon: Icon, colorClass = 'text-primary',
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; colorClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg bg-muted', colorClass)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold mt-0.5 truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Campaign Table ─────────────────────────────────────────────────────────────

function CampaignTable({ orgId }: { orgId: string }) {
  const { data: campaigns = [], isLoading } = usePaidTrafficCampaigns(orgId);

  if (isLoading) return <div className="py-8 flex justify-center"><Loader2 className="animate-spin w-5 h-5 text-muted-foreground" /></div>;
  if (!campaigns.length) return (
    <p className="text-center text-muted-foreground text-sm py-8">
      Nenhuma campanha sincronizada. Conecte uma plataforma de anúncios nas Integrações.
    </p>
  );

  const STATUS_COLOR: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-500',
    PAUSED: 'bg-amber-500/10 text-amber-500',
    ARCHIVED: 'bg-muted text-muted-foreground',
    DELETED: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-2">
      {campaigns.map((c) => {
        const platform = PLATFORM_LABELS[c.platform_slug];
        return (
          <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
            <span className="text-lg">{platform?.emoji ?? '📢'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{c.name}</p>
              <p className="text-xs text-muted-foreground">{platform?.label ?? c.platform_slug} • {c.objective ?? 'Objetivo não definido'}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {c.daily_budget && (
                <span className="text-xs text-muted-foreground">{BRL.format(c.daily_budget)}/dia</span>
              )}
              <Badge className={cn('text-[10px]', STATUS_COLOR[c.status] ?? 'bg-muted text-muted-foreground')}>
                {c.status}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const CHART_COLORS = { meta_ads: '#1877f2', google_ads: '#ea4335', total: 'hsl(var(--primary))' };

export default function PaidTraffic() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { dateRangeISO } = useFilters();
  const [activePlatform, setActivePlatform] = useState<string | undefined>(undefined);

  const { summary, timeSeries, isLoading } = usePaidTrafficSummary(orgId, dateRangeISO);
  const syncAds = useSyncAdPlatform();

  const handleSync = async (platformSlug: string) => {
    if (!orgId) return;
    try {
      await syncAds.mutateAsync({ orgId, platformSlug, daysBack: 30 });
      toast({ title: `${PLATFORM_LABELS[platformSlug]?.label ?? platformSlug} sincronizado!` });
    } catch {
      toast({ variant: 'destructive', title: 'Falha ao sincronizar.' });
    }
  };

  const t = summary?.totals;
  const chartData = timeSeries.map((d) => ({
    date: format(new Date(d.date + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
    Investimento: d.spend,
    Leads: d.leads,
  }));

  const platformEntries = Object.entries(summary?.byPlatform ?? {});

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />
            Tráfego Pago
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Performance de campanhas Meta Ads e Google Ads com atribuição de receita.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="gap-2"
            onClick={() => navigate(`/client/${orgId}/paid-traffic/connect`)}
          >
            <Plug className="w-3.5 h-3.5" />
            Conectar plataforma
          </Button>
          {['meta_ads', 'google_ads'].map((slug) => {
            const pl = PLATFORM_LABELS[slug];
            return (
              <Button
                key={slug}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={syncAds.isPending}
                onClick={() => handleSync(slug)}
              >
                {syncAds.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                {pl.emoji} Sync {pl.label}
              </Button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !summary ? (
        <div className="text-center py-24 text-muted-foreground">
          <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Nenhum dado de tráfego pago</p>
          <p className="text-sm mt-1">
            Conecte Meta Ads ou Google Ads na{' '}
            <a href="../integrations" className="text-primary hover:underline">Central de Integrações</a>.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile
              label="Investimento"
              value={BRL.format(t?.spend ?? 0)}
              icon={DollarSign}
              colorClass="text-blue-500"
            />
            <KpiTile
              label="Leads Gerados"
              value={NUM.format(t?.leads ?? 0)}
              sub={summary.cpl ? `CPL: ${BRL.format(summary.cpl)}` : undefined}
              icon={Target}
              colorClass="text-emerald-500"
            />
            <KpiTile
              label="ROAS"
              value={summary.roas ? `${summary.roas.toFixed(2)}x` : '—'}
              sub={t?.purchase_value ? `Receita: ${BRL.format(t.purchase_value)}` : undefined}
              icon={TrendingUp}
              colorClass="text-primary"
            />
            <KpiTile
              label="CTR"
              value={summary.ctr ? PCT(summary.ctr) : '—'}
              sub={`${NUM.format(t?.impressions ?? 0)} impressões`}
              icon={MousePointerClick}
              colorClass="text-amber-500"
            />
          </div>

          {/* Por plataforma */}
          {platformEntries.length > 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {platformEntries.map(([slug, m]) => {
                const pl = PLATFORM_LABELS[slug] ?? { label: slug, color: '#888', emoji: '📢' };
                return (
                  <Card key={slug}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span>{pl.emoji}</span> {pl.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Investimento</p>
                        <p className="font-semibold">{BRL.format(m.spend)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Leads</p>
                        <p className="font-semibold">{NUM.format(m.leads)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">CPL</p>
                        <p className="font-semibold">{m.leads > 0 ? BRL.format(m.spend / m.leads) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">ROAS</p>
                        <p className="font-semibold">{m.spend > 0 ? `${(m.purchase_value / m.spend).toFixed(2)}x` : '—'}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Charts */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Investimento diário</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(v: number) => [BRL.format(v), 'Investimento']}
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Area type="monotone" dataKey="Investimento" stroke="hsl(var(--primary))" fill="url(#spendGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Leads gerados por dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(v: number) => [NUM.format(v), 'Leads']}
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Bar dataKey="Leads" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Campaigns */}
          <Tabs defaultValue="campaigns">
            <TabsList>
              <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
            </TabsList>
            <TabsContent value="campaigns" className="mt-4">
              <CampaignTable orgId={orgId!} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
