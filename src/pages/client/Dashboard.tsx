import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShareDashboardDialog } from '@/components/dashboard/ShareDashboardDialog';
import { supabase } from '@/integrations/supabase/client';
import {
  Download,
  Share2,
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
  Move,
  Check,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import DashboardEngine from '@/components/dashboard/DashboardEngine';
import { ReportGenerator } from '@/lib/report-generator';
import { useDashboardNarrative } from '@/hooks/useDashboardNarrative';
import { isRfmChurnEnabledForOrg, isDemoOrg, isDemoSlug } from '@/lib/featureFlags';
import { useOrganizationBranding } from '@/contexts/OrganizationBrandingContext';
import { KpiCard } from '@/components/ui/KpiCard';
import { useKpiComparison, type IsoRange } from '@/hooks/useKpiComparison';

const DASH_ICONS: Record<string, React.ReactNode> = {
  'Executivo': <LayoutDashboard className="w-4 h-4" />,
  'Tráfego Pago': <BarChart3 className="w-4 h-4" />,
  'Conversas': <MessageSquare className="w-4 h-4" />,
  'Ligações VAPI': <Phone className="w-4 h-4" />,
};

// ─── Query functions (fora do componente = referência estável) ─────────────────
//
// Mock pra modo demo: Arguto (e equivalentes) não tem leads reais no Supabase,
// entao retornamos valores hardcoded coerentes com a narrativa do ExecutiveSnapshot.
const DEMO_KPI = {
  totalLeads:     1_247,
  totalLeadsPrev: 1_086,
  conversions:    476,
  conversionsPrev: 392,
  conversionRate: 38.2,
  conversionRatePrev: 36.1,
  revenue:        32_400_000,
  revenuePrev:    27_800_000,
};

async function fetchLeadsCount(orgId: string, range: IsoRange): Promise<number> {
  if (isDemoOrg(orgId)) return DEMO_KPI.totalLeads;
  const { count, error } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  if (error) throw error;
  return count ?? 0;
}

async function fetchConversionsCount(orgId: string, range: IsoRange): Promise<number> {
  if (isDemoOrg(orgId)) return DEMO_KPI.conversions;
  const { count, error } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'converted')
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  if (error) throw error;
  return count ?? 0;
}

async function fetchConversionRate(orgId: string, range: IsoRange): Promise<number> {
  if (isDemoOrg(orgId)) return DEMO_KPI.conversionRate;
  const { data, error } = await supabase
    .from('leads')
    .select('status')
    .eq('org_id', orgId)
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  if (error) throw error;
  const leads = data ?? [];
  if (leads.length === 0) return 0;
  const converted = leads.filter((l) => l.status === 'converted').length;
  return (converted / leads.length) * 100;
}

async function fetchRevenue(orgId: string, range: IsoRange): Promise<number> {
  if (isDemoOrg(orgId)) return DEMO_KPI.revenue;
  const { data, error } = await supabase
    .from('leads')
    .select('value')
    .eq('org_id', orgId)
    .eq('status', 'converted')
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  if (error) throw error;
  return (data ?? []).reduce((sum, l) => sum + (Number(l.value) || 0), 0);
}

// ─── Bloco de KPIs ─────────────────────────────────────────────────────────────

