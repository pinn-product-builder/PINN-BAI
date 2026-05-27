"""Lista instâncias Evolution conectadas + health.

Proxy fino pro Mari Brain (/outbound/instances).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from whatsapp_outreach.core.mari_client import (
    MariClientError,
    list_instances as mari_list_instances,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp",
                    tags=["whatsapp-outreach:instances"])


class InstanceOut(BaseModel):
    name: str
    status: str
    messages_today: int
    cap_daily: int
    health: str  # green | yellow | red


@router.get("/instances", response_model=list[InstanceOut])
def list_instances() -> list[InstanceOut]:
    """Lista instâncias Evolution disponíveis pra usar em campanhas.

    Inclui health badge: green (<50% cap), yellow (>50%), red (>100% ou offline).
    UI mostra como chips selecionáveis na criação de campanha.
    """
    try:
        rows = mari_list_instances()
    except MariClientError as e:
        logger.error("mari list_instances failed: %s", e)
        raise HTTPException(status_code=502, detail=f"mari upstream: {e}")
    return [InstanceOut(**r) for r in rows]
