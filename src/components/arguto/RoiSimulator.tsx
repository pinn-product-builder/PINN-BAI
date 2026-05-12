import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Calculator, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { ROI_BASELINE } from '@/data/arguto-demo';
import { cn } from '@/lib/utils';

const PERIODOS = [6, 12, 24] as const;
type Periodo = typeof PERIODOS[number];

const fmtBRL = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toLocaleString('pt-BR')}`;
};

const fmtNum = (v: number, decimals = 0) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function RoiSimulator() {
  const [periodo, setPeriodo]   = useState<Periodo>(12);
  const [adocao, setAdocao]     = useState(80);   // 40-100
  const [cobertura, setCobertura] = useState(75); // 30-100

  /**
   * Modelo:
   *   t = adocao% × cobertura% (saturação multiplicativa)
   *   métrica_final = lerp(hoje, max, t)
   *   escala temporal: 6m = 50%, 12m = 100%, 24m = 130% (efeito composto leve)
   */
  const calc = useMemo(() => {
    const saturation = (adocao / 100) * (cobertura / 100); // 0..1
    const timeScale = periodo === 6 ? 0.5 : periodo === 12 ? 1.0 : 1.3;
    const t = Math.min(1, saturation * timeScale);

    const conversao = lerp(ROI_BASELINE.conversaoHoje, ROI_BASELINE.conversaoMax, t);
    const ticket    = lerp(ROI_BASELINE.ticketHoje,    ROI_BASELINE.ticketMax,    t);
    const mix       = lerp(ROI_BASELINE.mixHoje,       ROI_BASELINE.mixMax,       t);
    const ciclo     = lerp(ROI_BASELINE.cicloHoje,     ROI_BASELINE.cicloMin,     t);
    const custoVisita = lerp(ROI_BASELINE.custoVisitaHoje, ROI_BASELINE.custoVisitaMin, t);
    const visitasMes  = lerp(ROI_BASELINE.visitasMesHoje,  ROI_BASELINE.visitasMesMin,  t);

    const receitaIncMin = ROI_BASELINE.receitaIncrementalAnualMin * t * (periodo / 12);
    const receitaIncMax = ROI_BASELINE.receitaIncrementalAnualMax * t * (periodo / 12);

    /* Investimento Pinn (premissa demo): R$ 18k/mês, sem setup */
    const investimentoMensal = 18_000;
    const investimentoTotal = investimentoMensal * periodo;
    const economiaVisitas = (ROI_BASELINE.custoVisitaHoje * ROI_BASELINE.visitasMesHoje
                           - custoVisita * visitasMes) * periodo;
    const ganhoBruto = (receitaIncMin + receitaIncMax) / 2 + economiaVisitas;
    const roi = investimentoTotal > 0 ? ganhoBruto / investimentoTotal : 0;
    const payback = ganhoBruto > 0
      ? (investimentoTotal / (ganhoBruto / periodo))
      : 99;

    return {
      conversao, ticket, mix, ciclo, custoVisita, visitasMes,
      receitaIncMin, receitaIncMax,
      roi, payback, investimentoTotal, ganhoBruto, economiaVisitas,
    };
  }, [periodo, adocao, cobertura]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
          Simulação ROI
        </h2>
        <p className="text-sm text-muted-foreground">
          O slide que decide o deal. Ajuste premissas e veja o impacto em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Coluna inputs ── */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5 bg-card border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Premissas</h3>
            </div>

            {/* Período — segmented */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Período
                </label>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 bg-muted/30 rounded-lg">
                {PERIODOS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodo(p)}
                    className={cn(
                      'py-1.5 text-xs font-semibold rounded transition-all',
                      periodo === p
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {p} meses
                  </button>
                ))}
              </div>
            </div>

            {/* Adoção */}
            <div className="space-y-3 mb-5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Adoção do time
                </label>
                <span className="text-sm font-bold tabular-nums text-primary">{adocao}%</span>
              </div>
              <Slider
                value={[adocao]}
                onValueChange={(v) => setAdocao(v[0])}
                min={40}
                max={100}
                step={5}
              />
              <p className="text-[10px] text-muted-foreground/70 leading-snug">
                % de vendedores usando BAI ativamente
              </p>
            </div>

            {/* Cobertura */}
            <div className="space-y-3 mb-5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Cobertura da carteira
                </label>
                <span className="text-sm font-bold tabular-nums text-primary">{cobertura}%</span>
              </div>
              <Slider
                value={[cobertura]}
                onValueChange={(v) => setCobertura(v[0])}
                min={30}
                max={100}
                step={5}
              />
              <p className="text-[10px] text-muted-foreground/70 leading-snug">
                % da carteira priorizada via BAI
              </p>
            </div>

            {/* Highlights */}
            <div className="pt-4 border-t border-border/40 space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Payback do investimento</p>
                <p className="text-2xl font-bold tabular-nums text-primary">
                  {calc.payback < 12 ? `${calc.payback.toFixed(1)} meses` : '> 12 meses'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ROI no período</p>
                <p className="text-2xl font-bold tabular-nums text-foreground">{calc.roi.toFixed(1)}x</p>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Coluna outputs ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden border-border/50">
            <div className="p-4 border-b border-border/40 bg-muted/20">
              <h3 className="text-sm font-semibold text-foreground">
                Outputs projetados — {periodo} meses
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Adoção {adocao}% × Cobertura {cobertura}%
              </p>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-muted/15 border-b border-border/30">
                <tr className="text-left">
                  <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Métrica</th>
                  <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Hoje</th>
                  <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Com BAI</th>
                  <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Delta</th>
                </tr>
              </thead>
              <tbody>
                <Row
                  label="Conversão de visita"
                  hoje={`${ROI_BASELINE.conversaoHoje}%`}
                  novo={`${fmtNum(calc.conversao, 0)}%`}
                  delta={pct(ROI_BASELINE.conversaoHoje, calc.conversao)}
                  positive
                />
                <Row
                  label="Ticket médio por pedido"
                  hoje={`R$ ${fmtNum(ROI_BASELINE.ticketHoje)}`}
                  novo={`R$ ${fmtNum(calc.ticket)}`}
                  delta={pct(ROI_BASELINE.ticketHoje, calc.ticket)}
                  positive
                />
                <Row
                  label="Mix médio (SKUs ativos/cliente)"
                  hoje={fmtNum(ROI_BASELINE.mixHoje, 1)}
                  novo={fmtNum(calc.mix, 1)}
                  delta={pct(ROI_BASELINE.mixHoje, calc.mix)}
                  positive
                />
                <Row
                  label="Ciclo de recompra"
                  hoje={`${ROI_BASELINE.cicloHoje} dias`}
                  novo={`${fmtNum(calc.ciclo, 0)} dias`}
                  delta={pct(ROI_BASELINE.cicloHoje, calc.ciclo)}
                  positive={false}
                />
                <Row
                  label="Custo de visita (otimização rota)"
                  hoje={`R$ ${fmtNum(ROI_BASELINE.custoVisitaHoje)}/visita`}
                  novo={`R$ ${fmtNum(calc.custoVisita)}/visita`}
                  delta={pct(ROI_BASELINE.custoVisitaHoje, calc.custoVisita)}
                  positive={false}
                />
                <Row
                  label="Visitas necessárias/mês"
                  hoje={fmtNum(ROI_BASELINE.visitasMesHoje)}
                  novo={fmtNum(calc.visitasMes, 0)}
                  delta={pct(ROI_BASELINE.visitasMesHoje, calc.visitasMes)}
                  positive={false}
                />
                <tr className="bg-primary/5 border-t-2 border-primary/30">
                  <td className="px-4 py-3 font-bold text-foreground">Receita incremental no período</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-primary tabular-nums">
                      {fmtBRL(calc.receitaIncMin)} – {fmtBRL(calc.receitaIncMax)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Disclaimer */}
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200/60 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 leading-relaxed italic">
              <strong className="font-semibold">Disclaimer:</strong> Projeção baseada em benchmark de operações
              B2B de distribuição similares. Resultado real validado durante MVP de 90 dias com a Arguto.
              Os deltas projetados acima são propostos como pontos de aferição contratuais.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label, hoje, novo, delta, positive,
}: {
  label: string;
  hoje: string;
  novo: string;
  delta: string;
  positive: boolean;
}) {
  const isPositive = positive;
  const isImproved = (positive && delta.startsWith('+')) || (!positive && delta.startsWith('−'));
  return (
    <tr className="border-b border-border/20 hover:bg-muted/10 transition-colors">
      <td className="px-4 py-2.5 text-foreground">{label}</td>
      <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{hoje}</td>
      <td className="px-4 py-2.5 text-right font-semibold text-foreground tabular-nums">{novo}</td>
      <td className="px-4 py-2.5 text-right">
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums',
          isImproved ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
        )}>
          {isImproved ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {delta}
        </span>
      </td>
    </tr>
  );
}

function pct(hoje: number, novo: number): string {
  const d = ((novo - hoje) / hoje) * 100;
  const sign = d >= 0 ? '+' : '−';
  return `${sign}${Math.abs(d).toFixed(0)}%`;
}
