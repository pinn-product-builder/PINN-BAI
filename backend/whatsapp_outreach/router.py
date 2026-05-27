"""Roteador raiz do módulo WhatsApp Outreach.

Monta todos os sub-routers e expõe `GET /whatsapp/health` pra smoke check.
"""
from __future__ import annotations

from fastapi import APIRouter

from whatsapp_outreach.api.analytics import router as analytics_router
from whatsapp_outreach.api.campaigns import router as campaigns_router
from whatsapp_outreach.api.enroll import router as enroll_router
from whatsapp_outreach.api.instances import router as instances_router
from whatsapp_outreach.api.templates import router as templates_router
from whatsapp_outreach.core.mari_client import (
    MARI_API_BASE,
    MARI_API_TOKEN,
    MariClientError,
    _request,
)

router = APIRouter()
router.include_router(campaigns_router)
router.include_router(templates_router)
router.include_router(enroll_router)
router.include_router(analytics_router)
router.include_router(instances_router)


@router.get("/whatsapp/health", tags=["whatsapp-outreach:health"])
def whatsapp_health() -> dict:
    """Verifica que o módulo carregou + Mari Brain está alcançável."""
    out: dict = {
        "module": "whatsapp_outreach",
        "mari_base": MARI_API_BASE,
        "mari_token_set": bool(MARI_API_TOKEN),
        "mari_reachable": False,
    }
    try:
        _request("GET", "/health", timeout=5.0)
        out["mari_reachable"] = True
    except MariClientError as e:
        out["mari_error"] = str(e)
    return out
