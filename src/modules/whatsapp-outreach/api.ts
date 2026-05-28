/** Cliente HTTP do módulo WhatsApp Outreach → backend FastAPI proxy. */

import type {
  AnalyticsDashboard,
  CampaignCreatePayload,
  CampaignStats,
  CampaignUpdatePayload,
  CampaignWithStats,
  EnrollPayload,
  EnrollResult,
  EvolutionInstance,
  OutboundTemplate,
  TemplateCreatePayload,
  TemplateUpdatePayload,
  WhatsAppCampaign,
} from "./types";

const BACKEND = (import.meta.env.VITE_BACKEND_URL ?? "") as string;

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

export const waApi = {
  // ── Instances (Evolution) ───────────────────────────────────────
  listInstances() {
    return http<EvolutionInstance[]>("/whatsapp/instances");
  },

  // ── Campaigns ───────────────────────────────────────────────────
  listCampaigns() {
    return http<WhatsAppCampaign[]>("/whatsapp/campaigns");
  },
  getCampaign(campaignId: number) {
    return http<CampaignWithStats>(`/whatsapp/campaigns/${campaignId}`);
  },
  createCampaign(payload: CampaignCreatePayload) {
    return http<WhatsAppCampaign>("/whatsapp/campaigns", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateCampaign(campaignId: number, patch: CampaignUpdatePayload) {
    return http<WhatsAppCampaign>(`/whatsapp/campaigns/${campaignId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  // ── Templates ───────────────────────────────────────────────────
  listTemplates(campaignId: number, opts?: { touchIndex?: number; activeOnly?: boolean }) {
    const params = new URLSearchParams();
    if (opts?.touchIndex !== undefined) params.set("touch_index", String(opts.touchIndex));
    if (opts?.activeOnly) params.set("active_only", "true");
    const q = params.toString();
    return http<OutboundTemplate[]>(
      `/whatsapp/campaigns/${campaignId}/templates${q ? `?${q}` : ""}`
    );
  },
  createTemplate(campaignId: number, payload: TemplateCreatePayload) {
    return http<OutboundTemplate>(`/whatsapp/campaigns/${campaignId}/templates`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateTemplate(templateId: number, patch: TemplateUpdatePayload) {
    return http<OutboundTemplate>(`/whatsapp/templates/${templateId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  deleteTemplate(templateId: number) {
    return http<{ ok: boolean; template_id: number; soft_deleted: boolean }>(
      `/whatsapp/templates/${templateId}`,
      { method: "DELETE" }
    );
  },

  // ── Enroll ──────────────────────────────────────────────────────
  enrollLeads(campaignId: number, payload: EnrollPayload) {
    return http<EnrollResult>(`/whatsapp/campaigns/${campaignId}/enroll`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ── Analytics ───────────────────────────────────────────────────
  getAnalytics(campaignId: number) {
    return http<CampaignStats>(`/whatsapp/campaigns/${campaignId}/analytics`);
  },
  getDashboard(days: number = 30) {
    return http<AnalyticsDashboard>(`/whatsapp/analytics/dashboard?days=${days}`);
  },
};
