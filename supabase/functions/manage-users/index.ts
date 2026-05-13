import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Edge function "manage-users" — usada pelo Admin → Usuários no Pinn BAI.
// Operações suportadas (via { action: "..." } no body):
//   - "list":           devolve todos os usuários (auth + profile + roles + status)
//   - "reset-password": admin define nova senha de qualquer usuário
//   - "set-active":     ativa (banned_until = null) ou desativa (ban perpétuo) usuário
//   - "update-email":   troca o email de login de qualquer usuário
//
// Apenas platform_admins (verificado via RPC is_platform_admin) podem chamar.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface ListAction {
  action: "list";
}
interface ResetPasswordAction {
  action: "reset-password";
  userId: string;
  newPassword: string;
}
interface SetActiveAction {
  action: "set-active";
  userId: string;
  isActive: boolean;
}
interface UpdateEmailAction {
  action: "update-email";
  userId: string;
  newEmail: string;
}

type ManageAction =
  | ListAction
  | ResetPasswordAction
  | SetActiveAction
  | UpdateEmailAction;

// "Banir para sempre" — usado para desativar acesso. O Supabase aceita
// qualquer string ISO; pegamos 100 anos no futuro só pra simbolizar.
const FOREVER_BAN = "876600h"; // 100 anos em horas

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization header required" }, 401);

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerError } = await supabase.auth.getUser();
    if (callerError || !caller) return json({ error: "Invalid authorization" }, 401);

    const { data: isPlatformAdmin } = await admin.rpc("is_platform_admin", {
      _user_id: caller.id,
    });
    if (!isPlatformAdmin) {
      return json({ error: "Only platform admins can manage users" }, 403);
    }

    const body = (await req.json()) as ManageAction;

    // ─── LIST ────────────────────────────────────────────────────────
    if (body.action === "list") {
      // Pagina 1000 usuários por vez (limite máximo do listUsers).
      const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listError) return json({ error: listError.message }, 500);

      const authUsers = usersPage?.users ?? [];
      const userIds = authUsers.map((u) => u.id);

      // Profiles + roles em batch.
      const [profilesRes, rolesRes] = await Promise.all([
        admin
          .from("profiles")
          .select("user_id, full_name, email, org_id, avatar_url")
          .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
        admin
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      ]);

      if (profilesRes.error) return json({ error: profilesRes.error.message }, 500);
      if (rolesRes.error) return json({ error: rolesRes.error.message }, 500);

      const profileByUser = new Map(
        (profilesRes.data ?? []).map((p) => [p.user_id, p]),
      );
      const rolesByUser = new Map<string, string[]>();
      (rolesRes.data ?? []).forEach((r) => {
        const list = rolesByUser.get(r.user_id) ?? [];
        list.push(r.role);
        rolesByUser.set(r.user_id, list);
      });

      // Resolve nomes das orgs (se houver).
      const orgIds = Array.from(
        new Set(
          (profilesRes.data ?? [])
            .map((p) => p.org_id)
            .filter((id): id is string => !!id),
        ),
      );
      let orgNameById = new Map<string, string>();
      if (orgIds.length > 0) {
        const { data: orgs, error: orgErr } = await admin
          .from("organizations")
          .select("id, name")
          .in("id", orgIds);
        if (orgErr) return json({ error: orgErr.message }, 500);
        orgNameById = new Map((orgs ?? []).map((o) => [o.id, o.name]));
      }

      const enriched = authUsers.map((u) => {
        const profile = profileByUser.get(u.id);
        const roles = rolesByUser.get(u.id) ?? [];
        const banned_until = (u as { banned_until?: string | null }).banned_until ?? null;
        const isActive =
          !banned_until || new Date(banned_until).getTime() < Date.now();

        return {
          id: u.id,
          email: u.email ?? profile?.email ?? null,
          full_name:
            profile?.full_name ??
            ((u.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined) ??
            null,
          avatar_url: profile?.avatar_url ?? null,
          org_id: profile?.org_id ?? null,
          org_name: profile?.org_id ? orgNameById.get(profile.org_id) ?? null : null,
          roles,
          is_active: isActive,
          last_sign_in_at: u.last_sign_in_at ?? null,
          created_at: u.created_at,
        };
      });

      // Ordenação consistente: ativos primeiro, depois por last sign-in desc.
      enriched.sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        const aLast = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
        const bLast = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
        return bLast - aLast;
      });

      return json({ users: enriched });
    }

    // ─── RESET PASSWORD ──────────────────────────────────────────────
    if (body.action === "reset-password") {
      if (!body.userId || !body.newPassword) {
        return json({ error: "userId e newPassword são obrigatórios" }, 400);
      }
      if (body.newPassword.length < 6) {
        return json({ error: "Senha precisa ter ao menos 6 caracteres" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(body.userId, {
        password: body.newPassword,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ─── UPDATE EMAIL ────────────────────────────────────────────────
    if (body.action === "update-email") {
      if (!body.userId || !body.newEmail) {
        return json({ error: "userId e newEmail são obrigatórios" }, 400);
      }
      const email = body.newEmail.trim().toLowerCase();
      // Validação simples — Supabase já rejeita formatos inválidos, mas
      // damos uma mensagem mais clara antes da chamada.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "Formato de e-mail inválido" }, 400);
      }
      // email_confirm: true pra não mandar verificação — admin já validou.
      const { error } = await admin.auth.admin.updateUserById(body.userId, {
        email,
        email_confirm: true,
      });
      if (error) return json({ error: error.message }, 500);

      // Mantém profiles.email em sincronia (best-effort, não bloqueia).
      await admin
        .from("profiles")
        .update({ email })
        .eq("user_id", body.userId);

      return json({ success: true });
    }

    // ─── SET ACTIVE / INACTIVE ───────────────────────────────────────
    if (body.action === "set-active") {
      if (!body.userId) return json({ error: "userId é obrigatório" }, 400);
      if (body.userId === caller.id) {
        return json({ error: "Você não pode desativar a si mesmo." }, 400);
      }

      // Para "ativar" passamos `ban_duration: 'none'` que é a forma documentada
      // pelo Supabase de remover o ban (banned_until = null).
      const ban_duration = body.isActive ? "none" : FOREVER_BAN;
      const { error } = await admin.auth.admin.updateUserById(body.userId, {
        ban_duration,
      } as unknown as { ban_duration: string });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("manage-users error:", error);
    return json({ error: message }, 500);
  }
});
