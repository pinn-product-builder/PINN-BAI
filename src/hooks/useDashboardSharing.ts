import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardShare {
  id: string;
  org_id: string;
  dashboard_id: string;
  token: string;
  title: string | null;
  expires_at: string | null;
  allow_filters: boolean;
  view_count: number;
  created_at: string;
}

export const useDashboardShares = (dashboardId: string | undefined) =>
  useQuery({
    queryKey: ['dashboard-shares', dashboardId],
    queryFn: async (): Promise<DashboardShare[]> => {
      if (!dashboardId) return [];
      const { data, error } = await supabase
        .from('dashboard_shares')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DashboardShare[];
    },
    enabled: !!dashboardId,
  });

export const usePublicShare = (token: string | undefined) =>
  useQuery({
    queryKey: ['public-share', token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase
        .from('dashboard_shares')
        .select('*, dashboards(id, name, description, dashboard_widgets(*))')
        .eq('token', token)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Link não encontrado ou expirado.');
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        throw new Error('Este link expirou.');
      }
      // Increment view count (fire-and-forget)
      supabase.from('dashboard_shares').update({ view_count: (data.view_count ?? 0) + 1 }).eq('id', data.id).then(() => {});
      return data;
    },
    enabled: !!token,
    retry: false,
  });

export const useCreateShare = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      dashboardId,
      title,
      expiresAt,
      allowFilters,
    }: {
      orgId: string;
      dashboardId: string;
      title?: string;
      expiresAt?: string;
      allowFilters?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('dashboard_shares')
        .insert({
          org_id: orgId,
          dashboard_id: dashboardId,
          title: title ?? null,
          expires_at: expiresAt ?? null,
          allow_filters: allowFilters ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DashboardShare;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-shares', data.dashboard_id] });
    },
  });
};

export const useDeleteShare = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ shareId, dashboardId }: { shareId: string; dashboardId: string }) => {
      const { error } = await supabase.from('dashboard_shares').delete().eq('id', shareId);
      if (error) throw error;
      return { dashboardId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-shares', data.dashboardId] });
    },
  });
};
