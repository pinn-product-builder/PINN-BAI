import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type GoalUnit = 'number' | 'currency' | 'percent';
export type GoalPeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface KpiGoal {
  id: string;
  org_id: string;
  name: string;
  metric_key: string;
  target_value: number;
  current_value: number | null;
  unit: GoalUnit;
  period_type: GoalPeriodType;
  period_start: string;
  period_end: string;
  icon: string | null;
  color: string;
  created_at: string;
}

export interface KpiAlertRule {
  id: string;
  org_id: string;
  name: string;
  metric_key: string;
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  channel: 'in_app' | 'email';
  enabled: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

// ── Goals ──────────────────────────────────────────────────────────────────────

export const useKpiGoals = (orgId: string | undefined) =>
  useQuery({
    queryKey: ['kpi-goals', orgId],
    queryFn: async (): Promise<KpiGoal[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('kpi_goals')
        .select('*')
        .eq('org_id', orgId)
        .order('period_start', { ascending: false });
      if (error) throw error;
      return (data ?? []) as KpiGoal[];
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

export const useCreateGoal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: Omit<KpiGoal, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('kpi_goals').insert(goal).select().single();
      if (error) throw error;
      return data as KpiGoal;
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['kpi-goals', data.org_id] }),
  });
};

export const useUpdateGoalProgress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, currentValue, orgId }: { goalId: string; currentValue: number; orgId: string }) => {
      const { error } = await supabase
        .from('kpi_goals')
        .update({ current_value: currentValue, updated_at: new Date().toISOString() })
        .eq('id', goalId);
      if (error) throw error;
      return { orgId };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['kpi-goals', data.orgId] }),
  });
};

export const useDeleteGoal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, orgId }: { goalId: string; orgId: string }) => {
      const { error } = await supabase.from('kpi_goals').delete().eq('id', goalId);
      if (error) throw error;
      return { orgId };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['kpi-goals', data.orgId] }),
  });
};

// ── Alert Rules ────────────────────────────────────────────────────────────────

export const useKpiAlertRules = (orgId: string | undefined) =>
  useQuery({
    queryKey: ['kpi-alert-rules', orgId],
    queryFn: async (): Promise<KpiAlertRule[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('kpi_alert_rules')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as KpiAlertRule[];
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

export const useCreateAlertRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Omit<KpiAlertRule, 'id' | 'created_at' | 'last_triggered_at'>) => {
      const { data, error } = await supabase.from('kpi_alert_rules').insert(rule).select().single();
      if (error) throw error;
      return data as KpiAlertRule;
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['kpi-alert-rules', data.org_id] }),
  });
};

export const useToggleAlertRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, enabled, orgId }: { ruleId: string; enabled: boolean; orgId: string }) => {
      const { error } = await supabase.from('kpi_alert_rules').update({ enabled }).eq('id', ruleId);
      if (error) throw error;
      return { orgId };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['kpi-alert-rules', data.orgId] }),
  });
};

export const useDeleteAlertRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, orgId }: { ruleId: string; orgId: string }) => {
      const { error } = await supabase.from('kpi_alert_rules').delete().eq('id', ruleId);
      if (error) throw error;
      return { orgId };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['kpi-alert-rules', data.orgId] }),
  });
};

// ── Active Triggers (breaches) ─────────────────────────────────────────────────

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

export interface KpiTrigger {
  id: string;
  rule_id: string;
  org_id: string;
  metric_key: string;
  actual_value: number;
  threshold: number;
  operator: string;
  resolved: boolean;
  created_at: string;
  kpi_alert_rules?: { name: string; severity: string; metric_key: string } | null;
}

export const useKpiTriggers = (orgId: string | undefined) =>
  useQuery({
    queryKey: ['kpi-triggers', orgId],
    queryFn: async (): Promise<KpiTrigger[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('kpi_alert_triggers')
        .select('*, kpi_alert_rules(name, severity, metric_key)')
        .eq('org_id', orgId)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as KpiTrigger[];
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

export const useCheckKpiThresholds = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      const resp = await fetch(`${BACKEND}/kpi/check/${orgId}`, { method: 'POST' });
      if (!resp.ok) throw new Error('Falha ao verificar thresholds');
      return resp.json() as Promise<{ checked: number; triggered: number }>;
    },
    onSuccess: (_, orgId) => {
      qc.invalidateQueries({ queryKey: ['kpi-triggers', orgId] });
    },
  });
};

export const useResolveKpiTrigger = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ triggerId, orgId }: { triggerId: string; orgId: string }) => {
      const { error } = await supabase
        .from('kpi_alert_triggers')
        .update({ resolved: true })
        .eq('id', triggerId);
      if (error) throw error;
      return { orgId };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['kpi-triggers', data.orgId] }),
  });
};
