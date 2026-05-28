"""Endpoint manual do sequencer (E2 — Brick E).

POST /email/sequencer/tick → roda um ciclo (enrollment + send queue).
Útil pra desenvolvimento e como botão "Disparar agora" na UI.

Em produção, o ``jobs.py`` registra o tick automático via APScheduler.
"""
from __future__ import annotations

from fastapi import APIRouter

from email_outreach.sequencer import run_tick

router = APIRouter(prefix="/email/sequencer", tags=["email-outreach:sequencer"])


@router.post("/tick")
async def trigger_tick() -> dict:
    return await run_tick()
