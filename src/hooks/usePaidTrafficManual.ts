import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PaidTrafficManualEntry {
  id: string;
  org_id: string;
  channel: 'meta_ads' | 'google_ads' | 'tiktok' | 'linkedin' | 'outro' | string;
  period_start: string;
  period_end: string;
  spend: number;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Tabela paid_traffic_manual_entries ainda não está nos tipos gerados —
// cast para `any` pontual neste arquivo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const manualTable = () => (supabase as any).from('paid_traffic_manual_entries');

export const usePaidTrafficManualEntries = (orgId: string | undefined) =>
  useQuery({
    queryKey: ['paid-traffic-manual', orgId],
    queryFn: async (): Promise<PaidTrafficManualEntry[]> => {
      if (!orgId) return [];
      const { data, error } = await manualTable()
        .select('*')
        .eq('org_id', orgId)
        .order('period_start', { ascending: false })
        .limit(60);
      if (error) {
        console.warn('[usePaidTrafficManual] fetch falhou:', error.message);
        return [];
      }
      return (data ?? []) as PaidTrafficManualEntry[];
    },
    enabled: !!orgId,
  });

export interface CreateManualEntryInput {
  org_id: string;
  channel: PaidTrafficManualEntry['channel'];
  period_start: string;
  period_end: string;
  spend: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  notes?: string;
}

export const useCreatePaidTrafficManualEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateManualEntryInput): Promise<PaidTrafficManualEntry> => {
      const { data, error } = await manualTable().insert(input).select().single();
      if (error) throw error;
      return data as PaidTrafficManualEntry;
    },
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: ['paid-traffic-manual', entry.org_id] });
      qc.invalidateQueries({ queryKey: ['paid-traffic-summary', entry.org_id] });
      qc.invalidateQueries({ queryKey: ['unit-economics', entry.org_id] });
    },
  });
};

export const useDeletePaidTrafficManualEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, orgId }: { id: string; orgId: string }) => {
      const { error } = await manualTable().delete().eq('id', id);
      if (error) throw error;
      return { id, orgId };
    },
    onSuccess: ({ orgId }) => {
      qc.invalidateQueries({ queryKey: ['paid-traffic-manual', orgId] });
      qc.invalidateQueries({ queryKey: ['paid-traffic-summary', orgId] });
      qc.invalidateQueries({ queryKey: ['unit-economics', orgId] });
    },
  });
};
