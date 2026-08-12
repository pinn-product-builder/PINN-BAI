#!/usr/bin/env python3
"""Dispara a sync REAL do crm_auditor para um tenant (mock off via backend/.env).

Uso: backend/.venv/bin/python scripts/run_sync.py <tenant_id>
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"

# carrega backend/.env (SUPABASE_URL, SUPABASE_SERVICE_KEY, COMPOSIO_MOCK_SYNC=false, ...)
for raw in (BACKEND / ".env").read_text().splitlines():
    line = raw.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ[k.strip()] = v.strip()

assert os.environ.get("COMPOSIO_MOCK_SYNC", "false").lower() in ("0", "false", "no"), \
    "ABORTADO: COMPOSIO_MOCK_SYNC não está false — não vou rodar mock contra o banco real."

sys.path.insert(0, str(BACKEND))

from crm_auditor.jobs.sync_jobs import run_kommo_sync  # noqa: E402


async def main() -> None:
    tenant_id = sys.argv[1]
    print(f"Sync REAL tenant={tenant_id} (mock={os.environ.get('COMPOSIO_MOCK_SYNC')})")
    out = await run_kommo_sync(tenant_id)
    print("STATS:", out.get("stats"))


if __name__ == "__main__":
    asyncio.run(main())
