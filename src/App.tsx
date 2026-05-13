import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationBrandingProvider } from "@/contexts/OrganizationBrandingContext";
import { FilterProvider } from "@/contexts/FilterContext";
import { AppMuiProvider } from "@/theme/AppMuiProvider";
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
import Activity from "./pages/admin/Activity";
import AdminSettings from "./pages/admin/Settings";
import GlobalHQ from "./pages/admin/GlobalHQ";
import OrganizationDetail from "./pages/admin/OrganizationDetail";
import CustomMetrics from "./pages/admin/CustomMetrics";
import AdminRfmChurn from "./pages/admin/RfmChurn";
import PinnSDR from "./pages/admin/PinnSDR";
import LinkedInSDR from "./pages/admin/LinkedInSDR";

// Onboarding Wizard
import OnboardingWizard from "./components/onboarding/OnboardingWizard";

// Client Pages
import ClientLayout from "./components/layouts/ClientLayout";
import Dashboard from "./pages/client/Dashboard";
import Import from "./pages/client/Import";
import CRMKanban from "./pages/client/CRM";
import Datasets from "./pages/client/Datasets";
import Insights from "./pages/client/Insights";
import ClientUsers from "./pages/client/Users";
import ClientSettings from "./pages/client/Settings";
import ClientRfmChurn from "./pages/client/RfmChurn";
import Arguto from "./pages/client/Arguto";
import CrmAuditorPage from "./modules/crm-auditor/CrmAuditorPage";
import Integrations from "./pages/client/Integrations";
import CustomerHealth from "./pages/client/CustomerHealth";
import PaidTraffic from "./pages/client/PaidTraffic";
import PaidTrafficConnect from "./pages/client/PaidTrafficConnect";
import UnitEconomics from "./pages/client/UnitEconomics";
import Goals from "./pages/client/Goals";
import Gamification from "./pages/client/Gamification";
import CrmAuditDashboard from "./pages/client/CrmAuditDashboard";
import PublicDashboard from "./pages/PublicDashboard";
import { isRfmChurnEnabledForAdmin, isRfmChurnEnabledForOrg, isArgutoOrg } from "@/lib/featureFlags";
import { useIsPinnProductBuilderOrg } from "@/hooks/useIsPinnProductBuilderOrg";
import { useParams } from "react-router-dom";

const queryClient = new QueryClient();

// Landing inteligente: Arguto cai em /arguto, Pinn Product Builder em /pinn-sdr,
// e demais clientes no /dashboard padrão.
const ClientRootRedirect = () => {
  const { orgId } = useParams();
  const { isPinnPB, isLoading } = useIsPinnProductBuilderOrg(orgId);
  if (isLoading) return null;
  if (isArgutoOrg(orgId)) return <Navigate to={`/client/${orgId}/arguto`} replace />;
  if (isPinnPB)            return <Navigate to={`/client/${orgId}/pinn-sdr`} replace />;
  return <Navigate to={`/client/${orgId}/dashboard`} replace />;
};

const ClientRfmChurnGate = () => {
  const { orgId } = useParams();
  if (!isRfmChurnEnabledForOrg(orgId)) {
    return <Navigate to={`/client/${orgId}/dashboard`} replace />;
  }
  return <ClientRfmChurn />;
};

// Bloqueia acesso direto a /arguto em orgs que não são a Arguto.
const ArgutoOrgGate = () => {
  const { orgId } = useParams();
  if (!isArgutoOrg(orgId)) {
    return <Navigate to={`/client/${orgId}/dashboard`} replace />;
  }
  return <Arguto />;
};

// Bloqueia acesso direto a /pinn-sdr e /linkedin-sdr para orgs ≠ Pinn Product Builder.
const PinnSdrOrgGate = ({ children }: { children: JSX.Element }) => {
  const { orgId } = useParams();
  const { isPinnPB, isLoading } = useIsPinnProductBuilderOrg(orgId);
  if (isLoading) return null;
  if (!isPinnPB) return <Navigate to={`/client/${orgId}/dashboard`} replace />;
  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
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
                {isRfmChurnEnabledForAdmin() && (
                  <Route path="rfm-churn" element={<AdminRfmChurn />} />
                )}
                {/* Pinn SDR / LinkedIn SDR vivem dentro de /client/:orgId (org Pinn Product Builder). */}
                <Route path="users" element={<AdminUsers />} />
                <Route path="activity" element={<Activity />} />
                <Route path="settings" element={<AdminSettings />} />
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
                <Route path="import" element={<Import />} />
                <Route path="datasets" element={<Datasets />} />
                <Route path="insights" element={<Insights />} />
                <Route path="rfm-churn" element={<ClientRfmChurnGate />} />
                <Route path="crm-auditor" element={<CrmAuditorPage />} />
                <Route path="arguto" element={<ArgutoOrgGate />} />
                <Route path="paid-traffic" element={<PaidTraffic />} />
                <Route path="paid-traffic/connect" element={<PaidTrafficConnect />} />
                <Route path="customer-health" element={<CustomerHealth />} />
                <Route path="unit-economics" element={<UnitEconomics />} />
                <Route path="goals" element={<Goals />} />
                <Route path="gamification" element={<Gamification />} />
                <Route path="integrations" element={<Integrations />} />
                <Route path="crm-audit" element={<CrmAuditDashboard />} />
                <Route path="pinn-sdr" element={<PinnSdrOrgGate><PinnSDR /></PinnSdrOrgGate>} />
                <Route path="linkedin-sdr" element={<PinnSdrOrgGate><LinkedInSDR /></PinnSdrOrgGate>} />
                <Route path="users" element={<ClientUsers />} />
                <Route path="settings" element={<ClientSettings />} />
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
  </QueryClientProvider>
);

export default App;
