import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationBrandingProvider } from "@/contexts/OrganizationBrandingContext";
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
import { isRfmChurnEnabledForAdmin, isRfmChurnEnabledForOrg } from "@/lib/featureFlags";
import { useParams } from "react-router-dom";

const queryClient = new QueryClient();

const ClientRfmChurnGate = () => {
  const { orgId } = useParams();
  if (!isRfmChurnEnabledForOrg(orgId)) {
    return <Navigate to={`/client/${orgId}/dashboard`} replace />;
  }
  return <ClientRfmChurn />;
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
                <Route path="pinn-sdr" element={<PinnSDR />} />
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
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="crm" element={<CRMKanban />} />
                <Route path="import" element={<Import />} />
                <Route path="datasets" element={<Datasets />} />
                <Route path="insights" element={<Insights />} />
                <Route path="rfm-churn" element={<ClientRfmChurnGate />} />
                <Route path="users" element={<ClientUsers />} />
                <Route path="settings" element={<ClientSettings />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
              </AppMuiProvider>
            </OrganizationBrandingProvider>
          </BrowserRouter>
        </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
