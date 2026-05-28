/** Tipos do módulo Email Outreach (front), espelhando o backend FastAPI. */

export type InboxProvider = "gmail" | "outlook" | "smtp" | "ses";
export type InboxStatus =
  | "active"
  | "paused"
  | "disconnected"
  | "warming"
  | "error";

export interface Inbox {
  id: string;
  org_id: string;
  provider: InboxProvider;
  email: string;
  display_name: string;
  status: InboxStatus;
  daily_limit: number;
  warmup_enabled: boolean;
  warmup_score: number;
  last_health_check_at: string | null;
  last_health_error: string | null;
  last_sent_at: string | null;
  oauth_expires_at: string | null;
  created_at: string;
  signature_name?: string | null;
  signature_role?: string | null;
  signature_company?: string | null;
  signature_phone?: string | null;
  signature_link?: string | null;
  signature_html?: string | null;
}

export interface SmtpInboxCreatePayload {
  org_id: string;
  email: string;
  display_name?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  imap_host: string;
  imap_port: number;
  imap_username?: string;
  imap_password?: string;
  daily_limit?: number;
}

export interface InboxUpdatePayload {
  display_name?: string;
  daily_limit?: number;
  status?: InboxStatus;
  warmup_enabled?: boolean;
  signature_name?: string;
  signature_role?: string;
  signature_company?: string;
  signature_phone?: string;
  signature_link?: string;
  signature_html?: string;
}

export interface OAuthStartResponse {
  authorization_url: string;
  state: string;
}

// ── Campaigns (E2 — Sprint 2) ───────────────────────────────────────────────

export type CampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "archived";

/** Janela de envio por dia da semana. Tupla [horaInicio, horaFim] inclusive. */
export type SendWindow = Partial<Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  [number, number]
>>;

export interface Campaign {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  timezone: string;
  send_window: SendWindow;
  stop_on_reply: boolean;
  stop_on_click: boolean;
  track_opens: boolean;
  track_clicks: boolean;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignCreatePayload {
  org_id: string;
  name: string;
  description?: string;
  timezone?: string;
  send_window?: SendWindow;
  stop_on_reply?: boolean;
  stop_on_click?: boolean;
  track_opens?: boolean;
  track_clicks?: boolean;
}

export interface CampaignUpdatePayload {
  name?: string;
  description?: string | null;
  status?: CampaignStatus;
  timezone?: string;
  send_window?: SendWindow;
  stop_on_reply?: boolean;
  stop_on_click?: boolean;
  track_opens?: boolean;
  track_clicks?: boolean;
}

// ── Sequence Steps (E2 — Brick B) ───────────────────────────────────────────

export interface SequenceStep {
  id: string;
  campaign_id: string;
  step_order: number;
  variant_label: string;
  delay_days: number;
  delay_hours: number;
  subject_template: string;
  body_template: string;
  is_reply_to_previous: boolean;
  weight: number;
  created_at: string;
  updated_at: string;
}

export interface SequenceStepCreatePayload {
  step_order?: number;
  variant_label?: string;
  delay_days?: number;
  delay_hours?: number;
  subject_template: string;
  body_template: string;
  is_reply_to_previous?: boolean;
  weight?: number;
}

export interface SequenceStepUpdatePayload {
  step_order?: number;
  variant_label?: string;
  delay_days?: number;
  delay_hours?: number;
  subject_template?: string;
  body_template?: string;
  is_reply_to_previous?: boolean;
  weight?: number;
}

// ── Leads (E2 — Brick C) ────────────────────────────────────────────────────

export type LeadStatus = "active" | "bounced" | "unsubscribed" | "suppressed";

export interface Lead {
  id: string;
  org_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  phone: string | null;
  linkedin_url: string | null;
  custom_fields: Record<string, unknown>;
  timezone: string | null;
  source: string;
  external_ref: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
}

export interface LeadCreatePayload {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  phone?: string;
  linkedin_url?: string;
  custom_fields?: Record<string, unknown>;
  timezone?: string;
  source?: string;
  external_ref?: string;
}

export interface LeadBulkImportPayload {
  source?: string;
  leads: Array<Partial<LeadCreatePayload> & { email: string }>;
}

export interface LeadBulkImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ── Campaign Leads / Enrollment (E2 — Brick C) ──────────────────────────────

export type CampaignLeadStatus =
  | "enrolled"
  | "paused"
  | "replied"
  | "bounced"
  | "unsubscribed"
  | "finished"
  | "failed";

export interface CampaignLead {
  id: string;
  campaign_id: string;
  lead_id: string;
  current_step: number;
  next_send_at: string | null;
  variant_assignment: Record<string, string>;
  status: CampaignLeadStatus;
  status_reason: string | null;
  enrolled_at: string;
  finished_at: string | null;
  paused_at: string | null;
  /** Denormalizado via JOIN no backend. */
  lead_email: string | null;
  lead_name: string | null;
  lead_company: string | null;
}

// ── Campaign Inboxes (E2 — Brick D) ─────────────────────────────────────────

export interface CampaignInbox {
  campaign_id: string;
  inbox_id: string;
  weight: number;
  added_at: string;
  /** Denormalizado via JOIN. */
  inbox_email: string | null;
  inbox_status: string | null;
  inbox_provider: string | null;
}

// ── Analytics (E2 — Brick G) ────────────────────────────────────────────────

export interface StepFunnel {
  step_order: number;
  variant_label: string | null;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

export interface TopLead {
  campaign_lead_id: string;
  email: string;
  name: string | null;
  company: string | null;
  status: string;
  current_step: number;
  sent_count: number;
  opens: number;
  clicks: number;
  replied: boolean;
  last_event_at: string | null;
}

export interface CampaignAnalytics {
  campaign_id: string;
  total_enrolled: number;
  active_enrollments: number;
  finished: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  messages_sent: number;
  messages_failed: number;
  messages_queued: number;
  unique_opens: number;
  total_opens: number;
  unique_clicks: number;
  total_clicks: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  bounce_rate: number;
  funnel: StepFunnel[];
  top_leads: TopLead[];
}
