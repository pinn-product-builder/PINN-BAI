import { useQuery } from '@tanstack/react-query';
import { mariSupabase, isMariSupabaseConfigured } from '@/integrations/supabase/mariClient';

export interface LinkedInKpis {
  invites_sent: number;
  invites_accepted: number;
  acceptance_rate: number | null;
  convs_active: number;
  /** Sessões LinkedIn onde o lead enviou pelo menos uma mensagem inbound */
  sessions_with_reply: number;
  meetings_scheduled: number;
  msgs_sent: number;
  msgs_received: number;
  reply_rate: number | null;
  conversion_rate: number | null;
}

export interface LinkedInDailyRow {
  day: string;
  invites_sent: number;
  invites_accepted: number;
  msgs_sent: number;
  msgs_received: number;
}

export interface LinkedInFunnelRow {
  sort_order: number;
  funnel_stage: string;
  lead_count: number;
}

export interface LinkedInConversation {
  lead_name: string | null;
  company: string | null;
  role: string | null;
  sector: string | null;
  status: string;
  lead_score: number | null;
  pain: string | null;
  last_message_preview: string | null;
  ultima_mensagem: string | null;
  reuniao_agendada: string | null;
}

export interface LinkedInProfileData {
  kpis: LinkedInKpis | null;
  daily: LinkedInDailyRow[];
  funnel: LinkedInFunnelRow[];
  conversations: LinkedInConversation[];
}

function normalizeKpis(row: Record<string, unknown> | null): LinkedInKpis | null {
  if (!row || typeof row !== 'object') return null;
  const n = (k: string) => {
    const v = row[k];
    if (v === null || v === undefined) return 0;
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const nf = (k: string): number | null => {
    const v = row[k];
    if (v === null || v === undefined) return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };
  return {
    invites_sent:        n('invites_sent'),
    invites_accepted:    n('invites_accepted'),
    acceptance_rate:     nf('acceptance_rate'),
    convs_active:        n('convs_active'),
    sessions_with_reply: n('sessions_with_reply'),
    meetings_scheduled:  n('meetings_scheduled'),
    msgs_sent:           n('msgs_sent'),
    msgs_received:       n('msgs_received'),
    reply_rate:          nf('reply_rate'),
    conversion_rate:     nf('conversion_rate'),
  };
}

async function fetchProfile(profile: 'renan' | 'jaqueline'): Promise<LinkedInProfileData> {
  if (!mariSupabase) {
    throw new Error('Supabase da Mari não configurado');
  }
  const sb = mariSupabase as any;

  const [kpisRes, dailyRes, funnelRes, convsRes] = await Promise.all([
    sb.from(`vw_linkedin_sdr_kpis_${profile}`).select('*').maybeSingle(),
    sb.from(`vw_linkedin_sdr_daily_${profile}`).select('*').order('day', { ascending: true }),
    sb.from(`vw_linkedin_sdr_funnel_${profile}`).select('*').order('sort_order', { ascending: true }),
    sb.from(`vw_linkedin_sdr_conversations_${profile}`).select('*').limit(50),
  ]);

  if (kpisRes.error) throw kpisRes.error;
  if (dailyRes.error) throw dailyRes.error;
  if (funnelRes.error) throw funnelRes.error;
  if (convsRes.error) throw convsRes.error;

  return {
    kpis:          normalizeKpis(kpisRes.data as Record<string, unknown> | null),
    daily:         (dailyRes.data ?? []) as LinkedInDailyRow[],
    funnel:        (funnelRes.data ?? []) as LinkedInFunnelRow[],
    conversations: (convsRes.data ?? []) as LinkedInConversation[],
  };
}

export interface LinkedInMariData {
  renan:     LinkedInProfileData;
  jaqueline: LinkedInProfileData;
}

export const useLinkedInMari = () =>
  useQuery<LinkedInMariData>({
    queryKey: ['linkedin-mari'],
    enabled:  isMariSupabaseConfigured && mariSupabase !== null,
    queryFn: async () => {
      const [renan, jaqueline] = await Promise.all([
        fetchProfile('renan'),
        fetchProfile('jaqueline'),
      ]);
      return { renan, jaqueline };
    },
    staleTime:       2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
