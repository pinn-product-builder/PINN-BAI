import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mariSupabase } from '@/integrations/supabase/mariClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface LinkedInCampaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  mode: 'hunting' | 'direct';
  linkedin_account_id: string | null;
  delay_seconds: number;
  total_leads: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CampaignLead {
  id: string;
  lead_name: string | null;
  company: string | null;
  sector: string | null;
  role: string | null;
  linkedin_url: string | null;
  linkedin_provider_id: string | null;
  status: 'pending' | 'invite_sent' | 'invite_accepted' | 'sent' | 'failed' | 'skipped';
  invited_at: string | null;
  accepted_at: string | null;
  sent_at: string | null;
  error: string | null;
  opening_msg: string | null;
}

export interface LinkedInAccount {
  id: string;
  profile_name: string;
  unipile_account_id: string;
  prompt_profile: string | null;
  hunting_config: Record<string, any> | null;
}

export interface LinkedInSession {
  session_id: string;
  phone: string | null;
  lead_name: string | null;
  company: string | null;
  sector: string | null;
  role: string | null;
  stage: string;
  lead_score: number | null;
  pain: string | null;
  channel: string | null;
  instance: string | null;
  is_outbound: boolean | null;
  campaign_id: string | null;
  created_at: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  handoff: boolean | null;
  optout: boolean | null;
  confirmed_slot: string | null;
  email_lead: string | null;
}

export interface SessionMessage {
  id: string;
  session_id: string;
  direction: 'inbound' | 'outbound';
  text: string | null;
  intent: string | null;
  stage: string | null;
  created_at: string;
}

export interface CreateCampaignInput {
  name: string;
  linkedin_account_id: string;
  mode: 'hunting' | 'direct';
  delay_seconds: number;
  leads?: Array<{
    linkedin_url: string;
    lead_name: string;
    company: string;
    sector: string;
    role: string;
  }>;
}

// Instâncias LinkedIn da Mari (Renan e Jaqueline)
export const LINKEDIN_INSTANCES = [
  '_39Lo_qvT66qhg8Xf3tSeQ',
  'Z2xzKnaEQNexnOwS8gMlcQ',
] as const;

export const INSTANCE_PROFILE_MAP: Record<string, string> = {
  '_39Lo_qvT66qhg8Xf3tSeQ': 'Renan',
  'Z2xzKnaEQNexnOwS8gMlcQ': 'Jaqueline',
};

