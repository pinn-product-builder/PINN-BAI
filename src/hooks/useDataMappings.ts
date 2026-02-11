import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DataMapping } from '@/lib/types';
import type { Json } from '@/integrations/supabase/types';

// Fetch data mappings for an organization
export const useDataMappings = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ['data-mappings', orgId],
    queryFn: async (): Promise<DataMapping[]> => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('data_mappings')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });
};

// Fetch data mappings for an integration
export const useIntegrationMappings = (integrationId: string | undefined) => {
  return useQuery({
    queryKey: ['integration-mappings', integrationId],
    queryFn: async (): Promise<DataMapping[]> => {
      if (!integrationId) return [];

      const { data, error } = await supabase
        .from('data_mappings')
        .select('*')
        .eq('integration_id', integrationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!integrationId,
  });
};

// Save data mappings
export const useSaveDataMappings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orgId,
      integrationId,
      mappings,
    }: {
      orgId: string;
      integrationId: string;
      mappings: Array<{
        source_table: string;
        source_column: string;
        target_metric: string;
        transform_type?: string;
        transform_config?: Json;
        aggregation?: string;
      }>;
    }): Promise<DataMapping[]> => {
      // Delete existing mappings for this integration
      await supabase
        .from('data_mappings')
        .delete()
        .eq('integration_id', integrationId);

      // Insert new mappings — armazena aggregation dentro de transform_config
      const { data, error } = await supabase
        .from('data_mappings')
        .insert(
          mappings.map((mapping) => ({
            org_id: orgId,
            integration_id: integrationId,
            source_table: mapping.source_table,
            source_column: mapping.source_column,
            target_metric: mapping.target_metric,
            transform_type: mapping.transform_type || 'direct',
            transform_config: {
              ...(typeof mapping.transform_config === 'object' && mapping.transform_config !== null
                ? mapping.transform_config
                : {}),
              aggregation: mapping.aggregation || 'count',
            },
          }))
        )
        .select();

      if (error) throw error;
      return data || [];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['data-mappings', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['integration-mappings', variables.integrationId] });
    },
  });
};

// Delete data mapping
export const useDeleteDataMapping = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ orgId: string; integrationId: string }> => {
      // Get the mapping first to know org_id and integration_id
      const { data: mapping } = await supabase
        .from('data_mappings')
        .select('org_id, integration_id')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('data_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return {
        orgId: mapping?.org_id || '',
        integrationId: mapping?.integration_id || '',
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['data-mappings', result.orgId] });
      queryClient.invalidateQueries({ queryKey: ['integration-mappings', result.integrationId] });
    },
  });
};
