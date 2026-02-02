import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

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

// Onboarding Wizard
import OnboardingWizard from "./components/onboarding/OnboardingWizard";

// Client Pages
import ClientLayout from "./components/layouts/ClientLayout";
import Dashboard from "./pages/client/Dashboard";
import Import from "./pages/client/Import";
import Datasets from "./pages/client/Datasets";
import Insights from "./pages/client/Insights";
import ClientUsers from "./pages/client/Users";
import ClientSettings from "./pages/client/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* Admin routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/organizations" replace />} />
            <Route path="organizations" element={<Organizations />} />
            <Route path="organizations/new" element={<NewOrganization />} />
            <Route path="organizations/onboarding" element={<OnboardingWizard />} />
            <Route path="templates" element={<Templates />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="activity" element={<Activity />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Client routes */}
          <Route path="/client/:orgId" element={<ClientLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="import" element={<Import />} />
            <Route path="datasets" element={<Datasets />} />
            <Route path="insights" element={<Insights />} />
            <Route path="users" element={<ClientUsers />} />
            <Route path="settings" element={<ClientSettings />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
