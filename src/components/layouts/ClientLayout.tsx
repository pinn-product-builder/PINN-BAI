import { Link as RouterLink, useParams, useLocation, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Lightbulb,
  LogOut,
  Target,
  Sparkles,
  FileCheck,
  LineChart,
  HeartPulse,
  TrendingUp,
  Trophy,
  ArrowLeft,
  Settings,
  Zap,
  Linkedin,
  type LucideIcon,
} from "lucide-react";
import { useOrganizationBranding } from "@/contexts/OrganizationBrandingContext";
import { useAuth } from "@/contexts/AuthContext";
import AIChat from "@/components/ai/AIChat";
import { GlobalFilterBar } from "@/components/GlobalFilterBar";
import OrgAccessGate from "@/components/auth/OrgAccessGate";
import { AppShell, type ShellNavGroup } from "@/components/shell/AppShell";
import { useState } from "react";
import { isRfmChurnEnabledForOrg } from "@/lib/featureFlags";
import { useIsPinnProductBuilderOrg } from "@/hooks/useIsPinnProductBuilderOrg";

const baseNavItems: Array<{
  path: string;
  label: string;
  icon: LucideIcon;
  /** Slug-gated: só aparece pra orgs cujo slug esteja na lista. undefined = todos. */
  onlyForSlugs?: string[];
  /** Slug-hidden: NÃO aparece pras orgs listadas. */
  hideForSlugs?: string[];
}> = [
  // Dashboard fica oculto na Arguto — slug "arguto" cai direto em /arguto
  // (Dashboard.tsx redireciona pra lá em modo demo, então o item duplica o
  // Arguto · BAI no menu).
  { path: "dashboard",       label: "Dashboard",        icon: LayoutDashboard, hideForSlugs: ["arguto"] },
  { path: "arguto",          label: "Arguto · BAI",     icon: LineChart, onlyForSlugs: ["arguto"] },
  { path: "import",          label: "Dados",            icon: Database },
  { path: "insights",        label: "Inteligência IA",  icon: Lightbulb },
  { path: "rfm-churn",       label: "RFM + Churn",      icon: Target },
  { path: "customer-health", label: "Saúde do Cliente", icon: HeartPulse },
  { path: "unit-economics",  label: "CAC + LTV",        icon: TrendingUp },
  { path: "goals",           label: "Metas & Alertas",  icon: Trophy },
  { path: "crm-audit",       label: "Auditoria CRM",    icon: FileCheck },
  // Integrações migrou pro footer do drawer (ícone de engrenagem ao lado do usuário).
];

// Itens exclusivos da org Pinn Product Builder. Aparecem como grupo próprio.
const pinnPBNavItems: Array<{ path: string; label: string; icon: LucideIcon }> = [
  { path: "pinn-sdr",     label: "Pinn SDR",     icon: Zap },
  { path: "linkedin-sdr", label: "LinkedIn SDR", icon: Linkedin },
];

const ClientLayout = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { organization, isLoading } = useOrganizationBranding();
  const { profile, signOut, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const showRfmChurn = isRfmChurnEnabledForOrg(orgId);
  const orgSlug = organization?.slug;
  const { isPinnPB } = useIsPinnProductBuilderOrg(orgId);
  const currentPath = location.pathname.split("/").pop();

  const visibleBase = baseNavItems.filter((item) => {
    // RFM atrás de feature flag global
    if (item.path === "rfm-churn" && !showRfmChurn) return false;
    // Items slug-gated: só aparecem pra orgs cujo slug autoriza. Aplica até pra
    // platform_admin — não faz sentido o painel da org X exibir o item dedicado
    // da org Y. Quem quer enxergar Arguto deve impersonar Arguto direto.
    if (item.onlyForSlugs) {
      if (!orgSlug || !item.onlyForSlugs.includes(orgSlug)) return false;
    }
    if (item.hideForSlugs && orgSlug && item.hideForSlugs.includes(orgSlug)) {
      return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Carregando…</span>
        </div>
      </div>
    );
  }

  const orgName = organization?.name || "Organização";
  const base = (p: string) => `/client/${orgId}/${p}`;

  const nav: ShellNavGroup[] = [
    {
      label: "Operação",
      items: visibleBase.map((i) => ({
        to: base(i.path),
        label: i.label,
        icon: i.icon,
        active: currentPath === i.path,
      })),
    },
    ...(isPinnPB
      ? [
          {
            label: "Pinn Product Builder",
            items: pinnPBNavItems.map((i) => ({
              to: base(i.path),
              label: i.label,
              icon: i.icon,
              active: currentPath === i.path,
            })),
          },
        ]
      : []),
  ];

  const activeLabel = [...visibleBase, ...(isPinnPB ? pinnPBNavItems : [])].find((i) => i.path === currentPath)?.label;
  const breadcrumb = [orgName, activeLabel ?? "Dashboard"];

  const topSlot = isPlatformAdmin ? (
    <button
      type="button"
      onClick={() => navigate("/admin/hq")}
      className="flex w-full items-center gap-2 rounded-lg border border-primary/40 px-2.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.06]"
    >
      <ArrowLeft className="h-4 w-4" /> Voltar ao Admin
    </button>
  ) : undefined;

  const footer = (
    <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/60 px-2.5 py-2.5">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-border text-[11px] font-bold text-sidebar-foreground">
        {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold text-sidebar-foreground">{profile?.full_name || "Usuário"}</div>
        <div className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground">Painel</div>
      </div>
      <RouterLink
        to={base("integrations")}
        title="Integrações"
        aria-label="Integrações"
        className={`flex h-7 w-7 items-center justify-center rounded-md hover:text-primary ${
          currentPath === "integrations" ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <Settings className="h-4 w-4" />
      </RouterLink>
      <button
        type="button"
        onClick={() => signOut()}
        title="Sair"
        aria-label="Sair"
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-primary"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <OrgAccessGate>
      <AppShell
        brand={{ name: orgName, logoUrl: organization?.logo_url, caption: "Plano Empresarial" }}
        nav={nav}
        breadcrumb={breadcrumb}
        topSlot={topSlot}
        footer={footer}
        filterBar={<GlobalFilterBar />}
      >
        <Outlet />
      </AppShell>

      {/* Copiloto IA — FAB fixo (cor via token, respeita white-label por org) */}
      {!isChatOpen && (
        <button
          type="button"
          aria-label="Abrir copiloto IA"
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_hsl(var(--primary)/0.35)] transition-colors hover:bg-[hsl(var(--primary))/0.9]"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
      {isChatOpen && <AIChat onClose={() => setIsChatOpen(false)} />}
    </OrgAccessGate>
  );
};

export default ClientLayout;