/** Opções do seletor de perfil: sempre inclui Renan/Jaqueline + extras vindos do banco. */
export function useLinkedInAccountSelectOptions() {
  const { data: rows = [], isError } = useLinkedInAccounts();

  return useMemo(() => {
    const byUid = new Map(rows.map((r) => [r.unipile_account_id, r]));
    const out: { unipile_account_id: string; label: string }[] = [];

    for (const uid of LINKEDIN_INSTANCES) {
      const row = byUid.get(uid);
      out.push({
        unipile_account_id: uid,
        label: row?.profile_name ?? INSTANCE_PROFILE_MAP[uid] ?? uid,
      });
    }

    for (const row of rows) {
      if (
        !(LINKEDIN_INSTANCES as readonly string[]).includes(row.unipile_account_id)
      ) {
        out.push({
          unipile_account_id: row.unipile_account_id,
          label: row.profile_name,
        });
      }
    }

    return { options: out, isError };
  }, [rows, isError]);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useLinkedInCampaigns = () => {
  return useQuery<LinkedInCampaign[]>({
    queryKey: ['linkedin-campaigns'],
    queryFn: async () => {
      if (!mariSupabase) return [];
      const { data, error } = await (mariSupabase as any)
        .from('sdr_campaigns')
        .select(
          'id, name, status, mode, linkedin_account_id, delay_seconds, ' +
          'total_leads, sent_count, failed_count, created_at, started_at, completed_at'
        )
        .eq('channel', 'linkedin')
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('[useLinkedInCampaigns]', error.message ?? error);
        return [];
      }
      return (data ?? []) as LinkedInCampaign[];
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
};

export const useCampaignLeads = (campaignId: string | null) => {
  return useQuery<CampaignLead[]>({
    queryKey: ['campaign-leads', campaignId],
    queryFn: async () => {
      if (!mariSupabase || !campaignId) return [];
      const { data, error } = await (mariSupabase as any)
        .from('sdr_campaign_leads')
        .select(
          'id, lead_name, company, sector, role, linkedin_url, ' +
          'linkedin_provider_id, status, invited_at, accepted_at, sent_at, error, opening_msg'
        )
        .eq('campaign_id', campaignId)
        .order('id', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CampaignLead[];
    },
    enabled: !!campaignId,
    staleTime: 30 * 1000,
  });
};

export const useLinkedInAccounts = () => {
  return useQuery<LinkedInAccount[]>({
    queryKey: ['linkedin-accounts'],
    queryFn: async () => {
      if (!mariSupabase) return [];
      const { data, error } = await (mariSupabase as any)
        .from('linkedin_accounts')
        .select('id, profile_name, unipile_account_id, prompt_profile, hunting_config')
        .eq('is_active', true);
      if (error) {
        console.warn('[useLinkedInAccounts]', error.message ?? error);
        return [];
      }
      return (data ?? []) as LinkedInAccount[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      if (!mariSupabase) throw new Error('Supabase da Mari não configurado');

      const { data: campaign, error: campError } = await (mariSupabase as any)
        .from('sdr_campaigns')
        .insert({
          tenant_id: 'pinn',
          name: input.name,
          channel: 'linkedin',
          linkedin_account_id: input.linkedin_account_id,
          mode: input.mode,
          delay_seconds: input.delay_seconds,
          status: 'draft',
          total_leads: input.leads?.length ?? 0,
          sent_count: 0,
          failed_count: 0,
        })
        .select('id')
        .single();

      if (campError) throw campError;
      const campaignId = campaign.id as string;

      if (input.leads && input.leads.length > 0) {
        const rows = input.leads.map((l) => ({
          campaign_id: campaignId,
          tenant_id: 'pinn',
          phone:
            l.linkedin_url?.trim() ?
              `linkedin:${l.linkedin_url.trim()}`
            : '',
          lead_name: l.lead_name || null,
          company: l.company || null,
          sector: l.sector || null,
          role: l.role || null,
          linkedin_url: l.linkedin_url || null,
          status: 'pending',
        }));
        const { error: leadsError } = await (mariSupabase as any)
          .from('sdr_campaign_leads')
          .insert(rows);
        if (leadsError) throw leadsError;
      }

      return campaignId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-campaigns'] });
    },
  });
};

export const useLinkedInConversations = () => {
  return useQuery<LinkedInSession[]>({
    queryKey: ['linkedin-conversations'],
    queryFn: async () => {
      if (!mariSupabase) return [];
      const { data, error } = await (mariSupabase as any)
        .from('sdr_sessions')
        .select(
          'session_id, phone, lead_name, company, sector, role, stage, lead_score, pain, ' +
          'channel, instance, is_outbound, campaign_id, created_at, ' +
          'last_inbound_at, last_outbound_at, handoff, optout, confirmed_slot, email_lead'
        )
        .eq('channel', 'linkedin')
        .in('instance', LINKEDIN_INSTANCES)
        .order('last_inbound_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as LinkedInSession[];
    },
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
};

export const useSessionMessages = (sessionId: string | null) => {
  return useQuery<SessionMessage[]>({
    queryKey: ['session-messages', sessionId],
    queryFn: async () => {
      if (!mariSupabase || !sessionId) return [];
      const { data, error } = await (mariSupabase as any)
        .from('sdr_messages')
        .select('id, session_id, direction, text, intent, stage, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SessionMessage[];
    },
    enabled: !!sessionId,
    staleTime: 30 * 1000,
  });
};
