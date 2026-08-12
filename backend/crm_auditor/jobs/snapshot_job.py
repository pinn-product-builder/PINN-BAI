"""F8 — Captura diária (D-1) de snapshots de KPIs.

Itera sobre as conexões CRM ativas e chama a RPC `bai_capture_daily_snapshot`
para cada tenant, idempotentemente. O job é projetado para rodar 1x/dia,
preferencialmente nas primeiras horas da manhã (após o sync noturno).
"""
from __future__ import annotations

import logging
from typing import Any

from core.db import get_db

logger = logging.getLogger(__name__)


async def _list_active_tenants(db: Any) -> list[str]:
    """Retorna os tenants com pelo menos uma connection CRM ativa."""
    res = await (
        db.table("crm_auditor_connections")
        .select("tenant_id")
        .eq("sync_status", "success")
        .execute()
    )
    tenants = sorted({str(r["tenant_id"]) for r in (res.data or []) if r.get("tenant_id")})
    return tenants


async def capture_daily_snapshots() -> dict[str, Any]:
    """Captura snapshot do dia para todos os tenants ativos.

    Chamada pelo scheduler do APScheduler (registrada em main.py com
    CronTrigger). Idempotente — a RPC usa ON CONFLICT (tenant, date, metric).
    """
    db = await get_db()
    tenants = await _list_active_tenants(db)
    captured = 0
    errors: list[dict[str, str]] = []

    for tenant_id in tenants:
        try:
            res = await db.rpc("bai_capture_daily_snapshot", {"_tenant_id": tenant_id}).execute()
            captured += int((res.data or 0) or 0) if isinstance(res.data, int) else 1
        except Exception as exc:
            logger.exception("[bai_snapshot] falha no tenant=%s: %s", tenant_id, exc)
            errors.append({"tenant_id": tenant_id, "error": str(exc)})

    logger.info(
        "[bai_snapshot] %d tenants processados, %d métricas, %d erros.",
        len(tenants), captured, len(errors),
    )
    return {"tenants": len(tenants), "metrics_captured": captured, "errors": errors}
