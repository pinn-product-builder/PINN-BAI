import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Detecta se a org acabou de fazer sua PRIMEIRA sincronização CRM/ERP com
 * sucesso e ainda não tem widgets configurados no dashboard default. Sinal
 * pra disparar o fluxo de auto-build do dashboard.
 *
 * Condições (todas precisam ser true):
 *   1. Ao menos um row em crm_auditor_connections com sync_status='success'
 *      OU com last_sync_at preenchido
 *   2. O dashboard default da org NÃO tem widgets ainda
 */

interface FirstSyncState {
  ready: boolean;
  reason: 'no_sync' | 'has_widgets' | 'first_sync_ready';
  connectedProviders: string[];
  dashboardId: string | null;
  lastSyncAt: string | null;
}

export function useFirstSyncDetector(orgId: string | undefined) {
  return useQuery<FirstSyncState>({
    queryKey: ['crm-auditor', orgId ?? '', 'first-sync-detector'],
    queryFn: async () => {
      if (!orgId) {
        return { ready: false, reason: 'no_sync', connectedProviders: [], dashboardId: null, lastSyncAt: null };
      }

      // 1. Conexões com pelo menos uma sync bem-sucedida.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: conns } = await (supabase as any)
        .from('crm_auditor_connections')
        .select('provider, sync_status, last_sync_at')
        .eq('tenant_id', orgId)
        .not('last_sync_at', 'is', null);

      type Conn = { provider: string; sync_status: string; last_sync_at: string };
      const synced = ((conns ?? []) as Conn[]).filter((c) => c.sync_status === 'success' || !!c.last_sync_at);
      if (synced.length === 0) {
        return { ready: false, reason: 'no_sync', connectedProviders: [], dashboardId: null, lastSyncAt: null };
      }

      const connectedProviders = synced.map((c) => c.provider);
      const lastSyncAt = synced
        .map((c) => c.last_sync_at)
        .sort()
        .reverse()[0];

      // 2. Dashboard default
      const { data: dash } = await supabase
        .from('dashboards')
        .select('id')
        .eq('org_id', orgId)
        .eq('is_default', true)
        .maybeSingle();

      if (!dash) {
        return { ready: false, reason: 'no_sync', connectedProviders, dashboardId: null, lastSyncAt };
      }

      // 3. Tem widgets?
      const { count } = await supabase
        .from('dashboard_widgets')
        .select('id', { count: 'exact', head: true })
        .eq('dashboard_id', dash.id);

      if ((count ?? 0) > 0) {
        return { ready: false, reason: 'has_widgets', connectedProviders, dashboardId: dash.id, lastSyncAt };
      }

      return { ready: true, reason: 'first_sync_ready', connectedProviders, dashboardId: dash.id, lastSyncAt };
    },
    enabled: !!orgId,
    // Polling enquanto não estiver ready — sync pode terminar a qualquer momento.
    refetchInterval: (q) => (q.state.data?.ready ? false : 5000),
  });
}
