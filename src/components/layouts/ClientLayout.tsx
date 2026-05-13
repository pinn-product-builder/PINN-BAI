import { Link as RouterLink, useParams, useLocation, Outlet, useNavigate } from "react-router-dom";
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
  Button,
  AppBar,
  Toolbar,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Upload as UploadIcon,
  Lightbulb as LightbulbIcon,
  Logout as LogoutIcon,
  TrackChanges as TargetIcon,
  AutoAwesome as SparklesIcon,
  FactCheck as AuditorIcon,
  Insights as InsightsIcon,
  FavoriteBorder as HeartIcon,
  TrendingUp as TrendingUpIcon,
  EmojiEvents as TrophyIcon,
  ArrowBack as ArrowBackIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
  Bolt as BoltIcon,
  LinkedIn as LinkedInIcon,
} from "@mui/icons-material";
import { useOrganizationBranding } from "@/contexts/OrganizationBrandingContext";
import { useAuth } from "@/contexts/AuthContext";
import AIChat from "@/components/ai/AIChat";
import { GlobalFilterBar } from "@/components/GlobalFilterBar";
import { useState } from "react";
import { isRfmChurnEnabledForOrg } from "@/lib/featureFlags";
import { useIsPinnProductBuilderOrg } from "@/hooks/useIsPinnProductBuilderOrg";

const DRAWER_WIDTH = 220;
const MOBILE_APPBAR_HEIGHT = 56;

const baseNavItems: Array<{
  path: string;
  label: string;
  icon: typeof DashboardIcon;
  /** Slug-gated: só aparece pra orgs cujo slug esteja na lista. undefined = todos. */
  onlyForSlugs?: string[];
  /** Slug-hidden: NÃO aparece pras orgs listadas. */
  hideForSlugs?: string[];
}> = [
  // Dashboard fica oculto na Arguto — slug "arguto" cai direto em /arguto
  // (Dashboard.tsx redireciona pra lá em modo demo, então o item duplica o
  // Arguto · BAI no menu).
  { path: "dashboard",       label: "Dashboard",        icon: DashboardIcon, hideForSlugs: ["arguto"] },
  { path: "arguto",          label: "Arguto · BAI",     icon: InsightsIcon, onlyForSlugs: ["arguto"] },
  { path: "import",          label: "Dados",            icon: UploadIcon },
  { path: "insights",        label: "Inteligência IA",  icon: LightbulbIcon },
  { path: "rfm-churn",       label: "RFM + Churn",      icon: TargetIcon },
  { path: "customer-health", label: "Saúde do Cliente", icon: HeartIcon },
  { path: "unit-economics",  label: "CAC + LTV",        icon: TrendingUpIcon },
  { path: "goals",           label: "Metas & Alertas",  icon: TrophyIcon },
  { path: "crm-audit",       label: "Auditoria CRM",    icon: AuditorIcon },
  // Integrações migrou pro footer do drawer (ícone de engrenagem ao lado do usuário).
];

// Itens exclusivos da org Pinn Product Builder. Aparecem como abas internas
// (lugar de viverem em /admin, ficam dentro de /client/:orgId/...).
const pinnPBNavItems: Array<{ path: string; label: string; icon: typeof DashboardIcon }> = [
  { path: "pinn-sdr",     label: "Pinn SDR",     icon: BoltIcon },
  { path: "linkedin-sdr", label: "LinkedIn SDR", icon: LinkedInIcon },
];

