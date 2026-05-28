/** Cliente HTTP do módulo Email Outreach — talks to backend FastAPI. */

import type {
  Campaign,
  CampaignAnalytics,
  CampaignCreatePayload,
  CampaignInbox,
  CampaignLead,
  CampaignUpdatePayload,
  Inbox,
  InboxUpdatePayload,
  Lead,
  LeadBulkImportPayload,
  LeadBulkImportResult,
  LeadCreatePayload,
  OAuthStartResponse,
  SequenceStep,
  SequenceStepCreatePayload,
  SequenceStepUpdatePayload,
  SmtpInboxCreatePayload,
} from "./types";

// Em dev, o proxy do Vite (vite.config.ts) encaminha /email, /crm, etc.
// pro backend Python local (default 127.0.0.1:8000).
// Em prod, o Nginx do docker-compose faz o mesmo proxy no mesmo domínio.
// Override via VITE_BACKEND_URL apenas se o backend estiver em outro host.
const BACKEND = (import.meta.env.VITE_BACKEND_URL ?? "") as string;

/** Fetch wrapper que lança em erro HTTP e parseia JSON. */
async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let detail: string;
    try {
      const body = (await res.json()) as { detail?: string };
      detail = body.detail ?? `HTTP ${res.status}`;
    } catch {
      detail = `HTTP ${res.status}`;
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Inboxes ──────────────────────────────────────────────────────────────────

export const eoApi = {
  listInboxes(orgId: string) {
    return http<Inbox[]>(`/email/inboxes?org_id=${encodeURIComponent(orgId)}`);
  },

  createSmtpInbox(payload: SmtpInboxCreatePayload) {
    return http<Inbox>("/email/inboxes/smtp", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateInbox(inboxId: string, patch: InboxUpdatePayload) {
    return http<Inbox>(`/email/inboxes/${inboxId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  deleteInbox(inboxId: string) {
    return http<void>(`/email/inboxes/${inboxId}`, { method: "DELETE" });
  },

  healthcheckInbox(inboxId: string) {
    return http<Inbox>(`/email/inboxes/${inboxId}/healthcheck`, {
      method: "POST",
    });
  },

  startGoogleOAuth(orgId: string, userId?: string) {
    const qs = new URLSearchParams({ org_id: orgId });
    if (userId) qs.set("user_id", userId);
    return http<OAuthStartResponse>(`/email/oauth/google/start?${qs}`);
  },

  // ── Campaigns (E2 — Brick A) ────────────────────────────────────────────
  listCampaigns(orgId: string) {
    return http<Campaign[]>(`/email/campaigns?org_id=${encodeURIComponent(orgId)}`);
  },

  getCampaign(campaignId: string) {
    return http<Campaign>(`/email/campaigns/${encodeURIComponent(campaignId)}`);
  },

  createCampaign(payload: CampaignCreatePayload) {
    return http<Campaign>("/email/campaigns", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateCampaign(campaignId: string, patch: CampaignUpdatePayload) {
    return http<Campaign>(`/email/campaigns/${encodeURIComponent(campaignId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  deleteCampaign(campaignId: string) {
    return http<void>(`/email/campaigns/${encodeURIComponent(campaignId)}`, {
      method: "DELETE",
    });
  },

  // ── Sequence Steps (E2 — Brick B) ──────────────────────────────────────
  listSteps(campaignId: string) {
    return http<SequenceStep[]>(`/email/campaigns/${encodeURIComponent(campaignId)}/steps`);
  },

  createStep(campaignId: string, payload: SequenceStepCreatePayload) {
    return http<SequenceStep>(`/email/campaigns/${encodeURIComponent(campaignId)}/steps`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateStep(campaignId: string, stepId: string, patch: SequenceStepUpdatePayload) {
    return http<SequenceStep>(
      `/email/campaigns/${encodeURIComponent(campaignId)}/steps/${encodeURIComponent(stepId)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
  },

  deleteStep(campaignId: string, stepId: string) {
    return http<void>(
      `/email/campaigns/${encodeURIComponent(campaignId)}/steps/${encodeURIComponent(stepId)}`,
      { method: "DELETE" },
    );
  },

  // ── Leads (E2 — Brick C) ───────────────────────────────────────────────
  listLeads(orgId: string, params?: { status?: string; limit?: number }) {
    const qs = new URLSearchParams({ org_id: orgId });
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    return http<Lead[]>(`/email/leads?${qs}`);
  },

  createLead(orgId: string, payload: LeadCreatePayload) {
    return http<Lead>(`/email/leads`, {
      method: "POST",
      body: JSON.stringify({ ...payload, org_id: orgId }),
    });
  },

  bulkImportLeads(orgId: string, payload: LeadBulkImportPayload) {
    return http<LeadBulkImportResult>(`/email/leads/bulk-import`, {
      method: "POST",
      body: JSON.stringify({ ...payload, org_id: orgId }),
    });
  },

  deleteLead(leadId: string) {
    return http<void>(`/email/leads/${encodeURIComponent(leadId)}`, { method: "DELETE" });
  },

  // Enrollment
  listCampaignLeads(campaignId: string, limit = 500) {
    return http<CampaignLead[]>(
      `/email/campaigns/${encodeURIComponent(campaignId)}/leads?limit=${limit}`,
    );
  },

  enrollLeads(campaignId: string, leadIds: string[]) {
    return http<CampaignLead[]>(
      `/email/campaigns/${encodeURIComponent(campaignId)}/leads/enroll`,
      { method: "POST", body: JSON.stringify({ lead_ids: leadIds }) },
    );
  },

  unenrollLead(campaignId: string, campaignLeadId: string) {
    return http<void>(
      `/email/campaigns/${encodeURIComponent(campaignId)}/leads/${encodeURIComponent(campaignLeadId)}`,
      { method: "DELETE" },
    );
  },

  // ── Campaign Inboxes (E2 — Brick D) ────────────────────────────────────
  listCampaignInboxes(campaignId: string) {
    return http<CampaignInbox[]>(`/email/campaigns/${encodeURIComponent(campaignId)}/inboxes`);
  },

  attachInbox(campaignId: string, inboxId: string, weight = 1) {
    return http<CampaignInbox>(
      `/email/campaigns/${encodeURIComponent(campaignId)}/inboxes`,
      { method: "POST", body: JSON.stringify({ inbox_id: inboxId, weight }) },
    );
  },

  updateCampaignInbox(campaignId: string, inboxId: string, weight: number) {
    return http<CampaignInbox>(
      `/email/campaigns/${encodeURIComponent(campaignId)}/inboxes/${encodeURIComponent(inboxId)}`,
      { method: "PATCH", body: JSON.stringify({ weight }) },
    );
  },

  detachInbox(campaignId: string, inboxId: string) {
    return http<void>(
      `/email/campaigns/${encodeURIComponent(campaignId)}/inboxes/${encodeURIComponent(inboxId)}`,
      { method: "DELETE" },
    );
  },

  // ── Analytics (E2 — Brick G) ───────────────────────────────────────────
  getCampaignAnalytics(campaignId: string) {
    return http<CampaignAnalytics>(
      `/email/campaigns/${encodeURIComponent(campaignId)}/analytics`,
    );
  },

  // ── Sequencer manual trigger ───────────────────────────────────────────
  tickSequencer() {
    return http<{ enrolled: number; sent: number; failed: number; total: number }>(
      "/email/sequencer/tick",
      { method: "POST" },
    );
  },

  /** Resolve com o resultado postado pelo popup OAuth. */
  openOAuthPopup(authorizationUrl: string): Promise<{
    ok: boolean;
    error?: string;
    inbox?: { id: string; email: string };
  }> {
    return new Promise((resolve) => {
      const width = 500;
      const height = 640;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;
      const popup = window.open(
        authorizationUrl,
        "eo-oauth",
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
      );
      if (!popup) {
        resolve({ ok: false, error: "Popup bloqueado pelo navegador." });
        return;
      }

      const onMessage = (ev: MessageEvent) => {
        if (typeof ev.data !== "object" || ev.data === null) return;
        const t = (ev.data as { type?: string }).type;
        if (t !== "eo:oauth:success" && t !== "eo:oauth:error") return;
        window.removeEventListener("message", onMessage);
        clearInterval(closedTimer);
        const result = (ev.data as { result?: Record<string, unknown> }).result ?? {};
        resolve({
          ok: t === "eo:oauth:success",
          error: typeof result.error === "string" ? result.error : undefined,
          inbox: result.inbox as { id: string; email: string } | undefined,
        });
      };
      window.addEventListener("message", onMessage);

      const closedTimer = window.setInterval(() => {
        if (popup.closed) {
          window.removeEventListener("message", onMessage);
          clearInterval(closedTimer);
          resolve({ ok: false, error: "Popup fechado antes de concluir." });
        }
      }, 500);
    });
  },
};
