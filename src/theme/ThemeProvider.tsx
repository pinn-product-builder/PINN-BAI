import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Tema único do produto (repaginação ago/2026): substitui os sistemas paralelos
 * (MUI light fixo, useDashboardTheme do CRM Auditor) por UM interruptor.
 * - Aplica/remove a classe `dark` no <html> — os tokens vivem em index.css.
 * - Default `light` (clientes atuais); dark é opt-in até decisão de rollout.
 * - O AppMuiProvider deve ler `useTheme().theme` para escolher createPinnTheme(mode)
 *   enquanto os shells MUI ainda existirem (ponte de transição, Fase 2/3).
 */
type Theme = "light" | "dark";

const STORAGE_KEY = "bai-ui-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de <ThemeProvider>");
  return ctx;
}
