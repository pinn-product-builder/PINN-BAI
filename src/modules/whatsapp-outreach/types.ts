/** Tipos do módulo WhatsApp Outreach — espelham backend FastAPI proxy → Mari Brain. */

export type CampaignStatus = "draft" | "active" | "paused" | "done";

export interface SendWindow {
  weekdays: number[];     // 1=seg, 7=dom
  start_hour: number;     // 0-23
  end_hour: number;
  tz: string;             // "America/Sao_Paulo"
}

export interface WhatsAppCampaign {
  id: number;
  name: string;
  status: CampaignStatus;
  cadence_days: number[];
  icp_description: string | null;
  value_prop: string | null;
  system_prompt: string | null;
  instances: string[];
  instance: string;
  instance_rotation: boolean;
  daily_cap: number | null;
  daily_cap_per_instance: number;
  send_window: SendWindow | null;
  min_interval_seconds: number | null;
  max_interval_seconds: number | null;
  leads_enrolled: number;
  leads_responded: number;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
}

export type InstanceHealth = "green" | "yellow" | "red";

export interface EvolutionInstance {
  name: string;
  status: string;           // open | close | qr | unknown
  messages_today: number;
  cap_daily: number;
  health: InstanceHealth;
}

export interface CampaignStats {
  total: number;
  sent: number;
  responded: number;
  failed: number;
}

export interface CampaignWithStats {
  campaign: WhatsAppCampaign;
  stats: CampaignStats;
}

export interface CampaignCreatePayload {
  name: string;
  status?: CampaignStatus;
  cadence_days?: number[];
  icp_description?: string;
  value_prop?: string;
  system_prompt?: string;
  instances?: string[];
  instance?: string;
  instance_rotation?: boolean;
  daily_cap?: number;
  daily_cap_per_instance?: number;
  send_window?: SendWindow;
  min_interval_seconds?: number;
  max_interval_seconds?: number;
  created_by?: string;
}

export interface CampaignUpdatePayload {
  name?: string;
  status?: CampaignStatus;
  cadence_days?: number[];
  icp_description?: string;
  value_prop?: string;
  system_prompt?: string;
  instances?: string[];
  instance_rotation?: boolean;
  daily_cap?: number;
  daily_cap_per_instance?: number;
  send_window?: SendWindow;
  min_interval_seconds?: number;
  max_interval_seconds?: number;
}

// ─────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────

export interface OutboundTemplate {
  id: number;
  campaign_id: number;
  touch_index: number;
  body: string;
  vars: string[];
  ab_weight: number;
  active: boolean;
  version: number;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TemplateCreatePayload {
  touch_index: number;
  body: string;
  vars?: string[];
  ab_weight?: number;
  active?: boolean;
  notes?: string;
}

export interface TemplateUpdatePayload {
  body?: string;
  vars?: string[];
  ab_weight?: number;
  active?: boolean;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Enroll
// ─────────────────────────────────────────────────────────────────────

export interface LeadEnrollIn {
  phone: string;   // E.164 sem '+' (ex: 5531999999999)
  nome?: string;
  empresa?: string;
  cargo?: string;
  email?: string;
  extra?: Record<string, unknown>;
}

export interface EnrollPayload {
  leads: LeadEnrollIn[];
  start_at_iso?: string;
}

export interface EnrollResult {
  enrolled: number;
  skipped: number;
  errors: Array<{ phone?: string; error: string }>;
  campaign_id: number;
}

// ─────────────────────────────────────────────────────────────────────
// Analytics dashboard
// ─────────────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  total_sent: number;
  total_responded: number;
  total_scheduled: number;
  reply_rate_pct: number;
}

export interface AnalyticsTimeseriesPoint {
  day: string;
  sent: number;
  responded: number;
}

export interface AnalyticsCampaignRow {
  id: number;
  name: string;
  status: CampaignStatus;
  sent: number;
  responded: number;
  leads_enrolled: number;
  reply_rate_pct: number;
}

export interface AnalyticsTouchRow {
  touch_index: number;
  sent: number;
  responded: number;
  reply_rate_pct: number;
}

export interface AnalyticsInstanceRow {
  instance: string;
  sent: number;
  responded: number;
  reply_rate_pct: number;
}

export interface AnalyticsRecentRow {
  id: number;
  phone: string;
  instance: string;
  touch_index: number;
  campaign_name: string;
  status: string;
  sent_at: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// Lead-por-lead (acompanhamento da campanha)
// ─────────────────────────────────────────────────────────────────────

export interface CampaignLeadRow {
  phone: string;
  instance: string;
  phase: string;                  // prospecting / qualifying / scheduled / lost / ...
  nome: string | null;
  empresa: string | null;
  cargo: string | null;
  email: string | null;
  touches: number;
  sent_count: number;
  responded_count: number;
  failed_count: number;
  last_sent_at: string | null;
  last_touch_index: number | null;
  last_reply_at: string | null;
  next_action_at: string | null;
  next_action: string | null;
}

export interface CampaignLeadsPage {
  campaign_id: number;
  total: number;
  offset: number;
  limit: number;
  leads: CampaignLeadRow[];
}

export interface AnalyticsDashboard {
  period_days: number;
  overview: AnalyticsOverview;
  timeseries: AnalyticsTimeseriesPoint[];
  by_campaign: AnalyticsCampaignRow[];
  by_touch: AnalyticsTouchRow[];
  by_instance: AnalyticsInstanceRow[];
  recent: AnalyticsRecentRow[];
}
