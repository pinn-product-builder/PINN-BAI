/**
 * Hook que consome as views eo_v_* pra dashboard "Pinn Smart" (Pinn SDR).
 *
 * Substitui a fonte legada (smartlead_sync_snapshots) por agregações em
 * tempo real das tabelas eo_* via Supabase. Sem job de sync, sem snapshots
 * intermediários — leitura direta + auto-refresh a cada 60s.
 *
 * Views consumidas (criadas em supabase/migrations/20260518210000_eo_dashboard_views.sql):
 *   - eo_v_org_metrics       — 1 row por org com KPIs gerais
 *   - eo_v_campaign_metrics  — 1 row por campaign
 *   - eo_v_inbox_metrics     — 1 row por inbox
 *   - eo_v_step_metrics      — 1 row por sequence_step (pra A/B test)
 *   - eo_v_daily_timeline    — 1 row por (org, day) últimos 30 dias
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Tipos ────────────────────────────────────────────────────────────────

export interface EoOrgMetrics {
  org_id: string;
  // Campanhas
  total_campaigns: number;
  active_campaigns: number;
  completed_campaigns: number;
  paused_campaigns: number;
  draft_campaigns: number;
  // Leads
  total_leads: number;
  active_leads: number;
  bounced_leads: number;
  unsub_leads: number;
  // Enrollments
  total_enrollments: number;
  enrolled_active: number;
  enrolled_replied: number;
  enrolled_finished: number;
  enrolled_paused: number;
  enrolled_bounced: number;
  // Envios
  total_messages: number;
  total_sent: number;
  total_queued: number;
  total_failed: number;
  // Eventos
  total_opens: number;
  unique_opens: number;
  total_clicks: number;
  unique_clicks: number;
  total_replies: number;
  total_bounces: number;
  total_unsubs: number;
  total_complaints: number;
  // Taxas (%)
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  bounce_rate: number;
  unsub_rate: number;
}

export interface EoCampaignMetrics {
  campaign_id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  activated_at: string | null;
  created_at: string;
  // Leads
  total_leads: number;
  leads_active: number;
  leads_replied: number;
  leads_finished: number;
  leads_bounced: number;
  leads_paused: number;
  // Envios
  total_messages: number;
  total_sent: number;
  total_queued: number;
  total_failed: number;
  last_sent_at: string | null;
  // Eventos
  total_opens: number;
  unique_opens: number;
  total_clicks: number;
  total_replies: number;
  total_bounces: number;
  total_unsubs: number;
  // Taxas
  open_rate: number;
  reply_rate: number;
  bounce_rate: number;
}

export interface EoInboxMetrics {
  inbox_id: string;
  org_id: string;
  email: string;
  display_name: string | null;
  provider: string;
  status: string;
  daily_limit: number;
  last_sent_at: string | null;
  last_health_check_at: string | null;
  last_health_error: string | null;
  warmup_enabled: boolean;
  warmup_score: number;
  sent_24h: number;
  sent_lifetime: number;
  failed_lifetime: number;
  bounces_lifetime: number;
  bounce_rate: number;
  daily_usage_pct: number;
}

export interface EoStepMetrics {
  sequence_step_id: string;
  campaign_id: string;
  step_order: number;
  variant_label: string;
  weight: number;
  subject_template: string;
  sent: number;
  unique_opens: number;
  replies: number;
  open_rate: number;
  reply_rate: number;
}

export interface EoTimelineRow {
  org_id: string;
  day: string; // YYYY-MM-DD
  sent: number;
  opens: number;
  clicks: number;
  replies: number;
  bounces: number;
}

export interface EoMetricsBundle {
  org: EoOrgMetrics | null;
  campaigns: EoCampaignMetrics[];
  inboxes: EoInboxMetrics[];
  steps: EoStepMetrics[];
  timeline: EoTimelineRow[];
}

// ── Hook ──────────────────────────────────────────────────────────────────

const FIVE_MIN = 5 * 60 * 1000;
const ONE_MIN = 60 * 1000;

/**
 * @param orgId — id da org no Supabase. Quando undefined, query desabilitada.
 */
export function useEoMetrics(orgId: string | undefined) {
  return useQuery<EoMetricsBundle>({
    queryKey: ['eo-metrics', orgId],
    enabled: !!orgId,
    staleTime: ONE_MIN,
    refetchInterval: ONE_MIN, // auto-refresh a cada 60s
    queryFn: async () => {
      if (!orgId) {
        return { org: null, campaigns: [], inboxes: [], steps: [], timeline: [] };
      }

      const sb = supabase as any; // views não estão nos types gerados

      const [orgRes, campaignsRes, inboxesRes, timelineRes] = await Promise.all([
        sb.from('eo_v_org_metrics').select('*').eq('org_id', orgId).maybeSingle(),
        sb
          .from('eo_v_campaign_metrics')
          .select('*')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false }),
        sb.from('eo_v_inbox_metrics').select('*').eq('org_id', orgId).order('email'),
        sb.from('eo_v_daily_timeline').select('*').eq('org_id', orgId).order('day'),
      ]);

      if (orgRes.error) throw orgRes.error;
      if (campaignsRes.error) throw campaignsRes.error;
      if (inboxesRes.error) throw inboxesRes.error;
      if (timelineRes.error) throw timelineRes.error;

      const campaigns = (campaignsRes.data || []) as EoCampaignMetrics[];

      // Steps são por campaign — pega só de campanhas dessa org pra economizar payload.
      const campaignIds = campaigns.map(c => c.campaign_id);
      let steps: EoStepMetrics[] = [];
      if (campaignIds.length > 0) {
        const stepsRes = await sb
          .from('eo_v_step_metrics')
          .select('*')
          .in('campaign_id', campaignIds)
          .order('step_order')
          .order('variant_label');
        if (stepsRes.error) throw stepsRes.error;
        steps = (stepsRes.data || []) as EoStepMetrics[];
      }

      return {
        org: (orgRes.data as EoOrgMetrics | null) || null,
        campaigns,
        inboxes: (inboxesRes.data || []) as EoInboxMetrics[],
        steps,
        timeline: (timelineRes.data || []) as EoTimelineRow[],
      };
    },
  });
}
