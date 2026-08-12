import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ReferenceDot,
} from 'recharts';
import { ChevronRight, Activity, PieChart as PieIcon, Users2, AlertCircle, Library } from 'lucide-react';
import {
  TENDENCIA_90D,
  CONCENTRACAO_MIX,
  PERFORMANCE_VENDEDOR,
  ANOMALIA_PEDIDO,
  PENETRACAO_CATALOGO,
  DRILLDOWN_PLACEHOLDERS,
  type ArgutoClient,
} from '@/data/arguto-demo';

interface Props {
  client: ArgutoClient;
}

export default function DrilldownPanel({ client }: Props) {
  return (
    <div className="bg-muted/20 border-t border-border/40 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Drilldown</p>
          <h4 className="text-sm font-semibold text-foreground">{client.cliente}</h4>
        </div>
        <Badge variant="outline" className="text-[10px]">
          Score ICP {client.scoreICP}
        </Badge>
      </div>

      {/* 5 widgets prontos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <TendenciaWidget />
        <ConcentracaoMixWidget />
        <PerformanceVendedorWidget />
        <AnomaliaPedidoWidget />
        <PenetracaoCatalogoWidget />
      </div>

      {/* 5 placeholders */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Outros indicadores disponíveis no drilldown completo
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
          {DRILLDOWN_PLACEHOLDERS.map((p) => (
            <PlaceholderCard key={p.key} title={p.title} detail={p.detail} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── Widgets prontos ──────────────────────── */

function TendenciaWidget() {
  return (
    <Card className="p-3 bg-card border-border/50">
      <div className="flex items-center gap-1.5 mb-2">
        <Activity className="w-3 h-3 text-primary" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tendência 90 dias
        </p>
      </div>
      <p className="text-lg font-bold tabular-nums text-foreground">+42%</p>
      <p className="text-[9px] text-emerald-600 mb-2">Crescendo · saudável</p>
      <div className="h-14">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={TENDENCIA_90D}>
            <defs>
              <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#FF6B35" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="valor" stroke="#FF6B35" strokeWidth={1.5} fill="url(#trend)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ConcentracaoMixWidget() {
  return (
    <Card className="p-3 bg-card border-border/50">
      <div className="flex items-center gap-1.5 mb-2">
        <PieIcon className="w-3 h-3 text-primary" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Concentração mix
        </p>
      </div>
      <p className="text-lg font-bold tabular-nums text-foreground">68%</p>
      <p className="text-[9px] text-amber-600 mb-2">Top 3 SKUs · vulnerável</p>
      <div className="h-14 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={CONCENTRACAO_MIX} dataKey="pct" innerRadius={18} outerRadius={28} stroke="none">
              {CONCENTRACAO_MIX.map((c, i) => <Cell key={i} fill={c.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function PerformanceVendedorWidget() {
  return (
    <Card className="p-3 bg-card border-border/50">
      <div className="flex items-center gap-1.5 mb-2">
        <Users2 className="w-3 h-3 text-primary" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Performance vendedor
        </p>
      </div>
      <p className="text-lg font-bold tabular-nums text-foreground">Carlos M.</p>
      <p className="text-[9px] text-emerald-600 mb-2">Conv 62% · top do time</p>
      <div className="h-14">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={PERFORMANCE_VENDEDOR} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Bar dataKey="conversao" radius={[2, 2, 0, 0]}>
              {PERFORMANCE_VENDEDOR.map((v, i) => (
                <Cell key={i} fill={v.nome === 'Time média' ? '#999999' : '#FF6B35'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function AnomaliaPedidoWidget() {
  return (
    <Card className="p-3 bg-card border-border/50">
      <div className="flex items-center gap-1.5 mb-2">
        <AlertCircle className="w-3 h-3 text-destructive" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Anomalia detectada
        </p>
      </div>
      <p className="text-lg font-bold tabular-nums text-foreground">+107%</p>
      <p className="text-[9px] text-destructive mb-2">Dia 25 · fora do padrão</p>
      <div className="h-14">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ANOMALIA_PEDIDO}>
            <Line type="monotone" dataKey="padrao" stroke="#999999" strokeWidth={1} strokeDasharray="2 2" dot={false} />
            <Line type="monotone" dataKey="pedido" stroke="#C62828" strokeWidth={1.5} dot={(props: any) => {
              const isAnomaly = props.payload?.anomaly;
              return isAnomaly
                ? <circle key={props.index} cx={props.cx} cy={props.cy} r={3} fill="#C62828" />
                : <g key={props.index} />;
            }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function PenetracaoCatalogoWidget() {
  const pct = PENETRACAO_CATALOGO.pct;
  const circumference = 2 * Math.PI * 22;
  const offset = circumference * (1 - pct / 100);
  return (
    <Card className="p-3 bg-card border-border/50">
      <div className="flex items-center gap-1.5 mb-2">
        <Library className="w-3 h-3 text-primary" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Penetração catálogo
        </p>
      </div>
      <p className="text-lg font-bold tabular-nums text-foreground">{pct}%</p>
      <p className="text-[9px] text-amber-600 mb-2">
        {PENETRACAO_CATALOGO.experimentados}/{PENETRACAO_CATALOGO.total} SKUs
      </p>
      <div className="h-14 flex items-center justify-center">
        <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#E6E4E0" strokeWidth="4" />
          <circle
            cx="28" cy="28" r="22"
            fill="none"
            stroke="#FF6B35"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
      </div>
    </Card>
  );
}

/* ──────────────────────── Placeholders ──────────────────────── */

function PlaceholderCard({ title, detail }: { title: string; detail: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="text-left p-2.5 rounded-lg border border-dashed border-border/60 bg-card/40 hover:bg-card/80 hover:border-primary/30 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium text-foreground leading-snug line-clamp-2">
          {title}
        </p>
        <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0 mt-0.5" />
      </div>
      <p className="text-[9px] text-muted-foreground/70 mt-1 leading-snug line-clamp-2">
        {hover ? detail : 'Disponível no drilldown completo'}
      </p>
    </button>
  );
}
