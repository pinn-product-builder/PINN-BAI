import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Target } from 'lucide-react';
import { useRfmChurnAnalysis } from '@/hooks/useRfmChurnAnalysis';

interface RFMMatrixWidgetProps {
  orgId: string;
  title: string;
  description: string;
}

const RFMMatrixWidget = ({ orgId, title, description }: RFMMatrixWidgetProps) => {
  const { analysis, isLoading } = useRfmChurnAnalysis(orgId);
  const { rows, summary } = analysis;

  const segmentEntries = useMemo(
    () => Object.entries(summary.segments).sort((a, b) => b[1] - a[1]),
    [summary.segments],
  );

  return (
    <Card className="rounded-xl bg-card/80 backdrop-blur-sm border-border/50 h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              {title}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <Badge variant="outline">{summary.customers} clientes</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="h-[170px] flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Calculando matriz RFM...
          </div>
        ) : segmentEntries.length === 0 ? (
          <div className="h-[170px] flex items-center justify-center text-sm text-muted-foreground">
            Sem dados suficientes para montar a matriz RFM.
          </div>
        ) : (
          <>
            {segmentEntries.slice(0, 5).map(([segment, count]) => {
              const pct = summary.customers > 0 ? (count / summary.customers) * 100 : 0;
              return (
                <div key={segment} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{segment}</span>
                    <span className="text-muted-foreground">
                      {count} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
            {rows[0] && (
              <p className="text-xs text-muted-foreground pt-1">
                Segmento dominante: <span className="font-medium text-foreground">{rows[0].rfmSegment}</span>
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RFMMatrixWidget;
