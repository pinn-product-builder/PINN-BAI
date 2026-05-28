import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Callback do OAuth Google.
 *
 * Recebe ?code=...&state=... do Google, troca por tokens, persiste em
 * google_oauth_credentials (per-org via service_role) e redireciona o user
 * de volta para a return_url do state.
 *
 * Configurar GOOGLE_OAUTH_REDIRECT_URI = URL pública dessa edge function.
 */

const PUBLIC_REDIRECT_FALLBACK = "/client";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateB64 = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return htmlError(`Google retornou erro: ${error}`);
    }
    if (!code || !stateB64) {
      return htmlError("Parâmetros code/state ausentes.");
    }

    let state: { org_id: string; return_url?: string };
    try {
      state = JSON.parse(atob(stateB64));
    } catch {
      return htmlError("State inválido.");
    }
    if (!state.org_id) return htmlError("org_id ausente no state.");

    const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    const REDIRECT_URI = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return htmlError("Credenciais OAuth não configuradas no servidor.");
    }

    // Troca code por tokens
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return htmlError(`Google rejeitou o code: ${tokenResp.status} ${t.slice(0, 200)}`);
    }
    const tokens = await tokenResp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
      id_token?: string;
    };

    // Email da conta (id_token base64 payload). Best-effort.
    let google_email: string | null = null;
    if (tokens.id_token) {
      try {
        const payload = JSON.parse(atob(tokens.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        google_email = payload.email ?? null;
      } catch { /* ignore */ }
    }

    const expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Refresh token só vem na PRIMEIRA autorização (ou com prompt=consent).
    // Se reauth (mesma org), preservamos o refresh existente se Google não enviou.
    let refresh_token = tokens.refresh_token ?? "";
    if (!refresh_token) {
      const { data: existing } = await supabase
        .from("google_oauth_credentials")
        .select("refresh_token")
        .eq("org_id", state.org_id)
        .eq("provider", "google_calendar")
        .maybeSingle();
      refresh_token = (existing as { refresh_token?: string } | null)?.refresh_token ?? "";
    }
    if (!refresh_token) {
      return htmlError("Google não retornou refresh_token. Tente novamente após revogar o acesso anterior.");
    }

    const { error: upErr } = await supabase
      .from("google_oauth_credentials")
      .upsert({
        org_id: state.org_id,
        provider: "google_calendar",
        google_email,
        access_token: tokens.access_token,
        refresh_token,
        expires_at,
        scope: tokens.scope ?? null,
      }, { onConflict: "org_id,provider" });
    if (upErr) return htmlError(`Falha ao persistir: ${upErr.message}`);

    // Redireciona o usuário de volta pra UI
    const back = state.return_url || PUBLIC_REDIRECT_FALLBACK;
    return new Response(null, {
      status: 302,
      headers: { Location: back },
    });
  } catch (err) {
    return htmlError(err instanceof Error ? err.message : "Erro interno");
  }
});

function htmlError(msg: string): Response {
  const safe = msg.replace(/</g, "&lt;");
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Falha OAuth</title>
<style>body{font:14px system-ui;padding:2rem;color:#333}h1{font-size:18px;color:#b91c1c}</style>
<h1>Não foi possível conectar o Google Calendar</h1>
<p>${safe}</p>
<p><a href="javascript:history.back()">Voltar</a></p>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
