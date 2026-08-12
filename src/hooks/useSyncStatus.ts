import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Status de sync das integrações CRM (Kommo, Ploomes, Omie) por org.
 * Usado pra mostrar "Última sync há Xh" + botão "Sincronizar agora" no header
 * do dashboard. RLS já restringe leitura a admins.
 */

export interface SyncStatusRow {
  provider: string;
  sync_status: string | null;
  sync_error: string | null;
  last_sync_at: string | null;
}

const SYNC_FN_BY_PROVIDER: Record<string, string> = {
  kommo: 'sync-kommo',
  ploomes: 'sync-ploomes',
  omie: 'sync-omie',
};

export function useSyncStatus(orgId: string | undefined) {
  return useQuery<SyncStatusRow[]>({
    queryKey: ['sync-status', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('crm_auditor_connections')
        .select('provider, sync_status, sync_error, last_sync_at')
        .eq('tenant_id', orgId)
        .in('provider', ['kommo', 'ploomes', 'omie']);
      if (error) {
        console.warn('[useSyncStatus] fetch falhou:', error.message);
        return [];
      }
      return (data ?? []) as SyncStatusRow[];
    },
    refetchInterval: 60_000, // atualiza a cada 1 min
  });
}

export function useSyncNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, provider }: { orgId: string; provider: string }) => {
      const fn = SYNC_FN_BY_PROVIDER[provider];
      if (!fn) throw new Error(`Sync não suportado pra provider="${provider}"`);
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { org_id: orgId },
      });
      if (error) throw error;
      return data as { success?: boolean; synced?: Record<string, unknown> };
    },
    onSuccess: (_, vars) => {
      // Invalida tudo do dashboard pra mostrar dados frescos sem F5.
      qc.invalidateQueries({ queryKey: ['sync-status', vars.orgId] });
      qc.invalidateQueries({ queryKey: ['dashboard-widgets'] });
      qc.invalidateQueries({ queryKey: ['widget-snapshot'] });
      qc.invalidateQueries({ queryKey: ['crm-audit-dashboard'] });
      qc.invalidateQueries({ queryKey: ['snapshot-series'] });
      qc.invalidateQueries({ queryKey: ['snapshot-compare'] });
    },
  });
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'agora';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}
