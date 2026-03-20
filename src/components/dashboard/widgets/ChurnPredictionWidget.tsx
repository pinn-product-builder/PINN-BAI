import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useRfmChurnAnalysis } from '@/hooks/useRfmChurnAnalysis';

interface ChurnPredictionWidgetProps {
  orgId: string;
  title: string;
  description: string;
}

const riskBadgeClass: Record<'baixo' | 'medio' | 'alto', string> = {
  baixo: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  medio: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  alto: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const ChurnPredictionWidget = ({ orgId, title, description }: ChurnPredictionWidgetProps) => {
  const { analysis, isLoading } = useRfmChurnAnalysis(orgId);
  const { rows, summary } = analysis;
  const topRisk = rows.slice(0, 5);

  return (
    <Card className="rounded-xl bg-card/80 backdrop-blur-sm border-border/50 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="h-[170px] flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Calculando risco de churn...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Alto</p>
                <p className="text-base font-semibold text-red-500">{summary.highRiskCount}</p>
              </div>
              <div className="rounded-md border p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Médio</p>
                <p className="text-base font-semibold text-amber-500">{summary.mediumRiskCount}</p>
              </div>
              <div className="rounded-md border p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Baixo</p>
                <p className="text-base font-semibold text-emerald-500 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {summary.lowRiskCount}
                </p>
              </div>
            </div>

            {topRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados para predição de churn.</p>
            ) : (
              <div className="space-y-2">
                {topRisk.map(row => (
                  <div key={row.customerKey} className="flex items-center justify-between gap-2 p-2 rounded-md border">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{row.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(row.churnProbability * 100).toFixed(1)}% prob.
                      </p>
                    </div>
                    <Badge variant="outline" className={riskBadgeClass[row.churnRiskBand]}>
                      {row.churnRiskBand.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ChurnPredictionWidget;
