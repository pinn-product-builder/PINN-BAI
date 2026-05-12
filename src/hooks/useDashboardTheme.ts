import { useCallback, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "bai-dashboard-theme";

export type DashboardTheme = "dark" | "light";

function readStoredTheme(): DashboardTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function useDashboardTheme() {
  const [theme, setThemeState] = useState<DashboardTheme>(() =>
    typeof window !== "undefined" ? readStoredTheme() : "dark",
  );

  const setTheme = useCallback((next: DashboardTheme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.baiTheme = theme;
    document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
  }, [theme]);

  return { theme, setTheme, toggleTheme };
}
