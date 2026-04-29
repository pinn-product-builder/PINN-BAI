import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useKpiGoals, useCreateGoal, useDeleteGoal,
  useKpiAlertRules, useCreateAlertRule, useToggleAlertRule, useDeleteAlertRule,
  useKpiTriggers, useCheckKpiThresholds, useResolveKpiTrigger,
  type KpiGoal, type KpiAlertRule,
} from '@/hooks/useKpiGoals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Target, Bell, Plus, Trash2, Loader2, Trophy, AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Config ─────────────────────────────────────────────────────────────────────

const METRIC_OPTIONS = [
  { value: 'conversion_rate',   label: 'Taxa de Conversão (%)', unit: 'percent' as const },
  { value: 'total_leads',       label: 'Total de Leads',        unit: 'number' as const },
  { value: 'total_revenue',     label: 'Receita Total',         unit: 'currency' as const },
  { value: 'avg_ticket',        label: 'Ticket Médio',          unit: 'currency' as const },
  { value: 'cpl',               label: 'CPL (Custo por Lead)',  unit: 'currency' as const },
  { value: 'roas',              label: 'ROAS',                  unit: 'number' as const },
  { value: 'cac',               label: 'CAC',                   unit: 'currency' as const },
  { value: 'ltv_cac_ratio',     label: 'LTV:CAC Ratio',         unit: 'number' as const },
  { value: 'churn_rate',        label: 'Taxa de Churn (%)',      unit: 'percent' as const },
  { value: 'health_score_avg',  label: 'Health Score Médio',    unit: 'number' as const },
];

const OPERATOR_LABELS: Record<string, string> = {
  lt: 'menor que', lte: 'menor ou igual a', gt: 'maior que', gte: 'maior ou igual a', eq: 'igual a',
};

