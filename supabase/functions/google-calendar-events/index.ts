import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Lê próximos eventos do Google Calendar pra uma org.
 *
 * - Faz refresh do access_token automaticamente se expirado.
 * - Retorna eventos do calendário primário, próximos `max_days` dias.
 * - Edge function que o frontend chama via supabase.functions.invoke.
 */

interface ReqBody {
  org_id: string;
  max_days?: number;
  max_results?: number;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  hangoutLink?: string;
  location?: string;
  htmlLink?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return json({ error: "GOOGLE_OAUTH_CLIENT_ID/SECRET ausentes" }, 500);
    }

    const { org_id, max_days = 14, max_results = 20 }: ReqBody = await req.json();
    if (!org_id) return json({ error: "org_id obrigatório" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: row, error: selErr } = await supabase
      .from("google_oauth_credentials")
      .select("*")
      .eq("org_id", org_id)
      .eq("provider", "google_calendar")
      .maybeSingle();
    if (selErr) return json({ error: selErr.message }, 500);
    if (!row) return json({ error: "Google Calendar não conectado para esta org", connected: false }, 404);

    let accessToken: string = row.access_token;
    const expiresAt = new Date(row.expires_at);
    const needsRefresh = expiresAt.getTime() - Date.now() < 60_000;

    if (needsRefresh) {
      const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: row.refresh_token,
          grant_type: "refresh_token",
        }).toString(),
      });
      if (!refreshResp.ok) {
        const t = await refreshResp.text();
        return json({ error: `Falha no refresh: ${refreshResp.status} ${t.slice(0, 200)}` }, 502);
      }
      const refreshed = await refreshResp.json() as { access_token: string; expires_in: number };
      accessToken = refreshed.access_token;
      const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase
        .from("google_oauth_credentials")
        .update({ access_token: accessToken, expires_at: newExpires })
        .eq("org_id", org_id)
        .eq("provider", "google_calendar");
    }

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + max_days * 86_400_000).toISOString();
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin,
      timeMax,
      maxResults: String(Math.min(max_results, 50)),
    });
    const apiResp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!apiResp.ok) {
      const t = await apiResp.text();
      return json({ error: `Calendar API ${apiResp.status}: ${t.slice(0, 200)}` }, 502);
    }
    const data = await apiResp.json();
    const events: GoogleEvent[] = (data.items ?? []) as GoogleEvent[];

    return json({
      connected: true,
      google_email: row.google_email,
      events: events.map((e) => ({
        id: e.id,
        title: e.summary ?? "(sem título)",
        description: e.description ?? null,
        start: e.start?.dateTime ?? e.start?.date ?? null,
        end: e.end?.dateTime ?? e.end?.date ?? null,
        attendees: (e.attendees ?? []).map((a) => a.displayName ?? a.email),
        link: e.htmlLink ?? null,
        meet: e.hangoutLink ?? null,
        location: e.location ?? null,
      })),
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
