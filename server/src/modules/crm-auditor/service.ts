import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createComposioClient,
  mapComposioConnectionStatus,
  resolveComposioUserId,
} from "../../lib/composioClient.js";
import {
  fetchKommoMetricsViaComposioExecute,
  KommoComposioExecutionError,
} from "../../lib/kommoComposioExecute.js";

const PROVIDER_DEFAULT = "kommo";

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
  const { data: conn } = await internal
    .from("crm_connections")
    .select("id, status, last_sync_at, composio_connected_account_id, metadata")
    .eq("tenant_id", orgId)
    .eq("provider", provider)
    .maybeSingle();
  return conn as
    | {
        id: string;
        status: string;
        last_sync_at: string | null;
        composio_connected_account_id: string | null;
        metadata: unknown;
      }
    | null;
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

function normalizeConnectionMetadata(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
}

export async function saveComposioKommoIntegrationSettings(
  internal: SupabaseClient,
  orgId: string,
  provider: string,
  roles: { role: string }[],
  authConfigIdRaw: string,
  publicAppUrlRaw?: string | null,
) {
  if (!canMutateCrm(roles)) {
    const err = new Error("Insufficient permissions") as Error & { status: number };
    err.status = 403;
    throw err;
  }

  const auth_config_id = authConfigIdRaw.trim();
  if (!auth_config_id) {
    const err = new Error(
      "Informe o Auth Config ID do Kommo (Composio Dashboard → Developer → Auth configs).",
    ) as Error & { status: number };
    err.status = 400;
    throw err;
  }

  const conn = await loadConnection(internal, orgId, provider);
  const prev = normalizeConnectionMetadata(conn?.metadata);
  const prevComposio =
    typeof prev.composio === "object" && prev.composio !== null && !Array.isArray(prev.composio)
      ? { ...(prev.composio as Record<string, unknown>) }
      : {};

  const composio: Record<string, unknown> = {
    ...prevComposio,
    auth_config_id,
    settings_saved_at: new Date().toISOString(),
  };

  if (publicAppUrlRaw !== undefined) {
    const u = (publicAppUrlRaw ?? "").trim().replace(/\/$/, "");
    if (!u) {
      delete composio.public_app_url;
    } else if (!u.startsWith("http://") && !u.startsWith("https://")) {
      const err = new Error("URL pública deve começar com http:// ou https://") as Error & { status: number };
      err.status = 400;
      throw err;
    } else {
      composio.public_app_url = u;
    }
  }

  const metadata = { ...prev, composio };

  if (conn?.id) {
    const { error } = await internal
      .from("crm_connections")
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq("id", conn.id);
    if (error) {
      console.error("crm_connections settings update", error);
      const err = new Error("Não foi possível salvar as configurações") as Error & { status: number };
      err.status = 500;
      throw err;
    }
  } else {
    const { error } = await internal.from("crm_connections").insert({
      tenant_id: orgId,
      provider,
      status: "disconnected",
      metadata,
    });
    if (error) {
      console.error("crm_connections settings insert", error);
      const err = new Error("Não foi possível salvar as configurações") as Error & { status: number };
      err.status = 500;
      throw err;
    }
  }

  return { ok: true as const };
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
  internal: SupabaseClient,
  orgId: string,
  provider: string,
  composioConfigured: boolean,
  roles: { role: string }[],
  conn: Awaited<ReturnType<typeof loadConnection>>,
  composioRuntime?: { apiKey: string; executeBaseUrl: string; fallbackConnectedAccountId?: string },
) {
  if (!canMutateCrm(roles)) {
    const err = new Error("Insufficient permissions for sync") as Error & { status: number };
    err.status = 403;
    throw err;
  }

  const fallbackCa = composioRuntime?.fallbackConnectedAccountId?.trim() || "";
  const effectiveCa = (conn?.composio_connected_account_id?.trim() || "") || fallbackCa;
  /** Mesmo padrão do auditor standalone: conta no `.env` dispensa OAuth para sync. */
  const envAccountBypass = composioConfigured && Boolean(fallbackCa);

  const needsLiveConnection = composioConfigured;
  const connectedLive = conn?.status === "connected" || envAccountBypass;

  if (needsLiveConnection && !connectedLive) {
    const err = new Error("CRM connection required") as Error & { status: number; code: string };
    err.status = 409;
    err.code = "NO_CONNECTION";
    throw err;
  }

  const { data: runInsert, error: runErr } = await internal
    .from("crm_sync_runs")
    .insert({
      tenant_id: orgId,
      provider,
      status: "running",
      stats: { phase: "crm_auditor_sync_v2" },
    })
    .select("id")
    .single();

  if (runErr || !runInsert?.id) {
    console.error("sync run insert failed");
    const err = new Error("Could not start sync") as Error & { status: number };
    err.status = 500;
    throw err;
  }

  const runId = runInsert.id as string;

  try {
    let metrics = emptyMetrics();

    const canPullKommo =
      composioConfigured &&
      connectedLive &&
      Boolean(effectiveCa) &&
      Boolean(composioRuntime?.apiKey?.trim());

    metrics.mock = !composioConfigured || !canPullKommo;

    if (canPullKommo && effectiveCa && composioRuntime) {
      try {
        const userId = resolveComposioUserId(orgId);
        metrics = (await fetchKommoMetricsViaComposioExecute({
          apiKey: composioRuntime.apiKey,
          executeBaseUrl: composioRuntime.executeBaseUrl,
          connectedAccountId: effectiveCa,
          userId,
        })) as ReturnType<typeof emptyMetrics>;
      } catch (e) {
        const msg =
          e instanceof KommoComposioExecutionError
            ? e.message
            : e instanceof Error
              ? e.message
              : String(e);
        console.error("fetchKommoMetricsViaComposioExecute", e);
        const err = new Error(`Kommo via Composio: ${msg.slice(0, 500)}`) as Error & { status: number };
        err.status = 502;
        throw err;
      }
    }

    const { error: snapErr } = await internal.from("crm_snapshots").insert({
      tenant_id: orgId,
      provider,
      sync_run_id: runId,
      metrics,
    });

    if (snapErr) {
      throw new Error("snapshot_failed");
    }

    await internal
      .from("crm_sync_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        stats: { ...metrics, completed: true },
      })
      .eq("id", runId);

    if (conn?.id) {
      await internal.from("crm_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", conn.id);
    }

    return {
      ok: true as const,
      sync_run_id: runId,
      mock: Boolean((metrics as { mock?: boolean }).mock),
    };
  } catch (syncErr) {
    const msg =
      syncErr instanceof Error ? syncErr.message.slice(0, 2000) : String(syncErr).slice(0, 2000);
    await internal
      .from("crm_sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: msg || "Sync failed during snapshot phase",
      })
      .eq("id", runId);
    if (syncErr instanceof Error && "status" in syncErr && typeof (syncErr as Error & { status?: number }).status === "number") {
      throw syncErr;
    }
    const err = new Error("Sync failed") as Error & { status: number };
    err.status = 500;
    throw err;
  }
}

