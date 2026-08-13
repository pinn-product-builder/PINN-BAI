import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrganizationBrandingProvider } from "@/contexts/OrganizationBrandingContext";
import { FilterProvider } from "@/contexts/FilterContext";
import { AppMuiProvider } from "@/theme/AppMuiProvider";
import { ThemeProvider as UiThemeProvider } from "@/theme/ThemeProvider";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminLayout from "./components/layouts/AdminLayout";
import Organizations from "./pages/admin/Organizations";
import NewOrganization from "./pages/admin/NewOrganization";
import Templates from "./pages/admin/Templates";
import AdminUsers from "./pages/admin/Users";
import AdminSettings from "./pages/admin/Settings";
import AdminUnitEconomics from "./pages/admin/UnitEconomics";
import AdminAiPrompts from "./pages/admin/AiPrompts";
import AdminDataSources from "./pages/admin/DataSources";
import GlobalHQ from "./pages/admin/GlobalHQ";
import OrganizationDetail from "./pages/admin/OrganizationDetail";
import CustomMetrics from "./pages/admin/CustomMetrics";

// Onboarding Wizard
import OnboardingWizard from "./components/onboarding/OnboardingWizard";

// Client Pages
import ClientLayout from "./components/layouts/ClientLayout";
import Dashboard from "./pages/client/Dashboard";
import Import from "./pages/client/Import";
import CRMKanban from "./pages/client/CRM";
import CrmMapping from "./pages/client/CrmMapping";
import Insights from "./pages/client/Insights";
import PdcaPage from "./pages/client/Pdca";
import ClientSettings from "./pages/client/Settings";
import Arguto from "./pages/client/Arguto";
import CrmAuditorPage from "./modules/crm-auditor/CrmAuditorPage";
import CrmOnboardingWizard from "./modules/crm-auditor/OnboardingWizard";
import Integrations from "./pages/client/Integrations";
import CustomerHealth from "./pages/client/CustomerHealth";
import PaidTraffic from "./pages/client/PaidTraffic";
import PaidTrafficConnect from "./pages/client/PaidTrafficConnect";
import UnitEconomics from "./pages/client/UnitEconomics";
import Goals from "./pages/client/Goals";
import Gamification from "./pages/client/Gamification";
import CrmAuditDashboard from "./pages/client/CrmAuditDashboard";
import PublicDashboard from "./pages/PublicDashboard";
import { isArgutoOrg, isMockScreenEnabled, isDemoOrg, getOrgLandingLeaf } from "@/lib/featureFlags";
import RequirePermission from "@/components/auth/RequirePermission";
import { useParams } from "react-router-dom";

const queryClient = new QueryClient();

// Landing inteligente: lê default_landing_path do gating da org (org ativa já
// carregada — o ClientLayout só renderiza este Outlet após isLoading=false).
// Fallback legado: Arguto -> /arguto, demais -> /dashboard.
const ClientRootRedirect = () => {
  const { orgId } = useParams();
  return <Navigate to={`/client/${orgId}/${getOrgLandingLeaf(orgId)}`} replace />;
};

// Bloqueia acesso direto a /arguto em orgs que não são a Arguto.
const ArgutoOrgGate = () => {
  const { orgId } = useParams();
  if (!isArgutoOrg(orgId)) {
    return <Navigate to={`/client/${orgId}/dashboard`} replace />;
  }
  return <Arguto />;
};

/**
 * Gate de auditoria — A6: a auditoria do CRM é ferramenta interna da PIN. O
 * cliente final vê só o plano de ação consolidado, não o relatório bruto.
 * Decisão da reunião 19/05/2026: rejeitamos expor a auditoria livremente
 * porque diretores tendem a recusar a ferramenta ao ver muitos indicadores
 * negativos de uma só vez. Aqui só platform_admin (consultor Pinn) entra.
 */
const InternalAuditGate = ({ children }: { children: JSX.Element }) => {
  const { orgId } = useParams();
  const { isPlatformAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isPlatformAdmin) return <Navigate to={`/client/${orgId}/dashboard`} replace />;
  return children;
};

