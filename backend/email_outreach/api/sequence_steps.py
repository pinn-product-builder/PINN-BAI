"""Rotas CRUD de sequence steps (E2 — Brick B).

Steps sempre são filhos de uma campanha. Endpoints hierárquicos:

- GET    /email/campaigns/{cid}/steps              → lista ordenada
- POST   /email/campaigns/{cid}/steps              → cria step
- GET    /email/campaigns/{cid}/steps/{step_id}    → detalhe
- PATCH  /email/campaigns/{cid}/steps/{step_id}    → editar
- DELETE /email/campaigns/{cid}/steps/{step_id}    → remover

Unique constraint: (campaign_id, step_order, variant_label). Se o usuário
não passa ``step_order`` no POST, alocamos o próximo número disponível.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response

from core.db import get_db
from email_outreach.models import SequenceStepCreate, SequenceStepOut, SequenceStepUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email/campaigns/{campaign_id}/steps", tags=["email-outreach:steps"])


_STEP_COLUMNS = (
    "id, campaign_id, step_order, variant_label, "
    "delay_days, delay_hours, subject_template, body_template, "
    "is_reply_to_previous, weight, created_at, updated_at"
)


def _to_step_out(row: dict[str, Any]) -> SequenceStepOut:
    return SequenceStepOut.model_validate(row)


async def _next_step_order(db: Any, campaign_id: str) -> int:
    """Retorna o próximo step_order disponível pra esta campanha."""
    res = await (
        db.table("eo_sequence_steps")
        .select("step_order")
        .eq("campaign_id", campaign_id)
        .order("step_order", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return 1
    return int(rows[0]["step_order"]) + 1


@router.get("", response_model=list[SequenceStepOut])
async def list_steps(campaign_id: str) -> list[SequenceStepOut]:
    db = await get_db()
    res = await (
        db.table("eo_sequence_steps")
        .select(_STEP_COLUMNS)
        .eq("campaign_id", campaign_id)
        .order("step_order")
        .order("variant_label")
        .execute()
    )
    return [_to_step_out(row) for row in (res.data or [])]


@router.get("/{step_id}", response_model=SequenceStepOut)
async def get_step(campaign_id: str, step_id: str) -> SequenceStepOut:
    db = await get_db()
    res = await (
        db.table("eo_sequence_steps")
        .select(_STEP_COLUMNS)
        .eq("id", step_id)
        .eq("campaign_id", campaign_id).limit(1).execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Step não encontrado.")
    return _to_step_out(rows[0])


@router.post("", response_model=SequenceStepOut, status_code=status.HTTP_201_CREATED)
async def create_step(campaign_id: str, body: SequenceStepCreate) -> SequenceStepOut:
    db = await get_db()

    step_order = body.step_order
    if step_order is None:
        step_order = await _next_step_order(db, campaign_id)

    # Step 1 nunca responde anterior (não há).
    is_reply_to_previous = body.is_reply_to_previous if step_order > 1 else False

    row = {
        "campaign_id": campaign_id,
        "step_order": step_order,
        "variant_label": body.variant_label,
        "delay_days": body.delay_days,
        "delay_hours": body.delay_hours,
        "subject_template": body.subject_template,
        "body_template": body.body_template,
        "is_reply_to_previous": is_reply_to_previous,
        "weight": body.weight,
    }

    try:
        res = (
            await db.table("eo_sequence_steps")
            .insert(row).execute()
        )
    except Exception as exc:
        msg = str(exc)
        if "duplicate key" in msg.lower():
            raise HTTPException(
                status_code=409,
                detail=f"Já existe um step com order={step_order} e variant={body.variant_label} nesta campanha.",
            ) from exc
        logger.exception("Falha ao criar step")
        raise HTTPException(status_code=500, detail=f"Falha ao salvar step: {msg}") from exc

    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Step criado mas linha não retornada.")
    return _to_step_out(rows[0])


@router.patch("/{step_id}", response_model=SequenceStepOut)
async def update_step(campaign_id: str, step_id: str, body: SequenceStepUpdate) -> SequenceStepOut:
    db = await get_db()

    patch: dict[str, Any] = {}
    for field in (
        "step_order", "variant_label", "delay_days", "delay_hours",
        "subject_template", "body_template", "is_reply_to_previous", "weight",
    ):
        value = getattr(body, field)
        if value is not None:
            patch[field] = value

    if not patch:
        raise HTTPException(status_code=400, detail="Nada para atualizar.")

    res = await (
        db.table("eo_sequence_steps")
        .update(patch)
        .eq("id", step_id)
        .eq("campaign_id", campaign_id).execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Step não encontrado.")
    return _to_step_out(rows[0])


@router.delete("/{step_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_step(campaign_id: str, step_id: str) -> Response:
    db = await get_db()
    await (
        db.table("eo_sequence_steps")
        .delete()
        .eq("id", step_id)
        .eq("campaign_id", campaign_id)
        .execute()
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