const ClientLayout = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { organization, isLoading } = useOrganizationBranding();
  const { profile, signOut, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const showRfmChurn = isRfmChurnEnabledForOrg(orgId);
  const orgSlug = organization?.slug;
  const { isPinnPB } = useIsPinnProductBuilderOrg(orgId);
  const navItems = [
    ...baseNavItems.filter((item) => {
      // RFM atrás de feature flag global
      if (item.path === "rfm-churn" && !showRfmChurn) return false;
      // Items slug-gated: só aparecem pra orgs cujo slug autoriza.
      // Aplica até pra platform_admin — não faz sentido o painel da org X
      // exibir o item dedicado da org Y (ex.: "Arguto · BAI" dentro do painel
      // da BF Company). Quem quer enxergar Arguto deve impersonar Arguto direto.
      if (item.onlyForSlugs) {
        if (!orgSlug || !item.onlyForSlugs.includes(orgSlug)) return false;
      }
      // Items que devem sumir pra certas orgs (ex.: Dashboard duplica /arguto
      // pra slug "arguto", então fica oculto).
      if (item.hideForSlugs && orgSlug && item.hideForSlugs.includes(orgSlug)) {
        return false;
      }
      return true;
    }),
    ...(isPinnPB ? pinnPBNavItems : []),
  ];
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
  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* ── AppBar mobile (apenas <md) ── */}
      {isMobile && (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            bgcolor: "background.paper",
            color: "text.primary",
            borderBottom: "1px solid",
            borderColor: "divider",
            zIndex: (t) => t.zIndex.drawer + 1,
          }}
        >
          <Toolbar variant="dense" sx={{ minHeight: MOBILE_APPBAR_HEIGHT, gap: 1.5, px: 2 }}>
            <IconButton
              edge="start"
              size="small"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menu"
              sx={{ color: "text.primary" }}
            >
              <MenuIcon />
            </IconButton>
            {organization?.logo_url ? (
              <Box component="img" src={organization.logo_url} alt={organization.name} sx={{ height: 22, maxWidth: 110, objectFit: "contain" }} />
            ) : (
              <Box component="img" src="/pinn-logo.svg" alt="Pinn" sx={{ height: 22, width: "auto" }} />
            )}
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }} noWrap>
              {organization?.name || "Pinn BAI"}
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={isMobile ? mobileNavOpen : true}
        onClose={closeMobileNav}
        ModalProps={{ keepMounted: true }}
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

        {isPlatformAdmin && (
          <Box sx={{ px: 1.5, pt: 1.5 }}>
            <Button
              fullWidth
              size="small"
              startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                closeMobileNav();
                navigate("/admin/hq");
              }}
              variant="outlined"
              sx={{
                justifyContent: "flex-start",
                borderColor: (t) => `${t.palette.primary.main}40`,
                color: "primary.main",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "none",
                "&:hover": {
                  borderColor: "primary.main",
                  bgcolor: (t) => `${t.palette.primary.main}0d`,
                },
              }}
            >
              Voltar ao Admin
            </Button>
          </Box>
        )}

        <List sx={{ flex: 1, px: 1.5, py: 2, overflow: "auto" }}>
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = currentPath === path;
            return (
              <ListItemButton
                key={path}
                component={RouterLink}
                to={`/client/${orgId}/${path}`}
                selected={active}
                onClick={isMobile ? closeMobileNav : undefined}
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
            <IconButton
              size="small"
              component={RouterLink}
              to={`/client/${orgId}/integrations`}
              onClick={isMobile ? closeMobileNav : undefined}
              sx={{
                color: currentPath === "integrations" ? "primary.main" : "text.secondary",
                "&:hover": { color: "primary.main" },
              }}
              aria-label="Integrações"
              title="Integrações"
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => signOut()} sx={{ color: "text.secondary" }} aria-label="Sair">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: "100vh",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          pt: isMobile ? `${MOBILE_APPBAR_HEIGHT}px` : 0,
        }}
      >
        <GlobalFilterBar />
        <Outlet />
      </Box>

      <Box sx={{ position: "fixed", bottom: 24, right: 24, zIndex: (t) => t.zIndex.drawer + 2 }}>
        {!isChatOpen && (
          <Fab
            color="primary"
            aria-label="Abrir IA"
            onClick={() => setIsChatOpen(true)}
            sx={{
              background: "#FF6B35",
              boxShadow: "0 8px 24px rgba(255,107,53,0.22)",
              "&:hover": { background: "#E55A2B" },
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
