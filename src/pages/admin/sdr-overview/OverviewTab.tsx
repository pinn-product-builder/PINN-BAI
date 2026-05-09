/**
 * OverviewTab — Visão Geral do dashboard LinkedIn SDR.
 *
 * Agrega métricas em tempo real de todas as contas (Renan, Jaqueline, Pedro):
 * - Banner de campanhas ativas com progresso
 * - KPIs de topo (números brutos)
 * - Funil de conversão (gráfico)
 * - Aceites por dia (série temporal)
 * - Breakdown por perfil (cards comparativos)
 * - Feed de atividade recente
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import {
  Activity,
  Calendar,
  CheckCircle2,
  Flame,
  Mail,
  MessageSquare,
  Send,
  TrendingUp,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

import {
  useLinkedInCampaigns,
  useLinkedInConversations,
  useAllCampaignLeads,
  useRecentMessages,
  INSTANCE_PROFILE_MAP,
  LINKEDIN_INSTANCES,
  type LinkedInCampaign,
  type AllLeadsRow,
  type LinkedInSession,
  type RecentMessageRow,
} from '@/hooks/useLinkedInCampaigns';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const PROFILE_COLORS: Record<string, string> = {
  Renan: 'hsl(217, 91%, 60%)',     // azul
  Jaqueline: 'hsl(280, 70%, 60%)', // roxo
  Pedro: 'hsl(160, 60%, 45%)',     // verde
};

const FUNNEL_COLORS = [
  'hsl(217, 91%, 60%)',   // 1. Convites enviados — azul
  'hsl(280, 70%, 60%)',   // 2. Aceites — roxo
  'hsl(43, 96%, 56%)',    // 3. DMs enviadas — amarelo
  'hsl(24, 90%, 60%)',    // 4. Em qualificação — laranja
  'hsl(142, 71%, 45%)',   // 5. Reunião confirmada — verde
];

function dateKey(iso: string): string {
  // YYYY-MM-DD em UTC para agrupamento estável
  return iso.slice(0, 10);
}

function dateLabel(key: string): string {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Banner de campanhas ativas
// ──────────────────────────────────────────────────────────────────────────────

function ActiveCampaignsBanner({ campaigns }: { campaigns: LinkedInCampaign[] }) {
  const active = campaigns.filter((c) => c.status === 'active');

  if (active.length === 0) {
    return (
      <Card className="border-dashed bg-muted/30">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma campanha ativa no momento. Vá em "Campanhas" para iniciar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            Campanhas em execução agora ({active.length})
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Atualiza a cada 60s
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {active.map((c) => {
          const total = c.total_leads || 0;
          const sent = c.sent_count || 0;
          const failed = c.failed_count || 0;
          const pct = total > 0 ? Math.min(100, ((sent + failed) / total) * 100) : 0;
          return (
            <div
              key={c.id}
              className="rounded-lg border border-border bg-card p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.mode === 'hunting' ? '🎯 Hunting' : '📨 Direct'} ·{' '}
                    {c.linkedin_account_id
                      ? INSTANCE_PROFILE_MAP[c.linkedin_account_id] ?? '—'
                      : '—'}
                  </p>
                </div>
                <Badge className="text-[10px] bg-green-600/10 text-green-600 border-green-600/20 shrink-0">
                  ativa
                </Badge>
              </div>
              <div className="space-y-1">
                <Progress value={pct} className="h-1.5" />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {sent + failed} / {total}
                  </span>
                  <span className="font-medium text-foreground">{pct.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. KPI Grid (números brutos no topo)
// ──────────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor: string;
  trend?: { dir: 'up' | 'down' | 'flat'; pct: string } | null;
}

function KpiCard({ title, value, subtitle, icon: Icon, iconColor, trend }: KpiCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              {title}
            </p>
            <p className="text-2xl font-bold mt-0.5">
              {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
            </p>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted/40 shrink-0 ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {trend && (
          <div
            className={`mt-2 inline-flex items-center gap-1 text-[11px] font-medium ${
              trend.dir === 'up'
                ? 'text-green-600'
                : trend.dir === 'down'
                ? 'text-red-500'
                : 'text-muted-foreground'
            }`}
          >
            <TrendingUp
              className={`w-3 h-3 ${trend.dir === 'down' ? 'rotate-180' : ''}`}
            />
            {trend.pct}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface KpiGridProps {
  campaigns: LinkedInCampaign[];
  leads: AllLeadsRow[];
  sessions: LinkedInSession[];
}

function KpiGrid({ campaigns, leads, sessions }: KpiGridProps) {
  const stats = useMemo(() => {
    const byStatus = leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    const sent = (byStatus.invite_sent ?? 0) + (byStatus.invite_accepted ?? 0) + (byStatus.sent ?? 0);
    const accepted = (byStatus.invite_accepted ?? 0) + (byStatus.sent ?? 0);
    const dmsSent = byStatus.sent ?? 0;
    const acceptRate = sent > 0 ? (accepted / sent) * 100 : 0;

    const meetingsConfirmed = sessions.filter((s) => s.stage === 'confirmed').length;
    const conversasAtivas = sessions.filter((s) => s.stage === 'qualifying' || s.stage === 'scheduling').length;
    const hotLeads = sessions.filter((s) => (s.lead_score ?? 0) >= 68).length;

    const avgScore = sessions.length > 0
      ? sessions.reduce((acc, s) => acc + (s.lead_score ?? 0), 0) / sessions.length
      : 0;

    const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;

    // Aceites nas últimas 24h
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const accepted24h = leads.filter((l) => {
      if (!l.accepted_at) return false;
      return new Date(l.accepted_at).getTime() >= cutoff;
    }).length;

    return {
      activeCampaigns,
      totalCampaigns: campaigns.length,
      sent,
      accepted,
      acceptRate,
      dmsSent,
      conversasAtivas,
      meetingsConfirmed,
      hotLeads,
      avgScore,
      accepted24h,
    };
  }, [campaigns, leads, sessions]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        title="Campanhas Ativas"
        value={stats.activeCampaigns}
        subtitle={`${stats.totalCampaigns} no total`}
        icon={Activity}
        iconColor="text-blue-600"
      />
      <KpiCard
        title="Convites Enviados"
        value={stats.sent}
        subtitle="acumulado"
        icon={Send}
        iconColor="text-cyan-600"
      />
      <KpiCard
        title="Convites Aceitos"
        value={stats.accepted}
        subtitle={`${stats.acceptRate.toFixed(1)}% de taxa`}
        icon={UserCheck}
        iconColor="text-purple-600"
        trend={
          stats.accepted24h > 0
            ? { dir: 'up', pct: `+${stats.accepted24h} em 24h` }
            : null
        }
      />
      <KpiCard
        title="DMs Pós-Aceite"
        value={stats.dmsSent}
        subtitle="hooks disparados"
        icon={MessageSquare}
        iconColor="text-amber-600"
      />
      <KpiCard
        title="Conversas Ativas"
        value={stats.conversasAtivas}
        subtitle="qualif. + agendando"
        icon={Users}
        iconColor="text-orange-600"
      />
      <KpiCard
        title="Reuniões Confirmadas"
        value={stats.meetingsConfirmed}
        subtitle="stage = confirmed"
        icon={Calendar}
        iconColor="text-green-600"
      />
      <KpiCard
        title="Leads Quentes"
        value={stats.hotLeads}
        subtitle="score ≥ 68"
        icon={Flame}
        iconColor="text-red-500"
      />
      <KpiCard
        title="Score Médio"
        value={stats.avgScore.toFixed(0)}
        subtitle={`em ${stats.conversasAtivas + stats.meetingsConfirmed} conversas`}
        icon={TrendingUp}
        iconColor="text-indigo-600"
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. Funil de conversão (BarChart horizontal)
// ──────────────────────────────────────────────────────────────────────────────

function ConversionFunnel({
  leads,
  sessions,
}: {
  leads: AllLeadsRow[];
  sessions: LinkedInSession[];
}) {
  const data = useMemo(() => {
    const byStatus = leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    const sent = (byStatus.invite_sent ?? 0) + (byStatus.invite_accepted ?? 0) + (byStatus.sent ?? 0);
    const accepted = (byStatus.invite_accepted ?? 0) + (byStatus.sent ?? 0);
    const dms = byStatus.sent ?? 0;
    const inQual = sessions.filter((s) => s.stage === 'qualifying' || s.stage === 'scheduling').length;
    const meetings = sessions.filter((s) => s.stage === 'confirmed').length;

    return [
      { stage: 'Convites enviados', value: sent, pct: '100%' },
      {
        stage: 'Convites aceitos',
        value: accepted,
        pct: sent > 0 ? `${((accepted / sent) * 100).toFixed(1)}%` : '—',
      },
      {
        stage: 'DM pós-aceite enviada',
        value: dms,
        pct: sent > 0 ? `${((dms / sent) * 100).toFixed(1)}%` : '—',
      },
      {
        stage: 'Em qualificação',
        value: inQual,
        pct: sent > 0 ? `${((inQual / sent) * 100).toFixed(1)}%` : '—',
      },
      {
        stage: 'Reunião confirmada',
        value: meetings,
        pct: sent > 0 ? `${((meetings / sent) * 100).toFixed(1)}%` : '—',
      },
    ];
  }, [leads, sessions]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Funil de Conversão</CardTitle>
        <p className="text-xs text-muted-foreground">
          Do convite à reunião agendada — todas as contas
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 60, bottom: 0, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              type="category"
              dataKey="stage"
              width={140}
              tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, _name, props) => [
                `${value} (${props.payload.pct})`,
                'Leads',
              ]}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={FUNNEL_COLORS[i] ?? FUNNEL_COLORS[0]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. Aceites e DMs por dia (AreaChart)
// ──────────────────────────────────────────────────────────────────────────────

function TimeSeriesChart({
  leads,
  messages,
}: {
  leads: AllLeadsRow[];
  messages: RecentMessageRow[];
}) {
  const data = useMemo(() => {
    const days = lastNDays(14);
    const byDay = new Map<string, { date: string; aceitos: number; dms: number; respostas: number }>();
    days.forEach((d) => byDay.set(d, { date: d, aceitos: 0, dms: 0, respostas: 0 }));

    leads.forEach((l) => {
      if (l.accepted_at) {
        const k = dateKey(l.accepted_at);
        const row = byDay.get(k);
        if (row) row.aceitos += 1;
      }
    });

    messages.forEach((m) => {
      const k = dateKey(m.created_at);
      const row = byDay.get(k);
      if (!row) return;
      if (m.direction === 'outbound') row.dms += 1;
      if (m.direction === 'inbound') row.respostas += 1;
    });

    return days.map((d) => {
      const row = byDay.get(d)!;
      return { ...row, dateLabel: dateLabel(d) };
    });
  }, [leads, messages]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Atividade dos últimos 14 dias</CardTitle>
        <p className="text-xs text-muted-foreground">
          Convites aceitos · DMs enviadas · Respostas recebidas
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="grAceitos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(280, 70%, 60%)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="hsl(280, 70%, 60%)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="grDms" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(43, 96%, 56%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(43, 96%, 56%)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="grResp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="aceitos"
              name="Aceites"
              stroke="hsl(280, 70%, 60%)"
              fill="url(#grAceitos)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="dms"
              name="DMs"
              stroke="hsl(43, 96%, 56%)"
              fill="url(#grDms)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="respostas"
              name="Respostas"
              stroke="hsl(142, 71%, 45%)"
              fill="url(#grResp)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. Breakdown por perfil (Renan/Jaqueline/Pedro lado a lado)
// ──────────────────────────────────────────────────────────────────────────────

interface ProfileStats {
  name: string;
  instance: string;
  campaigns: number;
  sent: number;
  accepted: number;
  acceptRate: number;
  conversasAtivas: number;
  meetings: number;
}

function ProfileBreakdown({
  campaigns,
  leads,
  sessions,
}: {
  campaigns: LinkedInCampaign[];
  leads: AllLeadsRow[];
  sessions: LinkedInSession[];
}) {
  const stats = useMemo<ProfileStats[]>(() => {
    return LINKEDIN_INSTANCES.map((instance) => {
      const profileName = INSTANCE_PROFILE_MAP[instance] ?? instance;
      const camps = campaigns.filter((c) => c.linkedin_account_id === instance);
      const campIds = new Set(camps.map((c) => c.id));
      const profileLeads = leads.filter((l) => campIds.has(l.campaign_id));

      const sent =
        profileLeads.filter((l) => l.status === 'invite_sent').length +
        profileLeads.filter((l) => l.status === 'invite_accepted').length +
        profileLeads.filter((l) => l.status === 'sent').length;
      const accepted =
        profileLeads.filter((l) => l.status === 'invite_accepted').length +
        profileLeads.filter((l) => l.status === 'sent').length;

      const profileSessions = sessions.filter((s) => s.instance === instance);
      const conversasAtivas = profileSessions.filter(
        (s) => s.stage === 'qualifying' || s.stage === 'scheduling'
      ).length;
      const meetings = profileSessions.filter((s) => s.stage === 'confirmed').length;

      return {
        name: profileName,
        instance,
        campaigns: camps.length,
        sent,
        accepted,
        acceptRate: sent > 0 ? (accepted / sent) * 100 : 0,
        conversasAtivas,
        meetings,
      };
    });
  }, [campaigns, leads, sessions]);

  const chartData = useMemo(
    () =>
      stats.map((s) => ({
        name: s.name,
        Convites: s.sent,
        Aceites: s.accepted,
        Reuniões: s.meetings,
        fill: PROFILE_COLORS[s.name] ?? 'hsl(var(--primary))',
      })),
    [stats]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Performance por perfil</CardTitle>
        <p className="text-xs text-muted-foreground">
          Comparativo entre Renan, Jaqueline e Pedro
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cards lado a lado */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {stats.map((s) => (
            <div
              key={s.instance}
              className="rounded-lg border border-border p-3 space-y-2 hover:bg-muted/30 transition-colors"
              style={{
                borderLeftColor: PROFILE_COLORS[s.name] ?? 'hsl(var(--primary))',
                borderLeftWidth: 3,
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{s.name}</p>
                <Badge variant="outline" className="text-[10px]">
                  {s.campaigns} campanha{s.campaigns !== 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide">
                    Enviados
                  </p>
                  <p className="text-base font-semibold">{s.sent}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide">
                    Aceitos
                  </p>
                  <p className="text-base font-semibold">
                    {s.accepted}
                    <span className="text-[10px] text-muted-foreground ml-1">
                      ({s.acceptRate.toFixed(0)}%)
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide">
                    Conversas
                  </p>
                  <p className="text-base font-semibold">{s.conversasAtivas}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide">
                    Reuniões
                  </p>
                  <p className="text-base font-semibold text-green-600">{s.meetings}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico comparativo */}
        <div className="pt-2 border-t border-border">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Convites" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Aceites" fill="hsl(280, 70%, 60%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Reuniões" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. Feed de atividade recente
// ──────────────────────────────────────────────────────────────────────────────

function ActivityFeed({ messages }: { messages: RecentMessageRow[] }) {
  const items = messages.slice(0, 12);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Atividade recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Sem atividade recente nos últimos minutos.
          </p>
        ) : (
          <ul className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {items.map((m) => {
              const profile = INSTANCE_PROFILE_MAP[m.instance ?? ''] ?? '—';
              const color = PROFILE_COLORS[profile] ?? 'hsl(var(--muted-foreground))';
              const icon = m.direction === 'outbound' ? Send : Mail;
              const Icon = icon;
              return (
                <li
                  key={m.id}
                  className="flex items-start gap-2.5 text-xs border-b border-border/50 pb-2 last:border-b-0"
                >
                  <div className="mt-0.5 p-1 rounded bg-muted shrink-0">
                    <Icon className="w-3 h-3" style={{ color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">
                        <span style={{ color }}>{profile}</span>{' '}
                        <span className="text-muted-foreground font-normal">
                          {m.direction === 'outbound' ? 'enviou' : 'recebeu'}
                        </span>
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {relativeTime(m.created_at)}
                      </span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 mt-0.5">
                      {(m.text ?? '—').slice(0, 140)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Componente principal: OverviewTab
// ──────────────────────────────────────────────────────────────────────────────

export function OverviewTab() {
  const { data: campaigns = [], isLoading: campaignsLoading } = useLinkedInCampaigns();
  const { data: leads = [], isLoading: leadsLoading } = useAllCampaignLeads();
  const { data: sessions = [], isLoading: sessionsLoading } = useLinkedInConversations();
  const { data: messages = [] } = useRecentMessages(40);

  const isLoading = campaignsLoading || leadsLoading || sessionsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ActiveCampaignsBanner campaigns={campaigns} />
      <KpiGrid campaigns={campaigns} leads={leads} sessions={sessions} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ConversionFunnel leads={leads} sessions={sessions} />
        <TimeSeriesChart leads={leads} messages={messages} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ProfileBreakdown campaigns={campaigns} leads={leads} sessions={sessions} />
        </div>
        <ActivityFeed messages={messages} />
      </div>

      <div className="flex items-center justify-center py-3">
        <Badge variant="outline" className="text-[10px] gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-green-600" />
          Auto-refresh: 60s · {sessions.length} conversas · {leads.length} leads em campanhas
        </Badge>
      </div>
    </div>
  );
}
