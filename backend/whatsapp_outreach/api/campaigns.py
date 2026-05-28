"""CRUD de campanhas WhatsApp — proxy fino pro Mari Brain."""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from whatsapp_outreach.core.mari_client import (
    MariClientError,
    create_campaign as mari_create_campaign,
    get_campaign as mari_get_campaign,
    list_campaigns as mari_list_campaigns,
    update_campaign as mari_update_campaign,
)
from whatsapp_outreach.models import (
    CampaignWithStatsOut,
    WhatsAppCampaignCreate,
    WhatsAppCampaignOut,
    WhatsAppCampaignUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp/campaigns",
                    tags=["whatsapp-outreach:campaigns"])


@router.get("", response_model=list[WhatsAppCampaignOut])
def list_campaigns() -> list[WhatsAppCampaignOut]:
    try:
        rows = mari_list_campaigns()
    except MariClientError as e:
        logger.error("mari list_campaigns failed: %s", e)
        raise HTTPException(status_code=502, detail=f"mari upstream: {e}")
    return [WhatsAppCampaignOut(**r) for r in rows]


@router.post("", response_model=WhatsAppCampaignOut, status_code=201)
def create_campaign(body: WhatsAppCampaignCreate) -> WhatsAppCampaignOut:
    try:
        row = mari_create_campaign(body.model_dump(exclude_unset=False))
    except MariClientError as e:
        logger.error("mari create_campaign failed: %s (body=%s)", e, e.body)
        raise HTTPException(status_code=502, detail=f"mari upstream: {e}")
    return WhatsAppCampaignOut(**row)


@router.get("/{campaign_id}", response_model=CampaignWithStatsOut)
def get_campaign(campaign_id: int) -> CampaignWithStatsOut:
    try:
        data = mari_get_campaign(campaign_id)
    except MariClientError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail="campaign not found")
        raise HTTPException(status_code=502, detail=f"mari upstream: {e}")
    return CampaignWithStatsOut(
        campaign=WhatsAppCampaignOut(**data["campaign"]),
        stats=data.get("stats", {}),
    )


@router.patch("/{campaign_id}", response_model=WhatsAppCampaignOut)
def update_campaign(campaign_id: int,
                       body: WhatsAppCampaignUpdate) -> WhatsAppCampaignOut:
    patch = body.model_dump(exclude_unset=True, exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="empty patch")
    try:
        row = mari_update_campaign(campaign_id, patch)
    except MariClientError as e:
        raise HTTPException(status_code=502, detail=f"mari upstream: {e}")
    return WhatsAppCampaignOut(**row)
