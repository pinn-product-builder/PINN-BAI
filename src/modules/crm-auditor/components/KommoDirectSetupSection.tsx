import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import { useToast } from "@/hooks/use-toast";
import { connectKommoDirect } from "../api";

const qk = (orgId: string) => ["crm-auditor", orgId] as const;

type Props = {
  orgId: string;
  canOperate: boolean;
};

/**
 * Conexão Kommo por token direto — único caminho suportado.
 * O usuário informa o subdomínio (minhaempresa → minhaempresa.kommo.com) e o
 * Long-Lived Access Token. Ao conectar, cria a conexão no backend e dispara a
 * sincronização inicial.
 */
export function KommoDirectSetupSection({ orgId, canOperate }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subdomain, setSubdomain] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const connectMutation = useMutation({
    mutationFn: () =>
      connectKommoDirect(orgId, {
        subdomain: subdomain.trim(),
        access_token: accessToken.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk(orgId) });
      setAccessToken("");
      toast({
        title: "Kommo conectado",
        description: "Conexão salva e sincronização iniciada.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Não foi possível conectar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const canSubmit =
    canOperate && !connectMutation.isPending && subdomain.trim() !== "" && accessToken.trim() !== "";

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
            Conectar Kommo (token direto)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Informe o subdomínio da sua conta Kommo e o Access Token (Long-Lived). Geramos a conexão e
            iniciamos a primeira sincronização automaticamente.
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={2}>
        <TextField
          label="Subdomínio"
          fullWidth
          size="small"
          value={subdomain}
          onChange={(e) => setSubdomain(e.target.value)}
          disabled={!canOperate || connectMutation.isPending}
          placeholder="minhaempresa (sem .kommo.com)"
          helperText="Ex.: minhaempresa → minhaempresa.kommo.com"
        />
        <TextField
          label="Access Token (Long-Lived)"
          fullWidth
          size="small"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          disabled={!canOperate || connectMutation.isPending}
          placeholder="Kommo → Configurações → Integrações → Crie sua própria integração"
          autoComplete="off"
          helperText="Token de acesso de longa duração gerado no painel da Kommo."
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <Button
            variant="contained"
            disabled={!canSubmit}
            onClick={() => connectMutation.mutate()}
          >
            {connectMutation.isPending ? "Conectando…" : "Conectar"}
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
