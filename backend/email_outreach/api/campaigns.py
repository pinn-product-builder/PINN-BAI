"""Rotas CRUD de campanhas (E2 — Sprint 2 / Brick A).

Fluxos:
- GET    /email/campaigns?org_id=X            → lista campanhas da org
- POST   /email/campaigns                     → cria campanha (status=draft)
- GET    /email/campaigns/{campaign_id}       → detalhe
- PATCH  /email/campaigns/{campaign_id}       → editar
- DELETE /email/campaigns/{campaign_id}       → remover

Sequence steps, leads, enrollments e dispatch ficam em sub-rotas próprias
(``api/sequence_steps.py``, ``api/leads.py``, etc — próximos bricks).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response

from core.db import get_db
from email_outreach.models import (
    DEFAULT_SEND_WINDOW,
    CampaignCreate,
    CampaignOut,
    CampaignUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email/campaigns", tags=["email-outreach:campaigns"])


_CAMPAIGN_COLUMNS = (
    "id, org_id, name, description, status, timezone, send_window, "
    "stop_on_reply, stop_on_click, track_opens, track_clicks, "
    "activated_at, created_at, updated_at"
)


def _to_campaign_out(row: dict[str, Any]) -> CampaignOut:
    return CampaignOut.model_validate(row)


# ── Listagem ─────────────────────────────────────────────────────────────────


@router.get("", response_model=list[CampaignOut])
async def list_campaigns(
    org_id: str = Query(..., description="UUID da organização"),
) -> list[CampaignOut]:
    db = await get_db()
    res = await (
        db.table("eo_campaigns")
        .select(_CAMPAIGN_COLUMNS)
        .eq("org_id", org_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_to_campaign_out(row) for row in (res.data or [])]


# ── Detalhe ──────────────────────────────────────────────────────────────────


@router.get("/{campaign_id}", response_model=CampaignOut)
async def get_campaign(campaign_id: str) -> CampaignOut:
    db = await get_db()
    res = await (
        db.table("eo_campaigns")
        .select(_CAMPAIGN_COLUMNS)
        .eq("id", campaign_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Campanha não encontrada.")
    return _to_campaign_out(rows[0])


# ── Criar ────────────────────────────────────────────────────────────────────


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
async def create_campaign(body: CampaignCreate) -> CampaignOut:
    """Cria uma campanha em status ``draft``. Sequence steps, leads e inbox
    rotation vêm em endpoints separados.
    """
    db = await get_db()
    row: dict[str, Any] = {
        "org_id": body.org_id,
        "name": body.name.strip(),
        "description": body.description,
        "status": "draft",
        "timezone": body.timezone,
        "send_window": body.send_window or DEFAULT_SEND_WINDOW,
        "stop_on_reply": body.stop_on_reply,
        "stop_on_click": body.stop_on_click,
        "track_opens": body.track_opens,
        "track_clicks": body.track_clicks,
    }
    try:
        res = await db.table("eo_campaigns").insert(row).execute()
    except Exception as exc:
        logger.exception("Falha ao criar campanha")
        raise HTTPException(status_code=500, detail=f"Falha ao salvar campanha: {exc}") from exc

    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Campanha criada mas linha não retornada.")
    return _to_campaign_out(rows[0])


# ── Update ───────────────────────────────────────────────────────────────────


@router.patch("/{campaign_id}", response_model=CampaignOut)
async def update_campaign(campaign_id: str, body: CampaignUpdate) -> CampaignOut:
    db = await get_db()

    patch: dict[str, Any] = {}
    for field in (
        "name", "description", "status", "timezone", "send_window",
        "stop_on_reply", "stop_on_click", "track_opens", "track_clicks",
    ):
        value = getattr(body, field)
        if value is not None:
            patch[field] = value

    if not patch:
        raise HTTPException(status_code=400, detail="Nada para atualizar.")

    # Primeira ativação registra activated_at.
    if patch.get("status") == "active":
        current_res = (
            await db.table("eo_campaigns")
            .select("activated_at")
            .eq("id", campaign_id)
            .limit(1)
            .execute()
        )
        current = (current_res.data or [{}])[0]
        if current.get("activated_at") is None:
            patch["activated_at"] = datetime.now(timezone.utc).isoformat()

    res = await db.table("eo_campaigns").update(patch).eq("id", campaign_id).execute()
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Campanha não encontrada.")
    return _to_campaign_out(rows[0])


# ── Delete ───────────────────────────────────────────────────────────────────


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_campaign(campaign_id: str) -> Response:
    db = await get_db()
    await db.table("eo_campaigns").delete().eq("id", campaign_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
