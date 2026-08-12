"""Jobs de sync — hoje síncronos; preparado para Celery/worker depois."""
from __future__ import annotations

import logging
from typing import Any

from core.db import get_db
from crm_auditor.modules.kommo.sync_service import AuditorSyncService

logger = logging.getLogger(__name__)


async def fetch_kommo_connection(db: Any, tenant_id: str) -> dict[str, Any] | None:
    res = await (
        db.table("crm_auditor_connections")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("provider", "kommo")
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


async def run_kommo_sync(tenant_id: str) -> dict[str, Any]:
    db = await get_db()
    conn = await fetch_kommo_connection(db, tenant_id)
    if not conn:
        raise ValueError(f"Nenhuma conexão Kommo (crm_auditor_connections) para tenant={tenant_id}")
    svc = AuditorSyncService(db, tenant_id, conn)
    return await svc.run()
