import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
const supabase = supabaseClient as any;
import type { HubConnection, IntegrationProvider } from '@/lib/types';

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

// ── Providers catalogue ────────────────────────────────────────────────────────

export const useIntegrationProviders = () =>
  useQuery({
    queryKey: ['integration-providers'],
    queryFn: async (): Promise<IntegrationProvider[]> => {
      const { data, error } = await supabase
        .from('integration_providers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as IntegrationProvider[];
    },
    staleTime: 10 * 60 * 1000,
  });

// ── Active connections ─────────────────────────────────────────────────────────

export const useHubConnections = (orgId: string | undefined) =>
  useQuery({
    queryKey: ['hub-connections', orgId],
    queryFn: async (): Promise<HubConnection[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('hub_connections')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as HubConnection[];
    },
    enabled: !!orgId,
  });

// ── Connect ────────────────────────────────────────────────────────────────────

export const useHubConnect = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      providerSlug,
      displayName,
      credentials,
      syncConfig = {},
    }: {
      orgId: string;
      providerSlug: string;
      displayName: string;
      credentials: Record<string, string>;
      syncConfig?: Record<string, unknown>;
    }) => {
      const resp = await fetch(`${BACKEND}/hub/connect/${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_slug: providerSlug,
          display_name: displayName,
          credentials,
          sync_config: syncConfig,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Erro desconhecido' }));
        throw new Error(err.detail ?? 'Falha ao conectar');
      }
      return resp.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['hub-connections', vars.orgId] });
    },
  });
};

// ── Disconnect ─────────────────────────────────────────────────────────────────

export const useHubDisconnect = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, connectionId }: { orgId: string; connectionId: string }) => {
      const resp = await fetch(`${BACKEND}/hub/connections/${orgId}/${connectionId}`, {
        method: 'DELETE',
      });
      if (!resp.ok) throw new Error('Falha ao desconectar');
      return { orgId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hub-connections', data.orgId] });
    },
  });
};
