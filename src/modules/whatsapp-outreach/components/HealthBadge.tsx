import { Box, Tooltip, Typography } from "@mui/material";
import type { InstanceHealth } from "../types";

const COLORS: Record<InstanceHealth, { bg: string; text: string; tip: string }> = {
  green:  { bg: "#10b981", text: "Saudável",  tip: "Disparou < 50% do cap diário · WhatsApp conectado" },
  yellow: { bg: "#f59e0b", text: "Atenção",   tip: "Disparou > 50% do cap diário — pode pausar logo" },
  red:    { bg: "#ef4444", text: "Bloqueado", tip: "Atingiu cap diário OU WhatsApp desconectado" },
};

export function HealthBadge({
  health, size = "sm", showLabel = true,
}: {
  health: InstanceHealth;
  size?: "sm" | "md";
  showLabel?: boolean;
}) {
  const cfg = COLORS[health];
  const dim = size === "sm" ? 8 : 10;
  return (
    <Tooltip title={cfg.tip}>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
        <Box
          sx={{
            width: dim, height: dim, borderRadius: "50%",
            bgcolor: cfg.bg,
            boxShadow: `0 0 0 2px ${cfg.bg}33`,
          }}
        />
        {showLabel && (
          <Typography variant="caption" color="text.secondary">
            {cfg.text}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}
