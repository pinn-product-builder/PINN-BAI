"""Configuração carregada de variáveis de ambiente (sem secrets hardcoded)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class AuditorSettings:
    composio_api_key: str | None
    composio_base_url: str
    composio_execute_base_url: str
    composio_mock_sync: bool
    openai_api_key: str | None
    openai_base_url: str
    openai_model: str
    stuck_lead_days: int
    engagement_sync_max_pages: int


@lru_cache
def get_auditor_settings() -> AuditorSettings:
    return AuditorSettings(
        composio_api_key=os.getenv("COMPOSIO_API_KEY") or None,
        composio_base_url=os.getenv("COMPOSIO_BASE_URL", "https://backend.composio.dev/api/v3"),
        composio_execute_base_url=os.getenv(
            "COMPOSIO_EXECUTE_BASE_URL",
            "https://backend.composio.dev/api/v3.1",
        ),
        composio_mock_sync=os.getenv("COMPOSIO_MOCK_SYNC", "true").lower() in ("1", "true", "yes"),
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        openai_base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        stuck_lead_days=int(os.getenv("AUDITOR_STUCK_LEAD_DAYS", "7")),
        engagement_sync_max_pages=int(os.getenv("AUDITOR_ENGAGEMENT_MAX_PAGES", "20")),
    )
