import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownRight, ArrowUpRight, Loader2, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  KPI_METRICS,
  useSnapshotComparison,
  useSnapshotSeries,
  usePdcaEntries,
  useUpsertPdcaEntry,
  weekStartMonday,
} from '@/hooks/usePdca';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

/**
 * PDCA / Revisão semanal: combina snapshots de KPI (bai_kpi_snapshots) com
 * o diário Plan-Do-Check-Act (pdca_entries). Página principal de
 * acompanhamento da operação.
 */
export default function PdcaPage() {
  const { orgId } = useParams();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(weekStartMonday());
  const [selectedMetric, setSelectedMetric] = useState<string>(KPI_METRICS[0].key);

  const entries = usePdcaEntries(orgId);
  const upsert = useUpsertPdcaEntry();

  const currentEntry = useMemo(
    () => entries.data?.find((e) => e.week_start === weekStart),
    [entries.data, weekStart],
  );

  const [plan, setPlan] = useState('');
  const [doNotes, setDoNotes] = useState('');
  const [checkNotes, setCheckNotes] = useState('');
  const [act, setAct] = useState('');

  useEffect(() => {
    setPlan(currentEntry?.plan ?? '');
    setDoNotes(currentEntry?.do_notes ?? '');
    setCheckNotes(currentEntry?.check_notes ?? '');
    setAct(currentEntry?.act ?? '');
  }, [currentEntry?.id, weekStart]);

  const series = useSnapshotSeries(orgId, selectedMetric, 60);
  // Heurística: se há menos de 14 dias de snapshots, a comparação semana-vs-semana
  // ainda não estabilizou (precisa de pelo menos 1 semana completa anterior + atual).
  const snapshotsBootstrap = (series.data?.length ?? 0) < 14;

  const navigateWeek = (deltaDays: number) => {
    const d = new Date(weekStart + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + deltaDays);
    setWeekStart(d.toISOString().slice(0, 10));
  };

  const handleSave = async () => {
    if (!orgId) return;
    try {
      await upsert.mutateAsync({
        org_id: orgId,
        week_start: weekStart,
        plan,
        do_notes: doNotes,
        check_notes: checkNotes,
        act,
      });
      toast({ title: 'Revisão semanal salva' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Falha ao salvar', description: (e as Error).message });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">PDCA · Revisão semanal</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          KPIs comparam médias da semana atual vs anterior (via snapshots diários).
          O diário Plan-Do-Check-Act guarda o contexto das decisões.
        </p>
      </header>

      {snapshotsBootstrap && !series.isLoading && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Período de bootstrap.</strong> Há menos de 14 dias de snapshots — a comparação
            semana-vs-semana só estabiliza depois que o job rodar por uma semana completa.
            O job captura automaticamente todo dia às 03:30 UTC.
          </AlertDescription>
        </Alert>
      )}

      {/* KPI compare cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_METRICS.map((m) => (
          <KpiCompareCard
            key={m.key}
            orgId={orgId}
            metricKey={m.key}
            label={m.label}
            isSelected={selectedMetric === m.key}
            onSelect={() => setSelectedMetric(m.key)}
          />
        ))}
      </div>

      {/* Série temporal da métrica selecionada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Evolução · {KPI_METRICS.find((m) => m.key === selectedMetric)?.label}
          </CardTitle>
          <CardDescription>Últimos 60 dias (snapshot diário).</CardDescription>
        </CardHeader>
        <CardContent>
          {series.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !series.data || series.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Sem snapshots ainda. O job de captura roda 1×/dia (03:30 UTC).
            </p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series.data}>
                  <XAxis dataKey="snapshot_date" fontSize={10} tickFormatter={(v) => v.slice(5)} />
                  <YAxis fontSize={10} />
                  <Tooltip
                    formatter={(v: number) => [v.toLocaleString('pt-BR'), 'valor']}
                    labelFormatter={(l) => `Data: ${l}`}
                  />
                  <Line type="monotone" dataKey="metric_value" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diário PDCA */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">Diário da semana</CardTitle>
            <CardDescription>
              Semana de <code>{weekStart}</code> (segunda-feira UTC).
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => navigateWeek(-7)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setWeekStart(weekStartMonday())}
              disabled={weekStart === weekStartMonday()}
            >
              Hoje
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigateWeek(7)}
              disabled={weekStart >= weekStartMonday()}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PdcaField
              label="Plan · o que vou fazer"
              hint="Hipóteses, metas, experimentos pra a semana"
              value={plan}
              onChange={setPlan}
            />
            <PdcaField
              label="Do · o que foi feito"
              hint="Ações executadas (não inventar — só o que aconteceu)"
              value={doNotes}
              onChange={setDoNotes}
            />
            <PdcaField
              label="Check · o que aprendi"
              hint="O que os números mostraram, surpresas, padrões"
              value={checkNotes}
              onChange={setCheckNotes}
            />
            <PdcaField
              label="Act · próximo ciclo"
              hint="Ajustes pra próxima semana — vira o Plan dela"
              value={act}
              onChange={setAct}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Salvar revisão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PdcaField({ label, hint, value, onChange }: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-sm font-semibold">{label}</Label>
      <p className="text-xs text-muted-foreground mb-1">{hint}</p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="resize-none"
      />
    </div>
  );
}

function KpiCompareCard({
  orgId,
  metricKey,
  label,
  isSelected,
  onSelect,
}: {
  orgId: string | undefined;
  metricKey: string;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const cmp = useSnapshotComparison(orgId, metricKey, 7);
  const data = cmp.data;
  const isMoney = metricKey === 'open_pipeline_value';

  const fmt = (v: number) =>
    isMoney
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
      : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  const isUp = (data?.delta_abs ?? 0) >= 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-lg border p-3 transition-all ${
        isSelected ? 'border-primary/60 ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-border/80'
      }`}
    >
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {cmp.isLoading ? (
        <Skeleton className="h-6 w-24" />
      ) : !data ? (
        <div className="text-sm text-muted-foreground">sem dados</div>
      ) : (
        <>
          <div className="text-xl font-bold">{fmt(Number(data.current_value))}</div>
          <div className={`text-xs mt-1 flex items-center gap-1 ${isUp ? 'text-emerald-600' : 'text-destructive'}`}>
            {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {data.delta_pct == null ? 's/ base' : `${data.delta_pct > 0 ? '+' : ''}${data.delta_pct.toFixed(1)}%`}
            <span className="text-muted-foreground/70 ml-1">vs sem ant ({fmt(Number(data.previous_value))})</span>
          </div>
        </>
      )}
    </button>
  );
}
