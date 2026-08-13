/**
 * Onboarding de CRM — wizard em 4 passos: conectar o CRM (provider-agnóstico,
 * form dinâmico a partir de providers.ts), sincronizar (edge sync-<provider>),
 * montar o dashboard (AutoBuildDashboardDialog) e concluir.
 *
 * Reconstruído fielmente a partir do bundle de produção
 * (dist/assets/index-*.js, build de 05/jul/2026). Ícones: melhor esforço.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useToast } from "@/hooks/use-toast";
import { useDashboard, useCreateDashboard } from "@/hooks/useDashboard";
import { PROVIDERS, getProvider } from "./providers";
import { connectProviderDirect, runProviderSync } from "./api";
import { AutoBuildDashboardDialog } from "./components/AutoBuildDashboardDialog";

const STEPS = ["Conectar CRM", "Sincronizar", "Montar dashboard", "Pronto"];

const STAT_CHIPS: { key: string; label: string }[] = [
  { key: "pipelines", label: "Funis" },
  { key: "stages", label: "Etapas" },
  { key: "leads", label: "Leads" },
  { key: "contacts", label: "Contatos" },
  { key: "users", label: "Usuários" },
];

export default function CrmOnboardingWizard() {
  const { orgId } = useParams();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState("kommo");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const providerDef = getProvider(provider);
  const [syncStats, setSyncStats] = useState<Record<string, unknown> | null>(null);
  const defaultDashboard = useDashboard(orgId);
  const createDashboard = useCreateDashboard();
  const [dashboardId, setDashboardId] = useState<string | null>(null);
  const [autoBuildOpen, setAutoBuildOpen] = useState(false);

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Organização não encontrada.");
      if (!providerDef) throw new Error("Provedor inválido.");
      const credentials: Record<string, string> = {};
      for (const field of providerDef.credentialFields) {
        credentials[field.key] = (creds[field.key] ?? "").trim();
      }
      await connectProviderDirect(orgId, provider, credentials);
    },
    onSuccess: () => setStep(1),
    onError: (err: Error) => toast({ variant: "destructive", title: "Falha ao conectar", description: err.message }),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Organização não encontrada.");
      return runProviderSync(orgId, provider);
    },
    onSuccess: (stats) => setSyncStats(stats),
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Falha na sincronização", description: err.message }),
  });

  useEffect(() => {
    if (step === 1 && !syncStats && !syncMutation.isPending) syncMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const prepareDashboard = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Organização não encontrada.");
      if (defaultDashboard.data?.id) return defaultDashboard.data.id;
      return (await createDashboard.mutateAsync({ org_id: orgId, name: "Dashboard", is_default: true })).id;
    },
    onSuccess: (id: string) => {
      setDashboardId(id);
      setAutoBuildOpen(true);
    },
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Não consegui preparar o dashboard", description: err.message }),
  });

  const canConnect = useMemo(
    () => !!providerDef && providerDef.credentialFields.every((field) => (creds[field.key] ?? "").trim().length > 0),
    [providerDef, creds],
  );

  const selectProvider = (id: string) => {
    setProvider(id);
    setCreds({});
  };

  return (
    <Box sx={{ maxWidth: 760, mx: "auto", py: 4, px: 2 }}>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Onboarding de CRM
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Conecte o CRM do cliente, puxe os dados e monte o dashboard selecionando as tabelas. Sem hardcode — tudo a
        partir da descoberta.
      </Typography>

      <Stepper activeStep={step} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {step === 0 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" gap={1}>
              <LinkIcon fontSize="small" color="primary" />
              <Typography variant="h6" fontWeight={700}>
                Conectar o CRM
              </Typography>
            </Stack>
            <FormControl size="small" fullWidth>
              <InputLabel id="prov">Provedor de CRM</InputLabel>
              <Select
                labelId="prov"
                label="Provedor de CRM"
                value={provider}
                onChange={(e) => selectProvider(e.target.value)}
              >
                {PROVIDERS.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.label}
                    {p.syncReady ? "" : " · em breve"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {providerDef && !providerDef.syncReady && (
              <Alert severity="info">
                {providerDef.note ?? "Conector em desenvolvimento."} Você pode salvar a conexão, mas a sincronização
                ainda não está disponível para este CRM.
              </Alert>
            )}
            {(providerDef?.credentialFields ?? []).map((field) => (
              <TextField
                key={field.key}
                size="small"
                label={field.label}
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                helperText={field.help}
                value={creds[field.key] ?? ""}
                onChange={(e) => setCreds((prev) => ({ ...prev, [field.key]: e.target.value }))}
                fullWidth
              />
            ))}
            <Box>
              <Button
                variant="contained"
                onClick={() => connectMutation.mutate()}
                disabled={!canConnect || connectMutation.isPending}
                startIcon={
                  connectMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <LinkIcon />
                }
              >
                {connectMutation.isPending ? "Conectando…" : "Conectar"}
              </Button>
            </Box>
          </Stack>
        </Paper>
      )}

      {step === 1 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" gap={1}>
              <CloudSyncIcon fontSize="small" color="primary" />
              <Typography variant="h6" fontWeight={700}>
                Puxando os dados do CRM
              </Typography>
            </Stack>
            {syncMutation.isPending && (
              <Stack alignItems="center" spacing={1.5} sx={{ py: 3 }}>
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary">
                  Descobrindo funis, etapas, campos e leads…
                </Typography>
              </Stack>
            )}
            {syncMutation.isError && !syncMutation.isPending && (
              <>
                <Alert severity="error">A sincronização falhou. Verifique a conexão e tente de novo.</Alert>
                <Box>
                  <Button variant="outlined" onClick={() => syncMutation.mutate()}>
                    Tentar de novo
                  </Button>
                </Box>
              </>
            )}
            {syncStats && !syncMutation.isPending && (
              <>
                <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />}>
                  Dados sincronizados do CRM.
                </Alert>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  {STAT_CHIPS.filter((chip) => syncStats[chip.key] != null).map((chip) => (
                    <Chip
                      key={chip.key}
                      label={`${syncStats[chip.key]} ${chip.label}`}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Stack>
                <Box>
                  <Button variant="contained" onClick={() => setStep(2)}>
                    Continuar
                  </Button>
                </Box>
              </>
            )}
          </Stack>
        </Paper>
      )}

      {step === 2 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" gap={1}>
              <AutoAwesomeIcon fontSize="small" color="primary" />
              <Typography variant="h6" fontWeight={700}>
                Montar o dashboard
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Escolha as tabelas/fontes descobertas e marque os widgets — ou deixe a IA propor o dashboard inteiro. A
              seleção acumula entre fontes.
            </Typography>
            <Box>
              <Button
                variant="contained"
                onClick={() => prepareDashboard.mutate()}
                disabled={prepareDashboard.isPending || defaultDashboard.isLoading}
                startIcon={
                  prepareDashboard.isPending ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />
                }
              >
                {prepareDashboard.isPending ? "Preparando…" : "Selecionar tabelas e montar"}
              </Button>
            </Box>
          </Stack>
        </Paper>
      )}

      {step === 3 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2} alignItems="flex-start">
            <Stack direction="row" alignItems="center" gap={1}>
              <CheckCircleIcon color="success" />
              <Typography variant="h6" fontWeight={700}>
                Dashboard montado!
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              O CRM está conectado, os dados sincronizados e o dashboard pronto. A partir daqui a sync roda
              automaticamente e você pode editar os widgets no dashboard.
            </Typography>
            <Button component={RouterLink} to={`/client/${orgId}/dashboard`} variant="contained">
              Ver o dashboard
            </Button>
          </Stack>
        </Paper>
      )}

      <AutoBuildDashboardDialog
        open={autoBuildOpen}
        orgId={orgId ?? ""}
        dashboardId={dashboardId}
        connectedProviders={[provider]}
        onClose={() => setAutoBuildOpen(false)}
        onApplied={() => {
          setAutoBuildOpen(false);
          setStep(3);
        }}
      />
    </Box>
  );
}
