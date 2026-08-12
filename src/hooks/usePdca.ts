import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hooks de PDCA + snapshots de KPI.
 *
 * Snapshots: lê de `bai_kpi_snapshots` via RPCs prontas.
 * PDCA: CRUD na tabela `pdca_entries` (entrada por semana).
 */

export interface SnapshotComparison {
  current_value: number;
  previous_value: number;
  delta_abs: number;
  delta_pct: number | null;
  current_start: string;
  current_end: string;
  previous_start: string;
  previous_end: string;
}

export interface SnapshotSeriesPoint {
  snapshot_date: string;
  metric_value: number;
}

export interface PdcaEntry {
  id: string;
  org_id: string;
  week_start: string;     // ISO date "2026-05-18"
  plan: string;
  do_notes: string;
  check_notes: string;
  act: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const KPI_METRICS = [
  { key: 'open_leads',          label: 'Leads abertos' },
  { key: 'open_pipeline_value', label: 'Pipeline ($) aberto' },
  { key: 'won_leads_today',     label: 'Ganhos no dia' },
  { key: 'lost_leads_today',    label: 'Perdidos no dia' },
] as const;

export function useSnapshotComparison(orgId: string | undefined, metricKey: string, windowDays = 7) {
  return useQuery<SnapshotComparison | null>({
    queryKey: ['snapshot-compare', orgId, metricKey, windowDays],
    enabled: !!orgId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('bai_kpi_snapshot_compare', {
        _tenant_id: orgId,
        _metric_key: metricKey,
        _window_days: windowDays,
      });
      if (error) {
        console.warn('[useSnapshotComparison]', error.message);
        return null;
      }
      return (data?.[0] as SnapshotComparison | undefined) ?? null;
    },
  });
}

export function useSnapshotSeries(orgId: string | undefined, metricKey: string, days = 60) {
  return useQuery<SnapshotSeriesPoint[]>({
    queryKey: ['snapshot-series', orgId, metricKey, days],
    enabled: !!orgId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('bai_kpi_snapshot_series', {
        _tenant_id: orgId,
        _metric_key: metricKey,
        _days: days,
      });
      if (error) {
        console.warn('[useSnapshotSeries]', error.message);
        return [];
      }
      return (data ?? []) as SnapshotSeriesPoint[];
    },
  });
}

/**
 * Segunda-feira da semana de uma data dada (UTC). Default: hoje.
 */
export function weekStartMonday(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = dom, 1 = seg
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function usePdcaEntries(orgId: string | undefined) {
  return useQuery<PdcaEntry[]>({
    queryKey: ['pdca-entries', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('pdca_entries')
        .select('*')
        .eq('org_id', orgId)
        .order('week_start', { ascending: false });
      if (error) {
        console.warn('[usePdcaEntries]', error.message);
        return [];
      }
      return (data ?? []) as PdcaEntry[];
    },
  });
}

export function useUpsertPdcaEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      org_id: string;
      week_start: string;
      plan?: string;
      do_notes?: string;
      check_notes?: string;
      act?: string;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { error } = await sb
        .from('pdca_entries')
        .upsert(
          {
            org_id: input.org_id,
            week_start: input.week_start,
            plan: input.plan ?? '',
            do_notes: input.do_notes ?? '',
            check_notes: input.check_notes ?? '',
            act: input.act ?? '',
          },
          { onConflict: 'org_id,week_start' },
        );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pdca-entries', vars.org_id] });
    },
  });
}
