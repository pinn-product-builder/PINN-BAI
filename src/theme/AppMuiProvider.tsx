import { useMemo, type ReactNode } from "react";
import { ThemeProvider as MuiThemeProvider, CssBaseline } from "@mui/material";
import { useOrganizationBranding } from "@/contexts/OrganizationBrandingContext";
import { createPinnTheme, createPinnThemeLight } from "./pinnTheme";
import { useTheme } from "./ThemeProvider";

/**
 * Provedor MUI: segue o tema único do produto (ThemeProvider) enquanto os
 * shells MUI existirem. Light aceita cor primária da organização (white-label);
 * o dark ainda não propaga o override de primária — TODO na migração shadcn-first.
 */
export function AppMuiProvider({ children }: { children: ReactNode }) {
  const { organization } = useOrganizationBranding();
  const { theme: uiTheme } = useTheme();
  const primary = organization?.primary_color ?? null;
  const theme = useMemo(
    () => (uiTheme === "dark" ? createPinnTheme("dark") : createPinnThemeLight(primary)),
    [uiTheme, primary],
  );

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
