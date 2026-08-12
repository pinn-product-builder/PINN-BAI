import { Stack, Typography } from "@mui/material";

interface Props {
  title?: string;
  subtitle?: string;
}

export function DashboardHeader({
  title = "Auditor CRM",
  subtitle = "Diagnóstico comercial, higiene de dados e disciplina do funil — isolado por organização.",
}: Props) {
  return (
    <Stack spacing={0.75} sx={{ mb: 3 }}>
      <Typography variant="h5" fontWeight={700} letterSpacing="-0.02em">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
        {subtitle}
      </Typography>
    </Stack>
  );
}
