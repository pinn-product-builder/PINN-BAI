import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShareDashboardDialog } from '@/components/dashboard/ShareDashboardDialog';
import { supabase } from '@/integrations/supabase/client';
import {
  Download,
  Share2,
  Loader2,
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
        aiSnapshot: '',
      });
      toast({ title: "Relatório Concluído", description: "O PDF foi gerado com sucesso." });
    } catch {
      toast({ title: "Erro ao exportar", description: "Não foi possível gerar o PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
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
    <div className="w-full px-4 md:px-6 py-6 space-y-6 pb-24 max-w-[1480px] mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <h1 className="text-base font-semibold text-foreground">
            {activeDash?.name || 'Dashboard'}
          </h1>
          <p className="text-xs text-muted-foreground/60">
            {activeDash?.description || 'Desempenho dos últimos 30 dias'}
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

      {/* ── Banner de modo edição ── */}
      {isEditingLayout && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/[0.05] text-xs">
          <Move className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">Modo edição ativo</p>
            <p className="text-muted-foreground/80 mt-0.5">
              Arraste qualquer widget pra reorganizar · Use o canto inferior direito (laranja) pra redimensionar · Os ajustes salvam automaticamente
            </p>
          </div>
        </div>
      )}

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

export default Dashboard;
