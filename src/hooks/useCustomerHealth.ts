import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CustomerAlert, CustomerHealthScore, HealthBand } from '@/lib/types';

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

// ── Health scores ──────────────────────────────────────────────────────────────

export const useHealthScores = (
  orgId: string | undefined,
  options?: { band?: HealthBand; limit?: number },
) =>
  useQuery({
    queryKey: ['customer-health', orgId, options?.band],
    queryFn: async (): Promise<CustomerHealthScore[]> => {
      if (!orgId) return [];
      let q = supabase
        .from('customer_health_scores')
        .select('*')
        .eq('org_id', orgId)
        .order('health_score', { ascending: true })
        .limit(options?.limit ?? 100);
      if (options?.band) q = q.eq('health_band', options.band);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CustomerHealthScore[];
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

// ── Summary stats ──────────────────────────────────────────────────────────────

export const useHealthSummary = (orgId: string | undefined) =>
  useQuery({
    queryKey: ['customer-health-summary', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('customer_health_scores')
        .select('health_band, health_score, trend')
        .eq('org_id', orgId);
      if (error) throw error;
      const rows = data ?? [];
      const total = rows.length;
      const byBand: Record<string, number> = {};
      let sumScore = 0;
      let improving = 0;
      let declining = 0;
      for (const r of rows) {
        byBand[r.health_band] = (byBand[r.health_band] ?? 0) + 1;
        sumScore += r.health_score;
        if (r.trend === 'up') improving++;
        if (r.trend === 'down') declining++;
      }
      return {
        total,
        avgScore: total ? Math.round(sumScore / total) : 0,
        byBand,
        improving,
        declining,
        critico: byBand['critico'] ?? 0,
        risco: byBand['risco'] ?? 0,
        atencao: byBand['atencao'] ?? 0,
        saudavel: byBand['saudavel'] ?? 0,
      };
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

// ── Alerts ─────────────────────────────────────────────────────────────────────

export const useCustomerAlerts = (
  orgId: string | undefined,
  options?: { severity?: string; resolved?: boolean; limit?: number },
) =>
  useQuery({
    queryKey: ['customer-alerts', orgId, options?.severity, options?.resolved],
    queryFn: async (): Promise<CustomerAlert[]> => {
      if (!orgId) return [];
      let q = supabase
        .from('customer_alerts')
        .select('*')
        .eq('org_id', orgId)
        .eq('resolved', options?.resolved ?? false)
        .order('created_at', { ascending: false })
        .limit(options?.limit ?? 50);
      if (options?.severity) q = q.eq('severity', options.severity);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CustomerAlert[];
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

// ── Compute health (trigger) ───────────────────────────────────────────────────

export const useComputeHealth = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      const resp = await fetch(`${BACKEND}/health/compute/${orgId}`, { method: 'POST' });
      if (!resp.ok) throw new Error('Falha ao calcular health scores');
      return resp.json();
    },
    onSuccess: (_, orgId) => {
      queryClient.invalidateQueries({ queryKey: ['customer-health', orgId] });
      queryClient.invalidateQueries({ queryKey: ['customer-health-summary', orgId] });
      queryClient.invalidateQueries({ queryKey: ['customer-alerts', orgId] });
    },
  });
};

// ── Acknowledge / Resolve alert ────────────────────────────────────────────────

export const useAcknowledgeAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, alertId }: { orgId: string; alertId: string }) => {
      const resp = await fetch(`${BACKEND}/health/alerts/${orgId}/${alertId}/acknowledge`, {
        method: 'PATCH',
      });
      if (!resp.ok) throw new Error('Falha ao confirmar alerta');
      return { orgId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customer-alerts', data.orgId] });
    },
  });
};

export const useResolveAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, alertId }: { orgId: string; alertId: string }) => {
      const resp = await fetch(`${BACKEND}/health/alerts/${orgId}/${alertId}/resolve`, {
        method: 'PATCH',
      });
      if (!resp.ok) throw new Error('Falha ao resolver alerta');
      return { orgId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customer-alerts', data.orgId] });
    },
  });
};
