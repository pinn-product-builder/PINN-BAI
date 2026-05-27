"""Enrollment de leads em campanhas — proxy pro Mari Brain."""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from whatsapp_outreach.core.mari_client import (
    MariClientError,
    enroll_leads as mari_enroll_leads,
)
from whatsapp_outreach.models import EnrollPayload, EnrollResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp",
                    tags=["whatsapp-outreach:enroll"])


@router.post("/campaigns/{campaign_id}/enroll", response_model=EnrollResult)
def enroll_leads(campaign_id: int, body: EnrollPayload) -> EnrollResult:
    """Enfileira leads numa campanha. Mari Brain valida que existem templates
    pra todos os touches da cadência antes de aceitar.
    """
    leads_payload = [lead.model_dump(exclude_none=True) for lead in body.leads]
    try:
        result = mari_enroll_leads(
            campaign_id,
            leads_payload,
            start_at_iso=body.start_at_iso,
        )
    except MariClientError as e:
        if e.status_code == 400:
            # Validações do brain (sem templates, campaign não ativa, etc)
            raise HTTPException(status_code=400, detail=e.body or str(e))
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail="campaign not found")
        logger.error("mari enroll_leads failed: %s", e)
        raise HTTPException(status_code=502, detail=f"mari upstream: {e}")
    return EnrollResult(**result)