function KpiRow({ orgId }: { orgId: string }) {
  const isEnabled = !!orgId;

  const totalLeads = useKpiComparison({
    queryKey: ['kpi-leads', orgId],
    queryFn: (range) => fetchLeadsCount(orgId, range),
    enabled: isEnabled,
  });

  const conversions = useKpiComparison({
    queryKey: ['kpi-conversions', orgId],
    queryFn: (range) => fetchConversionsCount(orgId, range),
    enabled: isEnabled,
  });

  const conversionRate = useKpiComparison({
    queryKey: ['kpi-conv-rate', orgId],
    queryFn: (range) => fetchConversionRate(orgId, range),
    enabled: isEnabled,
  });

  const revenue = useKpiComparison({
    queryKey: ['kpi-revenue', orgId],
    queryFn: (range) => fetchRevenue(orgId, range),
    enabled: isEnabled,
  });

  // Todos compartilham o mesmo periodLabel (vêm do mesmo usePreviousPeriod internamente)
  const periodLabel = totalLeads.periodLabel;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        title="Total de Leads"
        value={totalLeads.current ?? 0}
        previousValue={totalLeads.previous ?? undefined}
        format="number"
        periodLabel={periodLabel}
        isLoading={totalLeads.isLoading}
      />
      <KpiCard
        title="Conversões"
        value={conversions.current ?? 0}
        previousValue={conversions.previous ?? undefined}
        format="number"
        periodLabel={periodLabel}
        isLoading={conversions.isLoading}
      />
      <KpiCard
        title="Taxa de Conversão"
        value={conversionRate.current ?? 0}
        previousValue={conversionRate.previous ?? undefined}
        format="percent"
        periodLabel={periodLabel}
        isLoading={conversionRate.isLoading}
      />
      <KpiCard
        title="Receita"
        value={revenue.current ?? 0}
        previousValue={revenue.previous ?? undefined}
        format="currency"
        periodLabel={periodLabel}
        isLoading={revenue.isLoading}
      />
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { orgId } = useParams();
  const { organization, isLoading: brandingLoading } = useOrganizationBranding();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedDashId, setSelectedDashId] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const showRfmChurn = isRfmChurnEnabledForOrg(orgId);

  // Detecção demo precisa rodar ANTES de qualquer query/fetch da org real,
  // mas DEPOIS dos hooks (regra de hooks: chamada consistente entre renders).
  const isDemo = isDemoSlug(organization?.slug) || isDemoOrg(orgId);

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
    enabled: !!orgId && !isDemo && !brandingLoading,
  });

  const activeDash = dashboards?.find(d => d.id === selectedDashId)
    || dashboards?.find(d => d.is_default)
    || dashboards?.[0];

  const { narrative, isLoading: isLoadingNarrative } = useDashboardNarrative(activeDash?.id, orgId);

  // Orgs em modo demo (ex.: Arguto) recebem a tela /arguto dedicada como
  // landing — evita session restaurada cair em /dashboard zerado.
  // Detecta por slug (estável entre ambientes) ou por id hardcoded (fallback).
  if (isDemo) {
    return <Navigate to={`/client/${orgId}/arguto`} replace />;
  }

  // Branding ainda carregando — espera pra evitar piscar o dashboard zerado
  // antes do redirect demo disparar pra orgs cujo id não bate o hardcoded.
  if (brandingLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

  // Restaura o grid pro layout-padrão (4 cards por linha, charts 2-up). Útil
  // quando o usuário arrastou widgets pra posições ruins e quer voltar à
  // disposição calculada automaticamente pelo DashboardEngine.
  const handleResetLayout = async () => {
    if (!activeDash) return;
    const ok = window.confirm(
      "Restaurar a organização padrão dos widgets? Suas customizações de posição serão perdidas.",
    );
    if (!ok) return;
    const { error } = await supabase
      .from('dashboards')
      .update({ layout: null, updated_at: new Date().toISOString() })
      .eq('id', activeDash.id);
    if (error) {
      toast({ title: "Não foi possível restaurar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Layout restaurado", description: "Recarregando..." });
    setTimeout(() => window.location.reload(), 400);
  };

  return (
    <div className="px-4 md:px-6 py-6 space-y-6 pb-24 max-w-[1480px] mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <h1 className="text-base font-semibold text-foreground">
            {activeDash?.name || 'Dashboard'}
          </h1>
          <p className="text-xs text-muted-foreground/60">
            {activeDash?.description || 'Performance dos últimos 30 dias'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeDash && (
            <button
              type="button"
              onClick={() => setIsEditingLayout((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-all",
                isEditingLayout
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/50 bg-card/60 text-muted-foreground hover:text-foreground hover:border-border/80"
              )}
            >
              {isEditingLayout ? <Check className="w-3.5 h-3.5" /> : <Move className="w-3.5 h-3.5" />}
              {isEditingLayout ? 'Concluir' : 'Editar layout'}
            </button>
          )}
          {activeDash && isEditingLayout && (
            <button
              type="button"
              onClick={handleResetLayout}
              title="Volta os widgets ao grid padrão (4 KPIs por linha)"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar grid
            </button>
          )}
          {showRfmChurn && (
            <button
              type="button"
              onClick={() => navigate(`/client/${orgId}/rfm-churn`)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border/50 bg-card/60 text-muted-foreground hover:text-foreground hover:border-border/80 transition-all"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              RFM + Churn
            </button>
          )}
          {activeDash && (
            <button
              onClick={() => setShowShare(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border/50 bg-card/60 text-muted-foreground hover:text-foreground hover:border-border/80 transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              Compartilhar
            </button>
          )}
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
              borderColor: 'rgba(255,107,53,0.3)',
              color: '#FF6B35',
              background: 'rgba(255,107,53,0.06)',
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

      {/* ── Dashboards (cards lado-a-lado com descrição) ──
          Padding/altura uniformes pra match o estilo dos cards do Auditor CRM:
          p-4 (16px), min-h fixo pra alinhar verticalmente independente do
          tamanho da descrição, line-clamp-2 evita que cards "estourem". */}
      {dashboards && dashboards.length > 1 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
          {dashboards.map((d) => {
            const isActive = activeDash?.id === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDashId(d.id)}
                className={cn(
                  "group flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all min-h-[96px] h-full",
                  isActive
                    ? "border-primary/50 bg-primary/[0.06] shadow-[0_0_0_1px_rgba(255,107,53,0.18),0_4px_18px_rgba(255,107,53,0.08)]"
                    : "border-border/40 bg-card/40 hover:border-border/80 hover:bg-card/70",
                )}
              >
                <div className="flex items-center gap-2 w-full min-w-0">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
                      isActive ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground group-hover:bg-muted",
                    )}
                  >
                    {DASH_ICONS[d.name] || <LayoutDashboard className="w-3.5 h-3.5" />}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold truncate flex-1 min-w-0",
                      isActive ? "text-foreground" : "text-foreground/85",
                    )}
                  >
                    {d.name}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-snug flex-1">
                  {d.description || "Visão executiva do período."}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* ── AI Narrative ── */}
      <div
        className="rounded-xl border border-border/30 p-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(255,105,0,0.04) 0%, hsl(var(--card)) 60%)' }}
      >
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
          <DashboardEngine dashboardId={activeDash.id} isEditing={isEditingLayout} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[140px] rounded-xl bg-muted/20 animate-pulse border border-dashed border-border/40" />
            ))}
          </div>
        )}
      </div>
      {showShare && activeDash && orgId && (
        <ShareDashboardDialog
          orgId={orgId}
          dashboardId={activeDash.id}
          dashboardName={activeDash.name}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
};

const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

export default Dashboard;
