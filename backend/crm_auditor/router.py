"""Rotas HTTP do BAI CRM Auditor (multi-tenant por tenant_id)."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.db import get_db
from crm_auditor.jobs import sync_jobs
from crm_auditor.modules.ai.analysis_service import AnalysisService
from crm_auditor.modules.analytics.audit_dashboard_service import AuditDashboardService
from crm_auditor.modules.analytics.metrics_service import MetricsService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["bai-crm-auditor"])


class TenantCreate(BaseModel):
    """Se `id` for informado, use o mesmo UUID de `public.organizations` para alinhar PINN BAI + auditor."""

    id: str | None = Field(
        None,
        description="UUID opcional; ex.: id da organizations para tenant_id único no produto.",
    )
    name: str = Field(..., min_length=1, max_length=500)
    slug: str | None = Field(None, max_length=200)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CRMConnectionCreate(BaseModel):
    tenant_id: str
    provider: str = "kommo"
    display_name: str = "default"
    auth_via: str = "composio"
    composio_connected_account_id: str | None = None
    """ID da connected account Kommo na Composio (OAuth concluído)."""
    composio_user_id: str | None = None
    """User ID lógico na Composio; se omitido, usa tenant_id."""
    credentials: dict[str, Any] = Field(default_factory=dict)


class KommoSyncRequest(BaseModel):
    tenant_id: str


def _as_uuid_or_400(tenant_id: str) -> None:
    """Validação leve de UUID (Postgres aceita uuid string)."""
    from uuid import UUID

    try:
        UUID(tenant_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tenant_id deve ser um UUID válido.",
        ) from exc


@router.post("/tenants", status_code=status.HTTP_201_CREATED)
async def create_tenant(body: TenantCreate) -> dict[str, Any]:
    if body.id is not None:
        _as_uuid_or_400(body.id)
    db = await get_db()
    row: dict[str, Any] = {
        "name": body.name,
        "slug": body.slug,
        "metadata": body.metadata,
    }
    if body.id:
        row["id"] = body.id
    res = await db.table("tenants").insert(row).execute()
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Falha ao criar tenant")
    created = rows[0]
    logger.info("Tenant criado id=%s", created.get("id"))
    return created


@router.get("/tenants")
async def list_tenants(limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    db = await get_db()
    res = await db.table("tenants").select("*").order("created_at", desc=True).limit(limit).execute()
    return {"tenants": res.data or []}


@router.post("/crm/connections", status_code=status.HTTP_201_CREATED)
async def create_crm_connection(body: CRMConnectionCreate) -> dict[str, Any]:
    _as_uuid_or_400(body.tenant_id)
    db = await get_db()
    creds = dict(body.credentials or {})
    if body.composio_user_id:
        creds.setdefault("composio_user_id", body.composio_user_id)
    if body.composio_connected_account_id:
        creds.setdefault("composio_connected_account_id", body.composio_connected_account_id)
    row = {
        "tenant_id": body.tenant_id,
        "provider": body.provider,
        "display_name": body.display_name,
        "auth_via": body.auth_via,
        "composio_connected_account_id": body.composio_connected_account_id,
        "credentials": creds,
        "sync_status": "idle",
    }
    res = await (
        db.table("crm_auditor_connections")
        .upsert(row, on_conflict="tenant_id,provider")
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Falha ao salvar conexão CRM")
    return rows[0]


@router.post("/crm/kommo/sync")
async def kommo_sync(body: KommoSyncRequest) -> dict[str, Any]:
    _as_uuid_or_400(body.tenant_id)
    try:
        result = await sync_jobs.run_kommo_sync(body.tenant_id)
        return {"ok": True, **result}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Sync Kommo falhou")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/crm/sync-runs")
async def list_sync_runs(
    tenant_id: str = Query(..., description="UUID do tenant"),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    _as_uuid_or_400(tenant_id)
    db = await get_db()
    res = await (
        db.table("crm_sync_runs")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("started_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"sync_runs": res.data or []}


@router.get("/crm/audit/dashboard")
async def audit_dashboard(tenant_id: str = Query(..., description="UUID do tenant (use o mesmo da organization se alinhado)")) -> dict[str, Any]:
    """Payload completo para o dashboard de auditoria CRM (Kommo via Composio/sync)."""
    _as_uuid_or_400(tenant_id)
    db = await get_db()
    try:
        return await AuditDashboardService(db).build_dashboard(tenant_id)
    except Exception as exc:
        logger.exception("Falha ao montar dashboard de auditoria")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/crm/metrics/overview")
async def metrics_overview(tenant_id: str = Query(...)) -> dict[str, Any]:
    _as_uuid_or_400(tenant_id)
    db = await get_db()
    svc = MetricsService(db)
    overview = await svc.get_overview_metrics(tenant_id)
    breakdown = await svc.get_data_quality_breakdown(tenant_id)
    dq = svc.compute_data_quality_score(overview, breakdown)
    stuck = await svc.get_stuck_leads(tenant_id)
    no_action = await svc.get_no_next_action_leads(tenant_id)
    overdue = await svc.get_overdue_tasks(tenant_id)
    op = svc.compute_operation_score(dq, len(overdue), len(stuck), len(no_action))
    return {
        "tenant_id": tenant_id,
        "overview": overview,
        "data_quality_score_0_100": dq,
        "operation_score_0_100": op,
        "counts": {
            "stuck_leads": len(stuck),
            "no_next_action_leads": len(no_action),
            "overdue_tasks": len(overdue),
        },
    }


@router.get("/crm/metrics/pipeline-health")
async def metrics_pipeline_health(tenant_id: str = Query(...)) -> dict[str, Any]:
    _as_uuid_or_400(tenant_id)
    db = await get_db()
    rows = await MetricsService(db).get_pipeline_health(tenant_id)
    return {"tenant_id": tenant_id, "pipeline_health": rows}


@router.get("/crm/metrics/owners")
async def metrics_owners(tenant_id: str = Query(...)) -> dict[str, Any]:
    _as_uuid_or_400(tenant_id)
    db = await get_db()
    rows = await MetricsService(db).get_owner_performance(tenant_id)
    return {"tenant_id": tenant_id, "owners": rows}


@router.get("/crm/metrics/data-quality")
async def metrics_data_quality(tenant_id: str = Query(...)) -> dict[str, Any]:
    _as_uuid_or_400(tenant_id)
    db = await get_db()
    svc = MetricsService(db)
    overview = await svc.get_overview_metrics(tenant_id)
    breakdown = await svc.get_data_quality_breakdown(tenant_id)
    score = svc.compute_data_quality_score(overview, breakdown)
    return {"tenant_id": tenant_id, "score_0_100": score, "breakdown": breakdown}


@router.post("/crm/analysis/generate")
async def generate_analysis(tenant_id: str = Query(...)) -> dict[str, Any]:
    _as_uuid_or_400(tenant_id)
    db = await get_db()
    try:
        report = await AnalysisService(db).generate_and_persist(tenant_id)
        return report
    except Exception as exc:
        logger.exception("Geração de análise falhou")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/crm/analysis/reports")
async def list_analysis_reports(
    tenant_id: str = Query(...),
    limit: int = Query(20, ge=1, le=50),
) -> dict[str, Any]:
    _as_uuid_or_400(tenant_id)
    db = await get_db()
    rows = await AnalysisService(db).list_reports(tenant_id, limit)
    return {"tenant_id": tenant_id, "reports": rows}