/**
 * Gate para rotas mock/esqueleto — flag-off antes da demo investidor.
 * Cliente em prod cai pro dashboard; platform_admin / Arguto / dev (`VITE_ENABLE_MOCK_SCREENS=true`)
 * continuam vendo. Ver `isMockScreenEnabled` em `featureFlags.ts`.
 */
const MockScreenGate = ({
  feature,
  children,
}: {
  feature: import('@/lib/featureFlags').MockScreenFeature;
  children: JSX.Element;
}) => {
  const { orgId } = useParams();
  const { isPlatformAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isMockScreenEnabled(feature, { isPlatformAdmin, isDemoOrg: isDemoOrg(orgId) })) {
    return <Navigate to={`/client/${orgId}/dashboard`} replace />;
  }
  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UiThemeProvider>
    <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <OrganizationBrandingProvider>
              <AppMuiProvider>
            <FilterProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />

              {/* Admin routes - require platform_admin role */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRoles={['platform_admin']}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/admin/hq" replace />} />
                <Route path="hq" element={<GlobalHQ />} />
                <Route path="organizations" element={<Organizations />} />
                <Route path="organizations/:orgId" element={<OrganizationDetail />} />
                <Route path="organizations/new" element={<NewOrganization />} />
                <Route path="organizations/onboarding" element={<OnboardingWizard />} />
                <Route path="templates" element={<Templates />} />
                <Route path="custom-metrics" element={<CustomMetrics />} />
                {/* Pinn SDR / LinkedIn SDR vivem dentro de /client/:orgId (org Pinn Product Builder). */}
                <Route path="users" element={<AdminUsers />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="unit-economics" element={<AdminUnitEconomics />} />
                <Route path="ai-prompts" element={<AdminAiPrompts />} />
                <Route path="data-sources" element={<AdminDataSources />} />
              </Route>

              {/* Client routes - require authentication and org membership */}
              <Route
                path="/client/:orgId"
                element={
                  <ProtectedRoute requiredRoles={['client_admin', 'analyst', 'viewer']}>
                    <ClientLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<ClientRootRedirect />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="crm" element={<CRMKanban />} />
                <Route path="crm-mapping" element={<CrmMapping />} />
                <Route path="import" element={<RequirePermission permission="data:edit"><Import /></RequirePermission>} />
                <Route path="insights" element={<Insights />} />
                <Route path="pdca" element={<PdcaPage />} />
                <Route path="crm-auditor" element={<InternalAuditGate><CrmAuditorPage /></InternalAuditGate>} />
                <Route path="onboarding" element={<InternalAuditGate><CrmOnboardingWizard /></InternalAuditGate>} />
                <Route path="arguto" element={<ArgutoOrgGate />} />
                <Route path="paid-traffic" element={<MockScreenGate feature="paid-traffic"><PaidTraffic /></MockScreenGate>} />
                <Route path="paid-traffic/connect" element={<MockScreenGate feature="paid-traffic-connect"><PaidTrafficConnect /></MockScreenGate>} />
                <Route path="customer-health" element={<MockScreenGate feature="customer-health"><CustomerHealth /></MockScreenGate>} />
                <Route path="unit-economics" element={<UnitEconomics />} />
                <Route path="goals" element={<MockScreenGate feature="goals"><Goals /></MockScreenGate>} />
                <Route path="gamification" element={<MockScreenGate feature="gamification"><Gamification /></MockScreenGate>} />
                <Route path="integrations" element={<RequirePermission permission="org:manage"><Integrations /></RequirePermission>} />
                <Route path="crm-audit" element={<InternalAuditGate><CrmAuditDashboard /></InternalAuditGate>} />
                {/* Camada de prospecção (Pinn SDR/Smart/Outreach) removida do BAI —
                    migrada pro sistema Pinn Outbound separado (ver docs/pinn-outbound-extraction-blueprint.md). */}
                <Route path="settings" element={<RequirePermission permission="org:manage"><ClientSettings /></RequirePermission>} />
              </Route>

              {/* Public share */}
              <Route path="/share/:token" element={<PublicDashboard />} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </FilterProvider>
              </AppMuiProvider>
            </OrganizationBrandingProvider>
          </BrowserRouter>
        </TooltipProvider>
    </AuthProvider>
    </UiThemeProvider>
  </QueryClientProvider>
);

export default App;
