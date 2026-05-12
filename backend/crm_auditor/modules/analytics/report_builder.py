"""Montagem do pacote de contexto para IA / exportações (camada fina sobre MetricsService)."""
from __future__ import annotations

from typing import Any


async def build_consolidated_json(db: Any, tenant_id: str) -> dict[str, Any]:
    from crm_auditor.modules.analytics.metrics_service import MetricsService

    return await MetricsService(db).get_consolidated_context(tenant_id)
