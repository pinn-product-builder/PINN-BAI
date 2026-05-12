import { createTheme, darken, lighten } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    pinn: {
      orange: string;
      orangeLight: string;
      orangeDark: string;
      black: string;
      surface1: string;
      surface2: string;
      surface3: string;
      border: string;
      borderStrong: string;
    };
  }
  interface PaletteOptions {
    pinn?: {
      orange?: string;
      orangeLight?: string;
      orangeDark?: string;
      black?: string;
      surface1?: string;
      surface2?: string;
      surface3?: string;
      border?: string;
      borderStrong?: string;
    };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Pinn DS oficial (v1.0 · Maio/2026) — single source of truth
   ──────────────────────────────────────────────────────────────────────────── */
const PINN_ORANGE       = "#FF6B35";
const PINN_ORANGE_DARK  = "#E55A2B";
const PINN_ORANGE_LIGHT = "#FFF3ED";
const PINN_INK          = "#1A1A1A";
const PINN_INK_2        = "#2C2C2C";
const PINN_GRAPHITE     = "#555555";
const PINN_MUTE         = "#999999";
const PINN_RULE         = "#E6E4E0";
const PINN_SURFACE      = "#F6F4EF";
const PINN_PAPER        = "#FAF8F4";
const PINN_WHITE        = "#FFFFFF";
const PINN_SUCCESS      = "#2E7D32";
const PINN_ERROR        = "#C62828";
const PINN_WARNING      = "#F57C00";
const PINN_INFO         = "#2563EB";

/** Sombras DS — executive-soft, baseadas em rgba(26,26,26, 0.04→0.16) */
const buildPinnShadows = (isDark: boolean) => {
  if (isDark) {
    /* Modo dark mantido como hoje (não-alvo deste rebrand — backlog) */
    const d = (n: number) => `0 ${n}px ${n * 2}px rgba(0,0,0,0.4)`;
    return [
      "none",
      ...Array.from({ length: 24 }, (_, i) => d(i + 1)),
    ] as unknown as ReturnType<typeof createTheme>["shadows"];
  }
  /* Light: progressivo executive — hairline + soft drop */
  const hairline = "0 0 0 1px rgba(26,26,26,0.04)";
  const lvl = (drop: string) => `${drop}, ${hairline}`;
  return [
    "none",
    lvl("0 1px 2px rgba(26,26,26,0.06)"),
    lvl("0 2px 6px rgba(26,26,26,0.06)"),
    lvl("0 4px 12px rgba(26,26,26,0.07)"),
    lvl("0 6px 16px rgba(26,26,26,0.07)"),
    lvl("0 8px 20px rgba(26,26,26,0.08)"),
    lvl("0 12px 28px rgba(26,26,26,0.08)"),
    lvl("0 16px 36px rgba(26,26,26,0.09)"),
    lvl("0 20px 44px rgba(26,26,26,0.09)"),
    lvl("0 24px 52px rgba(26,26,26,0.10)"),
    lvl("0 28px 60px rgba(26,26,26,0.10)"),
    lvl("0 32px 68px rgba(26,26,26,0.11)"),
    lvl("0 36px 76px rgba(26,26,26,0.11)"),
    lvl("0 40px 84px rgba(26,26,26,0.12)"),
    lvl("0 44px 92px rgba(26,26,26,0.12)"),
    lvl("0 48px 100px rgba(26,26,26,0.12)"),
    lvl("0 52px 108px rgba(26,26,26,0.13)"),
    lvl("0 56px 116px rgba(26,26,26,0.13)"),
    lvl("0 60px 124px rgba(26,26,26,0.13)"),
    lvl("0 64px 132px rgba(26,26,26,0.14)"),
    lvl("0 68px 140px rgba(26,26,26,0.14)"),
    lvl("0 72px 148px rgba(26,26,26,0.14)"),
    lvl("0 76px 156px rgba(26,26,26,0.15)"),
    lvl("0 80px 164px rgba(26,26,26,0.15)"),
    lvl("0 84px 172px rgba(26,26,26,0.16)"),
  ] as unknown as ReturnType<typeof createTheme>["shadows"];
};

export function createPinnTheme(mode: "light" | "dark") {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main:         PINN_ORANGE,
        light:        "#FF8A60",
        dark:         PINN_ORANGE_DARK,
        contrastText: "#ffffff",
      },
      secondary: {
        main:         isDark ? "#2A2A2A" : PINN_SURFACE,
        light:        isDark ? "#3A3A3A" : "#F0EDE6",
        dark:         isDark ? "#1A1A1A" : "#D9D5CB",
        contrastText: isDark ? "#F0F0F0" : PINN_INK,
      },
      background: {
        default: isDark ? "#0F0F0F" : PINN_PAPER,
        paper:   isDark ? "#181818" : PINN_WHITE,
      },
      text: {
        primary:   isDark ? "#F0F0F0" : PINN_INK,
        secondary: isDark ? "#9A9A9A" : PINN_GRAPHITE,
        disabled:  isDark ? "#555555" : PINN_MUTE,
      },
      divider: isDark ? "rgba(255,255,255,0.07)" : PINN_RULE,
      success: { main: PINN_SUCCESS, contrastText: "#fff" },
      warning: { main: PINN_WARNING, contrastText: "#fff" },
      error:   { main: PINN_ERROR,   contrastText: "#fff" },
      info:    { main: PINN_INFO,    contrastText: "#fff" },
      pinn: {
        orange:       PINN_ORANGE,
        orangeLight:  PINN_ORANGE_LIGHT,
        orangeDark:   PINN_ORANGE_DARK,
        black:        isDark ? "#111111" : PINN_INK,
        surface1:     isDark ? "#181818" : PINN_WHITE,
        surface2:     isDark ? "#202020" : PINN_PAPER,
        surface3:     isDark ? "#282828" : PINN_SURFACE,
        border:       isDark ? "rgba(255,255,255,0.07)" : PINN_RULE,
        borderStrong: isDark ? "rgba(255,255,255,0.14)" : "#D9D5CB",
      },
    },

    typography: {
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: { fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05 },
      h2: { fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 },
      h3: { fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.15 },
      h4: { fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 },
      h5: { fontWeight: 600, letterSpacing: "-0.005em" },
      h6: { fontWeight: 600, letterSpacing: "-0.005em" },
      subtitle1: { fontWeight: 500, letterSpacing: "-0.005em" },
      subtitle2: { fontWeight: 500, fontSize: "0.8125rem" },
      body1: { letterSpacing: "-0.005em", lineHeight: 1.6 },
      body2: { fontSize: "0.8125rem", letterSpacing: "-0.003em", lineHeight: 1.55 },
      caption: { fontSize: "0.6875rem", letterSpacing: "0.01em" },
      overline: { fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" },
      button: { fontWeight: 600, letterSpacing: "-0.01em", textTransform: "none" },
    },

    shape: { borderRadius: 8 },

    shadows: buildPinnShadows(isDark),

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          "*": { boxSizing: "border-box" },
          "html, body, #root": { height: "100%", margin: 0, padding: 0 },
          body: {
            backgroundColor: isDark ? "#0F0F0F" : PINN_PAPER,
            color: isDark ? "#F0F0F0" : PINN_INK,
            fontFamily: '"Inter", system-ui, sans-serif',
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
          },
          "::-webkit-scrollbar": { width: "5px", height: "5px" },
          "::-webkit-scrollbar-track": { background: "transparent" },
          "::-webkit-scrollbar-thumb": {
            background: isDark ? "rgba(255,255,255,0.12)" : "rgba(26,26,26,0.15)",
            borderRadius: "4px",
          },
          "::-webkit-scrollbar-thumb:hover": {
            background: isDark ? "rgba(255,255,255,0.2)" : "rgba(26,26,26,0.25)",
          },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: ({ ownerState }) => ({
            borderRadius: 8,
            fontWeight: 600,
            fontSize: "0.8125rem",
            padding: "7px 16px",
            transition: "all 200ms cubic-bezier(.2,.7,.2,1)",
            ...(ownerState.variant === "contained" && ownerState.color === "primary" && {
              background: PINN_ORANGE,
              color: "#fff",
              "&:hover": { background: PINN_ORANGE_DARK },
              "&:active": { transform: "scale(0.98)" },
            }),
            ...(ownerState.variant === "outlined" && {
              borderColor: isDark ? "rgba(255,255,255,0.12)" : PINN_RULE,
              color: isDark ? "#D0D0D0" : PINN_INK_2,
              "&:hover": {
                borderColor: isDark ? "rgba(255,255,255,0.25)" : PINN_INK,
                background: isDark ? "rgba(255,255,255,0.04)" : PINN_ORANGE_LIGHT,
              },
            }),
            ...(ownerState.variant === "text" && {
              color: isDark ? "#B0B0B0" : PINN_GRAPHITE,
              "&:hover": {
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(26,26,26,0.04)",
                color: isDark ? "#F0F0F0" : PINN_INK,
              },
            }),
          }),
          sizeSmall: { fontSize: "0.75rem", padding: "5px 12px" },
          sizeLarge: { fontSize: "0.9375rem", padding: "10px 24px" },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: "all 150ms cubic-bezier(.2,.7,.2,1)",
            "&:hover": { background: isDark ? "rgba(255,255,255,0.06)" : "rgba(26,26,26,0.05)" },
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: isDark ? "#181818" : PINN_WHITE,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : PINN_RULE}`,
          },
          elevation1: { boxShadow: isDark
            ? "0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)"
            : "0 1px 2px rgba(26,26,26,0.06), 0 0 0 1px rgba(26,26,26,0.04)" },
          elevation2: { boxShadow: isDark
            ? "0 2px 6px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)"
            : "0 4px 16px rgba(26,26,26,0.06), 0 0 0 1px rgba(26,26,26,0.04)" },
          elevation3: { boxShadow: isDark
            ? "0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)"
            : "0 12px 32px rgba(26,26,26,0.08), 0 0 0 1px rgba(26,26,26,0.04)" },
        },
      },

      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: isDark ? "#181818" : PINN_WHITE,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : PINN_RULE}`,
            borderRadius: 12,
            transition: "border-color 200ms cubic-bezier(.2,.7,.2,1), box-shadow 200ms cubic-bezier(.2,.7,.2,1), transform 200ms cubic-bezier(.2,.7,.2,1)",
            "&:hover": {
              borderColor: isDark ? "rgba(255,255,255,0.12)" : "#D9D5CB",
              boxShadow: isDark
                ? "0 4px 16px rgba(0,0,0,0.4)"
                : "0 4px 16px rgba(26,26,26,0.06), 0 0 0 1px rgba(26,26,26,0.04)",
            },
          },
        },
      },

      MuiCardContent: {
        styleOverrides: { root: { padding: 20, "&:last-child": { paddingBottom: 20 } } },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? "#111111" : PINN_SURFACE,
            borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : PINN_RULE}`,
            backgroundImage: "none",
          },
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#111111" : PINN_PAPER,
            backgroundImage: "none",
            borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : PINN_RULE}`,
            boxShadow: "none",
            color: isDark ? "#F0F0F0" : PINN_INK,
          },
        },
      },

      MuiTextField: {
        defaultProps: { variant: "outlined", size: "small" },
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              backgroundColor: isDark ? "#1E1E1E" : PINN_WHITE,
              borderRadius: 8,
              fontSize: "0.875rem",
              "& fieldset": { borderColor: isDark ? "rgba(255,255,255,0.1)" : PINN_RULE },
              "&:hover fieldset": { borderColor: isDark ? "rgba(255,255,255,0.2)" : "#D9D5CB" },
              "&.Mui-focused fieldset": { borderColor: PINN_ORANGE, borderWidth: 1.5 },
            },
            "& .MuiInputLabel-root": { fontSize: "0.875rem", color: isDark ? "#888" : PINN_GRAPHITE },
            "& .MuiInputLabel-root.Mui-focused": { color: PINN_ORANGE },
          },
        },
      },

      MuiSelect: {
        defaultProps: { size: "small" },
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#1E1E1E" : PINN_WHITE,
            borderRadius: 8,
            fontSize: "0.875rem",
            "& .MuiOutlinedInput-notchedOutline": { borderColor: isDark ? "rgba(255,255,255,0.1)" : PINN_RULE },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: isDark ? "rgba(255,255,255,0.2)" : "#D9D5CB" },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: PINN_ORANGE, borderWidth: 1.5 },
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 500, fontSize: "0.75rem" },
          filled: {
            backgroundColor: "rgba(255,107,53,0.12)",
            color: PINN_ORANGE_DARK,
            "&:hover": { backgroundColor: "rgba(255,107,53,0.18)" },
          },
          outlined: {
            borderColor: isDark ? "rgba(255,255,255,0.12)" : PINN_RULE,
            color: isDark ? "#C0C0C0" : PINN_GRAPHITE,
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: PINN_INK,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(26,26,26,0.1)"}`,
            borderRadius: 6,
            fontSize: "0.75rem",
            padding: "6px 10px",
            color: "#fff",
          },
          arrow: { color: PINN_INK },
        },
      },

      MuiDivider: {
        styleOverrides: { root: { borderColor: isDark ? "rgba(255,255,255,0.07)" : PINN_RULE } },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: "1px 8px",
            padding: "8px 12px",
            transition: "all 150ms cubic-bezier(.2,.7,.2,1)",
            "&:hover": { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(26,26,26,0.04)" },
            "&.Mui-selected": {
              backgroundColor: "rgba(255,107,53,0.12)",
              color: PINN_ORANGE,
              "&:hover": { backgroundColor: "rgba(255,107,53,0.18)" },
              "& .MuiListItemIcon-root": { color: PINN_ORANGE },
            },
          },
        },
      },

      MuiListItemIcon: {
        styleOverrides: { root: { minWidth: 36, color: isDark ? "#707070" : PINN_MUTE } },
      },

      MuiListItemText: {
        styleOverrides: {
          primary: { fontSize: "0.875rem", fontWeight: 500 },
          secondary: { fontSize: "0.75rem" },
        },
      },

      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 40, borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : PINN_RULE}` },
          indicator: { backgroundColor: PINN_ORANGE, height: 2, borderRadius: "2px 2px 0 0" },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 40,
            textTransform: "none",
            fontWeight: 500,
            fontSize: "0.875rem",
            color: isDark ? "#888" : PINN_GRAPHITE,
            padding: "8px 16px",
            "&.Mui-selected": { color: isDark ? "#F0F0F0" : PINN_INK, fontWeight: 600 },
          },
        },
      },

      MuiTableHead: {
        styleOverrides: {
          root: {
            "& .MuiTableCell-root": {
              backgroundColor: isDark ? "#141414" : PINN_SURFACE,
              color: isDark ? "#888" : PINN_GRAPHITE,
              fontSize: "0.6875rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : PINN_RULE}`,
              padding: "10px 16px",
            },
          },
        },
      },

      MuiTableBody: {
        styleOverrides: {
          root: {
            "& .MuiTableRow-root": {
              transition: "background 150ms cubic-bezier(.2,.7,.2,1)",
              "&:hover": { backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "rgba(26,26,26,0.02)" },
            },
            "& .MuiTableCell-root": {
              borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(230,228,224,0.6)"}`,
              padding: "12px 16px",
              fontSize: "0.8125rem",
            },
          },
        },
      },

      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 8, fontSize: "0.875rem" },
          standardInfo: {
            backgroundColor: isDark ? "rgba(37,99,235,0.1)" : "rgba(37,99,235,0.08)",
            border: "1px solid rgba(37,99,235,0.2)",
            color: isDark ? "#93C5FD" : PINN_INFO,
          },
          standardSuccess: {
            backgroundColor: isDark ? "rgba(46,125,50,0.1)" : "rgba(46,125,50,0.08)",
            border: "1px solid rgba(46,125,50,0.2)",
            color: isDark ? "#86EFAC" : PINN_SUCCESS,
          },
          standardWarning: {
            backgroundColor: isDark ? "rgba(245,124,0,0.1)" : "rgba(245,124,0,0.08)",
            border: "1px solid rgba(245,124,0,0.2)",
            color: isDark ? "#FCD34D" : PINN_WARNING,
          },
          standardError: {
            backgroundColor: isDark ? "rgba(198,40,40,0.1)" : "rgba(198,40,40,0.08)",
            border: "1px solid rgba(198,40,40,0.2)",
            color: isDark ? "#FCA5A5" : PINN_ERROR,
          },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4, height: 4,
            backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(26,26,26,0.07)",
          },
          bar: { borderRadius: 4, backgroundColor: PINN_ORANGE },
        },
      },

      MuiCircularProgress: { defaultProps: { color: "primary" } },

      MuiSkeleton: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(26,26,26,0.06)",
            borderRadius: 6,
          },
        },
      },

      MuiBadge: {
        styleOverrides: {
          badge: { fontSize: "0.625rem", fontWeight: 700, minWidth: 18, height: 18, padding: "0 4px" },
        },
      },

      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? "#202020" : PINN_WHITE,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : PINN_RULE}`,
            borderRadius: 10,
            boxShadow: isDark
              ? "0 8px 32px rgba(0,0,0,0.6)"
              : "0 12px 32px rgba(26,26,26,0.08), 0 0 0 1px rgba(26,26,26,0.04)",
            backgroundImage: "none",
          },
        },
      },

      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: "0.875rem",
            borderRadius: 6,
            margin: "2px 6px",
            padding: "7px 10px",
            "&:hover": { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(26,26,26,0.04)" },
            "&.Mui-selected": { backgroundColor: "rgba(255,107,53,0.12)", color: PINN_ORANGE },
          },
        },
      },

      MuiSwitch: {
        styleOverrides: {
          root: { width: 36, height: 20, padding: 0 },
          switchBase: {
            padding: 2,
            "&.Mui-checked": {
              transform: "translateX(16px)",
              color: "#fff",
              "& + .MuiSwitch-track": { backgroundColor: PINN_ORANGE, opacity: 1 },
            },
          },
          thumb: { width: 16, height: 16, boxShadow: "none" },
          track: { borderRadius: 10, backgroundColor: isDark ? "#404040" : "#CCCCCC", opacity: 1 },
        },
      },
    },
  });
}

/** Tema PINN — modo claro (default Pinn DS oficial). Aceita override de cor primária por organização (hex). Sync com PROJETO-HERMES `pinnTheme.ts`. */
export function createPinnThemeLight(overridePrimaryHex?: string | null) {
  const base = createPinnTheme("light");
  if (!overridePrimaryHex || !/^#[0-9A-Fa-f]{3,8}$/.test(overridePrimaryHex.trim())) {
    return base;
  }
  const hex = overridePrimaryHex.trim();
  return createTheme(base, {
    palette: {
      primary: {
        main: hex,
        light: lighten(hex, 0.18),
        dark: darken(hex, 0.18),
        contrastText: "#ffffff",
      },
    },
  });
}

export const pinnTheme = createPinnThemeLight();
