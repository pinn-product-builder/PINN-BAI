"""Métricas de campanhas WhatsApp (passa pelo Mari Brain get_campaign).

Endpoint dedicado pra a UI consultar separado das ações.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from whatsapp_outreach.core.mari_client import (
    MariClientError,
    analytics_dashboard as mari_analytics_dashboard,
    get_campaign as mari_get_campaign,
)
from whatsapp_outreach.models import CampaignStats

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp",
                    tags=["whatsapp-outreach:analytics"])


@router.get("/campaigns/{campaign_id}/analytics", response_model=CampaignStats)
def campaign_analytics(campaign_id: int) -> CampaignStats:
    try:
        data = mari_get_campaign(campaign_id)
    except MariClientError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail="campaign not found")
        raise HTTPException(status_code=502, detail=f"mari upstream: {e}")
    stats = data.get("stats", {}) if isinstance(data, dict) else {}
    return CampaignStats(**stats)


@router.get("/analytics/dashboard")
def analytics_dashboard(days: int = 30) -> dict:
    """Métricas agregadas pro dashboard "Pinn WhatsApp" (tab no Pinn SDR).

    Payload contém: overview, timeseries, by_campaign, by_touch,
    by_instance, recent. Documentado no endpoint do Mari Brain.
    """
    try:
        return mari_analytics_dashboard(days=days)
    except MariClientError as e:
        raise HTTPException(status_code=502, detail=f"mari upstream: {e}")
