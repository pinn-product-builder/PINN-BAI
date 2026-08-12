import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Info, TrendingUp, AlertTriangle, Lightbulb, Sparkles, ChevronRight, Loader2, RefreshCw, ShieldCheck, ShieldAlert, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useFilters } from '@/hooks/useFilters';

interface InsightCardProps {
  title: string;
  description: string;
}

interface AuditNumber {
  value: string;
  foundIn: 'context' | 'derived' | 'missing';
}

interface AuditTrailItem {
  label: string;
  formula: string;
  inputs: Record<string, string | number>;
  value: string;
}

interface InsightAudit {
  numbers: AuditNumber[];
  relatedTrail: AuditTrailItem[];
  evidenceVerified: boolean;
}

interface AIInsight {
  type: 'recommendation' | 'alert' | 'trend';
  priority: 'high' | 'medium' | 'low';
  content: string;
  evidence?: string;
  metric?: string;
  title?: string;
  sourceSection?: string;
  audit?: InsightAudit;
}

interface CalculationTrail {
  key: string;
  label: string;
  formula: string;
  inputs: Record<string, string | number>;
  value: string;
  available: boolean;
}

const typeConfig = {
  recommendation: {
    icon: Lightbulb,
    label: 'Recomendação',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/5',
    borderColor: 'border-amber-500/15',
    iconBg: 'bg-amber-500/10',
  },
  alert: {
    icon: AlertTriangle,
    label: 'Alerta',
    color: 'text-red-400',
    bgColor: 'bg-red-500/5',
    borderColor: 'border-red-500/15',
    iconBg: 'bg-red-500/10',
  },
  trend: {
    icon: TrendingUp,
    label: 'Tendência',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/5',
    borderColor: 'border-emerald-500/15',
    iconBg: 'bg-emerald-500/10',
  },
};

