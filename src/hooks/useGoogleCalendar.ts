import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hooks pra Google Calendar.
 * - useGoogleCalendarStatus: lê se org tem credenciais conectadas (via SELECT).
 * - useGoogleCalendarEvents: invoca edge `google-calendar-events`.
 * - useStartGoogleOAuth: dispara handshake; redireciona pra Google.
 * - useDisconnectGoogleCalendar: remove credenciais.
 */

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start: string | null;
  end: string | null;
  attendees: string[];
  link: string | null;
  meet: string | null;
  location: string | null;
}

export interface CalendarStatus {
  connected: boolean;
  google_email: string | null;
}

export function useGoogleCalendarStatus(orgId: string | undefined) {
  return useQuery<CalendarStatus>({
    queryKey: ['google-calendar-status', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('google_oauth_credentials')
        .select('google_email')
        .eq('org_id', orgId)
        .eq('provider', 'google_calendar')
        .maybeSingle();
      if (error || !data) return { connected: false, google_email: null };
      return { connected: true, google_email: data.google_email ?? null };
    },
  });
}

export function useGoogleCalendarEvents(orgId: string | undefined, opts?: { maxDays?: number }) {
  return useQuery<{ events: CalendarEvent[]; connected: boolean; google_email: string | null }>({
    queryKey: ['google-calendar-events', orgId, opts?.maxDays],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: { org_id: orgId, max_days: opts?.maxDays ?? 14 },
      });
      if (error) {
        // 404 = não conectado (esperado, não logar como erro)
        return { events: [], connected: false, google_email: null };
      }
      const d = data as { events?: CalendarEvent[]; connected?: boolean; google_email?: string | null };
      return {
        events: d.events ?? [],
        connected: d.connected ?? false,
        google_email: d.google_email ?? null,
      };
    },
  });
}

export function useStartGoogleOAuth() {
  return useMutation({
    mutationFn: async ({ orgId, returnUrl }: { orgId: string; returnUrl?: string }) => {
      const { data, error } = await supabase.functions.invoke('google-oauth-start', {
        body: { org_id: orgId, return_url: returnUrl ?? window.location.href },
      });
      if (error) throw error;
      const url = (data as { authorize_url?: string })?.authorize_url;
      if (!url) throw new Error('authorize_url ausente');
      window.location.assign(url);
    },
  });
}

export function useDisconnectGoogleCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('google_oauth_credentials')
        .delete()
        .eq('org_id', orgId)
        .eq('provider', 'google_calendar');
      if (error) throw error;
    },
    onSuccess: (_, orgId) => {
      qc.invalidateQueries({ queryKey: ['google-calendar-status', orgId] });
      qc.invalidateQueries({ queryKey: ['google-calendar-events', orgId] });
    },
  });
}