const SEVERITY_CONFIG = {
  info:     { label: 'Info',    color: 'bg-blue-500/10 text-blue-500' },
  warning:  { label: 'Aviso',   color: 'bg-amber-500/10 text-amber-500' },
  critical: { label: 'Crítico', color: 'bg-destructive/10 text-destructive' },
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function formatValue(value: number, unit: string) {
  if (unit === 'currency') return BRL.format(value);
  if (unit === 'percent') return `${NUM.format(value)}%`;
  return NUM.format(value);
}

// ── Goal Card ──────────────────────────────────────────────────────────────────

function GoalCard({ goal, orgId, onDelete }: { goal: KpiGoal; orgId: string; onDelete: () => void }) {
  const progress = goal.current_value != null && goal.target_value > 0
    ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
    : 0;
  const isComplete = progress >= 100;
  const metricLabel = METRIC_OPTIONS.find(m => m.value === goal.metric_key)?.label ?? goal.metric_key;

  return (
    <Card className={cn('transition-all hover:shadow-md', isComplete && 'border-emerald-500/30')}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              {isComplete && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
              <p className="font-semibold text-sm">{goal.name}</p>
            </div>
            <p className="text-xs text-muted-foreground">{metricLabel}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className="text-[10px]">
              {format(new Date(goal.period_start + 'T12:00:00'), 'MMM/yy', { locale: ptBR })}
            </Badge>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {goal.current_value != null ? formatValue(goal.current_value, goal.unit) : '—'}
            </span>
            <span className="font-medium">{formatValue(goal.target_value, goal.unit)}</span>
          </div>
          <Progress value={progress} className={cn('h-2', isComplete && '[&>div]:bg-emerald-500')} />
          <p className="text-[10px] text-right text-muted-foreground">{progress}% da meta</p>
        </div>

        {goal.icon && (
          <div
            className="absolute top-3 right-10 text-lg opacity-10 select-none"
            style={{ color: goal.color }}
          >
            {goal.icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Create Goal Dialog ─────────────────────────────────────────────────────────

function CreateGoalDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const { toast } = useToast();
  const create = useCreateGoal();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().substring(0, 10);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().substring(0, 10);

  const [name, setName] = useState('');
  const [metricKey, setMetricKey] = useState('total_leads');
  const [targetValue, setTargetValue] = useState('');
  const [periodStart, setPeriodStart] = useState(firstDay);
  const [periodEnd, setPeriodEnd] = useState(lastDay);
  const [color, setColor] = useState('#6366f1');

  const selectedMetric = METRIC_OPTIONS.find(m => m.value === metricKey);

  const handleSubmit = async () => {
    if (!name.trim() || !targetValue) return;
    try {
      await create.mutateAsync({
        org_id: orgId,
        name: name.trim(),
        metric_key: metricKey,
        target_value: parseFloat(targetValue),
        current_value: null,
        unit: selectedMetric?.unit ?? 'number',
        period_type: 'month',
        period_start: periodStart,
        period_end: periodEnd,
        icon: null,
        color,
      } as any);
      toast({ title: 'Meta criada!' });
      onClose();
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao criar meta.' });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-4 h-4" /> Nova Meta
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome da meta</Label>
            <Input placeholder="Ex: Gerar 100 leads em Maio" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Métrica</Label>
            <Select value={metricKey} onValueChange={setMetricKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METRIC_OPTIONS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor alvo</Label>
            <Input type="number" placeholder="100" value={targetValue} onChange={e => setTargetValue(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Início do período</Label>
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fim do período</Label>
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !targetValue || create.isPending}>
            {create.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Criar Meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Alert Rule Dialog ───────────────────────────────────────────────────

function CreateAlertDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const { toast } = useToast();
  const create = useCreateAlertRule();
  const [name, setName] = useState('');
  const [metricKey, setMetricKey] = useState('conversion_rate');
  const [operator, setOperator] = useState<'lt' | 'lte' | 'gt' | 'gte' | 'eq'>('lt');
  const [threshold, setThreshold] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('warning');

  const handleSubmit = async () => {
    if (!name.trim() || !threshold) return;
    try {
      await create.mutateAsync({
        org_id: orgId,
        name: name.trim(),
        metric_key: metricKey,
        operator,
        threshold: parseFloat(threshold),
        severity,
        channel: 'in_app',
        enabled: true,
      } as any);
      toast({ title: 'Regra de alerta criada!' });
      onClose();
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao criar regra.' });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-4 h-4" /> Nova Regra de Alerta
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome da regra</Label>
            <Input placeholder="Ex: Alerta de CPL alto" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Métrica</Label>
              <Select value={metricKey} onValueChange={setMetricKey}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Operador</Label>
              <Select value={operator} onValueChange={(v) => setOperator(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OPERATOR_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor limite</Label>
              <Input type="number" placeholder="5" value={threshold} onChange={e => setThreshold(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Severidade</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Aviso</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !threshold || create.isPending}>
            {create.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Criar Regra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Goals() {
  const { orgId } = useParams<{ orgId: string }>();
  const { toast } = useToast();
  const { data: goals = [], isLoading: loadingGoals } = useKpiGoals(orgId);
  const { data: rules = [], isLoading: loadingRules } = useKpiAlertRules(orgId);
  const { data: triggers = [] } = useKpiTriggers(orgId);
  const deleteGoal = useDeleteGoal();
  const toggleRule = useToggleAlertRule();
  const deleteRule = useDeleteAlertRule();
  const checkThresholds = useCheckKpiThresholds();
  const resolveTrigger = useResolveKpiTrigger();

  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [showCreateAlert, setShowCreateAlert] = useState(false);

  const completedGoals = goals.filter(g => g.current_value != null && g.current_value >= g.target_value).length;
  const activeRules = rules.filter(r => r.enabled).length;

  const handleCheck = async () => {
    if (!orgId) return;
    try {
      const result = await checkThresholds.mutateAsync(orgId);
      toast({ title: `Verificação concluída: ${result.triggered} alerta(s) disparado(s).` });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao verificar thresholds.' });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" />
            Metas & Alertas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Defina objetivos por KPI e receba alertas automáticos quando métricas saírem do esperado.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCheck} disabled={checkThresholds.isPending}>
            {checkThresholds.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Verificar Agora
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowCreateAlert(true)}>
            <Bell className="w-4 h-4" /> Nova Regra
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setShowCreateGoal(true)}>
            <Plus className="w-4 h-4" /> Nova Meta
          </Button>
        </div>
      </div>

      {/* Active threshold breaches */}
      {triggers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Alertas Disparados ({triggers.length})
          </p>
          {triggers.map(t => {
            const sev = t.kpi_alert_rules?.severity ?? 'warning';
            const sevColor = sev === 'critical' ? 'border-destructive/30 bg-destructive/5' : 'border-amber-500/30 bg-amber-500/5';
            const metricLabel = METRIC_OPTIONS.find(m => m.value === t.metric_key)?.label ?? t.metric_key;
            return (
              <div key={t.id} className={cn('flex items-center gap-3 p-3 rounded-lg border', sevColor)}>
                <AlertTriangle className={cn('w-4 h-4 shrink-0', sev === 'critical' ? 'text-destructive' : 'text-amber-500')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.kpi_alert_rules?.name ?? 'Alerta'}</p>
                  <p className="text-xs text-muted-foreground">
                    {metricLabel}: valor atual <strong>{t.actual_value}</strong> {OPERATOR_LABELS[t.operator]} {t.threshold}
                  </p>
                </div>
                <Button
                  size="sm" variant="ghost"
                  className="h-7 text-[11px] gap-1 text-emerald-600 hover:text-emerald-700 shrink-0"
                  onClick={() => resolveTrigger.mutate({ triggerId: t.id, orgId: orgId! })}
                  disabled={resolveTrigger.isPending}
                >
                  <CheckCircle2 className="w-3 h-3" /> Resolver
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Metas ativas', value: goals.length, icon: Target, color: 'text-primary' },
          { label: 'Concluídas', value: completedGoals, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Regras ativas', value: activeRules, icon: Bell, color: 'text-amber-500' },
          { label: 'Regras totais', value: rules.length, icon: AlertTriangle, color: 'text-muted-foreground' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <item.icon className={cn('w-5 h-5 shrink-0', item.color)} />
              <div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="goals">
        <TabsList>
          <TabsTrigger value="goals" className="gap-2">
            <Target className="w-4 h-4" /> Metas ({goals.length})
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="w-4 h-4" /> Regras de Alerta ({rules.length})
          </TabsTrigger>
        </TabsList>

        {/* Goals tab */}
        <TabsContent value="goals" className="mt-4">
          {loadingGoals ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : goals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma meta criada</p>
              <p className="text-sm mt-1">Crie metas por KPI para acompanhar o progresso do time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {goals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  orgId={orgId!}
                  onDelete={async () => {
                    if (!confirm('Excluir esta meta?')) return;
                    try {
                      await deleteGoal.mutateAsync({ goalId: goal.id, orgId: orgId! });
                      toast({ title: 'Meta excluída.' });
                    } catch {
                      toast({ variant: 'destructive', title: 'Erro ao excluir.' });
                    }
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Alert rules tab */}
        <TabsContent value="alerts" className="mt-4">
          {loadingRules ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma regra de alerta</p>
              <p className="text-sm mt-1">Configure alertas automáticos quando KPIs saírem dos limites.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map(rule => {
                const sev = SEVERITY_CONFIG[rule.severity];
                const metricLabel = METRIC_OPTIONS.find(m => m.value === rule.metric_key)?.label ?? rule.metric_key;
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-all',
                      rule.enabled ? 'border-border/50 hover:border-border' : 'border-border/30 opacity-60',
                    )}
                  >
                    <AlertTriangle className={cn('w-4 h-4 shrink-0', rule.enabled ? sev.color.split(' ')[1] : 'text-muted-foreground')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {metricLabel} {OPERATOR_LABELS[rule.operator]} {rule.threshold}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={cn('text-[10px]', sev.color)}>{sev.label}</Badge>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(v) => toggleRule.mutate({ ruleId: rule.id, enabled: v, orgId: orgId! })}
                      />
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          if (!confirm('Excluir esta regra?')) return;
                          try {
                            await deleteRule.mutateAsync({ ruleId: rule.id, orgId: orgId! });
                            toast({ title: 'Regra excluída.' });
                          } catch {
                            toast({ variant: 'destructive', title: 'Erro ao excluir.' });
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showCreateGoal && orgId && <CreateGoalDialog orgId={orgId} onClose={() => setShowCreateGoal(false)} />}
      {showCreateAlert && orgId && <CreateAlertDialog orgId={orgId} onClose={() => setShowCreateAlert(false)} />}
    </div>
  );
}
