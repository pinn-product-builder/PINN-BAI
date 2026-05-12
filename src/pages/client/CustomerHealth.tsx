import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useHealthScores, useHealthSummary, useCustomerAlerts,
  useComputeHealth, useAcknowledgeAlert, useResolveAlert,
} from '@/hooks/useCustomerHealth';
import type { HealthBand, AlertSeverity } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Heart, AlertTriangle, TrendingUp, TrendingDown,
  Minus, RefreshCw, Loader2, CheckCircle2, Bell,
  Users, Shield, Activity, DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Config ─────────────────────────────────────────────────────────────────────

const BAND_CONFIG: Record<HealthBand, { label: string; color: string; bg: string; border: string }> = {
  saudavel: { label: 'Saudável',  color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  atencao:  { label: 'Atenção',   color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30' },
  risco:    { label: 'Em Risco',  color: 'text-orange-500',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30' },
  critico:  { label: 'Crítico',   color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
};

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; color: string; icon: React.ElementType }> = {
  critical: { label: 'Crítico', color: 'text-destructive',  icon: AlertTriangle },
  warning:  { label: 'Alerta',  color: 'text-amber-500',    icon: AlertTriangle },
  info:     { label: 'Info',    color: 'text-blue-500',     icon: Bell },
};

const TREND_ICONS = {
  up:     { Icon: TrendingUp,   color: 'text-emerald-500' },
  stable: { Icon: Minus,        color: 'text-muted-foreground' },
  down:   { Icon: TrendingDown, color: 'text-destructive' },
};

// ── Score Bar ──────────────────────────────────────────────────────────────────

function ScoreBar({ value, label }: { value: number; label: string }) {
  const color =
    value >= 80 ? 'bg-emerald-500' :
    value >= 60 ? 'bg-amber-500' :
    value >= 40 ? 'bg-orange-500' : 'bg-destructive';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ── Customer Health Card ───────────────────────────────────────────────────────

function HealthCard({ score }: { score: ReturnType<typeof useHealthScores>['data'][0] }) {
  const band = BAND_CONFIG[score.health_band];
  const trend = TREND_ICONS[score.trend ?? 'stable'];

  return (
    <Card className={cn('border transition-all hover:shadow-md', band.border)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{score.customer_name || 'Cliente sem nome'}</p>
            {score.customer_email && (
              <p className="text-xs text-muted-foreground truncate">{score.customer_email}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <trend.Icon className={cn('w-3.5 h-3.5', trend.color)} />
            <Badge className={cn('text-xs font-bold', band.bg, band.color, 'border-0')}>
              {score.health_score}
            </Badge>
          </div>
        </div>

        <Badge variant="outline" className={cn('text-[10px]', band.color, band.border)}>
          {band.label}
        </Badge>

        <div className="space-y-1.5 pt-1">
          <ScoreBar value={score.engagement_score} label="Engajamento" />
          <ScoreBar value={score.revenue_score}    label="Receita" />
          <ScoreBar value={score.momentum_score}   label="Momentum" />
          <ScoreBar value={score.loyalty_score}    label="Lealdade" />
        </div>

        {score.signals?.length > 0 && (
          <div className="pt-1 space-y-1">
            {score.signals.slice(0, 2).map((sig, i) => (
              <p key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span className={SEVERITY_CONFIG[sig.severity]?.color}>●</span>
                {sig.label}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Alert Row ──────────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  orgId,
}: {
  alert: ReturnType<typeof useCustomerAlerts>['data'][0];
  orgId: string;
}) {
  const { toast } = useToast();
  const acknowledge = useAcknowledgeAlert();
  const resolve = useResolveAlert();
  const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info;

  return (
    <div className={cn(
      'flex gap-3 p-3 rounded-lg border transition-all',
      alert.severity === 'critical' ? 'border-destructive/30 bg-destructive/5' :
      alert.severity === 'warning'  ? 'border-amber-500/30 bg-amber-500/5' :
      'border-border/50',
    )}>
      <sev.icon className={cn('w-4 h-4 mt-0.5 shrink-0', sev.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{alert.customer_name}</p>
          <Badge variant="outline" className={cn('text-[10px]', sev.color)}>{sev.label}</Badge>
          {alert.acknowledged && !alert.resolved && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">Visto</Badge>
          )}
        </div>
        <p className="text-xs font-medium mt-0.5">{alert.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{alert.description}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {format(new Date(alert.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        {!alert.acknowledged && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] px-2"
            disabled={acknowledge.isPending}
            onClick={() => acknowledge.mutate({ orgId, alertId: alert.id })}
          >
            Ver
          </Button>
        )}
        {!alert.resolved && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] px-2 text-emerald-600 hover:text-emerald-700"
            disabled={resolve.isPending}
            onClick={() =>
              resolve.mutateAsync({ orgId, alertId: alert.id })
                .then(() => toast({ title: 'Alerta resolvido.' }))
                .catch(() => toast({ variant: 'destructive', title: 'Erro ao resolver.' }))
            }
          >
            <CheckCircle2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CustomerHealth() {
  const { orgId } = useParams<{ orgId: string }>();
  const { toast } = useToast();
  const [bandFilter, setBandFilter] = useState<HealthBand | 'all'>('all');

  const { data: summary, isLoading: loadingSummary } = useHealthSummary(orgId);
  const { data: scores = [], isLoading: loadingScores } = useHealthScores(
    orgId,
    bandFilter !== 'all' ? { band: bandFilter } : undefined,
  );
  const { data: alerts = [], isLoading: loadingAlerts } = useCustomerAlerts(orgId, { severity: undefined });
  const computeHealth = useComputeHealth();

  const handleCompute = async () => {
    if (!orgId) return;
    try {
      const result = await computeHealth.mutateAsync(orgId);
      toast({ title: `Health calculado: ${result.computed} clientes, ${result.alerts} alertas gerados.` });
    } catch {
      toast({ variant: 'destructive', title: 'Falha ao calcular health scores.' });
    }
  };

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical' && !a.resolved);
  const warningAlerts  = alerts.filter((a) => a.severity === 'warning'  && !a.resolved);

  return (
    <div className="p-6 space-y-6 pb-24 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Heart className="w-6 h-6 text-primary" />
            Saúde do Cliente
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão 360° do estado de cada cliente. Alertas proativos antes que você precise perguntar.
          </p>
        </div>
        <Button
          onClick={handleCompute}
          disabled={computeHealth.isPending}
          className="gap-2 shrink-0"
        >
          {computeHealth.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />
          }
          Recalcular Scores
        </Button>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {((['critico', 'risco', 'atencao', 'saudavel'] as HealthBand[])).map((band) => {
            const cfg = BAND_CONFIG[band];
            const count = summary.byBand[band] ?? 0;
            const pct = summary.total > 0 ? Math.round(count / summary.total * 100) : 0;
            return (
              <Card
                key={band}
                className={cn('cursor-pointer transition-all hover:shadow-md', cfg.border,
                  bandFilter === band && `${cfg.bg} border-2`)}
                onClick={() => setBandFilter(bandFilter === band ? 'all' : band)}
              >
                <CardContent className="p-4">
                  <p className={cn('text-xs font-medium uppercase tracking-wider', cfg.color)}>{cfg.label}</p>
                  <p className="text-3xl font-bold mt-1">{count}</p>
                  <p className="text-xs text-muted-foreground">{pct}% da base</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Tabs defaultValue="scores">
        <TabsList>
          <TabsTrigger value="scores" className="gap-2">
            <Users className="w-4 h-4" />
            Clientes ({scores.length})
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="w-4 h-4" />
            Alertas
            {criticalAlerts.length > 0 && (
              <Badge className="ml-1 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0">
                {criticalAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Scores tab */}
        <TabsContent value="scores" className="mt-4">
          {loadingScores ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : scores.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Heart className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum dado de saúde ainda</p>
              <p className="text-sm mt-1">Clique em "Recalcular Scores" para gerar os health scores.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {scores.map((score) => (
                <HealthCard key={score.id} score={score} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Alerts tab */}
        <TabsContent value="alerts" className="mt-4">
          {loadingAlerts ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum alerta ativo</p>
              <p className="text-sm mt-1">Todos os clientes estão em bom estado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {criticalAlerts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-destructive uppercase tracking-wider">
                    Críticos ({criticalAlerts.length})
                  </p>
                  {criticalAlerts.map((a) => <AlertRow key={a.id} alert={a} orgId={orgId!} />)}
                </div>
              )}
              {warningAlerts.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                    Alertas ({warningAlerts.length})
                  </p>
                  {warningAlerts.map((a) => <AlertRow key={a.id} alert={a} orgId={orgId!} />)}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
