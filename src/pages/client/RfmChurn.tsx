import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import RfmChurnModule from '@/components/analytics/RfmChurnModule';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Target } from 'lucide-react';

const ClientRfmChurn = () => {
  const { orgId } = useParams();
  const [refetch, setRefetch] = useState<{ run: () => void; isFetching: boolean }>({
    run: () => {},
    isFetching: false,
  });

  // Recebe o refetch/loading do módulo para alimentar o botão do header padrão
  // (mesma estrutura visual de Goals, CustomerHealth, UnitEconomics, etc.).
  const handleRefetch = useCallback((run: () => void, isFetching: boolean) => {
    setRefetch({ run, isFetching });
  }, []);

  return (
    <div className="p-6 space-y-6 pb-24 max-w-7xl mx-auto">
      {/* Header — segue o padrão das outras páginas client (ícone + h1 +
          descrição + ação primária à direita), garantindo o mesmo recuo
          visual em relação à sidebar/GlobalFilterBar. */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Módulo RFM + Churn
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tela nova para análise de segmentação e retenção aplicada aos dashboards do cliente.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => refetch.run()}
          disabled={refetch.isFetching}
        >
          {refetch.isFetching
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          Atualizar análise
        </Button>
      </div>

      <RfmChurnModule
        orgId={orgId || ''}
        showHeader={false}
        onRefetch={handleRefetch}
      />
    </div>
  );
};

export default ClientRfmChurn;
