import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Building2, TrendingUp, Clock, AlertTriangle } from 'lucide-react';

interface AdminEconomicsSnapshot {
  totalOrgs: number;
  activeOrgs: number;
  trialOrgs: number;
  expiredTrialOrgs: number;
  byPlan: Array<{ plan_id: number; plan_name: string; org_count: number }>;
  createdLast30d: number;
  oldestOrgDate: string | null;
}

/**
 * E11.S3 — Métricas unit economics da Pinn (como empresa SaaS).
 *
 * Diferente de /client/:orgId/unit-economics (CAC/LTV do CLIENTE), esta tela
 * mostra a operação da PRÓPRIA Pinn: quantas orgs hoje, distribuição de planos,
 * trial vs pago, idade do portfólio. Todos os números vêm direto do banco —
 * nada mockado.
 */
const AdminUnitEconomics = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-unit-economics'],
    queryFn: async (): Promise<AdminEconomicsSnapshot> => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [orgsRes, plansRes] = await Promise.all([
        supabase
          .from('organizations')
          .select('id, plan, status, trial_ends_at, created_at')
          .order('created_at', { ascending: true }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('plans').select('id, name'),
      ]);

      if (orgsRes.error) throw orgsRes.error;
      const orgs = orgsRes.data ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plans: Array<{ id: number; name: string }> = (plansRes.data ?? []) as any;
      const planNameById = new Map<number, string>(plans.map((p) => [Number(p.id), String(p.name)]));

      const total = orgs.length;
      const active = orgs.filter((o) => o.status === 'active').length;
      const trial = orgs.filter((o) => o.status === 'trial').length;
      const expiredTrial = orgs.filter(
        (o) => o.status === 'trial' && o.trial_ends_at && new Date(o.trial_ends_at) < now,
      ).length;
      const createdLast30d = orgs.filter(
        (o) => o.created_at && new Date(o.created_at).toISOString() >= thirtyDaysAgo,
      ).length;

      const planCounts = new Map<number, number>();
      for (const o of orgs) {
        const p = Number(o.plan ?? 0);
        planCounts.set(p, (planCounts.get(p) ?? 0) + 1);
      }
      const byPlan = Array.from(planCounts.entries())
        .map(([plan_id, org_count]) => ({
          plan_id,
          plan_name: planNameById.get(plan_id) ?? `Plano #${plan_id}`,
          org_count,
        }))
        .sort((a, b) => b.org_count - a.org_count);

      return {
        totalOrgs: total,
        activeOrgs: active,
        trialOrgs: trial,
        expiredTrialOrgs: expiredTrial,
        byPlan,
        createdLast30d,
        oldestOrgDate: orgs[0]?.created_at ?? null,
      };
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-500" />
            <p className="text-sm">Não foi possível carregar as métricas. Tente recarregar a página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Unit Economics da Pinn</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Snapshot da operação da Pinn como empresa SaaS — todas as métricas vêm direto das tabelas <code>organizations</code> e <code>plans</code>.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile label="Organizações totais" value={data.totalOrgs} icon={Building2} />
        <KpiTile label="Ativas" value={data.activeOrgs} icon={TrendingUp} accent="emerald" />
        <KpiTile label="Em trial" value={data.trialOrgs} icon={Clock} accent="amber" />
        <KpiTile
          label="Trial expirado"
          value={data.expiredTrialOrgs}
          icon={AlertTriangle}
          accent={data.expiredTrialOrgs > 0 ? 'red' : 'neutral'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição por plano</CardTitle>
          <CardDescription>
            Quantas organizações em cada plano vendido. Base para estimar MRR quando preço por plano for atribuído.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.byPlan.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center italic">Nenhuma organização cadastrada ainda.</p>
          ) : (
            <ul className="space-y-3">
              {data.byPlan.map((p) => {
                const pct = data.totalOrgs > 0 ? (p.org_count / data.totalOrgs) * 100 : 0;
                return (
                  <li key={p.plan_id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{p.plan_name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {p.org_count} org{p.org_count === 1 ? '' : 's'} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Crescimento (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{data.createdLast30d}</p>
            <p className="text-xs text-muted-foreground mt-1">novas organizações no período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Org mais antiga</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-semibold">
              {data.oldestOrgDate
                ? new Date(data.oldestOrgDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">data de cadastro da org mais antiga em produção</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const KpiTile = ({
  label,
  value,
  icon: Icon,
  accent = 'neutral',
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent?: 'neutral' | 'emerald' | 'amber' | 'red';
}) => {
  const accentClass = {
    neutral: 'bg-muted text-muted-foreground',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-destructive/10 text-destructive',
  }[accent];
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{value.toLocaleString('pt-BR')}</p>
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accentClass}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminUnitEconomics;
