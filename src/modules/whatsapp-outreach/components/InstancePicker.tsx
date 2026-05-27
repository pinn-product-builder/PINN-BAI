/**
 * InstancePicker — chips selecionáveis das instâncias Evolution disponíveis,
 * com health badge inline + indicador de uso hoje (X/cap).
 *
 * Padrão inspirado em Smartlead/Instantly multi-inbox.
 */
import { Box, Card, CardContent, Chip, FormControlLabel, Stack, Switch, TextField, Tooltip, Typography, alpha } from "@mui/material";
import { WhatsApp as WhatsAppIcon, Sync as SyncIcon } from "@mui/icons-material";

import { useInstances } from "../hooks/useInstances";
import type { EvolutionInstance } from "../types";
import { HealthBadge } from "./HealthBadge";

export interface InstancePickerProps {
  selected: string[];
  onChange: (next: string[]) => void;
  rotation: boolean;
  onRotationChange: (v: boolean) => void;
  capDaily: number;
  onCapDailyChange: (v: number) => void;
}

export function InstancePicker({
  selected, onChange, rotation, onRotationChange, capDaily, onCapDailyChange,
}: InstancePickerProps) {
  const { data: instances, isLoading, error } = useInstances();

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((n) => n !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  const disabledForRed = (inst: EvolutionInstance) =>
    inst.health === "red" && inst.status !== "open";

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Quais números vão disparar?
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Escolha 1 ou mais. Rotação distribui leads entre os números (anti-ban).
            </Typography>
          </Box>
        </Stack>

        {error && (
          <Typography color="error" variant="caption">
            Falha ao listar instâncias: {(error as Error).message}
          </Typography>
        )}

        {isLoading && <Typography variant="caption">Carregando…</Typography>}

        {!isLoading && instances && instances.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            Nenhuma instância Evolution conectada.
          </Typography>
        )}

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1, mb: 2 }}>
          {(instances ?? []).map((inst) => {
            const isSelected = selected.includes(inst.name);
            const disabled = disabledForRed(inst);
            return (
              <Tooltip
                key={inst.name}
                title={
                  disabled
                    ? `${inst.name} está offline ou no cap`
                    : `${inst.messages_today}/${inst.cap_daily} mensagens hoje`
                }
              >
                <Box
                  onClick={() => !disabled && toggle(inst.name)}
                  sx={{
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    border: 1,
                    borderColor: isSelected ? "primary.main" : "divider",
                    borderRadius: 1.5,
                    px: 1.5,
                    py: 1,
                    minWidth: 220,
                    bgcolor: isSelected ? (theme) => alpha(theme.palette.primary.main, 0.08) : "transparent",
                    transition: "border-color 0.15s, background-color 0.15s",
                    "&:hover": disabled
                      ? undefined
                      : { borderColor: isSelected ? "primary.main" : "text.primary" },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <WhatsAppIcon fontSize="small" sx={{ color: "#25D366" }} />
                    <Box flex={1}>
                      <Typography variant="body2" fontWeight={isSelected ? 700 : 500}>
                        {inst.name}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" mt={0.25}>
                        <HealthBadge health={inst.health} size="sm" showLabel={false} />
                        <Typography variant="caption" color="text.secondary">
                          {inst.messages_today}/{inst.cap_daily} hoje
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        <Stack direction="row" alignItems="center" spacing={3}>
          <FormControlLabel
            control={
              <Switch
                checked={rotation}
                onChange={(e) => onRotationChange(e.target.checked)}
                disabled={selected.length < 2}
              />
            }
            label={
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <SyncIcon fontSize="small" />
                <Typography variant="body2">
                  Rotação automática
                </Typography>
              </Stack>
            }
          />
          <TextField
            label="Cap diário por número"
            type="number"
            value={capDaily}
            onChange={(e) => onCapDailyChange(Math.max(1, parseInt(e.target.value, 10) || 30))}
            size="small"
            inputProps={{ min: 1, max: 500 }}
            sx={{ width: 180 }}
            helperText="Default 30/dia. Acima de 50 aumenta risco de ban."
          />
        </Stack>

        {selected.length === 0 && (
          <Chip
            label="Selecione ao menos 1 instância"
            color="warning"
            size="small"
            sx={{ mt: 2 }}
          />
        )}
        {selected.length >= 1 && (
          <Chip
            label={
              rotation && selected.length >= 2
                ? `${selected.length} números · Rotação ativa · ~${capDaily * selected.length}/dia total`
                : `${selected.length} número${selected.length > 1 ? "s" : ""} · ${capDaily}/dia`
            }
            color="success"
            size="small"
            sx={{ mt: 2 }}
          />
        )}
      </CardContent>
    </Card>
  );
}
