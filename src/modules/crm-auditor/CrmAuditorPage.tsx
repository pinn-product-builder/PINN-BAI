import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import RoleGuard from "@/components/auth/RoleGuard";
import {
  invokeCrmAuditor,
  type ConnectKommoResponse,
  type CrmAuditorOverviewResponse,
  type CrmAuditorStatusResponse,
} from "./api";
import { ComposioKommoSetupSection } from "./components/ComposioKommoSetupSection";
import { DashboardHeader } from "./components/DashboardHeader";
import { IntegrationStatusCard } from "./components/IntegrationStatusCard";
import { SyncStatusCard } from "./components/SyncStatusCard";

const qk = (orgId: string) => ["crm-auditor", orgId] as const;

export default function CrmAuditorPage() {
  const { orgId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { roles } = useAuth();
  const canOperate = roles.some((r) => ["platform_admin", "client_admin", "analyst"].includes(r));

  const statusQuery = useQuery({
    queryKey: [...qk(orgId ?? ""), "status"],
    queryFn: () => invokeCrmAuditor<CrmAuditorStatusResponse>(orgId!, "status"),
    enabled: Boolean(orgId),
  });

  const overviewQuery = useQuery({
    queryKey: [...qk(orgId ?? ""), "overview"],
    queryFn: () => invokeCrmAuditor<CrmAuditorOverviewResponse>(orgId!, "overview"),
    enabled: Boolean(orgId) && Boolean(statusQuery.data?.latest_snapshot),
  });

  const syncMutation = useMutation({
    mutationFn: () => invokeCrmAuditor<{ ok: boolean; mock?: boolean }>(orgId!, "sync"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: qk(orgId!) });
      toast({
        title: "Sincronização concluída",
        description: data.mock ? "Snapshot de métricas gerado (modo demonstração)." : "Dados atualizados.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Não foi possível sincronizar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const connectMutation = useMutation({
    mutationFn: () => invokeCrmAuditor<ConnectKommoResponse>(orgId!, "connect-kommo"),
    onSuccess: (data) => {
      if (data.redirect_url) {
        window.location.assign(data.redirect_url);
      }
    },
    onError: (err: Error) => {
      toast({
        title: "Conexão Kommo",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => invokeCrmAuditor(orgId!, "finalize-kommo"),
    onSettled: () => {
      if (orgId) queryClient.invalidateQueries({ queryKey: qk(orgId) });
    },
  });

  const ranFinalizeOnBoot = useRef(false);
  useEffect(() => {
    ranFinalizeOnBoot.current = false;
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    if (statusQuery.data?.integration_mode !== "live") return;
    if (statusQuery.data?.connection?.status !== "pending") return;
    if (!statusQuery.data?.connection?.has_composio_account) return;
    if (ranFinalizeOnBoot.current) return;
    ranFinalizeOnBoot.current = true;
    finalizeMutation.mutate();
  }, [
    orgId,
    statusQuery.data?.integration_mode,
    statusQuery.data?.connection?.status,
    statusQuery.data?.connection?.has_composio_account,
  ]);

  useEffect(() => {
    const bump = () => {
      if (
        orgId &&
        statusQuery.data?.integration_mode === "live" &&
        statusQuery.data?.connection?.status === "pending"
      ) {
        finalizeMutation.mutate();
      }
    };
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, [orgId, statusQuery.data?.integration_mode, statusQuery.data?.connection?.status]);

  if (!orgId) {
    return null;
  }

  if (statusQuery.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (statusQuery.isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Não foi possível carregar o módulo Auditor CRM. Tente novamente.</Alert>
      </Box>
    );
  }

  const st = statusQuery.data!;
  const ck =
    st.composio_kommo ?? {
      auth_config_id: null,
      auth_config_source: "missing" as const,
      ready_to_connect: false,
      public_app_url: null,
    };
  const conn = st.connection;
  const mode = st.integration_mode;
  const snapshot = st.latest_snapshot;
  const run = st.latest_sync_run;

  const needsKommoOAuth =
    mode === "live" &&
    (!conn || conn.status === "disconnected" || conn.status === "error");

  const waitingFirstSync =
    conn?.status === "connected" && !snapshot && run?.status !== "failed";

  const syncInProgress = run?.status === "running";

  const syncFailed = run?.status === "failed";

  let banner: { severity: "info" | "warning" | "error"; message: string } | null = null;
  if (needsKommoOAuth) {
    banner = {
      severity: "warning",
      message: "Conecte o Kommo para iniciar a auditoria comercial.",
    };
  } else if (mode === "mock") {
    banner = {
      severity: "info",
      message:
        "Integração Composio não configurada neste ambiente. A sincronização gera apenas snapshot de métricas de demonstração.",
    };
  } else if (mode === "live" && conn?.status === "pending") {
    banner = {
      severity: "info",
      message:
        "Bridge Composio ↔ Kommo: conclua o OAuth na página da Composio; ao voltar ao PINN, confirmamos a conta automaticamente.",
    };
  } else if (waitingFirstSync) {
    banner = {
      severity: "info",
      message: "CRM conectado. Faça a primeira sincronização para gerar o diagnóstico.",
    };
  }

  if (syncInProgress) {
    banner = { severity: "info", message: "Sincronizando dados do CRM." };
  }

  if (syncFailed && run?.error_message) {
    banner = {
      severity: "error",
      message: `Última sincronização falhou. ${run.error_message}`,
    };
  }

  const metrics = overviewQuery.data?.metrics ?? snapshot?.metrics ?? {};
  const overall = Number(metrics.overall_score ?? 0);
  const hygiene = Number(metrics.hygiene_score ?? 0);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      <DashboardHeader />

      <ComposioKommoSetupSection
        orgId={orgId}
        integrationMode={mode === "live" ? "live" : "mock"}
        composioKommo={ck}
        canOperate={canOperate}
      />

      {banner && (
        <Alert severity={banner.severity} sx={{ mb: 2 }} variant="outlined">
          {banner.message}
        </Alert>
      )}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <IntegrationStatusCard
            provider={st.provider}
            connection={conn}
            integrationMode={mode === "live" ? "live" : "mock"}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <SyncStatusCard latestRun={run} />
        </Box>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 3 }}>
        <RoleGuard allowedRoles={["platform_admin", "client_admin", "analyst"]}>
          <Button
            variant="contained"
            disabled={
              !canOperate ||
              syncMutation.isPending ||
              syncInProgress ||
              (mode === "live" && conn?.status !== "connected")
            }
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending || syncInProgress ? "Sincronizando…" : "Sincronizar agora"}
          </Button>
          <Button
            variant="outlined"
            disabled={
              !canOperate ||
              connectMutation.isPending ||
              mode === "mock" ||
              !needsKommoOAuth ||
              !ck.ready_to_connect
            }
            onClick={() => connectMutation.mutate()}
          >
            Conectar Kommo
          </Button>
        </RoleGuard>
        {!canOperate && (
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
            Seu perfil não permite sincronizar ou alterar conexões.
          </Typography>
        )}
      </Stack>

      {snapshot || overviewQuery.data?.has_data ? (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Indicadores (último snapshot)
          </Typography>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2} sx={{ gap: 2 }}>
            <Box sx={{ flex: "1 1 140px", minWidth: 140 }}>
              <Metric label="Score geral" value={overall} />
            </Box>
            <Box sx={{ flex: "1 1 140px", minWidth: 140 }}>
              <Metric label="Higiene" value={hygiene} />
            </Box>
            <Box sx={{ flex: "1 1 140px", minWidth: 140 }}>
              <Metric label="Oportunidades" value={Number(metrics.total_opportunities ?? 0)} suffix="" />
            </Box>
            <Box sx={{ flex: "1 1 140px", minWidth: 140 }}>
              <Metric label="Valor aberto" value={Number(metrics.open_value ?? 0)} suffix=" R$" />
            </Box>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            Próximas fases trazem funil completo, evidências e parecer IA sobre estes números.
          </Typography>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: "center", bgcolor: "grey.50" }}>
          <Typography variant="body2" color="text.secondary">
            Quando houver um snapshot de sincronização, o painel exibirá métricas e seções de auditoria aqui.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

function Metric({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={700}>
        {Number.isFinite(value) ? `${value}${suffix}` : "—"}
      </Typography>
    </Box>
  );
}