const priorityConfig = {
  high: { label: 'Alta', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  medium: { label: 'Média', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  low: { label: 'Baixa', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

function periodLabel(period: string): string {
  const map: Record<string, string> = {
    today: 'Hoje',
    week: 'Esta semana',
    last_15d: 'Últimos 15 dias',
    month: 'Mês atual',
    prev_month: 'Mês anterior',
    quarter: 'Trimestre',
    year: 'Ano',
    custom: 'Período personalizado',
  };
  return map[period] ?? period;
}

const InsightCard = ({ title, description }: InsightCardProps) => {
  const { orgId } = useParams();
  const { dateRangeISO, filters } = useFilters();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [trail, setTrail] = useState<CalculationTrail[]>([]);
  const [auditMode, setAuditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-data-chat', {
        body: { orgId, mode: 'insights', dateRange: dateRangeISO },
      });

      if (fnError) throw fnError;

      if (data?.insights && Array.isArray(data.insights)) {
        setInsights(data.insights.slice(0, 3));
      } else {
        setInsights([]);
      }
      if (Array.isArray(data?.calculationTrail)) {
        setTrail(data.calculationTrail);
      } else {
        setTrail([]);
      }
    } catch (err) {
      console.error('[InsightCard] Error:', err);
      setError('Não foi possível gerar insights');
      setInsights([]);
      setTrail([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Refetch quando muda org OU quando o filtro temporal global muda. Sem isso,
  // o card mostrava insights do recorte antigo enquanto o resto do dashboard
  // já tinha atualizado — gerava inconsistência visual.
  useEffect(() => {
    fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, dateRangeISO.start, dateRangeISO.end]);

  const availableTrail = trail.filter((t) => t.available);

  return (
    <Card className="rounded-xl bg-card/80 backdrop-blur-sm border-border/50 h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">{description}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Análise em tempo real via IA · <span className="text-primary font-medium">{periodLabel(filters.period)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={auditMode ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-[10px] gap-1"
              onClick={() => setAuditMode((v) => !v)}
              title="Modo auditoria: mostra números e fórmulas usados"
            >
              <ShieldCheck className="h-3 w-3" />
              Auditoria
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={fetchInsights}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 flex-1 overflow-y-auto min-h-0 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
        {auditMode && availableTrail.length > 0 && (
          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-2 p-2 rounded-md bg-muted/40 hover:bg-muted/60 transition text-xs font-medium">
                <Calculator className="w-3.5 h-3.5 text-primary" />
                Trilha de cálculos do sistema ({availableTrail.length})
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1.5 space-y-1">
              {availableTrail.map((t) => (
                <div key={t.key} className="px-2 py-1.5 rounded-md border border-border/40 bg-background/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold">{t.label}</span>
                    <span className="text-[11px] font-mono text-primary">{t.value}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    = {t.formula}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                    {Object.entries(t.inputs).map(([k, v]) => `${k}=${v}`).join(' · ')}
                  </p>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Gerando insights com IA...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-xs">{error}</p>
          </div>
        ) : insights.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-xs">Sem dados suficientes para insights</p>
          </div>
        ) : (
          insights.map((insight, idx) => {
            const config = typeConfig[insight.type] || typeConfig.recommendation;
            const priority = priorityConfig[insight.priority] || priorityConfig.medium;
            const Icon = config.icon;
            const audit = insight.audit;
            const numbersOk = audit?.numbers.filter((n) => n.foundIn === 'context').length ?? 0;
            const numbersTotal = audit?.numbers.length ?? 0;

            return (
              <div
                key={idx}
                className={cn(
                  'p-3 rounded-lg border transition-all duration-200',
                  'hover:translate-x-0.5 hover:shadow-sm',
                  config.borderColor,
                  config.bgColor,
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('p-1.5 rounded-md shrink-0', config.iconBg)}>
                    <Icon className={cn('w-3.5 h-3.5', config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 h-4 font-medium', priority.className)}>
                        {priority.label}
                      </Badge>
                      {insight.metric && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium bg-primary/5 text-primary border-primary/20">
                          {insight.metric}
                        </Badge>
                      )}
                      {auditMode && audit && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] px-1.5 py-0 h-4 font-medium gap-1',
                            audit.evidenceVerified
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                          )}
                        >
                          {audit.evidenceVerified ? <ShieldCheck className="w-2.5 h-2.5" /> : <ShieldAlert className="w-2.5 h-2.5" />}
                          {numbersOk}/{numbersTotal} verif.
                        </Badge>
                      )}
                    </div>
                    {insight.title && (
                      <p className="text-xs font-semibold text-foreground mb-0.5">{insight.title}</p>
                    )}
                    <p className="text-xs text-foreground/90 leading-relaxed">{insight.content}</p>
                    {insight.evidence ? (
                      <p className="text-[10px] text-muted-foreground/70 italic mt-1.5 border-l-2 border-muted-foreground/20 pl-2">
                        Fonte: {insight.evidence}
                      </p>
                    ) : (
                      <p className="text-[10px] text-amber-600 italic mt-1.5 border-l-2 border-amber-500/30 pl-2">
                        ⚠️ Insight sem referência verificável. Confirme as integrações ativas em <span className="font-semibold">/integrations</span> antes de tomar decisão.
                      </p>
                    )}
                    {auditMode && audit && (
                      <div className="mt-2 p-2 rounded-md bg-background/60 border border-border/40 space-y-1.5">
                        {insight.sourceSection && (
                          <p className="text-[10px] text-muted-foreground">
                            <span className="font-semibold">Seção usada:</span> {insight.sourceSection}
                          </p>
                        )}
                        {audit.numbers.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Números citados:</p>
                            <div className="flex flex-wrap gap-1">
                              {audit.numbers.map((n, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className={cn(
                                    'text-[9px] px-1.5 py-0 h-4 font-mono',
                                    n.foundIn === 'context'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : 'bg-red-500/10 text-red-400 border-red-500/20',
                                  )}
                                >
                                  {n.value} {n.foundIn === 'context' ? '✓' : '⚠'}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {audit.relatedTrail.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Cálculos linkados:</p>
                            <div className="space-y-0.5">
                              {audit.relatedTrail.map((rt, i) => (
                                <p key={i} className="text-[10px] text-muted-foreground font-mono">
                                  {rt.label} = <span className="text-primary">{rt.value}</span>{' '}
                                  <span className="text-muted-foreground/70">[{rt.formula}]</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mt-1" />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default InsightCard;
