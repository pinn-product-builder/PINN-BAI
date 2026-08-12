import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Dashboard, DashboardWidget, WidgetType } from '@/lib/types';
import type { Json } from '@/integrations/supabase/types';

// Fetch default dashboard for an organization
export const useDashboard = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ['dashboard', orgId],
    queryFn: async (): Promise<Dashboard | null> => {
      if (!orgId) return null;

      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_default', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });
};

// Fetch all dashboards for an organization
export const useDashboards = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ['dashboards', orgId],
    queryFn: async (): Promise<Dashboard[]> => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .eq('org_id', orgId)
        // sort_order é manual (admin reordena pela UI). Empate → mais recente primeiro.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .order('sort_order' as any, { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });
};

// Fetch widgets for a dashboard
export const useDashboardWidgets = (dashboardId: string | undefined) => {
  return useQuery({
    queryKey: ['dashboard-widgets', dashboardId],
    queryFn: async (): Promise<DashboardWidget[]> => {
      if (!dashboardId) return [];

      const { data, error } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .eq('is_visible', true)
        .order('position', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!dashboardId,
  });
};

// Create dashboard
export const useCreateDashboard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      org_id: string;
      name: string;
      description?: string;
      is_default?: boolean;
    }): Promise<Dashboard> => {
      // If this is set as default, unset other defaults
      if (input.is_default) {
        await supabase
          .from('dashboards')
          .update({ is_default: false })
          .eq('org_id', input.org_id);
      }

      const { data, error } = await supabase
        .from('dashboards')
        .insert({
          org_id: input.org_id,
          name: input.name,
          description: input.description,
          is_default: input.is_default ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards', data.org_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', data.org_id] });
    },
  });
};

// Update dashboard (rename, change description, toggle default)
export const useUpdateDashboard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Dashboard> & { id: string }): Promise<Dashboard> => {
      if (updates.is_default && updates.org_id) {
        await supabase
          .from('dashboards')
          .update({ is_default: false })
          .eq('org_id', updates.org_id)
          .neq('id', id);
      }
      const { data, error } = await supabase
        .from('dashboards')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards', data.org_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', data.org_id] });
      queryClient.invalidateQueries({ queryKey: ['org-dashboards', data.org_id] });
    },
  });
};

// Delete dashboard (cascade remove widgets via FK)
export const useDeleteDashboard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ id: string; org_id: string | null }> => {
      const { data: existing } = await supabase
        .from('dashboards')
        .select('org_id')
        .eq('id', id)
        .single();
      const { error } = await supabase.from('dashboards').delete().eq('id', id);
      if (error) throw error;
      return { id, org_id: existing?.org_id ?? null };
    },
    onSuccess: ({ org_id }) => {
      if (org_id) {
        queryClient.invalidateQueries({ queryKey: ['dashboards', org_id] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', org_id] });
        queryClient.invalidateQueries({ queryKey: ['org-dashboards', org_id] });
      }
    },
  });
};

// Duplicate a dashboard (with widgets)
export const useDuplicateDashboard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dashboardId, name }: { dashboardId: string; name: string }): Promise<Dashboard> => {
      const { data: source, error: srcErr } = await supabase
        .from('dashboards')
        .select('*')
        .eq('id', dashboardId)
        .single();
      if (srcErr || !source) throw srcErr ?? new Error('Dashboard origem não encontrado');

      const { data: copy, error: copyErr } = await supabase
        .from('dashboards')
        .insert({
          org_id: source.org_id,
          name,
          description: source.description,
          is_default: false,
          layout: source.layout,
          filters: source.filters,
        })
        .select()
        .single();
      if (copyErr) throw copyErr;

      const { data: widgets } = await supabase
        .from('dashboard_widgets')
        .select('type,title,description,config,position,size,is_visible')
        .eq('dashboard_id', dashboardId);

      if (widgets && widgets.length > 0) {
        await supabase.from('dashboard_widgets').insert(
          widgets.map((w) => ({ ...w, dashboard_id: copy.id }))
        );
      }
      return copy;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards', data.org_id] });
      queryClient.invalidateQueries({ queryKey: ['org-dashboards', data.org_id] });
    },
  });
};

// Create dashboard widgets
export const useCreateDashboardWidgets = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dashboardId,
      widgets,
    }: {
      dashboardId: string;
      widgets: Array<{
        type: WidgetType;
        title: string;
        description?: string | null;
        config: Json;
        position?: number;
        size?: string;
        is_visible?: boolean;
      }>;
    }): Promise<DashboardWidget[]> => {
      const { data, error } = await supabase
        .from('dashboard_widgets')
        .insert(
          widgets.map((widget, index) => ({
            dashboard_id: dashboardId,
            type: widget.type as any,
            title: widget.title,
            description: widget.description,
            config: widget.config,
            position: widget.position ?? index,
            size: widget.size ?? 'medium',
            is_visible: widget.is_visible ?? true,
          }))
        )
        .select();

      if (error) throw error;
      return data || [];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets', variables.dashboardId] });
    },
  });
};

// Update dashboard widget
export const useUpdateDashboardWidget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<DashboardWidget> & { id: string }): Promise<DashboardWidget> => {
      const { type, ...safeUpdates } = updates;
      const updatePayload = type ? { ...safeUpdates, type: type as any } : safeUpdates;
      const { data, error } = await supabase
        .from('dashboard_widgets')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets', data.dashboard_id] });
    },
  });
};

// Delete dashboard widget
export const useDeleteDashboardWidget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<string | undefined> => {
      // Get dashboard_id first
      const { data: widget } = await supabase
        .from('dashboard_widgets')
        .select('dashboard_id')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('dashboard_widgets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return widget?.dashboard_id;
    },
    onSuccess: (dashboardId) => {
      if (dashboardId) {
        queryClient.invalidateQueries({ queryKey: ['dashboard-widgets', dashboardId] });
      }
    },
  });
};

// Reorder dashboards na sidebar/selector. Recebe a nova ordem completa
// e renumera com gaps de 10 (deixa espaço pra inserções futuras).
export const useReorderDashboards = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, dashboardIds }: { orgId: string; dashboardIds: string[] }) => {
      const updates = dashboardIds.map((id, idx) =>
        supabase
          .from('dashboards')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ sort_order: (idx + 1) * 10 } as any)
          .eq('id', id),
      );
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error);
      if (firstError?.error) throw firstError.error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards', variables.orgId] });
    },
  });
};

// Reorder widgets
export const useReorderWidgets = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dashboardId,
      widgetIds,
    }: {
      dashboardId: string;
      widgetIds: string[];
    }): Promise<void> => {
      // Update positions in batch
      const updates = widgetIds.map((id, index) =>
        supabase
          .from('dashboard_widgets')
          .update({ position: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets', variables.dashboardId] });
    },
  });
};
