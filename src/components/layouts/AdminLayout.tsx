import { Link as RouterLink, useLocation, useNavigate, Outlet } from "react-router-dom";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Stack,
  Button,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  Description as TemplateIcon,
  Speed as GaugeIcon,
  Bolt as BoltIcon,
  TrackChanges as TargetIcon,
  People as PeopleIcon,
  ShowChart as ActivityIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import { isRfmChurnEnabledForAdmin } from "@/lib/featureFlags";

const DRAWER_WIDTH = 220;

const baseNavItems = [
  { path: "/admin/hq", label: "Command", icon: DashboardIcon },
  { path: "/admin/organizations", label: "Organizações", icon: BusinessIcon },
  { path: "/admin/templates", label: "Templates", icon: TemplateIcon },
  { path: "/admin/custom-metrics", label: "Métricas", icon: GaugeIcon },
  { path: "/admin/pinn-sdr", label: "Pinn SDR", icon: BoltIcon },
  { path: "/admin/rfm-churn", label: "RFM + Churn", icon: TargetIcon },
  { path: "/admin/users", label: "Usuários", icon: PeopleIcon },
  
  { path: "/admin/settings", label: "Config", icon: SettingsIcon },
];

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const navItems = baseNavItems.filter((item) => item.path !== "/admin/rfm-churn" || isRfmChurnEnabledForAdmin());

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
          <Box component="img" src="/pinn-logo.svg" alt="Pinn" sx={{ height: 32, width: "auto" }} />
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1.5 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.main" }} />
            <Typography variant="caption" sx={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "text.secondary", fontWeight: 600 }}>
              Admin Panel
            </Typography>
          </Stack>
        </Box>

        <List sx={{ flex: 1, px: 1.5, py: 2, overflow: "auto" }}>
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname.startsWith(path);
            return (
              <ListItemButton
                key={path}
                component={RouterLink}
                to={path}
                selected={active}
                sx={{
                  borderRadius: 1,
                  mb: 0.25,
                  py: 1.25,
                  "&.Mui-selected": {
                    bgcolor: (t) => `${t.palette.primary.main}14`,
                    color: "primary.main",
                    "&:hover": { bgcolor: (t) => `${t.palette.primary.main}1f` },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: active ? "primary.main" : "action.active" }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={label} primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: active ? 600 : 500 }} />
                {active && <ChevronRightIcon sx={{ fontSize: 14, color: "primary.main", opacity: 0.5 }} />}
              </ListItemButton>
            );
          })}
        </List>

        <Box sx={{ px: 1.5, pb: 2.5, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 1.5, py: 1.5, borderRadius: 1, bgcolor: "action.hover" }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "primary.main",
                bgcolor: (t) => `${t.palette.primary.main}18`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Typography variant="caption" fontWeight={700} color="primary">
                A
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="caption" fontWeight={600} noWrap>
                Admin
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>
                Plataforma
              </Typography>
            </Box>
          </Stack>
          <Button
            fullWidth
            size="small"
            startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
            sx={{ mt: 1, justifyContent: "flex-start", color: "text.secondary", fontSize: "0.75rem" }}
          >
            Sair
          </Button>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1, minHeight: "100vh", minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default AdminLayout;
