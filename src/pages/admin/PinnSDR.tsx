import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RefreshCw, Users, Mail, MessageSquare, Target, TrendingUp,
  Linkedin, BarChart3, Activity, Loader2, Zap, Briefcase, Phone,
  CheckCircle, Clock, DollarSign, ListChecks
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line
} from 'recharts';
import { toast } from 'sonner';

const usePinnOrgId = () => {
  return useQuery({
    queryKey: ['pinn-org-id'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id')
        .ilike('name', '%pinn%')
        .limit(1)
        .single();
      if (error) throw error;
      return data.id;
    },
  });
};

const useSnapshots = (orgId: string | undefined, table: 'cmh_sync_snapshots' | 'ploomes_sync_snapshots') => {
  return useQuery({
    queryKey: [table, orgId],
    queryFn: async () => {
      if (!orgId) return null;

      if (table === 'cmh_sync_snapshots') {
        const { data, error } = await supabase
          .from('cmh_sync_snapshots')
          .select('*')
          .eq('org_id', orgId)
          .order('synced_at', { ascending: false });
        if (error) throw error;
        const snapshots: Record<string, any> = {};
        for (const row of data || []) {
          if (!snapshots[row.snapshot_type]) snapshots[row.snapshot_type] = row;
        }
        return snapshots;
      }

      // ploomes - use raw fetch since types aren't generated yet
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/ploomes_sync_snapshots?org_id=eq.${orgId}&order=synced_at.desc`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch ploomes snapshots');
      const rows: any[] = await res.json();
      const snapshots: Record<string, any> = {};
      for (const row of rows) {
        if (!snapshots[row.snapshot_type]) snapshots[row.snapshot_type] = row;
      }
      return snapshots;
    },
    enabled: !!orgId,
    refetchInterval: 5 * 60 * 1000,
  });
};

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const MetricCard = ({
  title, value, icon: Icon, color, small = false, subtitle,
}: {
  title: string; value: string | number; icon: any; color: string; small?: boolean; subtitle?: string;
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

// ==================== Cold Mail Tab ====================
const ColdMailTab = ({ snapshots, syncing, onSync }: { snapshots: any; syncing: boolean; onSync: () => void }) => {
  const stats = snapshots?.stats?.data?.stats;
  const campaigns = snapshots?.campaigns?.data?.campaigns || [];
  const pipeline = snapshots?.pipeline?.data?.pipeline;
  const linkedinMetrics = snapshots?.linkedin_metrics?.data?.linkedin_metrics;
  const timeline = snapshots?.timeline?.data?.timeline || [];
  const lastSync = snapshots?.stats?.synced_at;

  const pipelineStageData = pipeline?.by_stage
    ? Object.entries(pipeline.by_stage).map(([name, value]) => ({
        name: name.replace('_', ' ').replace(/^\w/, (c: string) => c.toUpperCase()),
        value: value as number,
      }))
    : [];

  const temperatureData = pipeline?.by_temperature
    ? Object.entries(pipeline.by_temperature).map(([name, value]) => ({
        name: name.replace(/^\w/, (c: string) => c.toUpperCase()),
        value: value as number,
      }))
    : [];

  const pipelineFunnelData = pipeline?.by_funnel_stage
    ? Object.entries(pipeline.by_funnel_stage).map(([name, value]) => ({
        name: name.replace(/^\w/, (c: string) => c.toUpperCase()),
        value: value as number,
      }))
    : [];

  const timelineFiltered = timeline.filter(
    (d: any) => d.leads > 0 || d.emails > 0 || d.linkedin_actions > 0
  );

  if (!stats) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Zap className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhum dado do Cold Mail sincronizado.</p>
          <Button className="mt-4" onClick={onSync} disabled={syncing}>
            {syncing ? 'Sincronizando...' : 'Fazer primeiro sync'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {lastSync && (
        <p className="text-xs text-muted-foreground">
          Último sync: {new Date(lastSync).toLocaleString('pt-BR')}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Campanhas" value={stats.campaigns} icon={Target} color="text-primary" />
        <MetricCard title="Leads" value={stats.leads?.toLocaleString('pt-BR')} icon={Users} color="text-chart-2" />
        <MetricCard title="Emails Gerados" value={stats.generated_emails?.toLocaleString('pt-BR')} icon={Mail} color="text-chart-3" />
        <MetricCard title="Listas de Leads" value={stats.lead_lists} icon={BarChart3} color="text-chart-4" />
      </div>

      {linkedinMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard title="Mensagens Enviadas" value={linkedinMetrics.messages_sent} icon={MessageSquare} color="text-chart-3" small />
          <MetricCard title="Total Mensagens" value={linkedinMetrics.messages_total} icon={MessageSquare} color="text-chart-2" small />
          <MetricCard title="Respostas" value={linkedinMetrics.replies} icon={Linkedin} color="text-chart-2" small />
          <MetricCard title="Taxa de Reply" value={`${linkedinMetrics.reply_rate}%`} icon={TrendingUp} color="text-primary" small />
          <MetricCard title="Convites Aceitos" value={linkedinMetrics.invites_accepted} icon={Users} color="text-chart-4" small />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pipelineStageData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline por Estágio</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={pipelineStageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {temperatureData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Distribuição de Temperatura</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={temperatureData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {temperatureData.map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {timelineFiltered.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Timeline de Atividade (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={timelineFiltered}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} labelFormatter={(v) => new Date(v).toLocaleDateString('pt-BR')} />
                <Area type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.15)" strokeWidth={2} />
                <Area type="monotone" dataKey="emails" name="Emails" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2)/0.1)" strokeWidth={2} />
                <Area type="monotone" dataKey="linkedin_messages" name="LinkedIn" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3)/0.1)" strokeWidth={2} />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {campaigns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Canais</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Emails</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Criada em</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c: any) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">{c.name}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant={c.status === 'complete' ? 'default' : 'secondary'} className="text-xs">{c.status}</Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1">
                          {c.channels?.map((ch: string) => (
                            <Badge key={ch} variant="outline" className="text-xs">{ch}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{c.email_count}</td>
                      <td className="py-2.5 px-3 text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {pipelineFunnelData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Funil de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pipelineFunnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ==================== Ploomes/SDR Tab ====================
const PloomesTab = ({ snapshots, syncing, onSync }: { snapshots: any; syncing: boolean; onSync: () => void }) => {
  const deals = snapshots?.deals?.data?.value || [];
  const stages = snapshots?.deals_stages?.data?.value || [];
  const pipelines = snapshots?.deals_pipelines?.data?.value || [];
  const contacts = snapshots?.contacts?.data?.value || [];
  const tasks = snapshots?.tasks?.data?.value || [];
  const interactions = snapshots?.interaction_records?.data?.value || [];
  const users = snapshots?.users?.data?.value || [];
  const lastSync = snapshots?.deals?.synced_at;

  if (deals.length === 0 && contacts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Briefcase className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhum dado do Ploomes sincronizado.</p>
          <Button className="mt-4" onClick={onSync} disabled={syncing}>
            {syncing ? 'Sincronizando...' : 'Fazer primeiro sync'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Pipeline value — Ploomes uses StatusId: 1=Open, 2=Won, 3=Lost
  const totalPipelineValue = deals.reduce((acc: number, d: any) => acc + (d.Amount || 0), 0);
  const wonDeals = deals.filter((d: any) => d.StatusId === 2);
  const lostDeals = deals.filter((d: any) => d.StatusId === 3);
  const openDeals = deals.filter((d: any) => d.StatusId === 1);
  const wonValue = wonDeals.reduce((acc: number, d: any) => acc + (d.Amount || 0), 0);

  // Deals by stage
  const stageMap: Record<number, string> = {};
  stages.forEach((s: any) => { stageMap[s.Id] = s.Name; });

  const dealsByStage: Record<string, number> = {};
  openDeals.forEach((d: any) => {
    const stageName = stageMap[d.StageId] || `Stage ${d.StageId}`;
    dealsByStage[stageName] = (dealsByStage[stageName] || 0) + 1;
  });
  const stageChartData = Object.entries(dealsByStage).map(([name, value]) => ({ name, value }));

  // Deals by pipeline
  const pipelineMap: Record<number, string> = {};
  pipelines.forEach((p: any) => { pipelineMap[p.Id] = p.Name; });

  const dealsByPipeline: Record<string, { count: number; value: number }> = {};
  deals.forEach((d: any) => {
    const pName = pipelineMap[d.PipelineId] || `Pipeline ${d.PipelineId}`;
    if (!dealsByPipeline[pName]) dealsByPipeline[pName] = { count: 0, value: 0 };
    dealsByPipeline[pName].count += 1;
    dealsByPipeline[pName].value += d.Amount || 0;
  });
  const pipelineChartData = Object.entries(dealsByPipeline).map(([name, data]) => ({
    name,
    deals: data.count,
    valor: data.value,
  }));

  // Deals by user (SDR performance)
  const userMap: Record<number, string> = {};
  users.forEach((u: any) => { userMap[u.Id] = u.Name || u.Email || `User ${u.Id}`; });

  const dealsByUser: Record<string, { total: number; won: number; value: number }> = {};
  deals.forEach((d: any) => {
    const uName = userMap[d.OwnerId] || `SDR ${d.OwnerId}`;
    if (!dealsByUser[uName]) dealsByUser[uName] = { total: 0, won: 0, value: 0 };
    dealsByUser[uName].total += 1;
    if (d.StatusId === 2) dealsByUser[uName].won += 1;
    dealsByUser[uName].value += d.Amount || 0;
  });
  const sdrPerformance = Object.entries(dealsByUser)
    .map(([name, data]) => ({
      name,
      total: data.total,
      ganhos: data.won,
      valor: data.value,
      taxa: data.total > 0 ? Math.round((data.won / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.valor - a.valor);

  // Tasks stats
  const pendingTasks = tasks.filter((t: any) => !t.Finished);
  const completedTasks = tasks.filter((t: any) => t.Finished);

  // Recent deals — deduplicate by contact+pipeline, keep the most recent per unique combo
  const deduped = (() => {
    const seen = new Set<string>();
    const sorted = [...deals].sort((a: any, b: any) => new Date(b.CreateDate).getTime() - new Date(a.CreateDate).getTime());
    const result: any[] = [];
    for (const d of sorted) {
      const key = `${d.ContactId || d.Title}-${d.PipelineId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(d);
      if (result.length >= 15) break;
    }
    return result;
  })();

  return (
    <div className="space-y-6">
      {lastSync && (
        <p className="text-xs text-muted-foreground">
          Último sync: {new Date(lastSync).toLocaleString('pt-BR')}
        </p>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard title="Negócios Abertos" value={openDeals.length} icon={Briefcase} color="text-primary" />
        <MetricCard title="Valor Pipeline" value={`R$ ${(totalPipelineValue / 1000).toFixed(0)}k`} icon={DollarSign} color="text-chart-2" />
        <MetricCard title="Ganhos" value={wonDeals.length} icon={CheckCircle} color="text-chart-2" subtitle={`R$ ${(wonValue / 1000).toFixed(0)}k`} />
        <MetricCard title="Perdidos" value={lostDeals.length} icon={Target} color="text-destructive" />
        <MetricCard title="Contatos" value={contacts.length} icon={Users} color="text-chart-3" />
        <MetricCard title="Tarefas Pendentes" value={pendingTasks.length} icon={ListChecks} color="text-chart-4" subtitle={`${completedTasks.length} concluídas`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deals by Stage */}
        {stageChartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Negócios por Estágio</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stageChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Pipeline Distribution */}
        {pipelineChartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Negócios por Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={pipelineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Bar dataKey="deals" name="Deals" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* SDR Performance Table */}
      {sdrPerformance.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Performance por SDR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">SDR</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Total Negócios</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Ganhos</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Taxa Conversão</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sdrPerformance.map((sdr) => (
                    <tr key={sdr.name} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">{sdr.name}</td>
                      <td className="py-2.5 px-3 text-foreground">{sdr.total}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="default" className="text-xs">{sdr.ganhos}</Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant={sdr.taxa >= 30 ? 'default' : 'secondary'} className="text-xs">{sdr.taxa}%</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-foreground font-medium">
                        R$ {sdr.valor.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Deals — deduplicated */}
      {deduped.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Negócios Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Contato</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Pipeline</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Estágio</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Valor</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Criado</th>
                  </tr>
                </thead>
                <tbody>
                  {deduped.map((d: any) => (
                    <tr key={d.Id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground max-w-[200px] truncate">
                        {d.ContactName || d.Title || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-xs">
                        {pipelineMap[d.PipelineId] || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-xs">{stageMap[d.StageId] || '—'}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-foreground">
                        {d.Amount ? `R$ ${d.Amount.toLocaleString('pt-BR')}` : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {d.StatusId === 2 ? <Badge className="text-xs bg-success/10 text-success border-success/20">Ganho</Badge> :
                         d.StatusId === 3 ? <Badge className="text-xs bg-destructive/10 text-destructive border-destructive/20">Perdido</Badge> :
                         <Badge variant="secondary" className="text-xs">Aberto</Badge>}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-xs">
                        {new Date(d.CreateDate).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ==================== Main Dashboard ====================
const PinnSDRDashboard = () => {
  const queryClient = useQueryClient();
  const { data: orgId, isLoading: orgLoading } = usePinnOrgId();
  const { data: cmhSnapshots, isLoading: cmhLoading } = useSnapshots(orgId, 'cmh_sync_snapshots');
  const { data: ploomesSnapshots, isLoading: ploomesLoading } = useSnapshots(orgId, 'ploomes_sync_snapshots');
  const [syncingCmh, setSyncingCmh] = useState(false);
  const [syncingPloomes, setSyncingPloomes] = useState(false);

  const syncCmh = useMutation({
    mutationFn: async () => {
      setSyncingCmh(true);
      const { data, error } = await supabase.functions.invoke('sync-coldmail', {
        body: { org_id: orgId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Cold Mail sync: ${data.synced?.length || 0} ações`);
      queryClient.invalidateQueries({ queryKey: ['cmh_sync_snapshots'] });
      setSyncingCmh(false);
    },
    onError: (err: Error) => {
      toast.error(`Erro CMH: ${err.message}`);
      setSyncingCmh(false);
    },
  });

  const syncPloomes = useMutation({
    mutationFn: async () => {
      setSyncingPloomes(true);
      const { data, error } = await supabase.functions.invoke('sync-ploomes', {
        body: { org_id: orgId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Ploomes sync: ${data.synced?.length || 0} endpoints`);
      queryClient.invalidateQueries({ queryKey: ['ploomes_sync_snapshots'] });
      setSyncingPloomes(false);
    },
    onError: (err: Error) => {
      toast.error(`Erro Ploomes: ${err.message}`);
      setSyncingPloomes(false);
    },
  });

  const isLoading = orgLoading || cmhLoading || ploomesLoading;
  const syncing = syncingCmh || syncingPloomes;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pinn SDR Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Cold Mail + Ploomes CRM · Visão unificada</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => syncCmh.mutate()} disabled={syncing} className="gap-2" size="sm">
            {syncingCmh ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Cold Mail
          </Button>
          <Button onClick={() => syncPloomes.mutate()} disabled={syncing} className="gap-2" size="sm">
            {syncingPloomes ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Ploomes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="ploomes" className="w-full">
        <TabsList>
          <TabsTrigger value="ploomes" className="gap-2">
            <Briefcase className="w-4 h-4" /> SDR / Ploomes
          </TabsTrigger>
          <TabsTrigger value="coldmail" className="gap-2">
            <Mail className="w-4 h-4" /> Cold Mail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ploomes" className="mt-4">
          <PloomesTab snapshots={ploomesSnapshots} syncing={syncingPloomes} onSync={() => syncPloomes.mutate()} />
        </TabsContent>

        <TabsContent value="coldmail" className="mt-4">
          <ColdMailTab snapshots={cmhSnapshots} syncing={syncingCmh} onSync={() => syncCmh.mutate()} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PinnSDRDashboard;
