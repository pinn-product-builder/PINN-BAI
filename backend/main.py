"""
Pinn BAI — Backend FastAPI
"""
from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

load_dotenv()

# Registrar adapters CRM e Ads
import adapters  # noqa: F401, E402
import adapters.meta_ads  # noqa: F401, E402
import adapters.google_ads  # noqa: F401, E402

from core.crm.registry import ADAPTER_REGISTRY, get_adapter  # noqa: E402
from core.ads.base import AD_ADAPTER_REGISTRY, get_ad_adapter  # noqa: E402
from core.ads.sync_service import AdSyncService  # noqa: E402
from core.db import get_db  # noqa: E402
from core.sync.service import SyncService  # noqa: E402
from core.health.service import CustomerHealthService  # noqa: E402
from core.kpi.threshold_service import ThresholdService  # noqa: E402
from core.kpi.achievement_service import AchievementService  # noqa: E402
from crm_auditor.router import router as bai_crm_auditor_router  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Pinn BAI — CRM Backend",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bai_crm_auditor_router)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["infra"])
async def health() -> dict:
    return {
        "status": "ok",
        "adapters": list(ADAPTER_REGISTRY.keys()),
    }


# ── Adapters ───────────────────────────────────────────────────────────────────

@app.get("/adapters", tags=["infra"])
async def list_adapters() -> dict:
    return {
        "adapters": [
            {"slug": slug, "class": cls.__name__}
            for slug, cls in ADAPTER_REGISTRY.items()
        ]
    }


# ── CRM connections ────────────────────────────────────────────────────────────

class ConnectRequest(BaseModel):
    crm_slug: str
    credentials: dict


@app.post("/crm/connect/{tenant_id}", tags=["crm"])
async def connect_crm(tenant_id: str, body: ConnectRequest) -> JSONResponse:
    """
    Salva as credenciais do CRM para um tenant e valida a conexão.
    Cria ou substitui a conexão existente (upsert por org_id + crm_slug).
    """
    if body.crm_slug not in ADAPTER_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CRM '{body.crm_slug}' não suportado. Disponíveis: {list(ADAPTER_REGISTRY.keys())}",
        )

    adapter = get_adapter(
        slug=body.crm_slug,
        tenant_id=tenant_id,
        credentials=body.credentials,
    )

    valid = await adapter.verify_credentials()
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas. Verifique o token e o subdomínio.",
        )

    db = await get_db()
    await db.table("crm_connections").upsert(
        {
            "org_id": tenant_id,
            "crm_slug": body.crm_slug,
            "credentials": body.credentials,
            "sync_status": "idle",
        },
        on_conflict="org_id,crm_slug",
    ).execute()

    return JSONResponse({"ok": True, "crm_slug": body.crm_slug})


@app.get("/crm/connections/{tenant_id}", tags=["crm"])
async def get_connections(tenant_id: str) -> JSONResponse:
    """Lista todas as conexões CRM de um tenant com status de sync."""
    db = await get_db()
    result = await db.table("crm_connections").select(
        "crm_slug,sync_status,last_sync_at,sync_error,created_at"
    ).eq("org_id", tenant_id).execute()

    connections = result.data or []

    # Enrich with record counts
    for conn in connections:
        slug = conn["crm_slug"]
        for table, key in [
            ("crm_contacts", "contacts"),
            ("crm_deals", "deals"),
            ("crm_appointments", "appointments"),
            ("crm_activities", "activities"),
        ]:
            count_result = await db.table(table).select(
                "*", count="exact"
            ).eq("org_id", tenant_id).eq("crm_slug", slug).execute()
            conn[key] = count_result.count or 0

    return JSONResponse({"connections": connections})


