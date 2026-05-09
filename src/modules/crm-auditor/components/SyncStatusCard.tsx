import { Card, CardContent, Typography, Stack, Chip } from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";

interface SyncRun {
  status: string;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
}

interface Props {
  latestRun: SyncRun | null;
}

export function SyncStatusCard({ latestRun }: Props) {
  if (!latestRun) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2, opacity: 0.9 }}>
        <CardContent sx={{ py: 2.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <SyncIcon color="disabled" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Nenhuma sincronização registrada ainda.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const color =
    latestRun.status === "success" ? "success" : latestRun.status === "failed" ? "error" : "warning";

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ py: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} flexWrap="wrap">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <SyncIcon color="primary" fontSize="small" />
            <BoxText latestRun={latestRun} />
          </Stack>
          <Chip size="small" label={latestRun.status} color={color} variant="outlined" />
        </Stack>
        {latestRun.status === "failed" && latestRun.error_message && (
          <Typography variant="caption" color="error" sx={{ display: "block", mt: 1.5 }}>
            {latestRun.error_message}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function BoxText({ latestRun }: { latestRun: SyncRun }) {
  const started = new Date(latestRun.started_at).toLocaleString("pt-BR");
  const finished = latestRun.finished_at ? new Date(latestRun.finished_at).toLocaleString("pt-BR") : "—";

  return (
    <div>
      <Typography variant="subtitle2" fontWeight={600}>
        Última sincronização
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        Início: {started}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        Fim: {finished}
      </Typography>
    </div>
  );
}
