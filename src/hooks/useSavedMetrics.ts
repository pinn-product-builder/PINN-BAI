import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SavedMetric {
  id: string;
  org_id: string;
  metric_name: string;
  display_label: string;
  description: string | null;
  transformation: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface SaveMetricInput {
  orgId: string;
  metricName: string;
  displayLabel: string;
  description?: string;
  transformation?: string;
}

export function useSavedMetrics(orgId: string | null) {
  const queryClient = useQueryClient();

  // Fetch saved metrics for the organization
  const { data: savedMetrics = [], isLoading, error } = useQuery({
    queryKey: ['saved-metrics', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from('saved_custom_metrics')
        .select('*')
        .eq('org_id', orgId)
        .order('usage_count', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as SavedMetric[];
    },
    enabled: !!orgId,
  });

  // Save or update a custom metric
  const saveMetricMutation = useMutation({
    mutationFn: async ({ orgId, metricName, displayLabel, description, transformation }: SaveMetricInput) => {
      // First, try to find existing metric
      const { data: existing } = await supabase
        .from('saved_custom_metrics')
        .select('id, usage_count')
        .eq('org_id', orgId)
        .eq('metric_name', metricName)
        .single();

      if (existing) {
        // Update usage count
        const { error } = await supabase
          .from('saved_custom_metrics')
          .update({ 
            usage_count: (existing.usage_count || 0) + 1,
            display_label: displayLabel,
            description,
            transformation,
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert new metric
        const { error } = await supabase
          .from('saved_custom_metrics')
          .insert({
            org_id: orgId,
            metric_name: metricName,
            display_label: displayLabel,
            description,
            transformation: transformation || 'none',
            usage_count: 1,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-metrics', orgId] });
    },
  });

  // Increment usage count for an existing metric
  const incrementUsageMutation = useMutation({
    mutationFn: async (metricId: string) => {
      const { data: metric } = await supabase
        .from('saved_custom_metrics')
        .select('usage_count')
        .eq('id', metricId)
        .single();
      
      if (metric) {
        await supabase
          .from('saved_custom_metrics')
          .update({ usage_count: (metric.usage_count || 0) + 1 })
          .eq('id', metricId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-metrics', orgId] });
    },
  });

  return {
    savedMetrics,
    isLoading,
    error,
    saveMetric: saveMetricMutation.mutate,
    saveMetricAsync: saveMetricMutation.mutateAsync,
    incrementUsage: incrementUsageMutation.mutate,
    isSaving: saveMetricMutation.isPending,
  };
}

export type { SavedMetric, SaveMetricInput };
