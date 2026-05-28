"""Pydantic DTOs do módulo WhatsApp Outreach.

Espelham as estruturas do Mari Brain (mari_outbound_campaigns,
mari_outbound_templates, mari_outbound_dispatch_log) — mas vivem
no BAI pra desacoplar contratos da UI.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ════════════════════════════════════════════════════════════════
# Campaigns
# ════════════════════════════════════════════════════════════════

class SendWindow(BaseModel):
    weekdays: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5])
    start_hour: int = 9
    end_hour: int = 18
    tz: str = "America/Sao_Paulo"


class WhatsAppCampaignBase(BaseModel):
    name: str
    cadence_days: list[int] = Field(default_factory=lambda: [0, 2, 5, 9])
    icp_description: Optional[str] = None
    value_prop: Optional[str] = None
    system_prompt: Optional[str] = None
    instances: list[str] = Field(default_factory=list)
    instance: str = "PINN SDR OUTBOUND - ATIVA"
    instance_rotation: bool = False
    daily_cap: Optional[int] = None
    daily_cap_per_instance: int = 30
    send_window: Optional[SendWindow] = None


class WhatsAppCampaignCreate(WhatsAppCampaignBase):
    status: str = "draft"
    created_by: Optional[str] = None


class WhatsAppCampaignUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    cadence_days: Optional[list[int]] = None
    icp_description: Optional[str] = None
    value_prop: Optional[str] = None
    system_prompt: Optional[str] = None
    instances: Optional[list[str]] = None
    instance_rotation: Optional[bool] = None
    daily_cap: Optional[int] = None
    daily_cap_per_instance: Optional[int] = None
    send_window: Optional[SendWindow] = None


class WhatsAppCampaignOut(WhatsAppCampaignBase):
    id: int
    status: str
    leads_enrolled: int = 0
    leads_responded: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None


class CampaignWithStatsOut(BaseModel):
    campaign: WhatsAppCampaignOut
    stats: dict[str, int] = Field(default_factory=dict)


# ════════════════════════════════════════════════════════════════
# Templates
# ════════════════════════════════════════════════════════════════

class OutboundTemplateCreate(BaseModel):
    touch_index: int = Field(..., ge=0, le=20)
    body: str
    vars: list[str] = Field(default_factory=list)
    ab_weight: int = Field(default=1, ge=1, le=100)
    active: bool = True
    notes: Optional[str] = None


class OutboundTemplateUpdate(BaseModel):
    body: Optional[str] = None
    vars: Optional[list[str]] = None
    ab_weight: Optional[int] = Field(default=None, ge=1, le=100)
    active: Optional[bool] = None
    notes: Optional[str] = None


class OutboundTemplateOut(BaseModel):
    id: int
    campaign_id: int
    touch_index: int
    body: str
    vars: list[str] = Field(default_factory=list)
    ab_weight: int = 1
    active: bool = True
    version: int = 1
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ════════════════════════════════════════════════════════════════
# Leads / Enrollment
# ════════════════════════════════════════════════════════════════

class LeadEnrollIn(BaseModel):
    phone: str  # E.164 sem '+' (ex: 5531999999999)
    nome: Optional[str] = None
    empresa: Optional[str] = None
    cargo: Optional[str] = None
    email: Optional[str] = None
    extra: Optional[dict[str, Any]] = None


class EnrollPayload(BaseModel):
    leads: list[LeadEnrollIn]
    start_at_iso: Optional[str] = None


class EnrollResult(BaseModel):
    enrolled: int
    skipped: int
    errors: list[dict[str, Any]] = Field(default_factory=list)
    campaign_id: int


# ════════════════════════════════════════════════════════════════
# Analytics
# ════════════════════════════════════════════════════════════════

class CampaignStats(BaseModel):
    total: int = 0
    sent: int = 0
    responded: int = 0
    failed: int = 0
