import type { SupabaseClient } from "@supabase/supabase-js";

const PROVIDER_DEFAULT = "kommo";

/** Integração externa do CRM foi removida; sync/conexão agora rodam no backend Python (/crm/...). */
function integrationRemovedError(): Error & { status: number; code: string } {
  const err = new Error(
    "Integração removida; sync e conexão Kommo agora rodam no backend Python (/crm/...).",
  ) as Error & { status: number; code: string };
  err.status = 501;
  err.code = "INTEGRATION_REMOVED";
  return err;
}

export function defaultProvider() {
  return PROVIDER_DEFAULT;
}

export function emptyMetrics() {
  return {
    total_opportunities: 0,
    open_count: 0,
    won_count: 0,
    lost_count: 0,
    open_value: 0,
    won_value: 0,
    win_rate: 0,
    loss_rate: 0,
    opportunities_without_value: 0,
    opportunities_without_owner: 0,
    opportunities_without_source: 0,
    opportunities_without_next_action: 0,
    overdue_tasks: 0,
    stalled_leads: 0,
    contacts_without_phone: 0,
    contacts_without_email: 0,
    losses_without_reason: 0,
    hygiene_score: 0,
    discipline_score: 0,
    risk_score: 0,
    forecast_score: 0,
    overall_score: 0,
    mock: true,
  };
}

async function assertOrgAccess(
  internal: SupabaseClient,
  userId: string,
  orgId: string,
): Promise<{ ok: true } | { ok: false }> {
  const { data: profile } = await internal.from("profiles").select("org_id").eq("user_id", userId).maybeSingle();
  const { data: userRoles } = await internal.from("user_roles").select("role").eq("user_id", userId);
  const isPlatformAdmin = (userRoles || []).some((r) => r.role === "platform_admin");
  const canAccess = isPlatformAdmin || profile?.org_id === orgId;
  if (!canAccess) {
    return { ok: false };
  }
  return { ok: true };
}

export function canMutateCrm(roles: { role: string }[]): boolean {
  return roles.some((r) => ["platform_admin", "client_admin", "analyst"].includes(r.role));
}

export async function assertTenantAccess(internal: SupabaseClient, userId: string, orgId: string) {
  const access = await assertOrgAccess(internal, userId, orgId);
  if (!access.ok) {
    const err = new Error("Access denied for this organization") as Error & { status: number };
    err.status = 403;
    throw err;
  }
}

export async function loadConnection(internal: SupabaseClient, orgId: string, provider: string) {
  // Schema canônico: crm_auditor_connections (a legada crm_connections não existe
  // mais). `status` ← sync_status; `metadata` era do Composio (removido) → null.
  const { data: conn } = await internal
    .from("crm_auditor_connections")
    .select("id, sync_status, last_sync_at, composio_connected_account_id")
    .eq("tenant_id", orgId)
    .eq("provider", provider)
    .maybeSingle();
  return conn
    ? {
        id: conn.id as string,
        status: (conn.sync_status as string | null) ?? "idle",
        last_sync_at: conn.last_sync_at as string | null,
        composio_connected_account_id: conn.composio_connected_account_id as string | null,
        metadata: null as unknown,
      }
    : null;
}

/** Auth Config Kommo salvo no próprio Auditor ou fallback env da API. */
export function resolveKommoAuthConfigId(
  conn: Awaited<ReturnType<typeof loadConnection>>,
  envFallback: string,
): { id: string | null; source: "tenant" | "environment" | "missing" } {
  const meta = conn?.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const raw = (meta as { composio?: { auth_config_id?: unknown } }).composio?.auth_config_id;
    if (typeof raw === "string" && raw.trim()) {
      return { id: raw.trim(), source: "tenant" };
    }
  }
  const env = envFallback?.trim() ?? "";
  if (env) return { id: env, source: "environment" };
  return { id: null, source: "missing" };
}

export function extractPublicAppUrlFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as { composio?: { public_app_url?: unknown } }).composio?.public_app_url;
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/\/$/, "");
  if (!t.startsWith("http://") && !t.startsWith("https://")) return null;
  return t;
}

export async function saveComposioKommoIntegrationSettings(
  _internal: SupabaseClient,
  _orgId: string,
  _provider: string,
  _roles: { role: string }[],
  _authConfigIdRaw: string,
  _publicAppUrlRaw?: string | null,
): Promise<{ ok: true }> {
  throw integrationRemovedError();
}

