"""CRUD de templates de outbound — proxy pro Mari Brain."""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException

from whatsapp_outreach.core.mari_client import (
    MariClientError,
    create_template as mari_create_template,
    delete_template as mari_delete_template,
    list_templates as mari_list_templates,
    update_template as mari_update_template,
)
from whatsapp_outreach.models import (
    OutboundTemplateCreate,
    OutboundTemplateOut,
    OutboundTemplateUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp",
                    tags=["whatsapp-outreach:templates"])


@router.get("/campaigns/{campaign_id}/templates",
              response_model=list[OutboundTemplateOut])
def list_templates(campaign_id: int,
                     touch_index: Optional[int] = None,
                     active_only: bool = False) -> list[OutboundTemplateOut]:
    try:
        rows = mari_list_templates(campaign_id, touch_index=touch_index,
                                       active_only=active_only)
    except MariClientError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail="campaign not found")
        raise HTTPException(status_code=502, detail=f"mari upstream: {e}")
    return [OutboundTemplateOut(**r) for r in rows]


@router.post("/campaigns/{campaign_id}/templates",
                response_model=OutboundTemplateOut, status_code=201)
def create_template(campaign_id: int,
                       body: OutboundTemplateCreate) -> OutboundTemplateOut:
    try:
        row = mari_create_template(campaign_id, body.model_dump())
    except MariClientError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail="campaign not found")
        raise HTTPException(status_code=502, detail=f"mari upstream: {e}")
    return OutboundTemplateOut(**row)


@router.patch("/templates/{template_id}",
                 response_model=OutboundTemplateOut)
def update_template(template_id: int,
                       body: OutboundTemplateUpdate) -> OutboundTemplateOut:
    patch = body.model_dump(exclude_unset=True, exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="empty patch")
    try:
        row = mari_update_template(template_id, patch)
    except MariClientError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail="template not found")
        raise HTTPException(status_code=502, detail=f"mari upstream: {e}")
    return OutboundTemplateOut(**row)


@router.delete("/templates/{template_id}")
def delete_template(template_id: int) -> dict:
    try:
        return mari_delete_template(template_id)
    except MariClientError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail="template not found")
        raise HTTPException(status_code=502, detail=f"mari upstream: {e}")
