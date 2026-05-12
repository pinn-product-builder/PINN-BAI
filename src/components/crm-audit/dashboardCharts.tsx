import type { CSSProperties, ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Referências a tokens PINN definidos em `pinn-tokens.css` (.bai-dashboard-root). */
const GRID = "var(--pinn-chart-grid)";
const TICK = "var(--pinn-chart-tick)";
const TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: "var(--pinn-bg-elevated)",
  border: "1px solid var(--pinn-border-strong)",
  borderRadius: 12,
  color: "var(--pinn-text-primary)",
};
const AXIS_TICK = { fill: TICK, fontSize: 11 };

const C1 = "var(--pinn-chart-1)";
const C2 = "var(--pinn-chart-2)";
const C3 = "var(--pinn-chart-3)";
const C4 = "var(--pinn-chart-4)";
const C5 = "var(--pinn-chart-5)";
const Cneutral = "var(--pinn-chart-neutral)";

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("pt-BR");
}

function fmtMoneyTooltip(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtMoneyShort(v: number) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return String(Math.round(v));
}

type OverviewLite = {
  total_active_leads?: number;
  total_won_leads?: number;
  total_lost_leads?: number;
};

export function DashboardChartsPanel({
  ov,
  scores,
  rollups,
  stageDist,
  owners,
  lostTop,
  pipes,
  engCounts,
  checklistOk,
  checklistTotal,
}: {
  ov: OverviewLite;
  scores: Record<string, number | undefined>;
  rollups?: Record<string, Record<string, number>>;
  stageDist: { stage_name?: string; lead_count?: number }[];
  owners: Record<string, unknown>[];
  lostTop: { lost_reason?: string; cnt?: number }[];
  pipes: Array<{ pipeline_name?: string; open_pipeline_value?: number; open?: number }>;
  engCounts: { notes?: number; events?: number; conversations?: number };
  checklistOk: number;
  checklistTotal: number;
}) {
  const open = ov.total_active_leads ?? 0;
  const won = ov.total_won_leads ?? 0;
  const lost = ov.total_lost_leads ?? 0;
  const pieOpp = [
    { name: "Abertas", value: Math.max(0, open), fill: C1 },
    { name: "Ganhas", value: Math.max(0, won), fill: C3 },
    { name: "Perdidas", value: Math.max(0, lost), fill: C5 },
  ].filter((x) => x.value > 0);

  const scoreData = [
    { nome: "Higiene", valor: Math.min(100, Math.max(0, scores.crm_data_quality_0_100 ?? 0)) },
    { nome: "Operação", valor: Math.min(100, Math.max(0, scores.operation_0_100 ?? 0)) },
  ];

  const funnelKeys = ["trafego", "disparos", "outros"] as const;
  const FUNNEL_PT: Record<string, string> = { trafego: "Tráfego", disparos: "Disparos", outros: "Outros" };
  const funnelBarData = rollups
    ? funnelKeys.map((k) => {
        const r = rollups[k] ?? {};
        return {
          nome: FUNNEL_PT[k] ?? k,
          Abertas: Number(r.open ?? 0),
          "Sem tarefa": Number(r.no_next_action_open ?? 0),
          Paradas: Number(r.stuck_open ?? 0),
          Atrasadas: Number(r.overdue_tasks_open_leads ?? 0),
        };
      })
    : [];

  const stagesChart = stageDist.slice(0, 14).map((s) => ({
    nome: String(s.stage_name ?? "—").slice(0, 28),
    oportunidades: Number(s.lead_count ?? 0),
  }));

  const ownersSorted = [...owners]
    .sort((a, b) => Number(b.open_value ?? 0) - Number(a.open_value ?? 0))
    .slice(0, 14)
    .map((o) => ({
      nome: String(o.owner_name ?? "—").slice(0, 22),
      valor: Number(o.open_value ?? 0),
      abertas: Number(o.open_leads ?? 0),
    }));

  const pipesChart = [...pipes]
    .sort((a, b) => Number(b.open_pipeline_value ?? 0) - Number(a.open_pipeline_value ?? 0))
    .slice(0, 12)
    .map((p) => ({
      nome: String(p.pipeline_name ?? "—").slice(0, 24),
      valor: Number(p.open_pipeline_value ?? 0),
      abertas: Number(p.open ?? 0),
    }));

  const lostChart = lostTop.slice(0, 12).map((x) => ({
    nome: String(x.lost_reason ?? "—").slice(0, 32),
    qtd: Number(x.cnt ?? 0),
  }));

  const notes = engCounts.notes ?? 0;
  const events = engCounts.events ?? 0;
  const conv = engCounts.conversations ?? 0;
  const engPie = [
    { name: "Notas", value: notes, fill: C1 },
    { name: "Eventos", value: events, fill: C2 },
    { name: "Conversas", value: conv, fill: C3 },
  ].filter((x) => x.value > 0);

  const checklistFail = Math.max(0, checklistTotal - checklistOk);
  const checklistPie =
    checklistTotal > 0
      ? [
          { name: "Controles OK", value: checklistOk, fill: C3 },
          { name: "A corrigir", value: checklistFail, fill: "var(--pinn-danger)" },
        ].filter((x) => x.value > 0)
      : [];

  const oppPieData = pieOpp.length ? pieOpp : [{ name: "Sem dados", value: 1, fill: Cneutral }];
  const engPieData = engPie.length ? engPie : [{ name: "Sem dados", value: 1, fill: Cneutral }];

  const pieFallback = [C1, C2, C3, C4, C5];

  return (
    <div className="analytics-chart-grid bai-chart-grid-pinn">
      <ChartCard title="Composição das oportunidades" subtitle="Participação entre abertas, ganhas e perdidas neste snapshot.">
        <ResponsiveContainer width="100%" height={268}>
          <PieChart>
            <Pie
              data={oppPieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={92}
              paddingAngle={2}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {oppPieData.map((entry, i) => (
                <Cell key={i} fill={(entry as { fill?: string }).fill ?? pieFallback[i % pieFallback.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => fmtInt(v)} contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Scores de saúde (0–100)" subtitle="Higiene de dados vs disciplina operacional.">
        <ResponsiveContainer width="100%" height={268}>
          <BarChart data={scoreData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="nome" tick={AXIS_TICK} axisLine={{ stroke: GRID }} />
            <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={{ stroke: GRID }} />
            <Tooltip formatter={(v: number) => `${v}/100`} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="valor" name="Pontuação" radius={[8, 8, 0, 0]}>
              {scoreData.map((_, i) => (
                <Cell key={i} fill={i === 0 ? C1 : C2} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Checklist de controles" subtitle={`${checklistOk} de ${checklistTotal} itens em conformidade.`}>
        <ResponsiveContainer width="100%" height={268}>
          <PieChart>
            <Pie
              data={checklistPie.length ? checklistPie : [{ name: "—", value: 1, fill: Cneutral }]}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={88}
              paddingAngle={2}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {(checklistPie.length ? checklistPie : [{ fill: Cneutral }]).map((entry, i) => (
                <Cell key={i} fill={(entry as { fill?: string }).fill ?? Cneutral} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => fmtInt(v)} contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Funis comparados (Tráfego · Disparos · Outros)"
        subtitle="Barras agrupadas por métrica — escalas diferentes facilitam comparar padrões entre grupos."
        span2
      >
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={funnelBarData} margin={{ top: 12, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="nome" tick={AXIS_TICK} axisLine={{ stroke: GRID }} />
            <YAxis tick={AXIS_TICK} axisLine={{ stroke: GRID }} />
            <Tooltip formatter={(v: number) => fmtInt(v)} contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Abertas" fill={C1} name="Abertas" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Sem tarefa" fill={C2} name="Sem próxima tarefa" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Paradas" fill={C4} name="Paradas (sem update)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Atrasadas" fill="var(--pinn-danger)" name="Tarefas atrasadas" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Mix de engajamento (recorte API)" subtitle={`Notas + eventos + conversas sincronizados (total ${fmtInt(notes + events + conv)} registros).`}>
        <ResponsiveContainer width="100%" height={268}>
          <PieChart>
            <Pie
              data={engPieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={86}
              paddingAngle={3}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {engPieData.map((entry, i) => (
                <Cell key={i} fill={(entry as { fill?: string }).fill ?? pieFallback[i % pieFallback.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => fmtInt(v)} contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top pipelines · valor em aberto (R$)" subtitle="Ranking pelo maior valor financeiro em abertas.">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart layout="vertical" data={pipesChart} margin={{ top: 8, right: 20, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => fmtMoneyShort(Number(v))} axisLine={{ stroke: GRID }} />
            <YAxis type="category" dataKey="nome" width={132} tick={AXIS_TICK} axisLine={{ stroke: GRID }} />
            <Tooltip formatter={(v: number) => fmtMoneyTooltip(v)} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="valor" name="Valor aberto" fill={C1} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Estágios · volume de abertas" subtitle="Onde há mais oportunidades ativas por estágio.">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={stagesChart} margin={{ top: 12, right: 12, left: 4, bottom: 52 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="nome" tick={AXIS_TICK} interval={0} angle={-26} textAnchor="end" height={72} axisLine={{ stroke: GRID }} />
            <YAxis tick={AXIS_TICK} axisLine={{ stroke: GRID }} />
            <Tooltip formatter={(v: number) => fmtInt(v)} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="oportunidades" name="Oportunidades abertas" fill={C2} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Equipe · valor em aberto por responsável" subtitle="Priorização por impacto financeiro nas abertas.">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart layout="vertical" data={ownersSorted} margin={{ top: 8, right: 20, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => fmtMoneyShort(Number(v))} axisLine={{ stroke: GRID }} />
            <YAxis type="category" dataKey="nome" width={132} tick={AXIS_TICK} axisLine={{ stroke: GRID }} />
            <Tooltip formatter={(v: number) => fmtMoneyTooltip(v)} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="valor" name="Valor em aberto" fill={C3} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Motivos de perda (quantidade)" subtitle="Razões mais frequentes nas oportunidades perdidas.">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart layout="vertical" data={lostChart} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} axisLine={{ stroke: GRID }} />
            <YAxis type="category" dataKey="nome" width={188} tick={AXIS_TICK} axisLine={{ stroke: GRID }} />
            <Tooltip formatter={(v: number) => fmtInt(v)} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="qtd" name="Quantidade" fill="var(--pinn-danger)" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  span2,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  span2?: boolean;
}) {
  const spanStyle: CSSProperties | undefined = span2 ? { gridColumn: "1 / -1" } : undefined;
  return (
    <div className="bai-chart-card" style={spanStyle}>
      <div style={{ marginBottom: 12 }}>
        <div className="bai-chart-card-title">{title}</div>
        {subtitle ? <div className="bai-chart-card-sub">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}