export async function getStatus(
  internal: SupabaseClient,
  orgId: string,
  provider: string,
  composioConfigured: boolean,
  envKommoAuthConfigId: string,
) {
  const conn = await loadConnection(internal, orgId, provider);

  const resolvedAuth = resolveKommoAuthConfigId(conn, envKommoAuthConfigId);
  const tenantPublicUrl = extractPublicAppUrlFromMetadata(conn?.metadata);

  const { data: latestRun } = await internal
    .from("crm_sync_runs")
    .select("id, status, started_at, finished_at, error_message, stats")
    .eq("tenant_id", orgId)
    .eq("provider", provider)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestSnapshot } = await internal
    .from("crm_snapshots")
    .select("id, captured_at, metrics, sync_run_id")
    .eq("tenant_id", orgId)
    .eq("provider", provider)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    provider,
    connection: conn
      ? {
          status: conn.status,
          last_sync_at: conn.last_sync_at,
          has_composio_account: Boolean(conn.composio_connected_account_id),
        }
      : null,
    latest_sync_run: latestRun,
    latest_snapshot: latestSnapshot,
    integration_mode: composioConfigured ? ("live" as const) : ("mock" as const),
    composio_kommo: {
      auth_config_id: resolvedAuth.id,
      auth_config_source: resolvedAuth.source,
      ready_to_connect: composioConfigured && Boolean(resolvedAuth.id),
      public_app_url: tenantPublicUrl,
    },
  };
}

export async function getOverview(internal: SupabaseClient, orgId: string, provider: string) {
  const { data: snap } = await internal
    .from("crm_snapshots")
    .select("metrics, captured_at")
    .eq("tenant_id", orgId)
    .eq("provider", provider)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    metrics: (snap?.metrics as Record<string, unknown>) ?? emptyMetrics(),
    captured_at: snap?.captured_at ?? null,
    has_data: Boolean(snap),
  };
}

export async function listSyncRuns(internal: SupabaseClient, orgId: string, provider: string) {
  const { data: runs, error } = await internal
    .from("crm_sync_runs")
    .select("id, status, started_at, finished_at, error_message, stats")
    .eq("tenant_id", orgId)
    .eq("provider", provider)
    .order("started_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("crm_sync_runs list error");
    const err = new Error("Failed to list sync runs") as Error & { status: number };
    err.status = 500;
    throw err;
  }
  return { runs: runs || [] };
}

export async function runSync(
  _internal: SupabaseClient,
  _orgId: string,
  _provider: string,
  _composioConfigured: boolean,
  roles: { role: string }[],
  _conn: Awaited<ReturnType<typeof loadConnection>>,
  _runtime?: { apiKey: string; executeBaseUrl: string; fallbackConnectedAccountId?: string },
): Promise<{ ok: true; sync_run_id: string; mock: boolean }> {
  if (!canMutateCrm(roles)) {
    const err = new Error("Insufficient permissions for sync") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  throw integrationRemovedError();
}

export async function connectKommo(
  _internal: SupabaseClient,
  _orgId: string,
  _provider: string,
  roles: { role: string }[],
  _opts: {
    composioApiKey: string;
    envKommoAuthConfigId: string;
    callbackBaseUrl: string;
  },
): Promise<{ redirect_url: string; connected_account_id: string; callback_url: string }> {
  if (!canMutateCrm(roles)) {
    const err = new Error("Insufficient permissions") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  throw integrationRemovedError();
}

export async function finalizeKommoConnection(
  _internal: SupabaseClient,
  _orgId: string,
  _provider: string,
  roles: { role: string }[],
  _composioApiKey: string,
): Promise<{ ok: true }> {
  if (!canMutateCrm(roles)) {
    const err = new Error("Insufficient permissions") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  throw integrationRemovedError();
}

export async function disconnectKommo(
  internal: SupabaseClient,
  orgId: string,
  provider: string,
  roles: { role: string }[],
  _composioApiKey: string,
) {
  if (!canMutateCrm(roles)) {
    const err = new Error("Insufficient permissions") as Error & { status: number };
    err.status = 403;
    throw err;
  }

  const conn = await loadConnection(internal, orgId, provider);
  if (!conn?.id) {
    return { ok: true as const };
  }

  // Composio removido — desconectar é só limpar o vínculo no schema canônico.
  const { error } = await internal
    .from("crm_auditor_connections")
    .update({
      composio_connected_account_id: null,
      sync_status: "disconnected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  if (error) {
    console.error("crm_auditor_connections disconnect", error);
    const err = new Error("Could not update connection") as Error & { status: number };
    err.status = 500;
    throw err;
  }

  return { ok: true as const };
}
