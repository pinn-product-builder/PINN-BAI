import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Integration, IntegrationInput, SelectedTable } from '@/lib/types';
import type { Json } from '@/integrations/supabase/types';

// Fetch integrations for an organization
export const useIntegrations = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ['integrations', orgId],
    queryFn: async (): Promise<Integration[]> => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });
};

// Fetch a single integration
export const useIntegration = (id: string | undefined) => {
  return useQuery({
    queryKey: ['integration', id],
    queryFn: async (): Promise<Integration | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

// Create integration
export const useCreateIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: IntegrationInput): Promise<Integration> => {
      const { data, error } = await supabase
        .from('integrations')
        .insert({
          org_id: input.org_id,
          name: input.name,
          type: input.type,
          config: input.config as unknown as Json,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['integrations', data.org_id] });
    },
  });
};

// Update integration
export const useUpdateIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Integration> & { id: string }): Promise<Integration> => {
      const { data, error } = await supabase
        .from('integrations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['integrations', data.org_id] });
      queryClient.invalidateQueries({ queryKey: ['integration', data.id] });
    },
  });
};

// Delete integration
export const useDeleteIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<string | undefined> => {
      // First get the integration to know the org_id
      const { data: integration } = await supabase
        .from('integrations')
        .select('org_id')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return integration?.org_id;
    },
    onSuccess: (orgId) => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ['integrations', orgId] });
      }
    },
  });
};

// Fetch selected tables for an integration
export const useSelectedTables = (integrationId: string | undefined) => {
  return useQuery({
    queryKey: ['selected-tables', integrationId],
    queryFn: async (): Promise<SelectedTable[]> => {
      if (!integrationId) return [];

      const { data, error } = await supabase
        .from('selected_tables')
        .select('*')
        .eq('integration_id', integrationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!integrationId,
  });
};

// Save selected tables
export const useSaveSelectedTables = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      integrationId,
      tables,
    }: {
      integrationId: string;
      tables: Array<{
        table_name: string;
        selected_columns: string[];
        column_types: Json;
        is_primary: boolean;
        row_count: number | null;
        sample_data: Json;
      }>;
    }): Promise<SelectedTable[]> => {
      // Delete existing selections
      await supabase
        .from('selected_tables')
        .delete()
        .eq('integration_id', integrationId);

      // Insert new selections
      const { data, error } = await supabase
        .from('selected_tables')
        .insert(
          tables.map((table) => ({
            integration_id: integrationId,
            table_name: table.table_name,
            selected_columns: table.selected_columns,
            column_types: table.column_types,
            is_primary: table.is_primary,
            row_count: table.row_count,
            sample_data: table.sample_data,
          }))
        )
        .select();

      if (error) throw error;
      return data || [];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['selected-tables', variables.integrationId] });
    },
  });
};
