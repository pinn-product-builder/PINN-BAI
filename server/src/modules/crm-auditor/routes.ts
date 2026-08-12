import type { Context, Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserSupabase } from "../../lib/supabase.js";
import {
  assertTenantAccess,
  defaultProvider,
  disconnectKommo,
  getOverview,
  getStatus,
  listSyncRuns,
} from "./service.js";

const INTEGRATION_REMOVED_MESSAGE =
  "Composio removido; conexão e sync do Kommo agora são via token direto no backend Python (/crm/...).";

type Variables = { userId: string; db: SupabaseClient };

export type CrmAuditorRouteContext = {
  supabaseUrl: string;
  anonKey: string;
};

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
      const body = await getStatus(db, orgId, provider, false, "");
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

  app.post("/api/crm-auditor/settings/composio-kommo", (c) => {
    return c.json({ error: INTEGRATION_REMOVED_MESSAGE }, 501);
  });

  app.post("/api/crm-auditor/sync", (c) => {
    return c.json({ error: INTEGRATION_REMOVED_MESSAGE }, 501);
  });

  app.post("/api/crm-auditor/connections/kommo/connect", (c) => {
    return c.json({ error: INTEGRATION_REMOVED_MESSAGE }, 501);
  });

  app.post("/api/crm-auditor/connections/kommo/finalize", (c) => {
    return c.json({ error: INTEGRATION_REMOVED_MESSAGE }, 501);
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
      const body = await disconnectKommo(db, orgId, provider, roles, "");
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
