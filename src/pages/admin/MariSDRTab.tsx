import { useState, useMemo } from 'react';
import { useMariSDR, MariSession } from '@/hooks/useMariSDR';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, CalendarCheck, TrendingUp, Zap,
  MessageSquare, AlertTriangle, RefreshCw, Bot,
  Filter, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useQueryClient } from '@tanstack/react-query';

// ─── Paleta ───────────────────────────────────────────────────────────────────

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#6366f1',
  '#ec4899',
];

// ─── MetricCard ───────────────────────────────────────────────────────────────

const MetricCard = ({
  title, value, icon: Icon, color, subtitle, trend,
}: {
  title: string; value: string | number; icon: any;
  color: string; subtitle?: string; trend?: string;
}) => (
  <Card className="shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl border border-border/60 group">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
          <p className="font-bold text-foreground text-2xl leading-tight">{value ?? '—'}</p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <p className="text-[11px] font-medium text-emerald-500">{trend}</p>
          )}
        </div>
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-105 transition-transform">
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ─── Labels ───────────────────────────────────────────────────────────────────

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

const urgencyLabel: Record<string, string> = {
  critical: 'Crítico',
  high:     'Alto',
  medium:   'Médio',
  low:      'Baixo',
};

const urgencyColor: Record<string, string> = {
  critical: 'text-red-500',
  high:     'text-orange-500',
  medium:   'text-yellow-500',
  low:      'text-muted-foreground',
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs text-muted-foreground">
          {p.name || 'Qtd'}: <span className="font-semibold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ─── Period filter helper ─────────────────────────────────────────────────────

function filterByPeriod(sessions: MariSession[], period: string): MariSession[] {
  if (period === 'all') return sessions;
  const now = new Date();
  const cutoff = new Date();
  switch (period) {
    case '7d':  cutoff.setDate(now.getDate() - 7); break;
    case '14d': cutoff.setDate(now.getDate() - 14); break;
    case '30d': cutoff.setDate(now.getDate() - 30); break;
    case '90d': cutoff.setDate(now.getDate() - 90); break;
    default: return sessions;
  }
  return sessions.filter(s => new Date(s.created_at) >= cutoff);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export const MariSDRTab = () => {
  const { data, isLoading, isError, refetch, isFetching } = useMariSDR();
  const queryClient = useQueryClient();

  // Filtros
  const [period, setPeriod] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');

  const hasFilters = period !== 'all' || stageFilter !== 'all' || urgencyFilter !== 'all' || sectorFilter !== 'all';

  const clearFilters = () => {
    setPeriod('all');
    setStageFilter('all');
    setUrgencyFilter('all');
    setSectorFilter('all');
  };

  // Sessões filtradas
  const filteredSessions = useMemo(() => {
    if (!data) return [];
    let sessions = data.recentSessions.length > 0 ? data.recentSessions : [];
    // Usamos os dados completos do hook (até 500 sessões)
    // O hook já retorna recentSessions como slice(0,50), mas as métricas são do total
    // Para filtros, reutilizamos recentSessions como amostra visual

    sessions = filterByPeriod(sessions, period);
    if (stageFilter !== 'all') sessions = sessions.filter(s => s.stage === stageFilter);
    if (urgencyFilter !== 'all') sessions = sessions.filter(s => s.urgency_level === urgencyFilter);
    if (sectorFilter !== 'all') sessions = sessions.filter(s => {
      const key = s.sector?.split(/[,\/]/)[0]?.trim()?.slice(0, 30) || '';
      return key === sectorFilter;
    });
    return sessions;
  }, [data, period, stageFilter, urgencyFilter, sectorFilter]);

  // Métricas derivadas dos filtrados
  const filteredMetrics = useMemo(() => {
    const s = filteredSessions;
    const total = s.length;
    const confirmed = s.filter(x => x.stage === 'confirmed').length;
    const qualifying = s.filter(x => x.stage === 'qualifying').length;
    const scheduling = s.filter(x => x.stage === 'scheduling').length;
    const hotLeads = s.filter(x => x.lead_score >= 68).length;
    const followUpActive = s.filter(x => (x.follow_up_count ?? 0) > 0 &&
      !['confirmed','cancelled','handoff','optout'].includes(x.stage)).length;
    const handoff = s.filter(x => x.stage === 'handoff').length;
    const scores = s.map(x => x.lead_score ?? 0).filter(n => n > 0);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const optout = s.filter(x => x.stage === 'optout').length;
    const cancelled = s.filter(x => x.stage === 'cancelled').length;
    const active = total - optout - cancelled;
    const conversionRate = active > 0 ? Math.round((confirmed / active) * 100) : 0;

    // By stage
    const stageCounts: Record<string, number> = {};
    s.forEach(x => { stageCounts[x.stage] = (stageCounts[x.stage] || 0) + 1; });
    const byStage = Object.entries(stageCounts)
      .map(([stage, count]) => ({ stage: stageLabel[stage] || stage, count }))
      .sort((a, b) => b.count - a.count);

    // By sector
    const sectorCounts: Record<string, number> = {};
    s.forEach(x => {
      if (x.sector) {
        const key = x.sector.split(/[,\/]/)[0].trim().slice(0, 30);
        sectorCounts[key] = (sectorCounts[key] || 0) + 1;
      }
    });
    const bySector = Object.entries(sectorCounts)
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count).slice(0, 8);

    // By urgency
    const urgencyCounts: Record<string, number> = {};
    s.forEach(x => {
      if (x.urgency_level) urgencyCounts[x.urgency_level] = (urgencyCounts[x.urgency_level] || 0) + 1;
    });
    const urgencyOrder = ['critical', 'high', 'medium', 'low'];
    const byUrgency = urgencyOrder
      .filter(u => urgencyCounts[u])
      .map(u => ({ level: urgencyLabel[u] || u, count: urgencyCounts[u] }));

    return {
      total, confirmed, qualifying, scheduling, hotLeads,
      followUpActive, handoff, avgScore, conversionRate,
      byStage, bySector, byUrgency,
    };
  }, [filteredSessions]);

  // Setores únicos para filtro
  const availableSectors = useMemo(() => {
    if (!data) return [];
    return data.bySector.map(s => s.sector);
  }, [data]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['mari-sdr-metrics'] });
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 mx-auto text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando dados da Mari...</p>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-dashed border-destructive/40 rounded-2xl">
        <CardContent className="py-12 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 mx-auto text-destructive/60" />
          <p className="text-muted-foreground text-sm">
            Não foi possível carregar dados da Mari SDR.
          </p>
          <p className="text-xs text-muted-foreground">
            Verifique os secrets <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">MARI_SUPABASE_URL</code> e{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">MARI_SUPABASE_KEY</code> nas Edge Functions.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 mt-2">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const m = filteredMetrics;

  return (
    <div className="space-y-6">

      {/* ── Header + Filtros ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {m.total} sessões
              {hasFilters && <span className="text-muted-foreground font-normal"> (filtrado)</span>}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Atualização automática a cada 2 min
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo período</SelectItem>
              <SelectItem value="7d">Últimos 7d</SelectItem>
              <SelectItem value="14d">Últimos 14d</SelectItem>
              <SelectItem value="30d">Últimos 30d</SelectItem>
              <SelectItem value="90d">Últimos 90d</SelectItem>
            </SelectContent>
          </Select>

          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os stages</SelectItem>
              <SelectItem value="qualifying">Qualificando</SelectItem>
              <SelectItem value="scheduling">Agendando</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="rescheduling">Reagendando</SelectItem>
              <SelectItem value="handoff">Handoff</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="optout">Optout</SelectItem>
            </SelectContent>
          </Select>

          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Urgência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda urgência</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
              <SelectItem value="medium">Médio</SelectItem>
              <SelectItem value="low">Baixo</SelectItem>
            </SelectContent>
          </Select>

          {availableSectors.length > 0 && (
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {availableSectors.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive">
              <X className="w-3 h-3" /> Limpar
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isFetching} className="gap-1.5 h-8 text-xs ml-auto">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de leads"
          value={m.total}
          icon={Users}
          color="text-primary"
        />
        <MetricCard
          title="Reuniões confirmadas"
          value={m.confirmed}
          icon={CalendarCheck}
          color="text-emerald-500"
          subtitle={`${m.conversionRate}% de conversão`}
        />
        <MetricCard
          title="Leads quentes"
          value={m.hotLeads}
          icon={Zap}
          color="text-orange-500"
          subtitle="score ≥ 68"
        />
        <MetricCard
          title="Score médio"
          value={`${m.avgScore}`}
          icon={TrendingUp}
          color="text-primary"
          subtitle="de 100 pontos"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Qualificando"
          value={m.qualifying}
          icon={MessageSquare}
          color="text-blue-500"
        />
        <MetricCard
          title="Agendando"
          value={m.scheduling}
          icon={CalendarCheck}
          color="text-violet-500"
        />
        <MetricCard
          title="Follow-ups ativos"
          value={m.followUpActive}
          icon={RefreshCw}
          color="text-amber-500"
          subtitle="em reengajamento"
        />
        <MetricCard
          title="Handoff p/ humano"
          value={m.handoff}
          icon={Users}
          color="text-muted-foreground"
        />
      </div>

      {/* ── Charts Row 1: Stage + Urgência lado a lado ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil por stage */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Leads por Stage</CardTitle>
          </CardHeader>
          <CardContent>
            {m.byStage.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={m.byStage} layout="vertical" margin={{ left: 4, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Leads" radius={[0, 6, 6, 0]}>
                    {m.byStage.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Distribuição de urgência */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Distribuição de Urgência</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {m.byUrgency.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={m.byUrgency}
                    dataKey="count"
                    nameKey="level"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={42}
                    paddingAngle={3}
                    label={({ level, percent }) =>
                      `${level} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {m.byUrgency.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={30}
                    formatter={(value: string) => (
                      <span className="text-xs text-muted-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Chart Row 2: Setor (full width) ──────────────────────── */}
      {m.bySector.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Leads por Setor</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={m.bySector} layout="vertical" margin={{ left: 4, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="sector" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={120} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Leads" radius={[0, 6, 6, 0]}>
                  {m.bySector.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Tabela de leads recentes ─────────────────────────────── */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Leads Recentes
            <span className="ml-2 font-normal text-xs text-muted-foreground">
              ({filteredSessions.length} {hasFilters ? 'filtrados' : 'mais recentes'})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Lead</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Empresa</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Setor</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Stage</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Score</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Urgência</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">FU</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Desde</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                      <Filter className="w-5 h-5 mx-auto mb-2 opacity-40" />
                      Nenhum lead encontrado com os filtros aplicados.
                    </td>
                  </tr>
                )}
                {filteredSessions.map((s: MariSession) => (
                  <tr
                    key={s.session_id}
                    className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground truncate max-w-[150px]">
                        {s.lead_name || <span className="text-muted-foreground italic">sem nome</span>}
                      </div>
                      {s.phone && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">{s.phone}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground truncate max-w-[120px]">
                      {s.company || '—'}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground truncate max-w-[110px] text-xs">
                      {s.sector || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={stageVariant[s.stage] || 'secondary'}
                        className="text-[10px] whitespace-nowrap"
                      >
                        {stageLabel[s.stage] || s.stage}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${
                          s.lead_score >= 68 ? 'bg-orange-500' :
                          s.lead_score >= 40 ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                        }`} />
                        <span className={`font-semibold text-xs ${
                          s.lead_score >= 68 ? 'text-orange-500' :
                          s.lead_score >= 40 ? 'text-emerald-500' : 'text-muted-foreground'
                        }`}>
                          {s.lead_score > 0 ? s.lead_score : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-xs font-medium ${urgencyColor[s.urgency_level] || 'text-muted-foreground'}`}>
                        {urgencyLabel[s.urgency_level] || s.urgency_level || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {s.follow_up_count > 0 ? (
                        <Badge variant="outline" className="text-[10px]">
                          {s.follow_up_count}x
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground text-xs whitespace-nowrap">
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
