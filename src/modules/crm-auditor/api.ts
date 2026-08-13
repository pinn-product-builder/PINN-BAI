/**
 * API do módulo Auditor CRM.
 *
 * Dois backends distintos:
 *  1. Edge API do auditor (`/api/crm-auditor/*`) — status, overview, sync,
 *     autenticada com o access_token da sessão Supabase (invokeCrmAuditor).
 *  2. Backend legado de conexões (`/crm/connections`) — salvar credenciais e
 *     disparar a primeira sync do Kommo/others por token direto.
 *
 * Reconstruído a partir do bundle de produção (dist/assets/index-*.js,
 * build de 05/jul/2026); tipos derivados dos consumidores.
 */
import { supabase } from "@/integrations/supabase/client";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface CrmConnectionSummary {
  status: "disconnected" | "pending" | "connected" | "error" | string;
  provider?: string;
  connected_at?: string | null;
  last_sync_at?: string | null;
}

export interface CrmAuditorSyncRun {
  status: string;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
}

export interface CrmAuditorComposioKommoSetup {
  auth_config_id?: string | null;
  public_app_url?: string | null;
  auth_config_source?: "tenant" | "environment" | null | string;
  ready_to_connect?: boolean;
}

export interface CrmAuditorStatusResponse {
  provider: string;
  integration_mode: "live" | "mock" | string;
  connection: CrmConnectionSummary | null;
  latest_snapshot: { metrics?: Record<string, unknown> } | null;
  latest_sync_run: CrmAuditorSyncRun | null;
  composio_kommo?: CrmAuditorComposioKommoSetup;
}

export interface CrmAuditorOverviewResponse {
  has_data?: boolean;
  metrics?: Record<string, unknown>;
}

// ── Edge API do auditor ──────────────────────────────────────────────────────

function apiBase(): string {
  const base: string = import.meta.env?.VITE_CRM_AUDITOR_API_BASE ?? "";
  return base.trim();
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

const ACTIONS: Record<string, { method: "GET" | "POST"; path: string }> = {
  status: { method: "GET", path: "/api/crm-auditor/status" },
  overview: { method: "GET", path: "/api/crm-auditor/overview" },
  "sync-runs": { method: "GET", path: "/api/crm-auditor/sync-runs" },
  sync: { method: "POST", path: "/api/crm-auditor/sync" },
  "disconnect-kommo": { method: "POST", path: "/api/crm-auditor/connections/kommo/disconnect" },
  // ⚠️ path derivado do padrão das demais actions — não constava no bundle antigo.
  "save-composio-kommo": { method: "POST", path: "/api/crm-auditor/save-composio-kommo" },
};

export async function invokeCrmAuditor<T>(
  orgId: string,
  action: keyof typeof ACTIONS | string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const headers = await authHeaders();
  const base = apiBase();
  const def = ACTIONS[action];
  if (!def) throw new Error(`Ação desconhecida do Auditor CRM: "${action}"`);
  const query = `orgId=${encodeURIComponent(orgId)}`;
  const url = def.method === "GET" ? `${base}${def.path}?${query}` : `${base}${def.path}`;
  const res = await fetch(url, {
    method: def.method,
    headers,
    body: def.method === "POST" ? JSON.stringify({ orgId, ...(payload ?? {}) }) : undefined,
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const message =
      json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : res.statusText || "Erro na API";
    throw new Error(message);
  }
  if (json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string") {
    throw new Error((json as { error: string }).error);
  }
  return json as T;
}

// ── Backend legado de conexões (token direto) ────────────────────────────────

function connectionsBackendBase(): string {
  const base: string = (import.meta.env?.VITE_BACKEND_URL ?? "").trim();
  return base ? base.replace(/\/$/, "") : "https://bai.srv879715.hstgr.cloud";
}

/**
 * Conexão Kommo por token direto: salva a conexão e dispara a sync inicial.
 */
export async function connectKommoDirect(
  orgId: string,
  creds: { subdomain: string; access_token: string },
): Promise<void> {
  const base = connectionsBackendBase();
  const res = await fetch(`${base}/crm/connections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenant_id: orgId,
      provider: "kommo",
      display_name: "default",
      auth_via: "direct",
      credentials: { subdomain: creds.subdomain, access_token: creds.access_token },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err && (err.error || err.detail)) || "Falha ao conectar o Kommo. Verifique subdomínio e token.",
    );
  }
  const syncRes = await fetch(`${base}/crm/kommo/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: orgId }),
  });
  if (!syncRes.ok) {
    const err = await syncRes.json().catch(() => ({}));
    throw new Error(
      (err && (err.error || err.detail)) ||
        "Conexão salva, mas a sincronização inicial falhou. Tente sincronizar novamente.",
    );
  }
}

/**
 * Salva a conexão de qualquer provider suportado (token direto, sem OAuth).
 * Usado pelo wizard de onboarding — o form vem de PROVIDERS (providers.ts).
 */
export async function connectProviderDirect(
  orgId: string,
  provider: string,
  credentials: Record<string, string>,
): Promise<void> {
  const res = await fetch(`${connectionsBackendBase()}/crm/connections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenant_id: orgId,
      provider,
      display_name: "default",
      auth_via: "direct",
      credentials,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err && (err.error || err.detail)) || "Falha ao conectar. Verifique as credenciais.");
  }
}

/**
 * Dispara a edge `sync-<provider>` e retorna as contagens sincronizadas
 * (pipelines/stages/leads/contacts/users) para exibição no wizard.
 */
export async function runProviderSync(orgId: string, provider: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke(`sync-${provider}`, { body: { org_id: orgId } });
  if (error) throw new Error(error.message || "Falha na sincronização.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = data as any;
  if (result?.success === false) throw new Error(result?.error || "Falha na sincronização.");
  return result?.synced ?? result?.stats ?? result ?? {};
}
