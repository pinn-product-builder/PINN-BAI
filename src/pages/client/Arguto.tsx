import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, ListChecks, Calculator, ShieldAlert } from 'lucide-react';
import ExecutiveSnapshot from '@/components/arguto/ExecutiveSnapshot';
import Operacao from '@/components/arguto/Operacao';
import RoiSimulator from '@/components/arguto/RoiSimulator';
import RfmChurnModule from '@/components/analytics/RfmChurnModule';
import { isRfmChurnEnabledForOrg } from '@/lib/featureFlags';

const Arguto = () => {
  const { orgId } = useParams();
  const [tab, setTab] = useState('snapshot');
  const churnEnabled = isRfmChurnEnabledForOrg(orgId);

  return (
    <div className="p-6 lg:p-8 space-y-6 pb-24">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
            Desafio 1
          </span>
          <span className="text-muted-foreground/60 text-[10px]">·</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Inteligência Comercial Preditiva · Distribuição B2B
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Inteligência na distribuição e vendas de produtos
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
          Sistema operacional de receita pra distribuição B2B. <strong className="text-foreground">Prospecção para máquinas. Fechamento para humanos.</strong>
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className={`grid w-full ${churnEnabled ? 'max-w-3xl grid-cols-4' : 'max-w-2xl grid-cols-3'} h-11 bg-muted/40`}>
          <TabsTrigger value="snapshot" className="gap-1.5 text-xs">
            <LayoutDashboard className="w-3.5 h-3.5" />
            Executive Snapshot
          </TabsTrigger>
          <TabsTrigger value="operacao" className="gap-1.5 text-xs">
            <ListChecks className="w-3.5 h-3.5" />
            Operação
          </TabsTrigger>
          {churnEnabled && (
            <TabsTrigger value="churn" className="gap-1.5 text-xs">
              <ShieldAlert className="w-3.5 h-3.5" />
              Predição de Churn
            </TabsTrigger>
          )}
          <TabsTrigger value="roi" className="gap-1.5 text-xs">
            <Calculator className="w-3.5 h-3.5" />
            Simulação ROI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="snapshot" className="mt-6">
          <ExecutiveSnapshot onOpenChurn={churnEnabled ? () => setTab('churn') : undefined} />
        </TabsContent>
        <TabsContent value="operacao" className="mt-6">
          <Operacao />
        </TabsContent>
        {churnEnabled && orgId && (
          <TabsContent value="churn" className="mt-6">
            <RfmChurnModule
              orgId={orgId}
              title="Predição de Churn · BAI Engine"
              description="Engine de scoring que alimenta os alertas operacionais — recência, frequência, monetário, razões detectadas e probabilidade por cliente."
            />
          </TabsContent>
        )}
        <TabsContent value="roi" className="mt-6">
          <RoiSimulator />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Arguto;
