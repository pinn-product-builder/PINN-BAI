import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Inicia OAuth do Google Calendar.
 *
 * Recebe { org_id, return_url } e retorna { authorize_url }.
 * O frontend redireciona pra essa URL. Após consent, o Google volta
 * pra google-oauth-callback?code=...&state=... com state contendo
 * org_id + return_url (encodados base64).
 *
 * Scopes: somente leitura de eventos. Refresh token retornado porque
 * usamos `access_type=offline` + `prompt=consent`.
 */

interface StartBody {
  org_id: string;
  return_url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const REDIRECT_URI = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI");
    if (!CLIENT_ID || !REDIRECT_URI) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_OAUTH_CLIENT_ID/REDIRECT_URI não configurados nos secrets da function." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { org_id, return_url }: StartBody = await req.json();
    if (!org_id) {
      return new Response(JSON.stringify({ error: "org_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const state = btoa(JSON.stringify({
      org_id,
      return_url: return_url ?? "",
      nonce: crypto.randomUUID(),
      ts: Date.now(),
    }));

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar.readonly openid email",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });

    const authorize_url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return new Response(JSON.stringify({ authorize_url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
