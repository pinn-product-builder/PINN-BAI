import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  Loader2,
  TrendingDown,
  Volume2,
  Play,
  Sparkles,
  Mic2,
  BarChart3,
  MessageSquare,
  Phone,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import DashboardEngine from '@/components/dashboard/DashboardEngine';
import { Card, CardContent } from '@/components/ui/card';
import { ReportGenerator } from '@/lib/report-generator';
import { useDashboardNarrative } from '@/hooks/useDashboardNarrative';

const DASH_ICONS: Record<string, React.ReactNode> = {
  'Executivo': <LayoutDashboard className="w-4 h-4" />,
  'Tráfego Pago': <BarChart3 className="w-4 h-4" />,
  'Conversas': <MessageSquare className="w-4 h-4" />,
  'Ligações VAPI': <Phone className="w-4 h-4" />,
};

const Dashboard = () => {
  const { orgId } = useParams();
  const { toast } = useToast();
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedDashId, setSelectedDashId] = useState<string | null>(null);

  // Fetch ALL dashboards for this org
  const { data: dashboards, isLoading: isLoadingDashes } = useQuery({
    queryKey: ['org-dashboards', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .eq('org_id', orgId)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  // Auto-select default dashboard
  const activeDash = dashboards?.find(d => d.id === selectedDashId) 
    || dashboards?.find(d => d.is_default) 
    || dashboards?.[0];

  // Generate dynamic narrative
  const { narrative, isLoading: isLoadingNarrative } = useDashboardNarrative(activeDash?.id, orgId);

  const handleExportPDF = async () => {
    if (!activeDash) return;
    setIsExporting(true);
    toast({ title: "Gerando Relatório", description: "Capturando dados e aplicando branding Pinn..." });
    try {
      await ReportGenerator.generateDashboardPDF('dashboard-content', {
        title: activeDash.name || 'Dashboard',
        organizationName: 'Sua Organização',
        aiSnapshot: narrative?.text || '',
      });
      toast({ title: "Relatório Concluído", description: "O PDF foi gerado com sucesso." });
    } catch {
      toast({ title: "Erro ao exportar", description: "Não foi possível gerar o PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleVoiceBriefing = () => {
    setIsVoiceActive(true);
    toast({ title: "CEO Voice Mode Ativado", description: "A IA está preparando seu resumo executivo em áudio..." });
    const textToSpeak = narrative?.text || "Nenhum insight disponível no momento.";
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
        <div className="space-y-2">
          {/* Dashboard Selector Dropdown */}
          <div className="flex items-center gap-3">
            <Select
              value={activeDash?.id || ''}
              onValueChange={(id) => setSelectedDashId(id)}
            >
              <SelectTrigger className="w-[260px] h-10 text-base font-bold border-border/50 bg-card/80 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  {activeDash && DASH_ICONS[activeDash.name]}
                  <SelectValue placeholder="Selecionar dashboard" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                {dashboards?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <div className="flex items-center gap-2">
                      {DASH_ICONS[d.name] || <LayoutDashboard className="w-4 h-4" />}
                      <span>{d.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {activeDash?.description || 'Performance dos últimos 30 dias'}
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
                    {narrative.trend === 'up' && <TrendingUpIcon className="w-2.5 h-2.5" />}
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
        {activeDash?.id ? (
          <DashboardEngine dashboardId={activeDash.id} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[140px] rounded-xl bg-muted/20 animate-pulse border border-dashed border-border/50" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Placeholder icon
const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

export default Dashboard;
