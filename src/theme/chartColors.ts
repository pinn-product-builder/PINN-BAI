import type { Theme } from "@mui/material/styles";

/** Paleta de séries para Recharts alinhada ao tema PINN / MUI. */
export function getChartSeriesColors(theme: Theme): string[] {
  const p = theme.palette;
  return [
    p.primary.main,
    p.warning.main,
    p.info.main,
    p.success.main,
    p.error.main,
    "#8B5CF6",
  ];
}

export function chartGridColor(theme: Theme): string {
  return theme.palette.mode === "light" ? "rgba(0,0,0,0.08)" : theme.palette.divider;
}
