import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Share2,
  Download,
  Filter,
  Layout,
  Calendar,
  ChevronDown,
  Sparkles,
  Volume2,
  Mic2,
  Play,
  Monitor,
  Database,
  Loader2,
  TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import DashboardEngine from '@/components/dashboard/DashboardEngine';
import { Card, CardContent } from '@/components/ui/card';
import { ReportGenerator } from '@/lib/report-generator';
import { useDashboardNarrative } from '@/hooks/useDashboardNarrative';

const Dashboard = () => {
  const { orgId } = useParams();
  const { toast } = useToast();
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch the default dashboard for this organization
  const { data: dashboard, isLoading: isLoadingDash } = useQuery({
    queryKey: ['org-dashboard', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_default', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Generate dynamic narrative
  const { narrative, isLoading: isLoadingNarrative } = useDashboardNarrative(dashboard?.id, orgId);

  const handleExportPDF = async () => {
    if (!dashboard) return;
    setIsExporting(true);

    toast({
      title: "Gerando Relatório",
      description: "Capturando dados e aplicando branding Pinn...",
    });

    try {
      await ReportGenerator.generateDashboardPDF('dashboard-content', {
        title: dashboard.name || 'Executive Dashboard',
        organizationName: 'Sua Organização', // Em breve puxar nome real da org
        aiSnapshot: "Olá! Hoje notamos um crescimento atípico de 22% nos leads provenientes do LinkedIn. Sua taxa de conversão geral está estável em 12.5%, mas o ticket médio subiu para R$ 2.4k.",
      });

      toast({
        title: "Relatório Concluído",
        description: "O PDF foi gerado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível gerar o PDF.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleVoiceBriefing = () => {
    setIsVoiceActive(true);
    toast({
      title: "CEO Voice Mode Ativado",
      description: "A IA está preparando seu resumo executivo em áudio...",
    });

    // Use narrative text or fallback
    const textToSpeak = narrative?.text || 
      "Olá! Hoje notamos um crescimento atípico de vinte e dois por cento nos leads provenientes do LinkedIn. Sua taxa de conversão geral está estável, mas o ticket médio subiu para dois mil e quatrocentos reais.";

    // Simulate TTS
    setTimeout(() => {
      setIsVoiceActive(false);
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'pt-BR';
      window.speechSynthesis.speak(utterance);
    }, 1500);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            {dashboard?.name || 'Tráfego Pago'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Performance de investimento em mídia — últimos 30 dias
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-4 rounded-lg gap-2 text-xs font-medium border-border/50"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Relatório PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-4 rounded-lg gap-2 text-xs font-medium border-primary/20 text-primary hover:bg-primary/5"
            onClick={handleVoiceBriefing}
            disabled={isVoiceActive}
          >
            {isVoiceActive ? (
              <div className="flex gap-0.5 items-center">
                <div className="w-0.5 h-2 bg-primary animate-bounce rounded-full" />
                <div className="w-0.5 h-3 bg-primary animate-bounce delay-75 rounded-full" />
                <div className="w-0.5 h-2.5 bg-primary animate-bounce delay-150 rounded-full" />
              </div>
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            CEO Briefing
          </Button>
        </div>
      </div>

      {/* AI Narrative — compact */}
      <Card className="border-border/40 bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden relative group rounded-xl">
        <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
          <Sparkles size={120} />
        </div>
        <CardContent className="p-5">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Mic2 className="text-primary w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Resumo Executivo</h3>
                {narrative?.trend && (
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                    narrative.trend === 'up' && "bg-emerald-500/10 text-emerald-500",
                    narrative.trend === 'down' && "bg-red-500/10 text-red-500",
                    narrative.trend === 'stable' && "bg-muted text-muted-foreground"
                  )}>
                    {narrative.trend === 'up' && <TrendingUp className="w-2.5 h-2.5" />}
                    {narrative.trend === 'down' && <TrendingDown className="w-2.5 h-2.5" />}
                    {narrative.trend === 'up' && 'Alta'}
                    {narrative.trend === 'down' && 'Baixa'}
                    {narrative.trend === 'stable' && 'Estável'}
                  </div>
                )}
              </div>
              {isLoadingNarrative ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-xs">Gerando insights...</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {narrative?.highlight ? (
                    <>
                      {narrative.text.split(narrative.highlight)[0]}
                      <span className="text-foreground font-semibold">{narrative.highlight}</span>
                      {narrative.text.split(narrative.highlight)[1]}
                    </>
                  ) : (
                    narrative?.text || "Configure seus widgets para ver insights automáticos."
                  )}
                </p>
              )}
              <Button variant="ghost" size="sm" className="text-primary gap-1.5 text-xs font-medium hover:bg-primary/5 h-7 px-2 -ml-2" onClick={handleVoiceBriefing}>
                <Play className="w-3 h-3 fill-current" />
                Ouvir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Widgets */}
      <div id="dashboard-content">
        {dashboard?.id ? (
          <>
            {console.log('[Dashboard] Rendering DashboardEngine with dashboardId:', dashboard.id)}
            <DashboardEngine dashboardId={dashboard.id} />
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[140px] rounded-xl bg-muted/20 animate-pulse border border-dashed border-border/50" />
            ))}
          </div>
        )}
      </div>

      {/* Floating Action */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button size="sm" className="h-10 px-5 rounded-full font-medium shadow-lg gap-2 text-xs">
          <Layout className="w-4 h-4" />
          Smart CRM
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[9px] text-primary-foreground font-bold">
            12
          </div>
        </Button>
      </div>
    </div>
  );
};

// Placeholder icon until I can confirm icons
const TrendingUp = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

export default Dashboard;
