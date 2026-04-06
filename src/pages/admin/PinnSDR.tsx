import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw, Users, Mail, MessageSquare, Target, TrendingUp,
  Linkedin, BarChart3, Activity, Loader2, Zap
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { toast } from 'sonner';

// Pinn org_id - hardcoded for internal dashboard
const PINN_ORG_ID = 'pinn'; // Will be resolved dynamically

const usePinnOrgId = () => {
  return useQuery({
    queryKey: ['pinn-org-id'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', 'pinn')
        .single();
      if (error) throw error;
      return data.id;
    },
  });
};

const useCmhSnapshots = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ['cmh-snapshots', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('cmh_sync_snapshots')
        .select('*')
        .eq('org_id', orgId)
        .order('synced_at', { ascending: false });
      if (error) throw error;

      const snapshots: Record<string, any> = {};
      for (const row of data || []) {
        if (!snapshots[row.snapshot_type]) {
          snapshots[row.snapshot_type] = row;
        }
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

const PinnSDRDashboard = () => {
  const queryClient = useQueryClient();
  const { data: orgId, isLoading: orgLoading } = usePinnOrgId();
  const { data: snapshots, isLoading: dataLoading } = useCmhSnapshots(orgId);
  const [syncing, setSyncing] = useState(false);

  const syncMutation = useMutation({
    mutationFn: async () => {
      setSyncing(true);
      const { data, error } = await supabase.functions.invoke('sync-coldmail', {
        body: { org_id: orgId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sync concluído: ${data.synced?.length || 0} ações sincronizadas`);
      queryClient.invalidateQueries({ queryKey: ['cmh-snapshots'] });
      setSyncing(false);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao sincronizar: ${err.message}`);
      setSyncing(false);
    },
  });

  const isLoading = orgLoading || dataLoading;
  const stats = snapshots?.stats?.data?.stats;
  const campaigns = snapshots?.campaigns?.data?.campaigns || [];
  const pipeline = snapshots?.pipeline?.data?.pipeline;
  const linkedinMetrics = snapshots?.linkedin_metrics?.data?.linkedin_metrics;
  const timeline = snapshots?.timeline?.data?.timeline || [];
  const lastSync = snapshots?.stats?.synced_at;

  // Pipeline chart data
  const pipelineStageData = pipeline?.by_stage
    ? Object.entries(pipeline.by_stage).map(([name, value]) => ({
        name: name.replace('_', ' ').replace(/^\w/, (c: string) => c.toUpperCase()),
        value: value as number,
      }))
    : [];

  const pipelineFunnelData = pipeline?.by_funnel_stage
    ? Object.entries(pipeline.by_funnel_stage).map(([name, value]) => ({
        name: name.replace(/^\w/, (c: string) => c.toUpperCase()),
        value: value as number,
      }))
    : [];

  const temperatureData = pipeline?.by_temperature
    ? Object.entries(pipeline.by_temperature).map(([name, value]) => ({
        name: name.replace(/^\w/, (c: string) => c.toUpperCase()),
        value: value as number,
      }))
    : [];

  // Timeline filtered (only days with activity)
  const timelineFiltered = timeline.filter(
    (d: any) => d.leads > 0 || d.emails > 0 || d.linkedin_actions > 0
  );

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pinn SDR Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cold Mail Hackers · Dados em tempo real
            {lastSync && (
              <span className="ml-2 text-xs">
                Último sync: {new Date(lastSync).toLocaleString('pt-BR')}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncing}
          className="gap-2"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar
        </Button>
      </div>

      {!stats && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Zap className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhum dado sincronizado ainda.</p>
            <Button className="mt-4" onClick={() => syncMutation.mutate()} disabled={syncing}>
              {syncing ? 'Sincronizando...' : 'Fazer primeiro sync'}
            </Button>
          </CardContent>
        </Card>
      )}

      {stats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Campanhas"
              value={stats.campaigns}
              icon={Target}
              color="text-primary"
            />
            <MetricCard
              title="Leads"
              value={stats.leads?.toLocaleString('pt-BR')}
              icon={Users}
              color="text-emerald-500"
            />
            <MetricCard
              title="Emails Gerados"
              value={stats.generated_emails?.toLocaleString('pt-BR')}
              icon={Mail}
              color="text-blue-500"
            />
            <MetricCard
              title="Listas de Leads"
              value={stats.lead_lists}
              icon={BarChart3}
              color="text-amber-500"
            />
          </div>

          {/* LinkedIn Metrics */}
          {linkedinMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MetricCard title="Mensagens Enviadas" value={linkedinMetrics.messages_sent} icon={MessageSquare} color="text-blue-600" small />
              <MetricCard title="Total Mensagens" value={linkedinMetrics.messages_total} icon={MessageSquare} color="text-blue-400" small />
              <MetricCard title="Respostas" value={linkedinMetrics.replies} icon={Linkedin} color="text-emerald-500" small />
              <MetricCard title="Taxa de Reply" value={`${linkedinMetrics.reply_rate}%`} icon={TrendingUp} color="text-primary" small />
              <MetricCard title="Convites Aceitos" value={linkedinMetrics.invites_accepted} icon={Users} color="text-amber-500" small />
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pipeline by Stage */}
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
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Temperature Distribution */}
            {temperatureData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Distribuição de Temperatura</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={temperatureData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {temperatureData.map((_, idx) => (
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

          {/* Timeline */}
          {timelineFiltered.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Timeline de Atividade (30 dias)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={timelineFiltered}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                      labelFormatter={(v) => new Date(v).toLocaleDateString('pt-BR')}
                    />
                    <Area type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.15)" strokeWidth={2} />
                    <Area type="monotone" dataKey="emails" name="Emails" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2)/0.1)" strokeWidth={2} />
                    <Area type="monotone" dataKey="linkedin_messages" name="LinkedIn" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3)/0.1)" strokeWidth={2} />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Campaigns Table */}
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
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Narrativa</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Criada em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c: any) => (
                        <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-foreground">{c.name}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant={c.status === 'complete' ? 'default' : 'secondary'} className="text-xs">
                              {c.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex gap-1">
                              {c.channels?.map((ch: string) => (
                                <Badge key={ch} variant="outline" className="text-xs">{ch}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{c.email_count}</td>
                          <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[200px] truncate">{c.narrative_name}</td>
                          <td className="py-2.5 px-3 text-muted-foreground text-xs">
                            {new Date(c.created_at).toLocaleDateString('pt-BR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Funnel Stage */}
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
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

// Metric card component
const MetricCard = ({
  title, value, icon: Icon, color, small = false,
}: {
  title: string; value: string | number; icon: any; color: string; small?: boolean;
}) => (
  <Card>
    <CardContent className={small ? 'p-4' : 'p-5'}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{title}</p>
          <p className={`font-bold text-foreground ${small ? 'text-lg mt-1' : 'text-2xl mt-1.5'}`}>
            {value}
          </p>
        </div>
        <div className={`${small ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg bg-muted/50 flex items-center justify-center`}>
          <Icon className={`${small ? 'w-4 h-4' : 'w-5 h-5'} ${color}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default PinnSDRDashboard;
