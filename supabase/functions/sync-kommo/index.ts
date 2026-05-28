import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Sync Kommo → tabelas crm_* unificadas, via Composio.
 *
 * Substitui o job APScheduler do backend Python (que estava offline). Lê
 * credenciais per-tenant de crm_auditor_connections.credentials:
 *   - composio_api_key
 *   - composio_user_id
 *   - composio_connected_account_id (também na coluna dedicada)
 *   - composio_execute_base_url (default: https://backend.composio.dev/api/v3.1)
 *   - value_config (opcional, ditá como derivar opportunity_value)
 *
 * MVP: sincroniza pipelines + stages + loss_reasons + users + leads. Contatos,
 * empresas e tasks ficam fora desta primeira versão — leads é o que move o
 * dashboard.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  org_id: string;
}

interface KommoCredentials {
  composio_api_key?: string;
  composio_user_id?: string;
  composio_execute_base_url?: string;
}

interface ValueConfig {
  value_is_debt?: boolean;
  commission_pct?: number;
  fixed_fee?: number;
  opportunity_field_id?: string;
}

// Composio tool slugs (mesmos do composio_tool_map.py)
const T = {
  LIST_PIPELINES: "KOMMO_LIST_LEADS_PIPELINES",
  LIST_PIPELINE_STAGES: "KOMMO_LIST_PIPELINE_STAGES",
  LIST_USERS: "KOMMO_LIST_USERS",
  LIST_LEADS: "KOMMO_LIST_LEADS",
  LIST_LOSS_REASONS: "KOMMO_LIST_LOSS_REASONS",
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { org_id }: SyncRequest = await req.json();
    if (!org_id) return json({ error: "org_id obrigatório" }, 400);

    // Lê connection Kommo
    const { data: connRow, error: connErr } = await supabase
      .from("crm_auditor_connections")
      .select("id, credentials, composio_connected_account_id, value_config")
      .eq("tenant_id", org_id)
      .eq("provider", "kommo")
      .maybeSingle();
    if (connErr) return json({ error: `Falha ao ler connection: ${connErr.message}` }, 500);
    if (!connRow) return json({ error: "Sem connection Kommo pra essa org" }, 404);

    const creds = (connRow.credentials ?? {}) as KommoCredentials;
    const connectedAccountId = connRow.composio_connected_account_id as string | null;
    if (!creds.composio_api_key || !creds.composio_user_id || !connectedAccountId) {
      await markError(supabase, org_id, "Credenciais Composio incompletas (composio_api_key/composio_user_id/composio_connected_account_id).");
      return json({ error: "Credenciais Composio incompletas" }, 400);
    }
    const valueConfig = (connRow.value_config ?? {}) as ValueConfig;
    const baseUrl = (creds.composio_execute_base_url ?? "https://backend.composio.dev/api/v3.1").replace(/\/+$/, "");

    const exec = async (slug: string, args: Record<string, unknown>): Promise<unknown> => {
      const resp = await fetch(`${baseUrl}/tools/execute/${slug}`, {
        method: "POST",
        headers: {
          "x-api-key": creds.composio_api_key!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connected_account_id: connectedAccountId,
          user_id: creds.composio_user_id,
          arguments: args,
        }),
      });
      const text = await resp.text();
      let payload: Record<string, unknown>;
      try { payload = text ? JSON.parse(text) : {}; }
      catch { throw new Error(`Composio resposta inválida (HTTP ${resp.status}): ${text.slice(0, 200)}`); }
      if (resp.status >= 400) throw new Error(`Composio HTTP ${resp.status}: ${text.slice(0, 300)}`);
      if (payload.successful === false) throw new Error(`Composio falhou: ${JSON.stringify(payload.message ?? payload).slice(0, 300)}`);
      const err = payload.error;
      if (err) {
        const msg = typeof err === "object" && err !== null
          ? (err as { message?: string; slug?: string }).message ?? (err as { slug?: string }).slug ?? JSON.stringify(err)
          : String(err);
        throw new Error(`Composio: ${msg}`.slice(0, 300));
      }
      return parseInner(payload.data);
    };

    const paginate = async (
      slug: string,
      baseArgs: Record<string, unknown>,
      embeddedKey: string,
      maxPages = 999,
    ): Promise<Record<string, unknown>[]> => {
      const all: Record<string, unknown>[] = [];
      let page = 1;
      const limit = 250;
      while (page <= maxPages) {
        const data = await exec(slug, { ...baseArgs, page, limit });
        const chunk = extractEmbeddedList(data, embeddedKey);
        if (chunk.length === 0) break;
        all.push(...chunk);
        if (chunk.length < limit) break;
        page += 1;
      }
      return all;
    };

    // ── Sync pipelines ───────────────────────────────────────────────────
    const pipelinesRaw = await paginate(T.LIST_PIPELINES, {}, "pipelines");
    const pipelineRows = pipelinesRaw.map((p) => ({
      tenant_id: org_id,
      external_id: String(p.id),
      name: String(p.name ?? "").slice(0, 500),
      is_active: p.is_active !== false,
    }));

    // ── Sync stages (extrai do _embedded das pipelines, fallback p/ API)
    const stagesByExternalId = new Map<string, "won" | "lost" | "progress">();
    const stageRows: Array<Record<string, unknown>> = [];
    for (const p of pipelinesRaw) {
      const pid = p.id;
      if (pid == null) continue;
      // deno-lint-ignore no-explicit-any
      const embedded = (p._embedded as any)?.statuses;
      let stages: Record<string, unknown>[] = [];
      if (Array.isArray(embedded) && embedded.length > 0) {
        stages = embedded.filter((x): x is Record<string, unknown> => typeof x === "object");
      } else {
        const raw = await exec(T.LIST_PIPELINE_STAGES, { pipeline_id: Number(pid) });
        stages = extractEmbeddedList(raw, "statuses");
        if (stages.length === 0) stages = extractEmbeddedList(raw, "items");
      }
      for (const s of stages) {
        const sid = String(s.id);
        const typeNum = Number(s.type ?? 0);
        // Kommo: type 1 = won, type 2 = lost
        const stageType: "won" | "lost" | "progress" =
          typeNum === 1 ? "won" : typeNum === 2 ? "lost" : "progress";
        stagesByExternalId.set(sid, stageType);
        stageRows.push({
          tenant_id: org_id,
          external_id: sid,
          pipeline_external_id: String(pid),
          name: String(s.name ?? "").slice(0, 500),
          sort_order: Number(s.sort ?? 0),
          stage_type: stageType,
        });
      }
    }

    // ── Sync loss reasons (catálogo) ─────────────────────────────────────
    const lossRaw = await paginate(T.LIST_LOSS_REASONS, {}, "loss_reasons").catch(() => []);
    const lossByExternalId = new Map<string, string>();
    for (const lr of lossRaw) {
      if (lr.id != null) lossByExternalId.set(String(lr.id), String(lr.name ?? ""));
    }

    // ── Sync users (mínimo p/ owner lookup) ──────────────────────────────
    const usersRaw = await paginate(T.LIST_USERS, {}, "users").catch(() => []);
    const userRows = usersRaw.map((u) => ({
      tenant_id: org_id,
      external_id: String(u.id),
      name: String(u.name ?? "").slice(0, 500),
      email: u.email != null ? String(u.email) : null,
      is_active: u.is_deleted !== true,
    }));

    // ── Sync leads (paginado) ────────────────────────────────────────────
    const leadsRaw = await paginate(T.LIST_LEADS, { with_params: ["contacts"] }, "leads");
    const syncedAt = new Date().toISOString();
    const leadRows = leadsRaw.map((raw) => mapLeadRow(raw, org_id, stagesByExternalId, lossByExternalId, valueConfig, syncedAt));

    // ── Upserts em batch ─────────────────────────────────────────────────
    const upsert = async (table: string, rows: Record<string, unknown>[], onConflict: string) => {
      if (rows.length === 0) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from(table).upsert(rows, { onConflict });
      if (error) throw new Error(`upsert ${table}: ${error.message}`);
    };

    if (pipelineRows.length > 0) await upsert("crm_pipelines", pipelineRows, "tenant_id,external_id");
    if (stageRows.length > 0)    await upsert("crm_stages",    stageRows,    "tenant_id,pipeline_external_id,external_id");
    if (userRows.length > 0)     await upsert("crm_users",     userRows,     "tenant_id,external_id");
    if (leadRows.length > 0)     await upsert("crm_leads",     leadRows,     "tenant_id,external_id");

    // Status final
    await supabase
      .from("crm_auditor_connections")
      .update({
        sync_status: "success",
        sync_error: null,
        last_sync_at: syncedAt,
      })
      .eq("tenant_id", org_id)
      .eq("provider", "kommo");

    return json({
      success: true,
      synced: {
        pipelines: pipelineRows.length,
        stages: stageRows.length,
        users: userRows.length,
        leads: leadRows.length,
        loss_reasons: lossByExternalId.size,
      },
      last_sync_at: syncedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("sync-kommo error:", msg);
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const body = await req.clone().json().catch(() => ({}));
      if (body.org_id) await markError(sb, body.org_id, msg);
    } catch { /* swallow */ }
    return json({ success: false, error: msg }, 500);
  }
});

