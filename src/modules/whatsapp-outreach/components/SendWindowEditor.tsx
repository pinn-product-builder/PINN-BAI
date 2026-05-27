/** Editor da janela de envio (dias úteis + horário comercial). */
import {
  Box, Card, CardContent, MenuItem, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from "@mui/material";
import type { SendWindow } from "../types";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Mexico_City",
  "America/New_York",
  "Europe/Lisbon",
  "Europe/London",
];

export function SendWindowEditor({
  value, onChange,
}: { value: SendWindow; onChange: (next: SendWindow) => void }) {
  const handleWeekdays = (_: unknown, next: number[]) => {
    if (next.length === 0) return;  // mínimo 1 dia
    onChange({ ...value, weekdays: next.sort() });
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} mb={1}>
          Janela de envio
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
          Mensagens fora desse horário ficam agendadas pra próxima abertura.
          Anti-ban: nunca dispare de madrugada.
        </Typography>

        <Box mb={2}>
          <Typography variant="caption" color="text.secondary">
            Dias da semana
          </Typography>
          <ToggleButtonGroup
            value={value.weekdays}
            onChange={handleWeekdays}
            size="small"
            sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}
          >
            {WEEKDAY_LABELS.map((lbl, idx) => (
              <ToggleButton key={lbl} value={idx + 1} sx={{ flex: "1 0 60px" }}>
                {lbl}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Stack direction="row" spacing={2}>
          <TextField
            label="Início"
            type="number"
            value={value.start_hour}
            onChange={(e) => {
              const h = Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0));
              onChange({ ...value, start_hour: h });
            }}
            inputProps={{ min: 0, max: 23 }}
            sx={{ width: 110 }}
            size="small"
            helperText="0-23h"
          />
          <TextField
            label="Fim"
            type="number"
            value={value.end_hour}
            onChange={(e) => {
              const h = Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 18));
              onChange({ ...value, end_hour: h });
            }}
            inputProps={{ min: 1, max: 24 }}
            sx={{ width: 110 }}
            size="small"
            helperText="1-24h"
          />
          <TextField
            select
            label="Timezone"
            value={value.tz}
            onChange={(e) => onChange({ ...value, tz: e.target.value })}
            size="small"
            sx={{ flex: 1 }}
          >
            {TIMEZONES.map((tz) => (
              <MenuItem key={tz} value={tz}>{tz}</MenuItem>
            ))}
          </TextField>
        </Stack>

        <Typography variant="caption" color="text.secondary" display="block" mt={1.5}>
          📅 Disparo: {value.weekdays.map(d => WEEKDAY_LABELS[d-1]).join("/")},
          das {value.start_hour}h às {value.end_hour}h ({value.tz})
        </Typography>
      </CardContent>
    </Card>
  );
}