export async function connectKommo(
  internal: SupabaseClient,
  orgId: string,
  provider: string,
  roles: { role: string }[],
  opts: {
    composioApiKey: string;
    envKommoAuthConfigId: string;
    callbackBaseUrl: string;
  },
) {
  if (!canMutateCrm(roles)) {
    const err = new Error("Insufficient permissions") as Error & { status: number };
    err.status = 403;
    throw err;
  }

  const connBefore = await loadConnection(internal, orgId, provider);
  const resolved = resolveKommoAuthConfigId(connBefore, opts.envKommoAuthConfigId);

  if (!opts.composioApiKey) {
    const err = new Error(
      "A API não tem COMPOSIO_API_KEY. Configure na infraestrutura para habilitar o modo Composio.",
    ) as Error & { status: number; code: string };
    err.status = 503;
    err.code = "COMPOSIO_NOT_CONFIGURED";
    throw err;
  }

  if (!resolved.id) {
    const err = new Error(
      "Informe o Auth Config ID do Kommo na seção Integração Composio acima (ou COMPOSIO_KOMMO_AUTH_CONFIG_ID na API).",
    ) as Error & { status: number; code: string };
    err.status = 400;
    err.code = "MISSING_AUTH_CONFIG";
    throw err;
  }

  const base = opts.callbackBaseUrl.replace(/\/$/, "");
  if (!base.startsWith("http://") && !base.startsWith("https://")) {
    const err = new Error("URL de callback inválida") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  const callback_url = `${base}/client/${encodeURIComponent(orgId)}/crm-auditor`;

  const client = createComposioClient(opts.composioApiKey);
  const link = await client.link.create({
    auth_config_id: resolved.id,
    user_id: resolveComposioUserId(orgId),
    callback_url,
  });

  const prev = normalizeConnectionMetadata(connBefore?.metadata);
  const prevComposio =
    typeof prev.composio === "object" && prev.composio !== null && !Array.isArray(prev.composio)
      ? { ...(prev.composio as Record<string, unknown>) }
      : {};

  const meta = {
    ...prev,
    composio: {
      ...prevComposio,
      auth_config_id: resolved.id,
      callback_url,
      link_created_at: new Date().toISOString(),
      expires_at: link.expires_at,
    },
  };

  const { error: upsertErr } = await internal.from("crm_connections").upsert(
    {
      tenant_id: orgId,
      provider,
      composio_connected_account_id: link.connected_account_id,
      status: "pending",
      metadata: meta,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,provider" },
  );

  if (upsertErr) {
    console.error("crm_connections upsert", upsertErr);
    const err = new Error("Could not save CRM connection") as Error & { status: number };
    err.status = 500;
    throw err;
  }

  return {
    redirect_url: link.redirect_url,
    connected_account_id: link.connected_account_id,
    callback_url,
  };
}

export async function finalizeKommoConnection(
  internal: SupabaseClient,
  orgId: string,
  provider: string,
  roles: { role: string }[],
  composioApiKey: string,
) {
  if (!canMutateCrm(roles)) {
    const err = new Error("Insufficient permissions") as Error & { status: number };
    err.status = 403;
    throw err;
  }

  if (!composioApiKey) {
    return { ok: true as const, updated: false as const, reason: "no_composio_key" as const };
  }

  const conn = await loadConnection(internal, orgId, provider);
  const caId = conn?.composio_connected_account_id;
  if (!caId) {
    return { ok: true as const, updated: false as const, reason: "no_connection" as const };
  }

  const client = createComposioClient(composioApiKey);
  let remote;
  try {
    remote = await client.connectedAccounts.retrieve(caId);
  } catch (e) {
    console.error("composio.connectedAccounts.retrieve", e);
    const err = new Error("Could not reach Composio") as Error & { status: number };
    err.status = 502;
    throw err;
  }

  const dbStatus = mapComposioConnectionStatus(remote.status);

  const prevMeta =
    typeof conn.metadata === "object" && conn.metadata !== null && !Array.isArray(conn.metadata)
      ? (conn.metadata as Record<string, unknown>)
      : {};
  const prevComposio =
    typeof prevMeta.composio === "object" && prevMeta.composio !== null && !Array.isArray(prevMeta.composio)
      ? (prevMeta.composio as Record<string, unknown>)
      : {};

  const { error } = await internal
    .from("crm_connections")
    .update({
      status: dbStatus,
      metadata: {
        ...prevMeta,
        composio: {
          ...prevComposio,
          last_retrieved_at: new Date().toISOString(),
          composio_status: remote.status,
          status_reason: remote.status_reason,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  if (error) {
    console.error("crm_connections finalize update", error);
    const err = new Error("Could not update connection") as Error & { status: number };
    err.status = 500;
    throw err;
  }

  return {
    ok: true as const,
    updated: true as const,
    composio_status: remote.status,
    connection_status: dbStatus,
  };
}

export async function disconnectKommo(
  internal: SupabaseClient,
  orgId: string,
  provider: string,
  roles: { role: string }[],
  composioApiKey: string,
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

  if (conn.composio_connected_account_id && composioApiKey) {
    try {
      const client = createComposioClient(composioApiKey);
      await client.connectedAccounts.delete(conn.composio_connected_account_id);
    } catch (e) {
      console.warn("composio.connectedAccounts.delete", e);
    }
  }

  const prev = normalizeConnectionMetadata(conn.metadata);
  const pc =
    typeof prev.composio === "object" && prev.composio !== null && !Array.isArray(prev.composio)
      ? (prev.composio as Record<string, unknown>)
      : {};
  const metadataPersist: Record<string, unknown> = {
    composio: {
      ...(typeof pc.auth_config_id === "string" ? { auth_config_id: pc.auth_config_id } : {}),
      ...(typeof pc.public_app_url === "string" ? { public_app_url: pc.public_app_url } : {}),
      ...(typeof pc.settings_saved_at === "string" ? { settings_saved_at: pc.settings_saved_at } : {}),
    },
  };
  if (
    typeof metadataPersist.composio === "object" &&
    metadataPersist.composio !== null &&
    Object.keys(metadataPersist.composio as object).length === 0
  ) {
    metadataPersist.composio = {};
  }

  const { error } = await internal
    .from("crm_connections")
    .update({
      composio_connected_account_id: null,
      status: "disconnected",
      metadata: metadataPersist,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  if (error) {
    console.error("crm_connections disconnect", error);
    const err = new Error("Could not update connection") as Error & { status: number };
    err.status = 500;
    throw err;
  }

  return { ok: true as const };
}
