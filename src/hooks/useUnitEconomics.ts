import { useQuery } from '@tanstack/react-query';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { isDemoOrg } from '@/lib/featureFlags';
import { DEMO_UNIT_ECONOMICS } from '@/data/arguto-extra-demo';
const supabase = supabaseClient as any;

export interface ChannelEconomics {
  channel: string;
  spend: number;
  conversions: number;
  revenue: number;
  cac: number;
  ltv: number;
  ltvCacRatio: number;
  paybackMonths: number;
}

export interface UnitEconomicsSummary {
  totalSpend: number;
  organicConversions: number;
  paidConversions: number;
  totalConversions: number;
  totalRevenue: number;
  avgTicket: number;
  cac: number;
  ltv: number;
  ltvCacRatio: number;
  paybackMonths: number;
  byChannel: ChannelEconomics[];
  avgRetentionMonths: number;
}

const ORGANIC_SOURCES = ['organico', 'organic', 'referral', 'referência', 'indicacao', 'indicação', 'direto', 'direct'];

export const useUnitEconomics = (
  orgId: string | undefined,
  dateRange: { start: string; end: string },
) =>
  useQuery({
    queryKey: ['unit-economics', orgId, dateRange.start, dateRange.end],
    queryFn: async (): Promise<UnitEconomicsSummary | null> => {
      if (!orgId) return null;
      if (isDemoOrg(orgId)) return DEMO_UNIT_ECONOMICS;

      const start = dateRange.start.substring(0, 10);
      const end = dateRange.end.substring(0, 10);

      const [leadsRes, paidRes, rfmRes] = await Promise.all([
        // Fonte de verdade é crm_leads (tabela `leads` legada está vazia). P1.2/P8.
        // lead_status='won' ≈ convertido.
        supabase
          .from('crm_leads')
          .select('id, lead_status, value, source, created_at')
          .eq('tenant_id', orgId)
          .eq('lead_status', 'won')
          .gte('created_at', start)
          .lte('created_at', end + 'T23:59:59')
          .limit(2000),

        supabase
          .from('paid_traffic_daily_metrics')
          .select('platform_slug, spend, leads, purchases, purchase_value')
          .eq('org_id', orgId)
          .gte('date', start)
          .lte('date', end)
          .limit(500),

        // RFM removido do produto (commit 131aaef) — tabela rfm_analyses não existe.
        // Placeholder vazio mantém o índice do Promise.all sem erro de DB.
        Promise.resolve({ data: [] as Array<{ monetary: number; frequency: number; recency_days: number }>, error: null }),
      ]);

      const converted = leadsRes.data ?? [];
      const paidRows = paidRes.data ?? [];
      const rfmRows = rfmRes.data ?? [];

      if (!converted.length && !paidRows.length) return null;

      // ── Paid spend by platform ────────────────────────────────────────────
      const spendByPlatform: Record<string, number> = {};
      const paidLeadsByPlatform: Record<string, number> = {};
      for (const m of paidRows) {
        spendByPlatform[m.platform_slug] = (spendByPlatform[m.platform_slug] ?? 0) + (m.spend ?? 0);
        paidLeadsByPlatform[m.platform_slug] = (paidLeadsByPlatform[m.platform_slug] ?? 0) + (m.leads ?? 0);
      }
      const totalSpend = Object.values(spendByPlatform).reduce((s, v) => s + v, 0);

      // ── Conversions by source ─────────────────────────────────────────────
      const convBySource: Record<string, { conversions: number; revenue: number }> = {};
      for (const l of converted) {
        const src = (l.source ?? 'unknown').toLowerCase();
        if (!convBySource[src]) convBySource[src] = { conversions: 0, revenue: 0 };
        convBySource[src].conversions++;
        convBySource[src].revenue += Number(l.value ?? 0);
      }

      const totalConversions = converted.length;
      const totalRevenue = converted.reduce((s, l) => s + Number(l.value ?? 0), 0);
      const avgTicket = totalConversions > 0 ? totalRevenue / totalConversions : 0;

      // ── Estimate LTV from RFM ─────────────────────────────────────────────
      // avg purchases per customer × avg monetary — use 12-month window estimate
      const avgMonetary = rfmRows.length > 0
        ? rfmRows.reduce((s, r) => s + Number(r.monetary ?? 0), 0) / rfmRows.length
        : avgTicket;
      const avgFrequency = rfmRows.length > 0
        ? rfmRows.reduce((s, r) => s + Number(r.frequency ?? 1), 0) / rfmRows.length
        : 1;
      // avg recency gives us an idea of purchase cycle
      const avgRecencyDays = rfmRows.length > 0
        ? rfmRows.reduce((s, r) => s + Number(r.recency_days ?? 365), 0) / rfmRows.length
        : 180;
      const avgRetentionMonths = Math.max(6, Math.min(36, Math.round(avgRecencyDays / 30) * 2));
      const monthlyRevPerCustomer = (avgMonetary * avgFrequency) / 12;
      const ltv = monthlyRevPerCustomer * avgRetentionMonths;

      // ── Global CAC ────────────────────────────────────────────────────────
      const paidConversions = converted.filter(l => {
        const src = (l.source ?? '').toLowerCase();
        return !ORGANIC_SOURCES.some(o => src.includes(o));
      }).length;
      const organicConversions = totalConversions - paidConversions;
      const cac = paidConversions > 0 ? totalSpend / paidConversions : totalSpend > 0 ? totalSpend : 0;
      const ltvCacRatio = cac > 0 ? ltv / cac : 0;
      const paybackMonths = monthlyRevPerCustomer > 0 ? cac / monthlyRevPerCustomer : 0;

      // ── By channel ────────────────────────────────────────────────────────
      const channels: ChannelEconomics[] = [];

      // Paid platforms
      for (const [slug, spend] of Object.entries(spendByPlatform)) {
        const slugConvs = converted.filter(l => {
          const src = (l.source ?? '').toLowerCase();
          return src.includes(slug.replace('_ads', '').replace('_', ''));
        });
        const convs = slugConvs.length || Math.max(1, paidLeadsByPlatform[slug] ?? 0);
        const rev = slugConvs.reduce((s, l) => s + Number(l.value ?? 0), 0);
        const chCac = convs > 0 ? spend / convs : spend;
        const chLtv = ltv;
        channels.push({
          channel: slug,
          spend,
          conversions: convs,
          revenue: rev,
          cac: chCac,
          ltv: chLtv,
          ltvCacRatio: chCac > 0 ? chLtv / chCac : 0,
          paybackMonths: monthlyRevPerCustomer > 0 ? chCac / monthlyRevPerCustomer : 0,
        });
      }

      // Organic
      const organicRevenue = converted
        .filter(l => ORGANIC_SOURCES.some(o => (l.source ?? '').toLowerCase().includes(o)))
        .reduce((s, l) => s + Number(l.value ?? 0), 0);
      if (organicConversions > 0) {
        channels.push({
          channel: 'organic',
          spend: 0,
          conversions: organicConversions,
          revenue: organicRevenue,
          cac: 0,
          ltv,
          ltvCacRatio: Infinity,
          paybackMonths: 0,
        });
      }

      return {
        totalSpend,
        organicConversions,
        paidConversions,
        totalConversions,
        totalRevenue,
        avgTicket,
        cac,
        ltv,
        ltvCacRatio,
        paybackMonths,
        byChannel: channels.sort((a, b) => b.spend - a.spend),
        avgRetentionMonths,
      };
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
