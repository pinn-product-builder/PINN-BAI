import type { Theme } from "@mui/material/styles";

/* ────────────────────────────────────────────────────────────────────────────
   Pinn DS oficial — paleta de séries para Recharts.
   Ordem canônica: orange (alma) → success → info → warning → error → graphite.
   Sem roxo (`#8B5CF6` removido — não está no DS oficial v1.0).
   ──────────────────────────────────────────────────────────────────────────── */
export function getChartSeriesColors(theme: Theme): string[] {
  const p = theme.palette;
  return [
    p.primary.main,    // #FF6B35 orange
    p.success.main,    // #2E7D32
    p.info.main,       // #2563EB
    p.warning.main,    // #F57C00
    p.error.main,      // #C62828
    "#555555",         // graphite (neutral DS)
  ];
}

export function chartGridColor(theme: Theme): string {
  return theme.palette.mode === "light"
    ? "rgba(230,228,224,0.6)"   // pinn-rule @ 60%
    : theme.palette.divider;
}
