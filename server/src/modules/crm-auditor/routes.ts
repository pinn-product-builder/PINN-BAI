import type { Context, Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserSupabase } from "../../lib/supabase.js";
import {
  assertTenantAccess,
  connectKommo,
  defaultProvider,
  disconnectKommo,
  extractPublicAppUrlFromMetadata,
  finalizeKommoConnection,
  getOverview,
  getStatus,
  listSyncRuns,
  loadConnection,
  runSync,
  saveComposioKommoIntegrationSettings,
} from "./service.js";

type Variables = { userId: string; db: SupabaseClient };

export type CrmAuditorRouteContext = {
  supabaseUrl: string;
  anonKey: string;
  composioConfigured: boolean;
  composioApiKey: string;
  composioKommoAuthConfigId: string;
  /** Base URL da execução de tools (`KOMMO_*`) — igual ao standalone Python. */
  composioExecuteBaseUrl: string;
  /** Opcional: mesma conta que no `.env` do auditor (`COMPOSIO_CONNECTED_ACCOUNT_ID`). */
  composioConnectedAccountId: string;
  /** Ex.: https://app.exemplo.com — usado no callback_url da Composio após OAuth Kommo */
  publicAppUrl: string;
};

function callbackBaseUrl(c: Context, ctx: CrmAuditorRouteContext): string {
  const fromEnv = ctx.publicAppUrl.replace(/\/$/, "");
  const origin = c.req.header("Origin")?.trim().replace(/\/$/, "") ?? "";
  return fromEnv || origin;
}

async function rolesForUser(db: SupabaseClient, userId: string) {
  const { data: roleRows } = await db.from("user_roles").select("role").eq("user_id", userId);
  return roleRows || [];
}

