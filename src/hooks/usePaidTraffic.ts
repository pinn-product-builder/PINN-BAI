import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
const supabase = supabaseClient as any;
import type { PaidTrafficCampaign, PaidTrafficMetrics } from '@/lib/types';

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

// ── Campaigns ──────────────────────────────────────────────────────────────────

export const usePaidTrafficCampaigns = (
  orgId: string | undefined,
  platformSlug?: string,
) =>
  useQuery({
    queryKey: ['paid-traffic-campaigns', orgId, platformSlug],
    queryFn: async (): Promise<PaidTrafficCampaign[]> => {
      if (!orgId) return [];
      let q = supabase
        .from('paid_traffic_campaigns')
        .select('*')
        .eq('org_id', orgId)
        .order('name');
      if (platformSlug) q = q.eq('platform_slug', platformSlug);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PaidTrafficCampaign[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

// ── Daily metrics ──────────────────────────────────────────────────────────────

export const usePaidTrafficMetrics = (
  orgId: string | undefined,
  dateRange: { start: string; end: string },
  platformSlug?: string,
) =>
  useQuery({
    queryKey: ['paid-traffic-metrics', orgId, dateRange.start, dateRange.end, platformSlug],
    queryFn: async (): Promise<PaidTrafficMetrics[]> => {
      if (!orgId) return [];
      let q = supabase
        .from('paid_traffic_daily_metrics')
        .select('*')
        .eq('org_id', orgId)
        .gte('date', dateRange.start.substring(0, 10))
        .lte('date', dateRange.end.substring(0, 10))
        .order('date', { ascending: true });
      if (platformSlug) q = q.eq('platform_slug', platformSlug);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PaidTrafficMetrics[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

// ── Aggregated summary for the period ─────────────────────────────────────────

export const usePaidTrafficSummary = (
  orgId: string | undefined,
  dateRange: { start: string; end: string },
) => {
  const { data: metrics, isLoading } = usePaidTrafficMetrics(orgId, dateRange);

  const summary = (() => {
    if (!metrics?.length) return null;

    const byPlatform: Record<string, {
      spend: number; impressions: number; clicks: number;
      leads: number; purchases: number; purchase_value: number;
    }> = {};

    for (const m of metrics) {
      const p = m.platform_slug;
      if (!byPlatform[p]) {
        byPlatform[p] = { spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, purchase_value: 0 };
      }
      byPlatform[p].spend += m.spend;
      byPlatform[p].impressions += m.impressions;
      byPlatform[p].clicks += m.clicks;
      byPlatform[p].leads += m.leads;
      byPlatform[p].purchases += m.purchases;
      byPlatform[p].purchase_value += m.purchase_value;
    }

    const totals = Object.values(byPlatform).reduce(
      (acc, p) => ({
        spend: acc.spend + p.spend,
        impressions: acc.impressions + p.impressions,
        clicks: acc.clicks + p.clicks,
        leads: acc.leads + p.leads,
        purchases: acc.purchases + p.purchases,
        purchase_value: acc.purchase_value + p.purchase_value,
      }),
      { spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, purchase_value: 0 },
    );

    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpl = totals.leads > 0 ? totals.spend / totals.leads : null;
    const cpa = totals.purchases > 0 ? totals.spend / totals.purchases : null;
    const roas = totals.spend > 0 ? totals.purchase_value / totals.spend : 0;

    return { totals, byPlatform, ctr, cpl, cpa, roas };
  })();

  // Time series: group by date across all platforms
  const timeSeries = (() => {
    if (!metrics?.length) return [];
    const byDate: Record<string, { date: string; spend: number; leads: number; roas: number | null }> = {};
    for (const m of metrics) {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, spend: 0, leads: 0, roas: null };
      byDate[m.date].spend += m.spend;
      byDate[m.date].leads += m.leads;
    }
    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        roas: d.spend > 0 ? null : null, // calculado separadamente
      }));
  })();

  return { summary, timeSeries, isLoading };
};

// ── Sync trigger ───────────────────────────────────────────────────────────────

export const useSyncAdPlatform = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      platformSlug,
      daysBack = 30,
    }: {
      orgId: string;
      platformSlug: string;
      daysBack?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('sync-paid-traffic', {
        body: { orgId, platformSlug, daysBack },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { orgId, ...(data ?? {}) };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['paid-traffic-metrics', data.orgId] });
      queryClient.invalidateQueries({ queryKey: ['paid-traffic-campaigns', data.orgId] });
      queryClient.invalidateQueries({ queryKey: ['paid-traffic-connections', data.orgId] });
    },
  });
};
