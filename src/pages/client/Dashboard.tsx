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
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DashboardEngine from '@/components/dashboard/DashboardEngine';
import { Card, CardContent } from '@/components/ui/card';
import { ReportGenerator } from '@/lib/report-generator';

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

    // Simulate TTS
    setTimeout(() => {
      setIsVoiceActive(false);
      const utterance = new SpeechSynthesisUtterance(
        "Olá! Hoje notamos um crescimento atípico de vinte e dois por cento nos leads provenientes do LinkedIn. Sua taxa de conversão geral está estável, mas o ticket médio subiu para dois mil e quatrocentos reais."
      );
      utterance.lang = 'pt-BR';
      window.speechSynthesis.speak(utterance);
    }, 1500);
  };

  return (
    <div className="p-8 space-y-8 pb-32">
      {/* Dynamic Header with AI Briefing Trigger */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-accent font-bold text-xs uppercase tracking-tight">
            <Sparkles className="w-3 h-3 fill-current" />
            Insights em Tempo Real
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
            {dashboard?.name || 'Executive Dashboard'}
          </h1>
          <p className="text-muted-foreground text-lg">
            Bem-vindo ao seu centro de comando. Aqui está o que aconteceu hoje.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-12 px-6 rounded-xl gap-2 font-bold border-white/10 hover:bg-white/5 text-white/70"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Relatório PDF
          </Button>
          <Button
            variant="outline"
            className="h-12 px-6 rounded-xl gap-2 font-bold border-accent/20 hover:bg-accent/5 text-accent"
            onClick={handleVoiceBriefing}
            disabled={isVoiceActive}
          >
            {isVoiceActive ? (
              <div className="flex gap-1 items-center">
                <div className="w-1 h-3 bg-accent animate-bounce" />
                <div className="w-1 h-5 bg-accent animate-bounce delay-75" />
                <div className="w-1 h-4 bg-accent animate-bounce delay-150" />
              </div>
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
            CEO Briefing
          </Button>
          <Button className="h-12 px-6 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold shadow-lg shadow-accent/20 gap-2">
            <Plus className="w-4 h-4" />
            Novo Widget
          </Button>
        </div>
      </div>

      {/* AI Narrative Section */}
      <Card className="border-none shadow-2xl bg-gradient-to-br from-accent/15 via-background to-background overflow-hidden relative group rounded-3xl">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Sparkles size={180} />
        </div>
        <CardContent className="p-10">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-20 h-20 rounded-3xl bg-accent flex items-center justify-center shadow-2xl shadow-accent/30 shrink-0 transform group-hover:scale-105 transition-transform">
              <Mic2 className="text-accent-foreground w-10 h-10" />
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-foreground">Resumo Narrativo: <span className="text-accent tracking-tight">Destaques do Dia</span></h3>
                <div className="h-1 w-20 bg-accent mt-1 rounded-full" />
              </div>
              <p className="text-muted-foreground leading-relaxed text-xl max-w-4xl font-medium">
                "Olá! Hoje notamos um <span className="text-foreground font-bold underline decoration-accent/30 underline-offset-4">crescimento atípico de 22%</span> nos leads provenientes do LinkedIn.
                Sua taxa de conversão geral está estável em 12.5%, mas o ticket médio subiu para R$ 2.4k.
                Recomendamos focar nas campanhas de São Paulo para aproveitar o feriado regional."
              </p>
              <div className="flex gap-4">
                <Button variant="ghost" size="sm" className="text-accent gap-2 font-bold hover:bg-accent/5 rounded-lg" onClick={handleVoiceBriefing}>
                  <Play className="w-3 h-3 fill-current" />
                  Ouvir Resumo por IA
                </Button>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success text-[10px] font-bold uppercase tracking-widest">
                  <TrendingUp className="w-3 h-3" />
                  Tendência de Alta
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Grid Engine */}
      <div className="space-y-6" id="dashboard-content">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="w-5 h-5 text-accent" />
            Visão Detalhada
          </h2>
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl">
            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-bold bg-background shadow-sm">Grade</Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-bold">Lista</Button>
          </div>
        </div>

        {dashboard?.id ? (
          <DashboardEngine dashboardId={dashboard.id} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-80 rounded-3xl bg-muted/20 animate-pulse border-2 border-dashed border-muted" />
            ))}
          </div>
        )}
      </div>

      {/* Floating Action for CRM Kanban */}
      <div className="fixed bottom-8 right-8 z-50">
        <Button className="h-16 px-10 rounded-full bg-foreground text-background font-bold shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:scale-105 transition-transform gap-3 group">
          <Layout className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          Visualizar Smart CRM
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center text-[10px] text-accent-foreground animate-pulse shadow-lg shadow-accent/50">
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
