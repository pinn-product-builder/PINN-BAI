"""DTOs Pydantic do módulo Email Outreach.

Mantemos os DTOs separados das rows do banco (eles divergem: nunca
expomos ``oauth_tokens_enc`` na API, por exemplo).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field

InboxProvider = Literal["gmail", "outlook", "smtp", "ses"]
InboxStatus = Literal["active", "paused", "disconnected", "warming", "error"]


# ── Inboxes ──────────────────────────────────────────────────────────────────

class InboxOut(BaseModel):
    """Inbox sem segredos — seguro para retornar na API."""

    id: str
    org_id: str
    provider: InboxProvider
    email: str
    display_name: str
    status: InboxStatus
    daily_limit: int
    warmup_enabled: bool
    warmup_score: float
    last_health_check_at: datetime | None = None
    last_health_error: str | None = None
    last_sent_at: datetime | None = None
    oauth_expires_at: datetime | None = None
    created_at: datetime
    # Assinatura usada no rodapé dos emails (templating Pinn Smart).
    signature_name: str | None = None
    signature_role: str | None = None
    signature_company: str | None = None
    signature_phone: str | None = None
    signature_link: str | None = None
    signature_html: str | None = None


class SmtpInboxCreate(BaseModel):
    """Criação manual de inbox SMTP/IMAP (sem OAuth)."""

    org_id: str
    email: EmailStr
    display_name: str = ""
    smtp_host: str
    smtp_port: int = Field(..., ge=1, le=65535)
    smtp_username: str
    smtp_password: str
    imap_host: str
    imap_port: int = Field(587, ge=1, le=65535)
    imap_username: str | None = None
    imap_password: str | None = None
    daily_limit: int = Field(50, ge=1, le=2000)


class InboxUpdate(BaseModel):
    display_name: str | None = None
    daily_limit: int | None = Field(None, ge=1, le=2000)
    status: InboxStatus | None = None
    warmup_enabled: bool | None = None
    # Assinatura — qualquer campo pode ser atualizado isoladamente. Use
    # string vazia ("") para limpar um valor já preenchido.
    signature_name: str | None = Field(None, max_length=120)
    signature_role: str | None = Field(None, max_length=120)
    signature_company: str | None = Field(None, max_length=120)
    signature_phone: str | None = Field(None, max_length=60)
    signature_link: str | None = Field(None, max_length=500)
    signature_html: str | None = Field(None, max_length=4000)


# ── OAuth ────────────────────────────────────────────────────────────────────

class OAuthStartResponse(BaseModel):
    """URL pra qual a UI deve abrir popup/redirect."""

    authorization_url: str
    state: str


class OAuthCallbackResult(BaseModel):
    ok: bool
    inbox: InboxOut | None = None
    error: str | None = None


# ── Health ───────────────────────────────────────────────────────────────────

class InboxHealthReport(BaseModel):
    inbox_id: str
    email: str
    ok: bool
    detail: str | None = None
    checked_at: datetime


# ── Campaigns (E2 — Sprint 2) ────────────────────────────────────────────────

CampaignStatus = Literal["draft", "active", "paused", "completed", "archived"]

DEFAULT_SEND_WINDOW: dict[str, list[int]] = {
    "mon": [9, 18],
    "tue": [9, 18],
    "wed": [9, 18],
    "thu": [9, 18],
    "fri": [9, 17],
}


class CampaignOut(BaseModel):
    id: str
    org_id: str
    name: str
    description: str | None = None
    status: CampaignStatus
    timezone: str
    send_window: dict[str, Any]
    stop_on_reply: bool
    stop_on_click: bool
    track_opens: bool
    track_clicks: bool
    activated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CampaignCreate(BaseModel):
    """Payload mínimo para criar uma campanha. Status sempre começa em ``draft``."""

    org_id: str
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    timezone: str = "America/Sao_Paulo"
    send_window: dict[str, Any] | None = None  # se ``None``, usa DEFAULT_SEND_WINDOW
    stop_on_reply: bool = True
    stop_on_click: bool = False
    track_opens: bool = True
    track_clicks: bool = True


class CampaignUpdate(BaseModel):
    """Patch parcial. Qualquer campo ``None`` é ignorado."""

    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    status: CampaignStatus | None = None
    timezone: str | None = None
    send_window: dict[str, Any] | None = None
    stop_on_reply: bool | None = None
    stop_on_click: bool | None = None
    track_opens: bool | None = None
    track_clicks: bool | None = None


# ── Sequence Steps (E2 — Brick B) ───────────────────────────────────────────


class SequenceStepOut(BaseModel):
    id: str
    campaign_id: str
    step_order: int
    variant_label: str
    delay_days: int
    delay_hours: int
    subject_template: str
    body_template: str
    is_reply_to_previous: bool
    weight: int
    created_at: datetime
    updated_at: datetime


class SequenceStepCreate(BaseModel):
    """Cria um step. ``step_order`` é alocado automaticamente se não informado
    (próximo número disponível para essa campanha)."""

    step_order: int | None = Field(None, ge=1)
    variant_label: str = Field("A", min_length=1, max_length=10)
    delay_days: int = Field(0, ge=0)
    delay_hours: int = Field(0, ge=0)
    subject_template: str = Field(..., min_length=1)
    body_template: str = Field(..., min_length=1)
    is_reply_to_previous: bool = True
    weight: int = Field(1, ge=1, le=10)


class SequenceStepUpdate(BaseModel):
    step_order: int | None = Field(None, ge=1)
    variant_label: str | None = Field(None, min_length=1, max_length=10)
    delay_days: int | None = Field(None, ge=0)
    delay_hours: int | None = Field(None, ge=0)
    subject_template: str | None = Field(None, min_length=1)
    body_template: str | None = Field(None, min_length=1)
    is_reply_to_previous: bool | None = None
    weight: int | None = Field(None, ge=1, le=10)


# ── Leads (E2 — Brick C) ────────────────────────────────────────────────────

LeadStatus = Literal["active", "bounced", "unsubscribed", "suppressed"]
LeadSource = Literal["manual", "csv_import", "api", "ploomes", "google_sheets"]


class LeadOut(BaseModel):
    id: str
    org_id: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    company: str | None = None
    title: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    custom_fields: dict[str, Any]
    timezone: str | None = None
    source: str
    external_ref: str | None = None
    status: LeadStatus
    created_at: datetime
    updated_at: datetime


class LeadCreate(BaseModel):
    org_id: str
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    company: str | None = None
    title: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    custom_fields: dict[str, Any] = Field(default_factory=dict)
    timezone: str | None = None
    source: str = "manual"
    external_ref: str | None = None


class LeadUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    company: str | None = None
    title: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    custom_fields: dict[str, Any] | None = None
    timezone: str | None = None
    status: LeadStatus | None = None


class LeadBulkImport(BaseModel):
    """Importa lote de leads. Dedup por (org_id, email) — duplicatas viram update."""

    org_id: str
    source: str = "csv_import"
    leads: list[dict[str, Any]] = Field(..., min_length=1, max_length=5000)


class LeadBulkImportResult(BaseModel):
    inserted: int
    updated: int
    skipped: int
    errors: list[str] = Field(default_factory=list)


# ── Campaign Leads / Enrollment (E2 — Brick C) ──────────────────────────────


CampaignLeadStatus = Literal[
    "enrolled", "paused", "replied", "bounced", "unsubscribed", "finished", "failed"
]


class CampaignLeadOut(BaseModel):
    id: str
    campaign_id: str
    lead_id: str
    current_step: int
    next_send_at: datetime | None = None
    variant_assignment: dict[str, Any]
    status: CampaignLeadStatus
    status_reason: str | None = None
    enrolled_at: datetime
    finished_at: datetime | None = None
    paused_at: datetime | None = None
    # Joined (denormalizado p/ UI):
    lead_email: str | None = None
    lead_name: str | None = None
    lead_company: str | None = None


class EnrollLeadsPayload(BaseModel):
    """Inscreve N leads em uma campanha (idempotente — dedup por (campaign_id, lead_id))."""

    lead_ids: list[str] = Field(..., min_length=1, max_length=5000)


# ── Campaign Inboxes (E2 — Brick D) ─────────────────────────────────────────


class CampaignInboxOut(BaseModel):
    campaign_id: str
    inbox_id: str
    weight: int
    added_at: datetime
    # Joined:
    inbox_email: str | None = None
    inbox_status: str | None = None
    inbox_provider: str | None = None


class CampaignInboxAttach(BaseModel):
    inbox_id: str
    weight: int = Field(1, ge=1, le=10)


class CampaignInboxUpdate(BaseModel):
    weight: int = Field(..., ge=1, le=10)


# ── Analytics (E2 — Brick G) ────────────────────────────────────────────────


class StepFunnel(BaseModel):
    step_order: int
    variant_label: str | None = None
    sent: int
    opened: int  # unique recipients
    clicked: int
    replied: int
    bounced: int


class TopLead(BaseModel):
    campaign_lead_id: str
    email: str
    name: str | None = None
    company: str | None = None
    status: str
    current_step: int
    sent_count: int
    opens: int
    clicks: int
    replied: bool
    last_event_at: datetime | None = None


class CampaignAnalytics(BaseModel):
    campaign_id: str
    # Enrollments
    total_enrolled: int
    active_enrollments: int
    finished: int
    replied: int
    bounced: int
    unsubscribed: int
    # Messages
    messages_sent: int
    messages_failed: int
    messages_queued: int
    # Events (unique recipients vs total events)
    unique_opens: int
    total_opens: int
    unique_clicks: int
    total_clicks: int
    # Derived rates (0-100 floats)
    open_rate: float
    click_rate: float
    reply_rate: float
    bounce_rate: float
    # Breakdown
    funnel: list[StepFunnel]
    top_leads: list[TopLead]
