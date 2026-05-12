import { useState, useMemo, Fragment } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronDown, ChevronRight, MessageSquare, FileText, MapPin, Route,
} from 'lucide-react';
import { ARGUTO_CLIENTS, SIGNAL_STYLE } from '@/data/arguto-demo';
import DrilldownPanel from './DrilldownPanel';
import ArgutoMap from './ArgutoMap';
import { cn } from '@/lib/utils';

const fmtBRL = (v: number) =>
  v >= 1_000 ? `R$ ${(v / 1_000).toFixed(1)}K` : `R$ ${v.toLocaleString('pt-BR')}`;

export default function Operacao() {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Ranqueado por receita esperada × probabilidade
  const ranked = useMemo(
    () =>
      [...ARGUTO_CLIENTS].sort(
        (a, b) =>
          b.receitaEsperada * (b.probConversao / 100) -
          a.receitaEsperada * (a.probConversao / 100)
      ),
    []
  );

  const totalEsperado = ranked.reduce(
    (acc, c) => acc + c.receitaEsperada * (c.probConversao / 100),
    0
  );

  const handlePrePedido = (cliente: string) => {
    toast({
      title: 'Pré-pedido gerado',
      description: `Rascunho montado pra ${cliente} com base no histórico. Pronto pra revisão do vendedor.`,
    });
  };

  const handleMensagem = (cliente: string) => {
    toast({
      title: 'Mensagem WhatsApp gerada',
      description: `Texto personalizado pronto pra ${cliente} — copiado pro template do time.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">
            Operação — próximas 24 horas
          </h2>
          <p className="text-sm text-muted-foreground">
            BAI não substitui vendedor. Diz pra ele onde ir, quando ir, o que oferecer.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Receita esperada hoje</p>
            <p className="text-xl font-bold tabular-nums text-foreground">{fmtBRL(totalEsperado)}</p>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <Card className="overflow-hidden border-border/50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border/50">
              <tr className="text-left">
                <th className="px-3 py-2.5 w-8"></th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Score ICP</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sinal detectado</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Receita esp.</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Prob. conv.</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ação recomendada</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center">Gerar</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((c) => {
                const style = SIGNAL_STYLE[c.sinal];
                const isOpen = expandedId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr
                      className={cn(
                        'border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer',
                        isOpen && 'bg-muted/15'
                      )}
                      onClick={() => setExpandedId(isOpen ? null : c.id)}
                    >
                      <td className="px-3 py-3">
                        {isOpen
                          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                      </td>
                      <td className="px-3 py-3">
                        <div>
                          <p className="font-medium text-foreground">{c.cliente}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {c.cidade}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn(
                          'inline-flex items-center justify-center w-9 h-7 rounded text-xs font-bold tabular-nums',
                          c.scoreICP >= 85 && 'bg-emerald-100 text-emerald-700',
                          c.scoreICP >= 70 && c.scoreICP < 85 && 'bg-amber-100 text-amber-700',
                          c.scoreICP < 70 && 'bg-rose-100 text-rose-700'
                        )}>
                          {c.scoreICP}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-start gap-2">
                          <Badge
                            variant="outline"
                            className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0"
                            style={{ background: style.bg, color: style.fg, borderColor: style.border }}
                          >
                            {style.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground leading-snug">{c.sinalDetalhe}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-semibold tabular-nums text-foreground">{fmtBRL(c.receitaEsperada)}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={cn(
                          'font-semibold tabular-nums',
                          c.probConversao >= 70 && 'text-emerald-600',
                          c.probConversao >= 50 && c.probConversao < 70 && 'text-amber-600',
                          c.probConversao < 50 && 'text-rose-600'
                        )}>
                          {c.probConversao}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-foreground">{c.acaoRecomendada}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] gap-1 px-2"
                            onClick={() => handlePrePedido(c.cliente)}
                          >
                            <FileText className="w-3 h-3" />
                            Pedido
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] gap-1 px-2"
                            onClick={() => handleMensagem(c.cliente)}
                          >
                            <MessageSquare className="w-3 h-3" />
                            WhatsApp
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/10">
                        <td colSpan={8} className="p-0">
                          <DrilldownPanel client={c} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mini-mapa */}
      <Card className="overflow-hidden border-border/50">
        <div className="p-4 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Roteirização otimizada do dia</h3>
            <Badge variant="outline" className="text-[10px] ml-2">
              {ARGUTO_CLIENTS.length} destinos · receita × tempo
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">Triângulo Mineiro / Alto Paranaíba</p>
        </div>
        <div className="h-[380px] w-full relative z-0">
          <ArgutoMap clients={ranked} routeTop={5} />
        </div>
        <div className="p-3 bg-muted/20 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: SIGNAL_STYLE.recompra.fg }} />
              Recompra
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: SIGNAL_STYLE.churn.fg }} />
              Churn
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: SIGNAL_STYLE.mix.fg }} />
              Mix
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: SIGNAL_STYLE.upsell.fg }} />
              Upsell
            </span>
          </div>
          <span>Tamanho do círculo ∝ receita esperada</span>
        </div>
      </Card>
    </div>
  );
}
