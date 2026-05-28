"""Roteador principal do módulo Email Outreach.

Concentra todos os sub-routers para ser incluído no ``main.py`` do
backend com uma única linha:

    from email_outreach.router import router as email_outreach_router
    app.include_router(email_outreach_router)
"""
from __future__ import annotations

from fastapi import APIRouter

from email_outreach.api.campaign_inboxes import router as campaign_inboxes_router
from email_outreach.api.campaigns import router as campaigns_router
from email_outreach.api.inboxes import router as inboxes_router
from email_outreach.api.leads import campaign_leads_router, leads_router
from email_outreach.api.oauth import router as oauth_router
from email_outreach.api.sequence_steps import router as sequence_steps_router
from email_outreach.api.analytics import router as analytics_router
from email_outreach.api.sequencer import router as sequencer_router
from email_outreach.api.tracking import router as tracking_router

router = APIRouter()
router.include_router(inboxes_router)
router.include_router(oauth_router)
router.include_router(campaigns_router)
router.include_router(sequence_steps_router)
router.include_router(leads_router)
router.include_router(campaign_leads_router)
router.include_router(campaign_inboxes_router)
router.include_router(sequencer_router)
router.include_router(tracking_router)
router.include_router(analytics_router)


@router.get("/email/health", tags=["email-outreach:health"])
async def email_outreach_health() -> dict:
    """Healthcheck do módulo. Retorna status + features habilitadas."""
    import os

    return {
        "status": "ok",
        "module": "email_outreach",
        "version": "0.1.0",
        "features": {
            "gmail_oauth": bool(os.getenv("GOOGLE_OAUTH_CLIENT_ID")),
            "outlook_oauth": bool(os.getenv("MICROSOFT_OAUTH_CLIENT_ID")),
            "smtp": True,
            "encryption_key_configured": bool(os.getenv("EO_ENCRYPTION_KEY")),
        },
    }
