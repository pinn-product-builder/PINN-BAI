import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Sync Kommo → tabelas crm_* unificadas.
 *
 * Autenticação por token direto: `crm_auditor_connections.credentials` deve ter
 * { subdomain, access_token } (Long-Lived Token) → bate em /api/v4 direto.
 * (Composio foi removido do sistema.)
 *
 * MVP: sincroniza pipelines + stages + loss_reasons + users + leads. Contatos,
 * empresas e tasks ficam fora — leads é o que move o dashboard.
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
  subdomain?: string;
  access_token?: string;
}

interface ValueConfig {
  value_is_debt?: boolean;
  commission_pct?: number;
  fixed_fee?: number;
  opportunity_field_id?: string;
}

// Endpoint logical names.
const T = {
  LIST_PIPELINES: "LIST_PIPELINES",
  LIST_PIPELINE_STAGES: "LIST_PIPELINE_STAGES",
  LIST_USERS: "LIST_USERS",
  LIST_LEADS: "LIST_LEADS",
  LIST_LOSS_REASONS: "LIST_LOSS_REASONS",
} as const;

type ToolName = keyof typeof T;

// Mapeamento Kommo API v4.
function directEndpoint(tool: ToolName, args: Record<string, unknown>): string {
  switch (tool) {
    case "LIST_PIPELINES":       return "/api/v4/leads/pipelines";
    case "LIST_PIPELINE_STAGES": return `/api/v4/leads/pipelines/${args.pipeline_id}/statuses`;
    case "LIST_USERS":           return "/api/v4/users";
    case "LIST_LEADS":           return "/api/v4/leads";
    case "LIST_LOSS_REASONS":    return "/api/v4/leads/loss_reasons";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { org_id }: SyncRequest = await req.json();
    if (!org_id) return json({ error: "org_id obrigatório" }, 400);

    // SEM requireOrgAccess aqui: o pg_cron (sync_all_crm_connections, migration
    // 20260522150000) chama esta function SEM Authorization. Fechar exige antes
    // guardar a service_role key no Vault e enviá-la no net.http_post do cron.
    // Risco aceito: só dispara sync (idempotente), não retorna dados de lead.

    // Lê connection Kommo
    const { data: connRow, error: connErr } = await supabase
      .from("crm_auditor_connections")
      .select("id, credentials, value_config")
      .eq("tenant_id", org_id)
      .eq("provider", "kommo")
      .maybeSingle();
    if (connErr) return json({ error: `Falha ao ler connection: ${connErr.message}` }, 500);
    if (!connRow) return json({ error: "Sem connection Kommo pra essa org" }, 404);

    const creds = (connRow.credentials ?? {}) as KommoCredentials;
    const valueConfig = (connRow.value_config ?? {}) as ValueConfig;

    // Token direto é o único modo suportado.
    if (!creds.subdomain || !creds.access_token) {
      const missing = !creds.subdomain && !creds.access_token
        ? "subdomain + access_token"
        : !creds.subdomain ? "subdomain" : "access_token";
      throw new Error(`Credenciais Kommo incompletas: faltando ${missing}.`);
    }

    const exec = makeDirectExec(creds.subdomain, creds.access_token);

    const paginate = async (
      tool: ToolName,
      baseArgs: Record<string, unknown>,
      embeddedKey: string,
      maxPages = 999,
    ): Promise<Record<string, unknown>[]> => {
      const all: Record<string, unknown>[] = [];
      let page = 1;
      const limit = 250;
      while (page <= maxPages) {
        const data = await exec(tool, { ...baseArgs, page, limit });
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
        const stagesRaw = await exec(T.LIST_PIPELINE_STAGES, { pipeline_id: Number(pid) });
        stages = extractEmbeddedList(stagesRaw, "statuses");
        if (stages.length === 0) stages = extractEmbeddedList(stagesRaw, "items");
      }
      for (const s of stages) {
        const sid = String(s.id);
        // Kommo reserva IDs FIXOS p/ os terminais, em todo pipeline/conta:
        // 142 = ganho (won), 143 = perdido (lost). O campo `type` NÃO indica
        // won/lost (type=1 é "Incoming leads"/entrada) — casa pelo ID reservado.
        const stageType: "won" | "lost" | "progress" =
          sid === "142" ? "won" : sid === "143" ? "lost" : "progress";
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
    const leadsRaw = await paginate(T.LIST_LEADS, { with_params: ["contacts"], order: { updated_at: "desc" } }, "leads");
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

    // ── Reconciliação (delete-missing): a sync é autoritativa. Apaga o que NÃO
    // voltou da API (lead removido no Kommo, lixo de syncs antigas/mock) → contagem
    // fica exata, não só crescente. Guard: só reconcilia se a API trouxe algo.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reconcile = async (table: string, keyCol: string, fetchedIds: string[]) => {
      if (fetchedIds.length === 0) return;
      const fetched = new Set(fetchedIds.map(String));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any).from(table).select(keyCol).eq("tenant_id", org_id);
      const stale = (existing ?? [])
        .map((r: Record<string, unknown>) => String(r[keyCol]))
        .filter((id: string) => !fetched.has(id));
      for (let i = 0; i < stale.length; i += 100) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from(table).delete().eq("tenant_id", org_id).in(keyCol, stale.slice(i, i + 100));
      }
    };
    await reconcile("crm_leads", "external_id", leadRows.map((r) => String(r.external_id)));
    await reconcile("crm_pipelines", "external_id", pipelineRows.map((r) => String(r.external_id)));

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

type ExecFn = (tool: ToolName, args: Record<string, unknown>) => Promise<unknown>;

function makeDirectExec(subdomain: string, accessToken: string): ExecFn {
  const cleanSubdomain = subdomain.trim().replace(/^https?:\/\//, "").replace(/\.kommo\.com.*$/i, "");
  const baseUrl = `https://${cleanSubdomain}.kommo.com`;
  return async (tool, args) => {
    const path = directEndpoint(tool, args);
    const url = new URL(baseUrl + path);
    // Pagina + limit + with via query string. Mapeamento:
    //  - page → page; limit → limit; with_params → with (CSV)
    if (args.page) url.searchParams.set("page", String(args.page));
    if (args.limit) url.searchParams.set("limit", String(args.limit));
    if (Array.isArray(args.with_params)) {
      url.searchParams.set("with", (args.with_params as string[]).join(","));
    }
    // Ordenação Kommo v4: order[updated_at]=desc → puxa a fatia mais fresca 1º.
    if (args.order && typeof args.order === "object") {
      for (const [k, v] of Object.entries(args.order as Record<string, string>)) {
        url.searchParams.set(`order[${k}]`, String(v));
      }
    }
    // Incremental (opcional): só leads atualizados após o watermark (epoch s).
    if (args.updated_after != null) {
      url.searchParams.set("filter[updated_at][from]", String(args.updated_after));
    }
    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    // 204 = empty page (Kommo retorna pra última página +1)
    if (resp.status === 204) return {};
    const text = await resp.text();
    if (resp.status === 401 || resp.status === 403) {
      // Mensagem amigável: o problema é credencial, não o sistema.
      throw new Error(
        "Token Kommo inválido ou expirado. Verifique o access_token (Long-Lived Token) " +
        "e o subdomínio no painel do Kommo (Configurações → Integrações). " +
        `Kommo respondeu ${resp.status}.`,
      );
    }
    if (resp.status >= 400) {
      throw new Error(`Kommo API ${tool} HTTP ${resp.status}: ${text.slice(0, 300)}`);
    }
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Kommo API ${tool} resposta inválida: ${text.slice(0, 200)}`);
    }
  };
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
