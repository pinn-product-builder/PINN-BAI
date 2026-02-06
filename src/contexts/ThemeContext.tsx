import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Organization } from '@/lib/types';

interface ThemeContextType {
    organization: Organization | null;
    isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { profile, roles, isPlatformAdmin } = useAuth();
    const location = useLocation();
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check if we're in admin context
    const isAdminContext = location.pathname.startsWith('/admin') || isPlatformAdmin;

    useEffect(() => {
        const fetchOrg = async () => {
            // If admin context OR platform admin, always use admin theme (black/orange)
            // Never apply organization colors to admin
            if (isAdminContext || isPlatformAdmin) {
                setOrganization(null);
                resetToAdminTheme();
                setIsLoading(false);
                return;
            }

            // Only apply organization colors for client users (not admin)
            if (!profile?.org_id) {
                setOrganization(null);
                resetToAdminTheme();
                setIsLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', profile.org_id)
                .single();

            if (!error && data) {
                setOrganization(data as unknown as Organization);
                applyTheme(data);
            } else {
                resetToAdminTheme();
            }
            setIsLoading(false);
        };

        fetchOrg();
    }, [profile?.org_id, isAdminContext, isPlatformAdmin, location.pathname]);

    // Reset to admin theme (black and orange)
    const resetToAdminTheme = () => {
        const root = document.documentElement;
        
        // Admin theme: Black background, Orange accents
        // Reset to default values from index.css
        root.style.removeProperty('--accent');
        root.style.removeProperty('--ring');
        root.style.removeProperty('--sidebar-primary');
        root.style.removeProperty('--sidebar-background');
        root.style.removeProperty('--chart-1');
        root.style.removeProperty('font-family');
        
        // Ensure admin uses orange (not blue)
        // Primary orange: 25 100% 50% (#ff6900)
        root.style.setProperty('--accent', '38 100% 50%'); // Amber glow
        root.style.setProperty('--ring', '38 100% 50%'); // Orange ring
        root.style.setProperty('--sidebar-primary', '25 100% 50%'); // Luminous orange
        root.style.setProperty('--chart-1', '25 100% 50%'); // Orange for charts
    };

    const applyTheme = (org: any) => {
        const root = document.documentElement;

        // Helper to convert hex to HSL for CSS variable usage
        const hexToHSL = (hex: string) => {
            let r = 0, g = 0, b = 0;
            if (hex.length === 4) {
                r = parseInt(hex[1] + hex[1], 16);
                g = parseInt(hex[2] + hex[2], 16);
                b = parseInt(hex[3] + hex[3], 16);
            } else if (hex.length === 7) {
                r = parseInt(hex.substring(1, 3), 16);
                g = parseInt(hex.substring(3, 5), 16);
                b = parseInt(hex.substring(5, 7), 16);
            }

            r /= 255; g /= 255; b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h = 0, s = 0, l = (max + min) / 2;

            if (max !== min) {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }

            return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
        };

        if (org.primary_color) {
            const hsl = hexToHSL(org.primary_color);
            root.style.setProperty('--accent', hsl);
            root.style.setProperty('--ring', hsl);
            root.style.setProperty('--sidebar-primary', hsl);
            // We can also adjust chart-1 to match primary
            root.style.setProperty('--chart-1', hsl);
        }

        if (org.secondary_color) {
            const hsl = hexToHSL(org.secondary_color);
            root.style.setProperty('--sidebar-background', hsl);
        }

        if (org.font_family) {
            root.style.setProperty('font-family', org.font_family + ', sans-serif');
        }
    };

    return (
        <ThemeContext.Provider value={{ organization, isLoading }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