@app.post("/crm/sync/{tenant_id}/{crm_slug}", tags=["crm"])
async def trigger_sync(tenant_id: str, crm_slug: str) -> JSONResponse:
    """
    Dispara sincronização completa do CRM para o tenant.
    Busca credenciais do Supabase, instancia o adapter e roda SyncService.
    """
    db = await get_db()
    result = await db.table("crm_connections").select("credentials").eq(
        "org_id", tenant_id
    ).eq("crm_slug", crm_slug).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nenhuma conexão encontrada para crm='{crm_slug}' e tenant='{tenant_id}'.",
        )

    credentials = result.data["credentials"]

    svc = SyncService(
        tenant_id=tenant_id,
        crm_slug=crm_slug,
        credentials=credentials,
    )
    counts = await svc.sync_all()

    return JSONResponse({"ok": True, "synced": counts})


@app.delete("/crm/connections/{tenant_id}/{crm_slug}", tags=["crm"])
async def disconnect_crm(tenant_id: str, crm_slug: str) -> JSONResponse:
    """Remove a conexão CRM e todos os dados sincronizados do tenant."""
    db = await get_db()
    await db.table("crm_connections").delete().eq("org_id", tenant_id).eq(
        "crm_slug", crm_slug
    ).execute()
    return JSONResponse({"ok": True})


# ── Webhook ────────────────────────────────────────────────────────────────────

@app.post(
    "/webhook/{tenant_id}/{crm_slug}",
    status_code=status.HTTP_200_OK,
    tags=["webhook"],
)
async def receive_webhook(
    tenant_id: str,
    crm_slug: str,
    request: Request,
) -> JSONResponse:
    """
    Recebe webhooks de qualquer CRM registrado.
    O Kommo envia form-encoded; outros CRMs podem enviar JSON.
    """
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        try:
            payload = await request.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payload JSON inválido.",
            )
    else:
        form = await request.form()
        payload = dict(form)

    db = await get_db()
    result = await db.table("crm_connections").select("credentials").eq(
        "org_id", tenant_id
    ).eq("crm_slug", crm_slug).single().execute()

    credentials = result.data["credentials"] if result.data else {}

    try:
        adapter = get_adapter(
            slug=crm_slug,
            tenant_id=tenant_id,
            credentials=credentials,
        )
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CRM adapter '{crm_slug}' não encontrado.",
        )

    await adapter.handle_webhook(payload)
    return JSONResponse({"ok": True})


# ── Entrypoint ─────────────────────────────────────────────────────────────────

# ── Paid Traffic ───────────────────────────────────────────────────────────────

class AdConnectRequest(BaseModel):
    platform_slug: str
    credentials: dict
    account_name: str | None = None


@app.get("/ads/platforms", tags=["ads"])
async def list_ad_platforms() -> dict:
    return {
        "platforms": [
            {"slug": slug, "class": cls.__name__}
            for slug, cls in AD_ADAPTER_REGISTRY.items()
        ]
    }


@app.post("/ads/connect/{tenant_id}", tags=["ads"])
async def connect_ad_platform(tenant_id: str, body: AdConnectRequest) -> JSONResponse:
    if body.platform_slug not in AD_ADAPTER_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plataforma '{body.platform_slug}' não suportada.",
        )

    adapter = get_ad_adapter(body.platform_slug, tenant_id, body.credentials)
    valid = await adapter.verify_credentials()
    if not valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas.")

    db = await get_db()
    account_id = body.credentials.get("account_id") or body.credentials.get("customer_id", "")
    await db.table("paid_traffic_connections").upsert(
        {
            "org_id": tenant_id,
            "platform_slug": body.platform_slug,
            "credentials": body.credentials,
            "account_id": account_id,
            "account_name": body.account_name,
            "sync_status": "idle",
        },
        on_conflict="org_id,platform_slug,account_id",
    ).execute()

    return JSONResponse({"ok": True, "platform_slug": body.platform_slug})


@app.post("/ads/sync/{tenant_id}/{platform_slug}", tags=["ads"])
async def sync_ad_platform(tenant_id: str, platform_slug: str, days_back: int = 30) -> JSONResponse:
    db = await get_db()
    result = await db.table("paid_traffic_connections").select("credentials").eq(
        "org_id", tenant_id
    ).eq("platform_slug", platform_slug).single().execute()

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conexão não encontrada.")

    svc = AdSyncService(tenant_id, platform_slug, result.data["credentials"])
    counts = await svc.sync_all(days_back=days_back)
    return JSONResponse({"ok": True, "synced": counts})


