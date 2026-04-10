import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Organization } from "@/lib/types";

export interface OrganizationBrandingContextType {
  organization: Organization | null;
  isLoading: boolean;
}

const OrganizationBrandingContext = createContext<OrganizationBrandingContextType | undefined>(undefined);

export const OrganizationBrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, isPlatformAdmin } = useAuth();
  const location = useLocation();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdminContext = location.pathname.startsWith("/admin");
  const isClientContext = location.pathname.startsWith("/client");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener("org-settings-updated", handler);
    return () => window.removeEventListener("org-settings-updated", handler);
  }, []);

  useEffect(() => {
    const fetchOrg = async () => {
      if (isAdminContext && !isClientContext) {
        setOrganization(null);
        resetToAdminTheme();
        setIsLoading(false);
        return;
      }

      const clientOrgMatch = location.pathname.match(/^\/client\/([^/]+)/);
      const targetOrgId = clientOrgMatch ? clientOrgMatch[1] : profile?.org_id;

      if (!targetOrgId) {
        setOrganization(null);
        resetToAdminTheme();
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.from("organizations").select("*").eq("id", targetOrgId).single();

      if (!error && data) {
        setOrganization(data as unknown as Organization);
        applyTheme(data);
      } else {
        resetToAdminTheme();
      }
      setIsLoading(false);
    };

    fetchOrg();
  }, [profile?.org_id, isAdminContext, isClientContext, isPlatformAdmin, location.pathname, refreshKey]);

  const resetToAdminTheme = () => {
    const root = document.documentElement;
    root.style.removeProperty("--primary");
    root.style.removeProperty("--accent");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--sidebar-primary");
    root.style.removeProperty("--sidebar-ring");
    root.style.removeProperty("--sidebar-accent");
    root.style.removeProperty("--sidebar-background");
    root.style.removeProperty("--chart-1");
    root.style.removeProperty("font-family");
  };

  const applyTheme = (org: { primary_color?: string | null }) => {
    const root = document.documentElement;

    const hexToHSL = (hex: string) => {
      let r = 0,
        g = 0,
        b = 0;
      if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
      } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
      }

      r /= 255;
      g /= 255;
      b /= 255;
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      let h = 0,
        s = 0,
        l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h /= 6;
      }

      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };

    if (org.primary_color) {
      const hsl = hexToHSL(org.primary_color);
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--accent", hsl);
      root.style.setProperty("--ring", hsl);
      root.style.setProperty("--sidebar-primary", hsl);
      root.style.setProperty("--sidebar-ring", hsl);
      root.style.setProperty("--sidebar-accent", hsl);
      root.style.setProperty("--chart-1", hsl);
    }
  };

  return (
    <OrganizationBrandingContext.Provider value={{ organization, isLoading }}>{children}</OrganizationBrandingContext.Provider>
  );
};

export function useOrganizationBranding() {
  const context = useContext(OrganizationBrandingContext);
  if (context === undefined) {
    throw new Error("useOrganizationBranding must be used within an OrganizationBrandingProvider");
  }
  return context;
}
