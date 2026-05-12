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
    <div className="p-6 space-y-6 pb-24 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
              Desafio 1
            </span>
            <span className="text-muted-foreground/60 text-[10px]">·</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Inteligência Comercial Preditiva · Distribuição B2B
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Inteligência na distribuição e vendas de produtos
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Sistema operacional de receita pra distribuição B2B. <strong className="text-foreground">Prospecção para máquinas. Fechamento para humanos.</strong>
          </p>
        </div>

        {/* Botão Editar Layout removido — Snapshot agora usa grid Tailwind
            estático (sempre 4 colunas lado a lado, sem drag/drop). */}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        {/* Mobile: scroll horizontal, full width tappable. Desktop: grid fixo. */}
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <TabsList
            className={`inline-flex sm:grid sm:w-full ${churnEnabled ? 'sm:max-w-3xl sm:grid-cols-4' : 'sm:max-w-2xl sm:grid-cols-3'} h-11 bg-muted/40 gap-1 sm:gap-0`}
          >
            <TabsTrigger value="snapshot" className="gap-1.5 text-xs px-3 whitespace-nowrap shrink-0 sm:shrink">
              <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
              <span className="lg:hidden">Snapshot</span>
              <span className="hidden lg:inline">Executive Snapshot</span>
            </TabsTrigger>
            <TabsTrigger value="operacao" className="gap-1.5 text-xs px-3 whitespace-nowrap shrink-0 sm:shrink">
              <ListChecks className="w-3.5 h-3.5 shrink-0" />
              <span>Operação</span>
            </TabsTrigger>
            {churnEnabled && (
              <TabsTrigger value="churn" className="gap-1.5 text-xs px-3 whitespace-nowrap shrink-0 sm:shrink">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span className="lg:hidden">Churn</span>
                <span className="hidden lg:inline">Predição de Churn</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="roi" className="gap-1.5 text-xs px-3 whitespace-nowrap shrink-0 sm:shrink">
              <Calculator className="w-3.5 h-3.5 shrink-0" />
              <span className="lg:hidden">ROI</span>
              <span className="hidden lg:inline">Simulação ROI</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="snapshot" className="mt-6">
          <ExecutiveSnapshot
            onOpenChurn={churnEnabled ? () => setTab('churn') : undefined}
          />
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
