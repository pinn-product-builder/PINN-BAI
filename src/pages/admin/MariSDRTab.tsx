import { useMariSDR, MariSession } from '@/hooks/useMariSDR';
import { isMariSupabaseConfigured } from '@/integrations/supabase/mariClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, CalendarCheck, TrendingUp, Zap,
  MessageSquare, AlertTriangle, RefreshCw, Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useQueryClient } from '@tanstack/react-query';

// ─── Paleta ───────────────────────────────────────────────────────────────────

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

// ─── MetricCard local (igual ao PinnSDR) ──────────────────────────────────────

const MetricCard = ({
  title, value, icon: Icon, color, small = false, subtitle,
}: {
  title: string; value: string | number; icon: any;
  color: string; small?: boolean; subtitle?: string;
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

// ─── Badges de stage e urgência ───────────────────────────────────────────────

const stageVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  qualifying:   'secondary',
  scheduling:   'default',
  confirmed:    'default',
  rescheduling: 'outline',
  handoff:      'outline',
  cancelled:    'destructive',
  optout:       'destructive',
};

const stageLabel: Record<string, string> = {
  qualifying:   'Qualificando',
  scheduling:   'Agendando',
  confirmed:    '✓ Confirmado',
  rescheduling: 'Reagendando',
  handoff:      'Handoff',
  cancelled:    'Cancelado',
  optout:       'Optout',
};

const urgencyColor: Record<string, string> = {
  critical: 'text-red-500',
  high:     'text-orange-500',
  medium:   'text-yellow-500',
  low:      'text-muted-foreground',
};

// ─── Componente principal ─────────────────────────────────────────────────────

export const MariSDRTab = () => {
  const { data, isLoading, isError, refetch, isFetching } = useMariSDR();
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['mari-sdr-metrics'] });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-dashed border-destructive/40">
        <CardContent className="py-12 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 mx-auto text-destructive/60" />
          <p className="text-muted-foreground text-sm">
            Não foi possível conectar ao Supabase da Mari.
          </p>
          <p className="text-xs text-muted-foreground">
            Verifique <code className="bg-muted px-1 rounded">VITE_MARI_SUPABASE_URL</code> e{' '}
            <code className="bg-muted px-1 rounded">VITE_MARI_SUPABASE_KEY</code> no <code>.env</code>.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 mt-2">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isMariSupabaseConfigured) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center space-y-3">
          <Bot className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Mari SDR não está configurado neste ambiente.</p>
          <p className="text-xs text-muted-foreground">
            Defina <code className="bg-muted px-1 rounded">VITE_MARI_SUPABASE_URL</code> e{' '}
            <code className="bg-muted px-1 rounded">VITE_MARI_SUPABASE_KEY</code> no <code>.env</code> e reinicie o{' '}
            <code className="bg-muted px-1 rounded">npm run dev</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center space-y-3">
          <Bot className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nenhuma sessão encontrada ainda.</p>
          <p className="text-xs text-muted-foreground">
            A Mari ainda não iniciou conversas ou as tabelas estão vazias.
          </p>
        </CardContent>
      </Card>
    );
  }

  const {
    total, qualifying, scheduling, confirmed,
    hotLeads, followUpActive, avgScore, conversionRate,
    byStage, bySector, byUrgency, recentSessions,
  } = data;

  return (
    <div className="space-y-6">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total} sessões · atualiza a cada 2 min
        </p>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isFetching} className="gap-1.5 h-7 text-xs">
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards — linha 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total de leads"
          value={total}
          icon={Users}
          color="text-primary"
        />
        <MetricCard
          title="Reuniões confirmadas"
          value={confirmed}
          icon={CalendarCheck}
          color="text-chart-2"
          subtitle={`${conversionRate}% de conversão`}
        />
        <MetricCard
          title="Leads quentes"
          value={hotLeads}
          icon={Zap}
          color="text-orange-500"
          subtitle="score ≥ 68"
        />
        <MetricCard
          title="Score médio"
          value={`${avgScore}/100`}
          icon={TrendingUp}
          color="text-chart-3"
          small
        />
      </div>

      {/* KPI Cards — linha 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Qualificando"
          value={qualifying}
          icon={MessageSquare}
          color="text-chart-4"
          small
        />
        <MetricCard
          title="Agendando"
          value={scheduling}
          icon={CalendarCheck}
          color="text-chart-5"
          small
        />
        <MetricCard
          title="Follow-ups ativos"
          value={followUpActive}
          icon={RefreshCw}
          color="text-muted-foreground"
          small
          subtitle="em reengajamento"
        />
        <MetricCard
          title="Handoff p/ humano"
          value={data.handoff}
          icon={Users}
          color="text-muted-foreground"
          small
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Funil por stage */}
        {byStage.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Leads por Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byStage} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Por setor */}
        {bySector.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Leads por Setor</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bySector} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="sector" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {bySector.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Distribuição de urgência */}
        {byUrgency.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Urgência dos Leads</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={byUrgency}
                    dataKey="count"
                    nameKey="level"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ level, percent }) =>
                      `${level} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {byUrgency.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabela de leads recentes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Leads Recentes
            <span className="ml-2 font-normal text-xs">({recentSessions.length} mais recentes)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Lead</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Empresa</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Setor</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Stage</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Score</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Urgência</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">FU</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Desde</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s: MariSession) => (
                  <tr
                    key={s.session_id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-foreground truncate max-w-[140px]">
                        {s.lead_name || <span className="text-muted-foreground italic">sem nome</span>}
                      </div>
                      {s.phone && (
                        <div className="text-[10px] text-muted-foreground">{s.phone}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[120px]">
                      {s.company || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[110px]">
                      {s.sector || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant={stageVariant[s.stage] || 'secondary'}
                        className="text-[10px] whitespace-nowrap"
                      >
                        {stageLabel[s.stage] || s.stage}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`font-semibold text-xs ${
                        s.lead_score >= 68 ? 'text-orange-500' :
                        s.lead_score >= 40 ? 'text-chart-2' : 'text-muted-foreground'
                      }`}>
                        {s.lead_score > 0 ? s.lead_score : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs font-medium ${urgencyColor[s.urgency_level] || 'text-muted-foreground'}`}>
                        {s.urgency_level ? s.urgency_level.charAt(0).toUpperCase() + s.urgency_level.slice(1) : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {s.follow_up_count > 0 ? (
                        <Badge variant="outline" className="text-[10px]">
                          {s.follow_up_count}x
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                      {s.created_at
                        ? new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};
