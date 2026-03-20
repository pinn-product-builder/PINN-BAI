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
      const { data, error } = await supabase
        .from('dashboard_widgets')
        .update(updates)
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
