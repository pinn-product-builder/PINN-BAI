import { useParams } from 'react-router-dom';
import { useFilters } from '@/hooks/useFilters';
import { useUnitEconomics } from '@/hooks/useUnitEconomics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Loader2, TrendingUp, DollarSign, Users, Target, Clock, Repeat, CalendarDays, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const CHANNEL_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  organic: 'Orgânico',
};

function KpiCard({
  label, value, sub, icon: Icon, health,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; health?: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const healthColor = {
    good: 'text-emerald-500',
    warn: 'text-amber-500',
    bad: 'text-destructive',
    neutral: 'text-primary',
  }[health ?? 'neutral'];

  return (
    <Card className="h-full">
      <CardContent className="p-4 h-full">
        <div className="flex items-start gap-3 h-full">
          <div className={cn('p-2 rounded-lg bg-muted', healthColor)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className={cn('text-xl font-bold mt-0.5', healthColor)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LtvCacBadge({ ratio }: { ratio: number }) {
  if (!isFinite(ratio)) return <Badge className="bg-emerald-500/10 text-emerald-500">∞ (orgânico)</Badge>;
  if (ratio >= 3) return <Badge className="bg-emerald-500/10 text-emerald-500">{NUM.format(ratio)}x — Excelente</Badge>;
  if (ratio >= 1) return <Badge className="bg-amber-500/10 text-amber-500">{NUM.format(ratio)}x — Atenção</Badge>;
  return <Badge className="bg-destructive/10 text-destructive">{NUM.format(ratio)}x — Crítico</Badge>;
}

export default function UnitEconomics() {
  const { orgId } = useParams<{ orgId: string }>();
  const { dateRangeISO } = useFilters();
  const { data: ue, isLoading } = useUnitEconomics(orgId, dateRangeISO);

  const ltvHealth = !ue ? 'neutral'
    : ue.ltvCacRatio >= 3 ? 'good'
    : ue.ltvCacRatio >= 1 ? 'warn'
    : 'bad';

  const channelChartData = ue?.byChannel
    .filter(c => c.channel !== 'organic')
    .map(c => ({
      name: CHANNEL_LABELS[c.channel] ?? c.channel,
      CAC: Math.round(c.cac),
      LTV: Math.round(c.ltv),
    })) ?? [];

  // ─── KPIs: grid estático Tailwind, 4 colunas no md+ (sempre lado a lado) ───
  // Sai do EditableCardGrid pra evitar que breakpoints do react-grid-layout
  // empilhem as cards em telas médias. Drag/drop continua nos widgets maiores.
  const kpiCards = ue ? (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        label="CAC"
        value={ue.cac > 0 ? BRL.format(ue.cac) : 'N/A'}
        sub="Custo por cliente pago"
        icon={DollarSign}
        health={ue.cac > 0 ? (ue.ltvCacRatio >= 3 ? 'good' : ue.ltvCacRatio >= 1 ? 'warn' : 'bad') : 'neutral'}
      />
      <KpiCard
        label="LTV"
        value={BRL.format(ue.ltv)}
        sub={`${ue.avgRetentionMonths} meses ret. est.`}
        icon={Repeat}
        health="neutral"
      />
      <KpiCard
        label="LTV:CAC"
        value={ue.cac > 0 ? `${NUM.format(ue.ltvCacRatio)}x` : '∞'}
        sub={ue.ltvCacRatio >= 3 ? 'Meta: ≥ 3x ✓' : 'Meta: ≥ 3x'}
        icon={Target}
        health={ltvHealth}
      />
      <KpiCard
        label="Payback"
        value={ue.paybackMonths > 0 ? `${NUM.format(ue.paybackMonths)} meses` : '—'}
        sub="Para recuperar o CAC"
        icon={Clock}
        health={ue.paybackMonths > 0 ? (ue.paybackMonths <= 6 ? 'good' : ue.paybackMonths <= 12 ? 'warn' : 'bad') : 'neutral'}
      />
      <KpiCard
        label="Ticket Médio"
        value={BRL.format(ue.avgTicket)}
        sub={`${ue.totalConversions} conversões`}
        icon={DollarSign}
        health="neutral"
      />
      <KpiCard
        label="Verba Total"
        value={BRL.format(ue.totalSpend)}
        sub={`${ue.paidConversions} conv. pagas`}
        icon={Wallet}
        health="neutral"
      />
      <KpiCard
        label="Receita Total"
        value={BRL.format(ue.totalRevenue)}
        sub={`${ue.totalConversions} clientes convertidos`}
        icon={Users}
        health="neutral"
      />
      <KpiCard
        label="Retenção Média"
        value={`${ue.avgRetentionMonths} meses`}
        sub="Janela usada no LTV"
        icon={CalendarDays}
        health="neutral"
      />
    </div>
  ) : null;

  // ─── Cards maiores (stack full-width, igual ao Arguto) ───
  const largeCards = ue ? (
    <>
      <Card className={cn(
        'border',
        ltvHealth === 'good' ? 'border-emerald-500/30 bg-emerald-500/5' :
        ltvHealth === 'warn' ? 'border-amber-500/30 bg-amber-500/5' :
        ltvHealth === 'bad' ? 'border-destructive/30 bg-destructive/5' : '',
      )}>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-semibold text-sm">Saúde do Ratio LTV:CAC</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ltvHealth === 'good'
                ? 'Excelente. Para cada R$ 1 investido em aquisição, você recupera ' + NUM.format(ue.ltvCacRatio) + 'x.'
                : ltvHealth === 'warn'
                ? 'Atenção. O retorno está abaixo do ideal (3x). Revise o ticket médio ou reduza o CAC.'
                : 'Crítico. O custo de aquisição é maior que o valor gerado pelo cliente. Intervenção urgente necessária.'}
            </p>
          </div>
          <LtvCacBadge ratio={ue.ltvCacRatio} />
        </CardContent>
      </Card>

      {ue.byChannel.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Comparativo por Canal</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {ue.byChannel.map((ch) => (
                <div key={ch.channel} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{CHANNEL_LABELS[ch.channel] ?? ch.channel}</p>
                    <p className="text-xs text-muted-foreground">
                      {ch.conversions} conv · {ch.spend > 0 ? BRL.format(ch.spend) : 'Sem gasto'}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs font-semibold">CAC: {ch.cac > 0 ? BRL.format(ch.cac) : '—'}</p>
                    <LtvCacBadge ratio={ch.ltvCacRatio} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {channelChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">CAC vs LTV por Canal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={channelChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number, name: string) => [BRL.format(v), name]}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="CAC" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} opacity={0.8} />
                <Bar dataKey="LTV" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} opacity={0.8} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Conversões por Origem</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Pagas (ads)', value: ue.paidConversions, color: 'text-primary' },
            { label: 'Orgânicas', value: ue.organicConversions, color: 'text-emerald-500' },
            { label: 'Convertidos', value: ue.totalConversions, color: 'text-foreground' },
            { label: 'Retenção (m)', value: ue.avgRetentionMonths, color: 'text-amber-500' },
          ].map((item) => (
            <div key={item.label} className="text-center p-3 rounded-lg bg-muted/50">
              <p className={cn('text-2xl font-bold', item.color)}>{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  ) : null;

  return (
    <div className="p-6 space-y-6 pb-24 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Unit Economics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            CAC, LTV e payback cruzando CRM com investimento em mídia paga.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !ue ? (
        <div className="text-center py-24 text-muted-foreground">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Sem dados suficientes</p>
          <p className="text-sm mt-1">Conecte Meta Ads ou Google Ads e importe clientes convertidos.</p>
        </div>
      ) : (
        <>
          {kpiCards}
          {largeCards}
        </>
      )}
    </div>
  );
}
