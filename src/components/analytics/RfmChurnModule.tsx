import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Target, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useRfmChurnAnalysis } from '@/hooks/useRfmChurnAnalysis';
import { useFilters } from '@/hooks/useFilters';

interface RfmChurnModuleProps {
  orgId: string;
  title?: string;
  description?: string;
}

const riskBadgeClass: Record<'baixo' | 'medio' | 'alto', string> = {
  baixo: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  medio: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  alto: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const RfmChurnModule = ({
  orgId,
  title = 'Matriz RFM e Predição de Churn',
  description = 'Novo módulo analítico para segmentação de clientes e risco de evasão.',
}: RfmChurnModuleProps) => {
  const { dateRangeISO } = useFilters();
  const { analysis, isLoading, isFetching, refetch } = useRfmChurnAnalysis(orgId, dateRangeISO);
  const { rows, summary } = analysis;

  const topRisk = useMemo(() => rows.slice(0, 10), [rows]);
  const segmentEntries = useMemo(
    () => Object.entries(summary.segments).sort((a, b) => b[1] - a[1]),
    [summary.segments],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-2 shrink-0"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Atualizar análise
        </Button>
      </div>

      {/* 4 KPIs do mesmo tamanho — padrao Arguto */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total avaliados</CardDescription>
            <CardTitle className="text-2xl text-foreground">{summary.customers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Risco Alto</CardDescription>
            <CardTitle className="text-2xl text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {summary.highRiskCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Risco Médio</CardDescription>
            <CardTitle className="text-2xl text-amber-500">{summary.mediumRiskCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Risco Baixo</CardDescription>
            <CardTitle className="text-2xl text-emerald-500 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              {summary.lowRiskCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Segmentos RFM */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4" />
            Segmentos RFM
          </CardTitle>
          <CardDescription>Distribuição de clientes por perfil de relacionamento e valor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="py-8 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processando matriz RFM...
            </div>
          ) : segmentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados suficientes para gerar segmentos.</p>
          ) : (
            segmentEntries.map(([segment, count]) => {
              const pct = summary.customers > 0 ? (count / summary.customers) * 100 : 0;
              return (
                <div key={segment} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{segment}</span>
                    <span className="text-muted-foreground">{count} clientes ({pct.toFixed(1)}%)</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Clientes prioritários para retenção */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes prioritários para retenção</CardTitle>
          <CardDescription>Ordenados pela probabilidade de churn calculada no módulo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {topRisk.map(row => (
            <div key={`churn-${row.customerKey}`} className="p-3 rounded-lg border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  Probabilidade de churn: {(row.churnProbability * 100).toFixed(1)}% · Segmento {row.rfmSegment} · RFM {row.rfmScore}
                </p>
              </div>
              <Badge variant="outline" className={riskBadgeClass[row.churnRiskBand]}>
                {row.churnRiskBand.toUpperCase()}
              </Badge>
            </div>
          ))}
          {!isLoading && topRisk.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem dados para predição de churn.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RfmChurnModule;
