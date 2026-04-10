import { useMemo, type ReactNode } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { useOrganizationBranding } from "@/contexts/OrganizationBrandingContext";
import { createPinnThemeLight } from "./pinnTheme";

/** Provedor MUI: tema PINN Growth claro; cor primária opcional vinda do branding da organização. */
export function AppMuiProvider({ children }: { children: ReactNode }) {
  const { organization } = useOrganizationBranding();
  const primary = organization?.primary_color ?? null;
  const theme = useMemo(() => createPinnThemeLight(primary), [primary]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
