"""Rotas de inboxes vinculadas a uma campanha (E2 — Brick D).

Rotação ponderada — quanto maior o weight, mais vezes essa inbox aparece
no scheduler. Default 1 = uniforme.

- GET    /email/campaigns/{cid}/inboxes                → lista
- POST   /email/campaigns/{cid}/inboxes                → anexa inbox
- PATCH  /email/campaigns/{cid}/inboxes/{inbox_id}     → muda weight
- DELETE /email/campaigns/{cid}/inboxes/{inbox_id}     → remove
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response

from core.db import get_db
from email_outreach.models import CampaignInboxAttach, CampaignInboxOut, CampaignInboxUpdate

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/email/campaigns/{campaign_id}/inboxes",
    tags=["email-outreach:campaign-inboxes"],
)


def _to_out(row: dict[str, Any]) -> CampaignInboxOut:
    inbox = row.get("eo_inboxes") if isinstance(row.get("eo_inboxes"), dict) else {}
    return CampaignInboxOut(
        campaign_id=row["campaign_id"],
        inbox_id=row["inbox_id"],
        weight=row["weight"],
        added_at=row["added_at"],
        inbox_email=(inbox or {}).get("email"),
        inbox_status=(inbox or {}).get("status"),
        inbox_provider=(inbox or {}).get("provider"),
    )


@router.get("", response_model=list[CampaignInboxOut])
async def list_campaign_inboxes(campaign_id: str) -> list[CampaignInboxOut]:
    db = await get_db()
    res = await (
        db.table("eo_campaign_inboxes")
        .select("campaign_id, inbox_id, weight, added_at, eo_inboxes(email, status, provider)")
        .eq("campaign_id", campaign_id)
        .order("added_at")
        .execute()
    )
    return [_to_out(row) for row in (res.data or [])]


@router.post("", response_model=CampaignInboxOut, status_code=status.HTTP_201_CREATED)
async def attach_inbox(campaign_id: str, body: CampaignInboxAttach) -> CampaignInboxOut:
    db = await get_db()
    try:
        await db.table("eo_campaign_inboxes").upsert(
            {"campaign_id": campaign_id, "inbox_id": body.inbox_id, "weight": body.weight},
            on_conflict="campaign_id,inbox_id",
        ).execute()
    except Exception as exc:
        logger.exception("Falha ao anexar inbox à campanha")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    res = await (
        db.table("eo_campaign_inboxes")
        .select("campaign_id, inbox_id, weight, added_at, eo_inboxes(email, status, provider)")
        .eq("campaign_id", campaign_id)
        .eq("inbox_id", body.inbox_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Inbox anexada mas linha não retornada.")
    return _to_out(rows[0])


@router.patch("/{inbox_id}", response_model=CampaignInboxOut)
async def update_campaign_inbox(
    campaign_id: str, inbox_id: str, body: CampaignInboxUpdate
) -> CampaignInboxOut:
    db = await get_db()
    upd = await (
        db.table("eo_campaign_inboxes")
        .update({"weight": body.weight})
        .eq("campaign_id", campaign_id)
        .eq("inbox_id", inbox_id)
        .execute()
    )
    if not (upd.data or []):
        raise HTTPException(status_code=404, detail="Vínculo não encontrado.")

    res = await (
        db.table("eo_campaign_inboxes")
        .select("campaign_id, inbox_id, weight, added_at, eo_inboxes(email, status, provider)")
        .eq("campaign_id", campaign_id)
        .eq("inbox_id", inbox_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado após update.")
    return _to_out(rows[0])


@router.delete(
    "/{inbox_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response
)
async def detach_inbox(campaign_id: str, inbox_id: str) -> Response:
    db = await get_db()
    await (
        db.table("eo_campaign_inboxes")
        .delete()
        .eq("campaign_id", campaign_id)
        .eq("inbox_id", inbox_id)
        .execute()
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
