import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { supabase } from "@/integrations/supabase/client";
import { PROVIDER_SCHEMAS, isSchemaProvider } from "../providerSchemas";
import { ProviderSetupCard } from "./ProviderSetupCard";

const qk = (orgId: string) => ["crm-auditor", orgId, "connections-summary"] as const;

interface ConnectionSummaryRow {
  provider: string;
  has_credentials: boolean;
  sync_status: string;
}

interface Props {
  orgId: string;
}

/**
 * Hub multi-provider — um setup card independente por CRM/ERP suportado
 * (schemas em providerSchemas.ts). Uma org pode ter Kommo + Omie + Ploomes
 * ao mesmo tempo (rows separadas em crm_auditor_connections).
 *
 * Reconstruído fielmente a partir do bundle de produção (05/jul/2026).
 */
export function ProviderPickerCard({ orgId }: Props) {
  const summary = useQuery({
    queryKey: qk(orgId),
    queryFn: async (): Promise<ConnectionSummaryRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("crm_auditor_connections")
        .select("provider, credentials, sync_status")
        .eq("tenant_id", orgId);
      if (error) {
        console.warn("[ProviderHub] fetch conexões falhou:", error.message);
        return [];
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((row) => ({
        provider: row.provider,
        has_credentials: Object.keys(row.credentials ?? {}).length > 0,
        sync_status: row.sync_status,
      }));
    },
    enabled: !!orgId,
  });

  const schemas = useMemo(() => Object.values(PROVIDER_SCHEMAS).filter((s) => isSchemaProvider(s.key)), []);
  const connectedCount = summary.data?.filter((c) => c.has_credentials).length ?? 0;

  return (
    <Box sx={{ mb: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              Integrações disponíveis
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Cada integração roda independente. O sync nightly (04h UTC) cobre todas as conectadas.
            </Typography>
          </Box>
          <Chip
            size="small"
            color={connectedCount > 0 ? "primary" : "default"}
            variant={connectedCount > 0 ? "filled" : "outlined"}
            label={`${connectedCount}/${schemas.length} conectada${connectedCount === 1 ? "" : "s"}`}
          />
        </Stack>
      </Paper>
      <Stack spacing={0}>
        {schemas.map((schema) => (
          <ProviderSetupCard key={schema.key} orgId={orgId} provider={schema.key} />
        ))}
      </Stack>
    </Box>
  );
}
