import { Link as RouterLink, useParams, useLocation, Outlet } from "react-router-dom";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Stack,
  CircularProgress,
  Fab,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Upload as UploadIcon,
  Lightbulb as LightbulbIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  TrackChanges as TargetIcon,
  AutoAwesome as SparklesIcon,
} from "@mui/icons-material";
import { useOrganizationBranding } from "@/contexts/OrganizationBrandingContext";
import { useAuth } from "@/contexts/AuthContext";
import AIChat from "@/components/ai/AIChat";
import { useState } from "react";
import { isRfmChurnEnabledForOrg } from "@/lib/featureFlags";

const DRAWER_WIDTH = 220;

const baseNavItems = [
  { path: "dashboard", label: "Dashboard", icon: DashboardIcon },
  { path: "import", label: "Dados", icon: UploadIcon },
  { path: "insights", label: "Inteligência IA", icon: LightbulbIcon },
  { path: "rfm-churn", label: "RFM + Churn", icon: TargetIcon },
  { path: "settings", label: "White Label", icon: SettingsIcon },
];

const ClientLayout = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { organization, isLoading } = useOrganizationBranding();
  const { profile, signOut } = useAuth();
  const showRfmChurn = isRfmChurnEnabledForOrg(orgId);
  const navItems = baseNavItems.filter((item) => item.path !== "rfm-churn" || showRfmChurn);
  const currentPath = location.pathname.split("/").pop();

  if (isLoading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={36} color="primary" />
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Carregando...
          </Typography>
        </Stack>
      </Box>
    );
  }

  const orgInitial = organization?.name?.charAt(0)?.toUpperCase() || "O";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: "grey.50",
            borderRight: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        <Box sx={{ px: 2.5, pt: 3, pb: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          {organization?.logo_url ? (
            <Box component="img" src={organization.logo_url} alt={organization.name} sx={{ height: 32, maxWidth: 140, objectFit: "contain" }} />
          ) : (
            <Box component="img" src="/pinn-logo.svg" alt="Pinn" sx={{ height: 32, width: "auto" }} />
          )}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.25}
            sx={{
              mt: 2,
              px: 1.25,
              py: 1,
              borderRadius: 1,
              border: "1px solid",
              borderColor: (t) => `${t.palette.primary.main}26`,
              bgcolor: (t) => `${t.palette.primary.main}12`,
            }}
          >
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: 0.75,
                bgcolor: "primary.main",
                color: "primary.contrastText",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {orgInitial}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" fontWeight={600} noWrap display="block" lineHeight={1.2}>
                {organization?.name || "Organização"}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Enterprise
              </Typography>
            </Box>
          </Stack>
        </Box>

        <List sx={{ flex: 1, px: 1.5, py: 2, overflow: "auto" }}>
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = currentPath === path;
            return (
              <ListItemButton
                key={path}
                component={RouterLink}
                to={`/client/${orgId}/${path}`}
                selected={active}
                sx={{
                  borderRadius: 1,
                  mb: 0.25,
                  py: 1.25,
                  "&.Mui-selected": {
                    bgcolor: (t) => `${t.palette.primary.main}14`,
                    color: "primary.main",
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: active ? "primary.main" : "action.active" }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={label} primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: active ? 600 : 500 }} />
              </ListItemButton>
            );
          })}
        </List>

        <Box sx={{ px: 1.5, pb: 2.5, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 1.25, py: 1.5, borderRadius: 1, bgcolor: "action.hover" }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 1,
                bgcolor: "divider",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Typography variant="caption" fontWeight={700}>
                {profile?.full_name?.charAt(0) || "U"}
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="caption" fontWeight={600} noWrap display="block">
                {profile?.full_name || "Usuário"}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Dashboard
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => signOut()} sx={{ color: "text.secondary" }} aria-label="Sair">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1, minHeight: "100vh", minWidth: 0 }}>
        <Outlet />
      </Box>

      <Box sx={{ position: "fixed", bottom: 24, right: 24, zIndex: (t) => t.zIndex.drawer + 2 }}>
        {!isChatOpen && (
          <Fab
            color="primary"
            aria-label="Abrir IA"
            onClick={() => setIsChatOpen(true)}
            sx={{
              background: "linear-gradient(135deg, #F97316, #EA580C)",
              boxShadow: "0 4px 16px rgba(249,115,22,0.35)",
              "&:hover": { background: "linear-gradient(135deg, #FB923C, #F97316)" },
            }}
          >
            <SparklesIcon />
          </Fab>
        )}
      </Box>

      {isChatOpen && <AIChat onClose={() => setIsChatOpen(false)} />}
    </Box>
  );
};

export default ClientLayout;
