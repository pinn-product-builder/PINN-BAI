import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  const navigate = useNavigate();
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
    <div className="p-6 lg:p-8 space-y-6 pb-32" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          {/* Dashboard selector */}
          <Select value={activeDash?.id || ''} onValueChange={(id) => setSelectedDashId(id)}>
            <SelectTrigger
              className="w-auto h-9 gap-2 border-border/40 bg-transparent text-foreground font-semibold text-base pl-0 pr-3 hover:bg-card/60 transition-colors focus:ring-0"
              style={{ fontFamily: "'Poppins', system-ui, sans-serif" }}
            >
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
          <p className="text-xs text-muted-foreground/60 pl-0.5">
            {activeDash?.description || 'Performance dos últimos 30 dias'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/client/${orgId}/rfm-churn`)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border/50 bg-card/60 text-muted-foreground hover:text-foreground hover:border-border/80 transition-all"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            RFM + Churn
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border/50 bg-card/60 text-muted-foreground hover:text-foreground hover:border-border/80 transition-all disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF
          </button>
          <button
            onClick={handleVoiceBriefing}
            disabled={isVoiceActive}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50"
            style={{
              borderColor: 'rgba(255,105,0,0.3)',
              color: '#FF6900',
              background: 'rgba(255,105,0,0.06)',
            }}
          >
            {isVoiceActive ? (
              <span className="flex gap-0.5 items-end">
                {[2, 3, 2.5].map((h, i) => (
                  <span key={i} className="w-0.5 rounded-full animate-bounce bg-primary"
                    style={{ height: `${h * 4}px`, animationDelay: `${i * 80}ms` }} />
                ))}
              </span>
            ) : <Volume2 className="w-3.5 h-3.5" />}
            CEO Briefing
          </button>
        </div>
      </div>

      {/* ── AI Narrative ── */}
      <div
        className="rounded-xl border border-border/30 p-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(255,105,0,0.04) 0%, hsl(var(--card)) 60%)' }}
      >
        {/* Background icon */}
        <Sparkles className="absolute top-3 right-3 w-20 h-20 text-primary/[0.04]" />

        <div className="flex gap-3 items-start relative z-10">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,105,0,0.12)', border: '1px solid rgba(255,105,0,0.2)' }}
          >
            <Mic2 className="w-4 h-4 text-primary" />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Resumo Executivo
              </h3>
              {narrative?.trend && (
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                  narrative.trend === 'up'     && "bg-emerald-500/10 text-emerald-400",
                  narrative.trend === 'down'   && "bg-red-500/10 text-red-400",
                  narrative.trend === 'stable' && "bg-muted text-muted-foreground"
                )}>
                  {narrative.trend === 'up'   && <TrendingUpIcon className="w-2.5 h-2.5" />}
                  {narrative.trend === 'down' && <TrendingDown className="w-2.5 h-2.5" />}
                  {narrative.trend === 'up' && 'Alta'}{narrative.trend === 'down' && 'Baixa'}{narrative.trend === 'stable' && 'Estável'}
                </span>
              )}
            </div>

            {isLoadingNarrative ? (
              <div className="flex items-center gap-2 text-muted-foreground/50">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[11px]">Gerando insights...</span>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {narrative?.highlight ? (
                  <>
                    {narrative.text.split(narrative.highlight)[0]}
                    <span className="text-foreground font-semibold">{narrative.highlight}</span>
                    {narrative.text.split(narrative.highlight)[1]}
                  </>
                ) : (narrative?.text || 'Configure seus widgets para ver insights automáticos.')}
              </p>
            )}

            <button
              onClick={handleVoiceBriefing}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary/70 hover:text-primary transition-colors mt-0.5"
            >
              <Play className="w-3 h-3 fill-current" />
              Ouvir
            </button>
          </div>
        </div>
      </div>

      {/* ── Widgets ── */}
      <div id="dashboard-content">
        {activeDash?.id ? (
          <DashboardEngine dashboardId={activeDash.id} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[140px] rounded-xl bg-muted/20 animate-pulse border border-dashed border-border/40" />
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