@app.get("/ads/connections/{tenant_id}", tags=["ads"])
async def list_ad_connections(tenant_id: str) -> JSONResponse:
    db = await get_db()
    result = await db.table("paid_traffic_connections").select(
        "platform_slug,account_id,account_name,sync_status,last_sync_at,sync_error"
    ).eq("org_id", tenant_id).execute()
    return JSONResponse({"connections": result.data or []})


@app.delete("/ads/connections/{tenant_id}/{platform_slug}", tags=["ads"])
async def disconnect_ad_platform(tenant_id: str, platform_slug: str) -> JSONResponse:
    db = await get_db()
    await db.table("paid_traffic_connections").delete().eq("org_id", tenant_id).eq(
        "platform_slug", platform_slug
    ).execute()
    return JSONResponse({"ok": True})


# ── Customer Health ─────────────────────────────────────────────────────────────

@app.post("/health/compute/{tenant_id}", tags=["health"])
async def compute_health(tenant_id: str) -> JSONResponse:
    svc = CustomerHealthService(tenant_id)
    result = await svc.compute_all()
    return JSONResponse({"ok": True, **result})


@app.get("/health/scores/{tenant_id}", tags=["health"])
async def get_health_scores(
    tenant_id: str,
    band: str | None = None,
    limit: int = 50,
) -> JSONResponse:
    db = await get_db()
    q = db.table("customer_health_scores").select("*").eq("org_id", tenant_id)
    if band:
        q = q.eq("health_band", band)
    q = q.order("health_score", desc=False).limit(limit)
    result = await q.execute()
    return JSONResponse({"scores": result.data or []})