/** Rotas REST: todas as queries usam o JWT do request (RLS no Postgres). */
export function registerCrmAuditorRoutes(app: Hono<{ Variables: Variables }>, ctx: CrmAuditorRouteContext) {
  app.use("/api/crm-auditor/*", async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Authorization required" }, 401);
    }
    const db = createUserSupabase(ctx.supabaseUrl, ctx.anonKey, authHeader);
    const { data: authData, error: authError } = await db.auth.getUser();
    if (authError || !authData.user) {
      return c.json({ error: "Invalid auth token" }, 401);
    }
    c.set("userId", authData.user.id);
    c.set("db", db);
    await next();
  });

  app.get("/api/crm-auditor/status", async (c) => {
    const orgId = c.req.query("orgId")?.trim() || "";
    const provider = (c.req.query("provider") || defaultProvider()).trim();
    if (!orgId) return c.json({ error: "orgId is required" }, 400);

    try {
      const db = c.var.db;
      await assertTenantAccess(db, c.var.userId, orgId);
      const body = await getStatus(db, orgId, provider, ctx.composioConfigured, ctx.composioKommoAuthConfigId);
      return c.json(body);
    } catch (e) {
      return handleServiceError(c, e);
    }
  });

  app.get("/api/crm-auditor/overview", async (c) => {
    const orgId = c.req.query("orgId")?.trim() || "";
    const provider = (c.req.query("provider") || defaultProvider()).trim();
    if (!orgId) return c.json({ error: "orgId is required" }, 400);

    try {
      const db = c.var.db;
      await assertTenantAccess(db, c.var.userId, orgId);
      const body = await getOverview(db, orgId, provider);
      return c.json(body);
    } catch (e) {
      return handleServiceError(c, e);
    }
  });

  app.get("/api/crm-auditor/sync-runs", async (c) => {
    const orgId = c.req.query("orgId")?.trim() || "";
    const provider = (c.req.query("provider") || defaultProvider()).trim();
    if (!orgId) return c.json({ error: "orgId is required" }, 400);

    try {
      const db = c.var.db;
      await assertTenantAccess(db, c.var.userId, orgId);
      const body = await listSyncRuns(db, orgId, provider);
      return c.json(body);
    } catch (e) {
      return handleServiceError(c, e);
    }
  });

  app.post("/api/crm-auditor/settings/composio-kommo", async (c) => {
    let orgId = "";
    let provider = defaultProvider();
    let composioKommoAuthConfigId = "";
    let publicAppUrl: string | undefined = undefined;
    try {
      const j = await c.req.json();
      orgId = typeof j?.orgId === "string" ? j.orgId.trim() : "";
      if (typeof j?.provider === "string" && j.provider.trim()) provider = j.provider.trim();
      composioKommoAuthConfigId =
        typeof j?.composioKommoAuthConfigId === "string" ? j.composioKommoAuthConfigId.trim() : "";
      if ("publicAppUrl" in j && typeof j.publicAppUrl === "string") {
        publicAppUrl = j.publicAppUrl;
      }
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (!orgId) return c.json({ error: "orgId is required" }, 400);

    try {
      const db = c.var.db;
      await assertTenantAccess(db, c.var.userId, orgId);
      const roles = await rolesForUser(db, c.var.userId);
      const body = await saveComposioKommoIntegrationSettings(
        db,
        orgId,
        provider,
        roles,
        composioKommoAuthConfigId,
        publicAppUrl,
      );
      return c.json(body);
    } catch (e) {
      return handleServiceError(c, e);
    }
  });

  app.post("/api/crm-auditor/sync", async (c) => {
    let orgId = "";
    let provider = defaultProvider();
    try {
      const j = await c.req.json();
      orgId = typeof j?.orgId === "string" ? j.orgId.trim() : "";
      provider = typeof j?.provider === "string" ? j.provider.trim() : defaultProvider();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (!orgId) return c.json({ error: "orgId is required" }, 400);

    try {
      const db = c.var.db;
      await assertTenantAccess(db, c.var.userId, orgId);
      const roles = await rolesForUser(db, c.var.userId);
      const conn = await loadConnection(db, orgId, provider);
      const body = await runSync(db, orgId, provider, ctx.composioConfigured, roles, conn, {
        apiKey: ctx.composioApiKey,
        executeBaseUrl: ctx.composioExecuteBaseUrl,
        fallbackConnectedAccountId: ctx.composioConnectedAccountId || undefined,
      });
      return c.json(body);
    } catch (e) {
      return handleServiceError(c, e);
    }
  });

  app.post("/api/crm-auditor/connections/kommo/connect", async (c) => {
    let orgId = "";
    let provider = defaultProvider();
    try {
      const j = await c.req.json();
      orgId = typeof j?.orgId === "string" ? j.orgId.trim() : "";
      if (typeof j?.provider === "string" && j.provider.trim()) provider = j.provider.trim();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (!orgId) return c.json({ error: "orgId is required" }, 400);

    try {
      const db = c.var.db;
      await assertTenantAccess(db, c.var.userId, orgId);
      const connPre = await loadConnection(db, orgId, provider);
      const tenantBase = extractPublicAppUrlFromMetadata(connPre?.metadata);
      const base = tenantBase || callbackBaseUrl(c, ctx);
      if (!base) {
        return c.json(
          {
            error:
              "Informe a URL pública do PINN nesta página (integração Composio) ou defina PUBLIC_APP_URL na API / use o mesmo domínio do app (Origin).",
          },
          400,
        );
      }

      const roles = await rolesForUser(db, c.var.userId);
      const body = await connectKommo(db, orgId, provider, roles, {
        composioApiKey: ctx.composioApiKey,
        envKommoAuthConfigId: ctx.composioKommoAuthConfigId,
        callbackBaseUrl: base,
      });
      return c.json(body);
    } catch (e) {
      return handleServiceError(c, e);
    }
  });

  app.post("/api/crm-auditor/connections/kommo/finalize", async (c) => {
    let orgId = "";
    let provider = defaultProvider();
    try {
      const j = await c.req.json();
      orgId = typeof j?.orgId === "string" ? j.orgId.trim() : "";
      if (typeof j?.provider === "string" && j.provider.trim()) provider = j.provider.trim();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (!orgId) return c.json({ error: "orgId is required" }, 400);

    try {
      const db = c.var.db;
      await assertTenantAccess(db, c.var.userId, orgId);
      const roles = await rolesForUser(db, c.var.userId);
      const body = await finalizeKommoConnection(db, orgId, provider, roles, ctx.composioApiKey);
      return c.json(body);
    } catch (e) {
      return handleServiceError(c, e);
    }
  });

  app.post("/api/crm-auditor/connections/kommo/disconnect", async (c) => {
    let orgId = "";
    let provider = defaultProvider();
    try {
      const j = await c.req.json();
      orgId = typeof j?.orgId === "string" ? j.orgId.trim() : "";
      if (typeof j?.provider === "string" && j.provider.trim()) provider = j.provider.trim();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (!orgId) return c.json({ error: "orgId is required" }, 400);

    try {
      const db = c.var.db;
      await assertTenantAccess(db, c.var.userId, orgId);
      const roles = await rolesForUser(db, c.var.userId);
      const body = await disconnectKommo(db, orgId, provider, roles, ctx.composioApiKey);
      return c.json(body);
    } catch (e) {
      return handleServiceError(c, e);
    }
  });
}

function handleServiceError(c: Context<{ Variables: Variables }>, e: unknown) {
  if (e instanceof Error && "status" in e && typeof (e as Error & { status?: number }).status === "number") {
    const status = (e as Error & { status: number }).status;
    const code = "code" in e ? (e as Error & { code?: string }).code : undefined;
    const payload: Record<string, unknown> = { error: e.message };
    if (code) payload.code = code;
    return c.json(payload, status as 400 | 401 | 403 | 409 | 500 | 501 | 502 | 503 | 504);
  }
  console.error("crm-auditor route error");
  return c.json({ error: "Internal error" }, 500);
}
