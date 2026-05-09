import { supabase } from "@/integrations/supabase/client";

export type CrmAuditorPath =
  | "status"
  | "overview"
  | "sync"
  | "sync-runs"
  | "save-composio-kommo"
  | "connect-kommo"
  | "finalize-kommo"
  | "disconnect-kommo";

/** Resposta do fluxo Composio Link (OAuth Kommo) — igual ao app original via Composio. */
export interface ConnectKommoResponse {
  redirect_url: string;
  connected_account_id: string;
  callback_url: string;
}

export interface CrmConnectionSummary {
  status: string;
  last_sync_at: string | null;
  has_composio_account: boolean;
}

export interface CrmAuditorComposioKommoSetup {
  auth_config_id: string | null;
  auth_config_source: "tenant" | "environment" | "missing";
  ready_to_connect: boolean;
  public_app_url: string | null;
}

export interface CrmAuditorStatusResponse {
  provider: string;
  connection: CrmConnectionSummary | null;
  composio_kommo: CrmAuditorComposioKommoSetup;
  latest_sync_run: {
    id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    error_message: string | null;
    stats: Record<string, unknown> | null;
  } | null;
  latest_snapshot: {
    id: string;
    captured_at: string;
    metrics: Record<string, unknown>;
    sync_run_id: string | null;
  } | null;
  integration_mode: "live" | "mock";
}

export interface CrmAuditorOverviewResponse {
  metrics: Record<string, unknown>;
  captured_at: string | null;
  has_data: boolean;
}

/** Base da API HTTP (VPS). Em dev, deixe vazio e use o proxy do Vite (`/api` → servidor local). */
function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();
  return raw ? raw.replace(/\/$/, "") : "";
}

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

const ROUTES: Record<CrmAuditorPath, { method: "GET" | "POST"; path: string }> = {
  status: { method: "GET", path: "/api/crm-auditor/status" },
  overview: { method: "GET", path: "/api/crm-auditor/overview" },
  "sync-runs": { method: "GET", path: "/api/crm-auditor/sync-runs" },
  sync: { method: "POST", path: "/api/crm-auditor/sync" },
  "save-composio-kommo": { method: "POST", path: "/api/crm-auditor/settings/composio-kommo" },
  "connect-kommo": { method: "POST", path: "/api/crm-auditor/connections/kommo/connect" },
  "finalize-kommo": { method: "POST", path: "/api/crm-auditor/connections/kommo/finalize" },
  "disconnect-kommo": { method: "POST", path: "/api/crm-auditor/connections/kommo/disconnect" },
};

export async function invokeCrmAuditor<T>(
  orgId: string,
  path: CrmAuditorPath,
  bodyExtra?: Record<string, unknown>,
): Promise<T> {
  const headers = await authHeaders();
  const base = apiBase();
  const route = ROUTES[path];
  const qs = `orgId=${encodeURIComponent(orgId)}`;
  const url =
    route.method === "GET"
      ? `${base}${route.path}?${qs}`
      : `${base}${route.path}`;

  const res = await fetch(url, {
    method: route.method,
    headers,
    body:
      route.method === "POST"
        ? JSON.stringify({ orgId, ...(bodyExtra ?? {}) })
        : undefined,
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const msg =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : res.statusText || "Erro na API";
    throw new Error(msg);
  }

  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "string"
  ) {
    throw new Error((body as { error: string }).error);
  }

  return body as T;
}
