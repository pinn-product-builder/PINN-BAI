import { alpha, Theme } from "@mui/material/styles";

/** Superfície de card (modo claro único) */
export function cardSurface(theme: Theme, radius: number | string = 2) {
  return {
    border: "1px solid",
    borderColor: "divider",
    bgcolor: "background.paper",
    borderRadius: radius,
  } as const;
}

/** Faixa / linha com fundo sutil */
export function subtleRowBg(theme: Theme) {
  return alpha(theme.palette.common.black, 0.03);
}

/** Input outlined denso (listas, admin, modais) */
export function denseOutlinedInput(theme: Theme) {
  return {
    "& .MuiOutlinedInput-root": {
      backgroundColor: alpha(theme.palette.common.black, 0.04),
      fontSize: "0.8125rem",
    },
  };
}

/** Borda + fundo para drawers / painéis laterais */
export function drawerPaperSx(theme: Theme) {
  return {
    bgcolor: "background.default",
    borderLeft: "1px solid",
    borderColor: "divider",
  };
}