function parseInner(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try { return JSON.parse(trimmed); } catch { return trimmed; }
  }
  return raw;
}

function extractEmbeddedList(payload: unknown, key: string): Record<string, unknown>[] {
  if (payload == null) return [];
  if (Array.isArray(payload)) {
    return payload.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
  }
  if (typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const embedded = obj._embedded as Record<string, unknown> | undefined;
  if (embedded && Array.isArray(embedded[key])) {
    return (embedded[key] as unknown[]).filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
  }
  if (Array.isArray(obj[key])) {
    return (obj[key] as unknown[]).filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
  }
  // payload pode ser um único item (id no topo)
  if (obj.id != null) return [obj];
  return [];
}

function inferLeadStatus(raw: Record<string, unknown>, stages: Map<string, "won" | "lost" | "progress">): "open" | "won" | "lost" {
  const closedAt = raw.closed_at;
  const isClosed = closedAt != null && closedAt !== 0 && closedAt !== "0" && closedAt !== "";
  const statusId = String(raw.status_id ?? "");
  const stype = stages.get(statusId);
  if (isClosed) {
    if (stype === "won") return "won";
    return "lost";
  }
  return "open";
}

function computeOpportunityValue(raw: Record<string, unknown>, cfg: ValueConfig): number | null {
  if (!cfg || Object.keys(cfg).length === 0) return null;
  if (cfg.opportunity_field_id) {
    const cfs = (raw.custom_fields_values as Array<Record<string, unknown>> | undefined) ?? [];
    for (const cf of cfs) {
      if (String(cf.field_id) === String(cfg.opportunity_field_id)) {
        const vals = (cf.values as Array<Record<string, unknown>> | undefined) ?? [];
        if (vals.length > 0) {
          const v = parseFloat(String(vals[0].value ?? 0));
          return isNaN(v) ? 0 : v;
        }
      }
    }
    return 0;
  }
  const price = parseFloat(String(raw.price ?? 0)) || 0;
  if (cfg.value_is_debt) {
    const pct = cfg.commission_pct ?? 0;
    const fixed = cfg.fixed_fee ?? 0;
    return Math.round((price * pct + fixed) * 100) / 100;
  }
  return null;
}

function tsToIso(value: unknown): string | null {
  if (value == null || value === 0 || value === "0" || value === "") return null;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (isNaN(n)) return null;
  // Kommo retorna epoch em segundos
  return new Date(n * 1000).toISOString();
}

function leadPrimaryContactId(raw: Record<string, unknown>): string | null {
  // deno-lint-ignore no-explicit-any
  const embedded = raw._embedded as any;
  const contacts = embedded?.contacts;
  if (Array.isArray(contacts) && contacts.length > 0) {
    const cid = contacts[0]?.id;
    if (cid != null) return String(cid);
  }
  return null;
}

function mapLeadRow(
  raw: Record<string, unknown>,
  tenantId: string,
  stagesByExternalId: Map<string, "won" | "lost" | "progress">,
  lossByExternalId: Map<string, string>,
  valueConfig: ValueConfig,
  syncedAt: string,
): Record<string, unknown> {
  const statusId = raw.status_id != null ? String(raw.status_id) : null;
  const lossReasonId = raw.loss_reason_id;
  let lostReason: string | null = null;
  if (lossReasonId != null) {
    lostReason = lossByExternalId.get(String(lossReasonId)) ?? null;
  }
  return {
    tenant_id: tenantId,
    external_id: String(raw.id),
    name: String(raw.name ?? "").slice(0, 500),
    pipeline_external_id: raw.pipeline_id != null ? String(raw.pipeline_id) : null,
    stage_external_id: statusId,
    lead_status: inferLeadStatus(raw, stagesByExternalId),
    value: parseFloat(String(raw.price ?? 0)) || 0,
    opportunity_value: computeOpportunityValue(raw, valueConfig),
    currency: null,
    owner_external_id: raw.responsible_user_id != null ? String(raw.responsible_user_id) : null,
    contact_external_id: leadPrimaryContactId(raw),
    company_external_id: null,
    created_at: tsToIso(raw.created_at),
    external_updated_at: tsToIso(raw.updated_at),
    closed_at: tsToIso(raw.closed_at),
    lost_reason: lostReason,
    raw,
    synced_at: syncedAt,
  };
}

async function markError(supabase: ReturnType<typeof createClient>, orgId: string, msg: string): Promise<void> {
  await supabase
    .from("crm_auditor_connections")
    .update({ sync_status: "error", sync_error: msg.slice(0, 1000) })
    .eq("tenant_id", orgId)
    .eq("provider", "kommo");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
