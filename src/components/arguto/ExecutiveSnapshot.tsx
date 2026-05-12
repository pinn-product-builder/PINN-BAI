import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { useParams } from 'react-router-dom';
import {
  TrendingUp, AlertTriangle, ShoppingCart, Boxes, MapPinOff, ArrowUpRight, Info,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import {
  HERO_KPIS, SECONDARY_ALERTS, SIGNAL_STYLE,
  KPI_EXPLANATIONS, ALERT_EXPLANATIONS,
  type MetricExplanation,
} from '@/data/arguto-demo';
import { isRfmChurnEnabledForOrg } from '@/lib/featureFlags';
import MetricExplanationDialog from './MetricExplanationDialog';
import { EditableSnapshotGrid, type SnapshotWidget } from './EditableSnapshotGrid';

interface ExecutiveSnapshotProps {
  onOpenChurn?: () => void;
  isEditing?: boolean;
}

const fmtBRL = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toLocaleString('pt-BR')}`;
};

const fmtNumber = (v: number) => v.toLocaleString('pt-BR');

export default function ExecutiveSnapshot({ onOpenChurn, isEditing = false }: ExecutiveSnapshotProps = {}) {
  const { orgId } = useParams();
  const churnEnabled = isRfmChurnEnabledForOrg(orgId);

  const [activeMetric, setActiveMetric] = useState<MetricExplanation | null>(null);

  const openMetric = (m: MetricExplanation) => {
    // Não abre dialog em modo edição — não atrapalha drag.
    if (isEditing) return;
    setActiveMetric(m);
  };
  const closeMetric = () => setActiveMetric(null);

  // ─── Widgets (cards) na ordem default ───────────────────────────────
  // Tamanhos pensados pra grid de 12 cols: KPI hero ocupa 3×6, alerta 3×5.
  const widgets: SnapshotWidget[] = [
    {
      id: 'kpi:conversao',
      size: { w: 3, h: 6 },
      render: () => (
        <ClickableKpiCard onClick={() => openMetric(KPI_EXPLANATIONS.conversao_visita)}>
          <div className="space-y-3">
            <KpiHeader title="Conversão por visita" subtitle="Hoje vs com Pinn BAI" />
            <div className="space-y-2.5 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Hoje</span>
                  <span className="text-sm font-bold tabular-nums text-foreground">38%</span>
                </div>
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                  <div className="h-full bg-muted-foreground/40 rounded-full" style={{ width: '38%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-primary">Com BAI</span>
                  <span className="text-sm font-bold tabular-nums text-primary">58%</span>
                </div>
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-[#FF8A60] rounded-full" style={{ width: '58%' }} />
                </div>
              </div>
            </div>
            <div className="pt-2 flex items-center gap-1.5 text-[11px] font-medium text-destructive">
              <TrendingUp className="w-3.5 h-3.5 rotate-180" />
              −52% de receita perdida hoje
            </div>
          </div>
        </ClickableKpiCard>
      ),
    },
    {
      id: 'kpi:receita-90d',
      size: { w: 3, h: 6 },
      render: () => (
        <ClickableKpiCard onClick={() => openMetric(KPI_EXPLANATIONS.receita_90d)}>
          <div className="space-y-3">
            <KpiHeader title="Receita prevista 90 dias" />
            <div>
              <p className="text-4xl font-bold tabular-nums text-foreground tracking-tight">
                R$ 32,4M
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Intervalo de confiança ± 8%
              </p>
            </div>
            <div className="pt-2">
              <div className="h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={Array.from({ length: 12 }, (_, i) => ({
                    x: i,
                    y: 24 + i * 0.7 + Math.sin(i / 1.5) * 1.5,
                  }))}>
                    <defs>
                      <linearGradient id="recprev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#FF6B35" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="y" stroke="#FF6B35" strokeWidth={1.5} fill="url(#recprev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </ClickableKpiCard>
      ),
    },
    {
      id: 'kpi:health',
      size: { w: 3, h: 6 },
      render: () => (
        <ClickableKpiCard onClick={() => openMetric(KPI_EXPLANATIONS.health_score)}>
          <div className="space-y-3">
            <KpiHeader title="Health Score da carteira" />
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold tabular-nums text-foreground tracking-tight">1.247</p>
              <p className="text-[11px] text-muted-foreground">clientes ativos</p>
            </div>
            <div className="space-y-2 pt-1">
              <div className="h-2.5 rounded-full overflow-hidden flex">
                {(HERO_KPIS[2] as any).bands.map((b: any) => (
                  <div key={b.label} style={{ width: `${b.pct}%`, background: b.color }} />
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(HERO_KPIS[2] as any).bands.map((b: any) => (
                  <div key={b.label} className="space-y-0.5">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: b.color }} />
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">{b.label}</span>
                    </div>
                    <p className="text-xs font-bold tabular-nums text-foreground pl-2.5">{b.pct}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ClickableKpiCard>
      ),
    },
    {
      id: 'kpi:incremental',
      size: { w: 3, h: 6 },
      render: () => (
        <ClickableKpiCard
          onClick={() => openMetric(KPI_EXPLANATIONS.receita_incremental)}
          accent="primary"
        >
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
              Receita incremental projetada
              <Info className="w-3 h-3 opacity-50" />
            </p>
            <div>
              <p className="text-4xl font-bold tabular-nums text-foreground tracking-tight">
                +R$ 28–38M
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                12 meses · Pinn BAI vs status quo
              </p>
            </div>
            <div className="flex items-center gap-1.5 pt-2 text-[11px] font-semibold text-primary">
              <TrendingUp className="w-3.5 h-3.5" />
              ROI estimado 18–24x
            </div>
          </div>
        </ClickableKpiCard>
      ),
    },
    // ─── Alertas ───
    ...SECONDARY_ALERTS.map((alert) => {
      const style = SIGNAL_STYLE[alert.signal];
      const Icon = alertIcon(alert.key);
      const explanation = ALERT_EXPLANATIONS[alert.key];
      return {
        id: `alert:${alert.key}`,
        size: { w: 3, h: 5 },
        render: () => (
          <Card
            onClick={() => explanation && openMetric(explanation)}
            className="p-4 border bg-card relative overflow-hidden cursor-pointer transition-all hover:shadow-md group h-full"
            style={{ borderColor: style.border }}
          >
            <Info className="absolute top-2.5 right-2.5 w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" />
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: style.bg, color: style.fg }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground pr-4">
                  {alert.title}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums text-foreground">
                    {fmtNumber(alert.metric)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{alert.metricLabel}</span>
                </div>
                <div className="flex items-baseline gap-1.5 pt-0.5 border-t border-border/40">
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: style.fg }}
                  >
                    {fmtBRL(alert.money)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{alert.moneyLabel}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/80 leading-relaxed pt-1">
                  {alert.description}
                </p>
                {alert.key === 'risco_churn' && churnEnabled && orgId && onOpenChurn && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEditing) return;
                      onOpenChurn();
                    }}
                    className="no-drag inline-flex items-center gap-1 text-[10px] font-semibold mt-2 px-2 py-1 rounded-md border transition-all hover:bg-muted/40"
                    style={{ color: style.fg, borderColor: style.border, background: style.bg }}
                  >
                    Ver predição de churn
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </Card>
        ),
      };
    }),
  ];

  const storageKey = `arguto:snapshot:${orgId ?? 'global'}`;

  return (
    <div className="space-y-6">
      {/* Header narrativo */}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
          Executive Snapshot
        </h2>
        <p className="text-sm text-muted-foreground">
          A dor da Arguto em números — quanto está em jogo hoje, e o que o Pinn BAI desbloqueia.
          <span className="ml-2 text-[11px] italic text-muted-foreground/70">
            {isEditing
              ? 'Modo edição ativo — arraste pra reposicionar, redimensione pelos cantos.'
              : 'Clique em qualquer card para ver o detalhamento completo.'}
          </span>
        </p>
      </div>

      {/* Banner de alertas (rótulo acima do grid, fica fora dos widgets) */}
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          KPIs e alertas operacionais
        </h3>
        <span className="text-[11px] text-muted-foreground">— arraste os cards pra montar sua visão</span>
      </div>

      {/* Grid editável (cards) */}
      <EditableSnapshotGrid
        storageKey={storageKey}
        widgets={widgets}
        isEditing={isEditing}
      />

      {/* Footnote */}
      <p className="text-[10px] text-muted-foreground/60 text-center pt-4 border-t border-border/30">
        Dados baseados em fixture demo · ingestion ERP Arguto + ERP fiscal NF + Calendário vendedor
      </p>

      {/* Dialog único compartilhado por todos os cards */}
      <MetricExplanationDialog
        open={!!activeMetric}
        onOpenChange={(open) => !open && closeMetric()}
        explanation={activeMetric}
      />
    </div>
  );
}

/* ─────────────────────── Auxiliares ─────────────────────── */

function ClickableKpiCard({
  children,
  onClick,
  accent = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  accent?: 'default' | 'primary';
}) {
  return (
    <Card
      onClick={onClick}
      className={`relative overflow-hidden p-5 bg-card cursor-pointer transition-all hover:shadow-md group h-full ${
        accent === 'primary'
          ? 'border-2 border-primary/30 bg-gradient-to-br from-primary/[0.04] to-card'
          : 'border-border/50'
      }`}
    >
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${
        accent === 'primary'
          ? 'bg-primary'
          : 'bg-gradient-to-r from-primary to-primary/30'
      }`} />
      <Info className="absolute top-3 right-3 w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" />
      {children}
    </Card>
  );
}

function KpiHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pr-4">
        {title}
      </p>
      {subtitle && (
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function alertIcon(key: string) {
  switch (key) {
    case 'recompra_iminente':    return ShoppingCart;
    case 'risco_churn':          return AlertTriangle;
    case 'mix_subexplorado':     return Boxes;
    case 'visitas_baixo_retorno':return MapPinOff;
    default:                     return AlertTriangle;
  }
}
