import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import { useToast } from "@/hooks/use-toast";
import { invokeCrmAuditor, type CrmAuditorComposioKommoSetup } from "../api";

const qk = (orgId: string) => ["crm-auditor", orgId] as const;

type Props = {
  orgId: string;
  integrationMode: "live" | "mock";
  composioKommo: CrmAuditorComposioKommoSetup;
  canOperate: boolean;
};

export function ComposioKommoSetupSection({
  orgId,
  integrationMode,
  composioKommo,
  canOperate,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [authConfigId, setAuthConfigId] = useState("");
  const [publicAppUrl, setPublicAppUrl] = useState("");

  useEffect(() => {
    setAuthConfigId(composioKommo.auth_config_id ?? "");
    setPublicAppUrl(composioKommo.public_app_url ?? "");
  }, [composioKommo.auth_config_id, composioKommo.public_app_url]);

  const saveMutation = useMutation({
    mutationFn: () =>
      invokeCrmAuditor<{ ok: boolean }>(orgId, "save-composio-kommo", {
        composioKommoAuthConfigId: authConfigId.trim(),
        publicAppUrl: publicAppUrl.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk(orgId) });
      toast({
        title: "Configuração salva",
        description: "Auth Config e URL de callback registrados para esta organização.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Não foi possível salvar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const sourceLabel =
    composioKommo.auth_config_source === "tenant"
      ? "Salvo neste Auditor"
      : composioKommo.auth_config_source === "environment"
        ? "Definido na API (COMPOSIO_KOMMO_AUTH_CONFIG_ID)"
        : "Não configurado";

  if (integrationMode === "mock") {
    return (
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          Integração Composio + Kommo
        </Typography>
        <Alert severity="warning" variant="outlined">
          O servidor da API não tem <code>COMPOSIO_API_KEY</code>. Todo o fluxo OAuth abaixo fica desativado até a
          infraestrutura habilitar a Composio (modo demonstração continua disponível).
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
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
            flexShrink: 0,
          }}
        >
          <LinkIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Integração Composio + Kommo
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Todo o processo de conexão é feito aqui: você informa o Auth Config, opcionalmente a URL pública do PINN
            (callback após OAuth), salva e em seguida usa &quot;Conectar Kommo&quot; para abrir o fluxo OAuth da
            Composio.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Origem do Auth Config: <strong>{sourceLabel}</strong>
            {composioKommo.ready_to_connect ? " · Pronto para OAuth" : " · Preencha e salve o Auth Config ID"}
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={2}>
        <TextField
          label="Auth Config ID (Kommo na Composio)"
          fullWidth
          size="small"
          value={authConfigId}
          onChange={(e) => setAuthConfigId(e.target.value)}
          disabled={!canOperate || saveMutation.isPending}
          placeholder="Ex.: ac_xxxx — Dashboard Composio → Auth configs"
          helperText="Mesmo identificador do Auth Config que você usa no app integrado à Composio."
        />
        <TextField
          label="URL pública do PINN (callback OAuth)"
          fullWidth
          size="small"
          value={publicAppUrl}
          onChange={(e) => setPublicAppUrl(e.target.value)}
          disabled={!canOperate || saveMutation.isPending}
          placeholder="Ex.: http://localhost:8080 ou https://app.seudominio.com"
          helperText="Onde o usuário volta após autorizar o Kommo. Se vazio, usamos PUBLIC_APP_URL na API ou o Origin do navegador."
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <Button
            variant="contained"
            disabled={!canOperate || saveMutation.isPending || !authConfigId.trim()}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Salvando…" : "Salvar configuração"}
          </Button>
          {!canOperate && (
            <Typography variant="caption" color="text.secondary">
              Seu perfil não pode alterar integrações.
            </Typography>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
