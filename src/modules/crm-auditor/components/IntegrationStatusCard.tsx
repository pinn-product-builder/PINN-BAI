import { Card, CardContent, Typography, Stack, Chip, Box } from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import type { CrmConnectionSummary } from "../api";

interface Props {
  provider: string;
  connection: CrmConnectionSummary | null;
  integrationMode: "live" | "mock";
}

const statusLabel: Record<string, string> = {
  disconnected: "Desconectado",
  pending: "Pendente",
  connected: "Conectado",
  error: "Erro",
};

export function IntegrationStatusCard({ provider, connection, integrationMode }: Props) {
  const st = connection?.status ?? "disconnected";
  const label = statusLabel[st] ?? st;

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ py: 2.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: "primary.main",
                color: "primary.contrastText",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LinkIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                Conexão CRM
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Provedor: {provider}
              </Typography>
              {integrationMode === "live" && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  OAuth Kommo via Composio (sessão de link + retorno ao PINN).
                </Typography>
              )}
            </Box>
          </Stack>
          <Stack alignItems="flex-end" spacing={0.75}>
            <Chip size="small" label={label} color={st === "connected" ? "success" : "default"} variant={st === "connected" ? "filled" : "outlined"} />
            <Chip
              size="small"
              label={integrationMode === "mock" ? "Modo demonstração" : "Produção"}
              variant="outlined"
              sx={{ fontSize: 10 }}
            />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
