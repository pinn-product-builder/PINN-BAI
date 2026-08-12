import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthOk {
  ok: true;
  /** null quando a chamada veio com a service_role key (server-to-server/cron). */
  userId: string | null;
  isServiceRole: boolean;
  isPlatformAdmin: boolean;
}

export interface AuthFail {
  ok: false;
  response: Response;
}

export type AuthResult = AuthOk | AuthFail;

let _admin: SupabaseClient | null = null;

function adminClient(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return _admin;
}

function jsonError(message: string, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Valida o chamador: JWT de usuário (via auth.getUser) ou service_role key
 * (chamadas server-to-server/cron). A anon key pura NÃO passa.
 */
export async function requireUser(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthResult> {
  const token = bearerToken(req);
  if (!token) {
    return { ok: false, response: jsonError("Authorization required", 401, corsHeaders) };
  }

  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return { ok: true, userId: null, isServiceRole: true, isPlatformAdmin: true };
  }

  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, response: jsonError("Invalid authorization", 401, corsHeaders) };
  }

  const { data: isPlatformAdmin } = await admin.rpc("is_platform_admin", {
    _user_id: data.user.id,
  });

  return {
    ok: true,
    userId: data.user.id,
    isServiceRole: false,
    isPlatformAdmin: Boolean(isPlatformAdmin),
  };
}

/**
 * requireUser + pertencimento à org: o usuário precisa ter profiles.org_id == orgId,
 * ser platform_admin, ou a chamada vir com a service_role key.
 */
export async function requireOrgAccess(
  req: Request,
  orgId: string,
  corsHeaders: Record<string, string>,
): Promise<AuthResult> {
  const auth = await requireUser(req, corsHeaders);
  if (!auth.ok) return auth;
  if (auth.isServiceRole || auth.isPlatformAdmin) return auth;

  const { data: profile } = await adminClient()
    .from("profiles")
    .select("org_id")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!profile || profile.org_id !== orgId) {
    return {
      ok: false,
      response: jsonError("Access denied for this organization", 403, corsHeaders),
    };
  }

  return auth;
}