@app.get("/health/alerts/{tenant_id}", tags=["health"])
async def get_health_alerts(
    tenant_id: str,
    severity: str | None = None,
    resolved: bool = False,
    limit: int = 50,
) -> JSONResponse:
    db = await get_db()
    q = (
        db.table("customer_alerts")
        .select("*")
        .eq("org_id", tenant_id)
        .eq("resolved", resolved)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if severity:
        q = q.eq("severity", severity)
    result = await q.execute()
    return JSONResponse({"alerts": result.data or []})


@app.patch("/health/alerts/{tenant_id}/{alert_id}/acknowledge", tags=["health"])
async def acknowledge_alert(tenant_id: str, alert_id: str) -> JSONResponse:
    from datetime import datetime, timezone
    db = await get_db()
    await db.table("customer_alerts").update(
        {"acknowledged": True, "acknowledged_at": datetime.now(tz=timezone.utc).isoformat()}
    ).eq("org_id", tenant_id).eq("id", alert_id).execute()
    return JSONResponse({"ok": True})


@app.patch("/health/alerts/{tenant_id}/{alert_id}/resolve", tags=["health"])
async def resolve_alert(tenant_id: str, alert_id: str) -> JSONResponse:
    from datetime import datetime, timezone
    db = await get_db()
    await db.table("customer_alerts").update(
        {"resolved": True, "resolved_at": datetime.now(tz=timezone.utc).isoformat()}
    ).eq("org_id", tenant_id).eq("id", alert_id).execute()
    return JSONResponse({"ok": True})


# ── Integration Hub ─────────────────────────────────────────────────────────────

@app.get("/hub/providers", tags=["hub"])
async def list_providers() -> JSONResponse:
    db = await get_db()
    result = await db.table("integration_providers").select("*").eq("is_active", True).order("sort_order").execute()
    return JSONResponse({"providers": result.data or []})


@app.get("/hub/connections/{tenant_id}", tags=["hub"])
async def list_hub_connections(tenant_id: str) -> JSONResponse:
    db = await get_db()
    result = await (
        db.table("hub_connections")
        .select("id,provider_slug,display_name,status,sync_status,last_sync_at,sync_error,metadata,created_at")
        .eq("org_id", tenant_id)
        .order("created_at", desc=True)
        .execute()
    )
    return JSONResponse({"connections": result.data or []})


class HubConnectRequest(BaseModel):
    provider_slug: str
    display_name: str
    credentials: dict
    sync_config: dict = {}


@app.post("/hub/connect/{tenant_id}", tags=["hub"])
async def hub_connect(tenant_id: str, body: HubConnectRequest) -> JSONResponse:
    db = await get_db()

    # Valida que o provider existe
    provider_res = await db.table("integration_providers").select("*").eq("slug", body.provider_slug).single().execute()
    if not provider_res.data:
        raise HTTPException(status_code=404, detail=f"Provider '{body.provider_slug}' não encontrado.")

    # Tenta validar credenciais se for adapter conhecido
    metadata: dict = {}
    if body.provider_slug in AD_ADAPTER_REGISTRY:
        adapter = get_ad_adapter(body.provider_slug, tenant_id, body.credentials)
        valid = await adapter.verify_credentials()
        if not valid:
            raise HTTPException(status_code=401, detail="Credenciais inválidas.")
    elif body.provider_slug in ADAPTER_REGISTRY:
        adapter = get_adapter(body.provider_slug, tenant_id, body.credentials)
        valid = await adapter.verify_credentials()
        if not valid:
            raise HTTPException(status_code=401, detail="Credenciais inválidas.")

    conn_res = await db.table("hub_connections").upsert(
        {
            "org_id": tenant_id,
            "provider_slug": body.provider_slug,
            "display_name": body.display_name,
            "credentials": body.credentials,
            "status": "connected",
            "sync_config": body.sync_config,
            "metadata": metadata,
        },
        on_conflict="org_id,provider_slug,display_name",
    ).select().single().execute()

    return JSONResponse({"ok": True, "connection": conn_res.data})


@app.delete("/hub/connections/{tenant_id}/{connection_id}", tags=["hub"])
async def hub_disconnect(tenant_id: str, connection_id: str) -> JSONResponse:
    db = await get_db()
    await db.table("hub_connections").delete().eq("org_id", tenant_id).eq("id", connection_id).execute()
    return JSONResponse({"ok": True})


# ── KPI Threshold & Goals ──────────────────────────────────────────────────────

@app.post("/kpi/check/{tenant_id}", tags=["kpi"])
async def check_kpi_thresholds(tenant_id: str) -> JSONResponse:
    """Evaluate all enabled KPI alert rules and fire triggers on breaches."""
    db = await get_db()
    svc = ThresholdService(db)
    result = await svc.check_rules(tenant_id)
    return JSONResponse(result)


@app.get("/kpi/triggers/{tenant_id}", tags=["kpi"])
async def get_kpi_triggers(tenant_id: str, resolved: bool = False) -> JSONResponse:
    db = await get_db()
    res = await (
        db.table("kpi_alert_triggers")
        .select("*, kpi_alert_rules(name, severity, metric_key)")
        .eq("org_id", tenant_id)
        .eq("resolved", resolved)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return JSONResponse({"triggers": res.data or []})


@app.patch("/kpi/triggers/{tenant_id}/{trigger_id}/resolve", tags=["kpi"])
async def resolve_kpi_trigger(tenant_id: str, trigger_id: str) -> JSONResponse:
    db = await get_db()
    await (
        db.table("kpi_alert_triggers")
        .update({"resolved": True})
        .eq("org_id", tenant_id)
        .eq("id", trigger_id)
        .execute()
    )
    return JSONResponse({"ok": True})


@app.post("/kpi/achievements/check/{tenant_id}", tags=["kpi"])
async def check_achievements(tenant_id: str) -> JSONResponse:
    """Auto-grant achievements to org members based on current KPI performance."""
    db = await get_db()
    svc = AchievementService(db)
    result = await svc.check_and_grant(tenant_id)
    return JSONResponse(result)


# ── Entrypoint ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("ENVIRONMENT", "development") == "development",
    )
