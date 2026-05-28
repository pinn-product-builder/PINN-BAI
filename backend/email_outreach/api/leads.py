"""Rotas de leads + enrollment em campanha (E2 — Brick C).

- GET    /email/leads?org_id=X                       → lista
- POST   /email/leads                                → criar 1
- POST   /email/leads/bulk-import                    → importar lote (dedup por email)
- PATCH  /email/leads/{lead_id}                      → editar
- DELETE /email/leads/{lead_id}                      → remover

- GET    /email/campaigns/{cid}/leads                → lista enrollments da campanha
- POST   /email/campaigns/{cid}/leads/enroll         → inscreve N leads
- DELETE /email/campaigns/{cid}/leads/{cl_id}        → desinscreve (delete campaign_lead)
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response

from core.db import get_db
from email_outreach.models import (
    CampaignLeadOut,
    EnrollLeadsPayload,
    LeadBulkImport,
    LeadBulkImportResult,
    LeadCreate,
    LeadOut,
    LeadUpdate,
)

logger = logging.getLogger(__name__)

leads_router = APIRouter(prefix="/email/leads", tags=["email-outreach:leads"])
campaign_leads_router = APIRouter(
    prefix="/email/campaigns/{campaign_id}/leads",
    tags=["email-outreach:campaign-leads"],
)


_LEAD_COLUMNS = (
    "id, org_id, email, first_name, last_name, company, title, phone, "
    "linkedin_url, custom_fields, timezone, source, external_ref, status, "
    "created_at, updated_at"
)

_CL_COLUMNS = (
    "id, campaign_id, lead_id, current_step, next_send_at, variant_assignment, "
    "status, status_reason, enrolled_at, finished_at, paused_at"
)


def _to_lead_out(row: dict[str, Any]) -> LeadOut:
    return LeadOut.model_validate(row)


# ─────────────────────────────────────────────────────────────────────────────
# Leads CRUD
# ─────────────────────────────────────────────────────────────────────────────


@leads_router.get("", response_model=list[LeadOut])
async def list_leads(
    org_id: str = Query(..., description="UUID da organização"),
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(500, ge=1, le=5000),
) -> list[LeadOut]:
    db = await get_db()
    q = db.table("eo_leads").select(_LEAD_COLUMNS).eq("org_id", org_id)
    if status_filter:
        q = q.eq("status", status_filter)
    res = await q.order("created_at", desc=True).limit(limit).execute()
    return [_to_lead_out(row) for row in (res.data or [])]


@leads_router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
async def create_lead(body: LeadCreate) -> LeadOut:
    db = await get_db()
    row = body.model_dump()
    row["email"] = str(row["email"]).lower().strip()
    try:
        res = (
            await db.table("eo_leads")
            .insert(row).execute()
        )
    except Exception as exc:
        msg = str(exc)
        if "duplicate key" in msg.lower():
            raise HTTPException(status_code=409, detail="Já existe lead com esse email nesta org.") from exc
        logger.exception("Falha ao criar lead")
        raise HTTPException(status_code=500, detail=f"Falha ao salvar lead: {msg}") from exc
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Lead criado mas linha não retornada.")
    return _to_lead_out(rows[0])


@leads_router.post("/bulk-import", response_model=LeadBulkImportResult)
async def bulk_import_leads(body: LeadBulkImport) -> LeadBulkImportResult:
    """Upsert por (org_id, email). Dedup automática.

    Cada item deve ter ao menos ``email``. Campos suportados:
    first_name, last_name, company, title, phone, linkedin_url, timezone,
    external_ref, custom_fields (dict).
    """
    db = await get_db()

    inserted = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    # Coleta emails existentes pra contar inserted vs updated.
    emails_clean: list[str] = []
    rows: list[dict[str, Any]] = []
    for idx, item in enumerate(body.leads):
        email = str(item.get("email") or "").lower().strip()
        if not email or "@" not in email:
            skipped += 1
            errors.append(f"item {idx}: email inválido ({item.get('email')!r})")
            continue
        emails_clean.append(email)
        rows.append({
            "org_id": body.org_id,
            "email": email,
            "first_name": item.get("first_name"),
            "last_name": item.get("last_name"),
            "company": item.get("company"),
            "title": item.get("title"),
            "phone": item.get("phone"),
            "linkedin_url": item.get("linkedin_url"),
            "timezone": item.get("timezone"),
            "external_ref": item.get("external_ref"),
            "custom_fields": item.get("custom_fields") or {},
            "source": body.source,
        })

    if not rows:
        return LeadBulkImportResult(inserted=0, updated=0, skipped=skipped, errors=errors)

    existing_res = (
        await db.table("eo_leads")
        .select("email")
        .eq("org_id", body.org_id)
        .in_("email", emails_clean)
        .execute()
    )
    existing_emails = {row["email"] for row in (existing_res.data or [])}

    # Upsert em chunks pra não estourar payload.
    for i in range(0, len(rows), 500):
        chunk = rows[i : i + 500]
        try:
            await db.table("eo_leads").upsert(chunk, on_conflict="org_id,email").execute()
        except Exception as exc:
            logger.exception("Falha em chunk de bulk import")
            errors.append(f"chunk {i // 500}: {exc}")
            continue
        for r in chunk:
            if r["email"] in existing_emails:
                updated += 1
            else:
                inserted += 1

    return LeadBulkImportResult(inserted=inserted, updated=updated, skipped=skipped, errors=errors)


@leads_router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(lead_id: str, body: LeadUpdate) -> LeadOut:
    db = await get_db()
    patch: dict[str, Any] = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not patch:
        raise HTTPException(status_code=400, detail="Nada para atualizar.")
    res = await (
        db.table("eo_leads")
        .update(patch)
        .eq("id", lead_id).execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Lead não encontrado.")
    return _to_lead_out(rows[0])


@leads_router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_lead(lead_id: str) -> Response:
    db = await get_db()
    await db.table("eo_leads").delete().eq("id", lead_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Campaign Leads — enrollment
# ─────────────────────────────────────────────────────────────────────────────


def _to_cl_out(row: dict[str, Any]) -> CampaignLeadOut:
    """Mapeia linha de eo_campaign_leads com possíveis joins denormalizados."""
    return CampaignLeadOut(
        id=row["id"],
        campaign_id=row["campaign_id"],
        lead_id=row["lead_id"],
        current_step=row.get("current_step") or 0,
        next_send_at=row.get("next_send_at"),
        variant_assignment=row.get("variant_assignment") or {},
        status=row.get("status") or "enrolled",
        status_reason=row.get("status_reason"),
        enrolled_at=row["enrolled_at"],
        finished_at=row.get("finished_at"),
        paused_at=row.get("paused_at"),
        lead_email=(row.get("eo_leads") or {}).get("email") if row.get("eo_leads") else row.get("lead_email"),
        lead_name=_compose_name(row),
        lead_company=(row.get("eo_leads") or {}).get("company") if row.get("eo_leads") else row.get("lead_company"),
    )


def _compose_name(row: dict[str, Any]) -> str | None:
    lead = row.get("eo_leads") if isinstance(row.get("eo_leads"), dict) else None
    fn = (lead or {}).get("first_name") or row.get("lead_first_name")
    ln = (lead or {}).get("last_name") or row.get("lead_last_name")
    if fn or ln:
        return " ".join(part for part in [fn, ln] if part).strip() or None
    return None


@campaign_leads_router.get("", response_model=list[CampaignLeadOut])
async def list_campaign_leads(
    campaign_id: str,
    limit: int = Query(500, ge=1, le=5000),
) -> list[CampaignLeadOut]:
    db = await get_db()
    # Join com eo_leads pra trazer email/nome/empresa de uma vez.
    res = await (
        db.table("eo_campaign_leads")
        .select(f"{_CL_COLUMNS}, eo_leads(email, first_name, last_name, company)")
        .eq("campaign_id", campaign_id)
        .order("enrolled_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [_to_cl_out(row) for row in (res.data or [])]


@campaign_leads_router.post("/enroll", response_model=list[CampaignLeadOut])
async def enroll_leads(campaign_id: str, body: EnrollLeadsPayload) -> list[CampaignLeadOut]:
    """Inscreve leads na campanha. Dedup por (campaign_id, lead_id) — idempotente."""
    db = await get_db()
    rows = [{"campaign_id": campaign_id, "lead_id": lid} for lid in body.lead_ids]

    # Upsert; ignora violações de unique já que onConflict mantém o registro existente.
    try:
        await db.table("eo_campaign_leads").upsert(
            rows, on_conflict="campaign_id,lead_id"
        ).execute()
    except Exception as exc:
        logger.exception("Falha ao inscrever leads")
        raise HTTPException(status_code=500, detail=f"Falha ao inscrever: {exc}") from exc

    # Retorna o estado atual de todos os enrollments solicitados.
    final = (
        await db.table("eo_campaign_leads")
        .select(f"{_CL_COLUMNS}, eo_leads(email, first_name, last_name, company)")
        .eq("campaign_id", campaign_id)
        .in_("lead_id", body.lead_ids)
        .execute()
    )
    return [_to_cl_out(row) for row in (final.data or [])]


@campaign_leads_router.delete(
    "/{campaign_lead_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response
)
async def unenroll_lead(campaign_id: str, campaign_lead_id: str) -> Response:
    db = await get_db()
    await (
        db.table("eo_campaign_leads")
        .delete()
        .eq("id", campaign_lead_id)
        .eq("campaign_id", campaign_id)
        .execute()
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
