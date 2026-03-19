import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Target, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useRfmChurnAnalysis } from '@/hooks/useRfmChurnAnalysis';

interface RfmChurnModuleProps {
  orgId: string;
  title?: string;
  description?: string;
  dashboardNames?: string[];
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const riskBadgeClass: Record<'baixo' | 'medio' | 'alto', string> = {
  baixo: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  medio: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  alto: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const RfmChurnModule = ({
  orgId,
  title = 'Matriz RFM e Predição de Churn',
  description = 'Novo módulo analítico para segmentação de clientes e risco de evasão.',
  dashboardNames = ['Executivo', 'Tráfego Pago', 'Conversas'],
}: RfmChurnModuleProps) => {
  const { analysis, isLoading, isFetching, refetch } = useRfmChurnAnalysis(orgId);
  const { rows, summary } = analysis;

  const topRisk = useMemo(() => rows.slice(0, 10), [rows]);
  const segmentEntries = useMemo(
    () => Object.entries(summary.segments).sort((a, b) => b[1] - a[1]),
    [summary.segments],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Atualizar análise
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Clientes avaliados</CardDescription>
            <CardTitle className="text-2xl">{summary.customers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Risco alto de churn</CardDescription>
            <CardTitle className="text-2xl text-red-500">{summary.highRiskCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recência média (dias)</CardDescription>
            <CardTitle className="text-2xl">{Math.round(summary.avgRecencyDays || 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monetário total</CardDescription>
            <CardTitle className="text-2xl">{currency.format(summary.totalMonetary || 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ativação do módulo nos 3 dashboards</CardTitle>
          <CardDescription>Aplicado como nova tela/módulo para os dashboards estratégicos.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {dashboardNames.slice(0, 3).map(name => (
            <div key={name} className="p-3 rounded-lg border bg-card/50 flex items-center justify-between">
              <span className="font-medium">{name}</span>
              <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary">Ativo</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="rfm" className="w-full">
        <TabsList>
          <TabsTrigger value="rfm">Matriz RFM</TabsTrigger>
          <TabsTrigger value="churn">Predição de Churn</TabsTrigger>
        </TabsList>

        <TabsContent value="rfm" className="space-y-4">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top clientes por risco (com score RFM)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topRisk.slice(0, 8).map(row => (
                <div key={row.customerKey} className="p-3 rounded-lg border flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {row.email || 'sem e-mail'} - Segmento {row.rfmSegment}
                    </p>
                  </div>
                  <Badge variant="outline">RFM {row.rfmScore}</Badge>
                </div>
              ))}
              {!isLoading && topRisk.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem clientes para exibir.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="churn" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Risco Alto</CardDescription>
                <CardTitle className="text-xl text-red-500 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {summary.highRiskCount}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Risco Médio</CardDescription>
                <CardTitle className="text-xl text-amber-500">{summary.mediumRiskCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Risco Baixo</CardDescription>
                <CardTitle className="text-xl text-emerald-500 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  {summary.lowRiskCount}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

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
                      Probabilidade de churn: {(row.churnProbability * 100).toFixed(1)}%
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RfmChurnModule;
