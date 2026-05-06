#!/usr/bin/env python3
"""
Valida acesso real à API Kommo (pipelines + usuários).

Uso (na pasta `backend/`):

  export KOMMO_ACCESS_TOKEN="..."
  export KOMMO_SUBDOMAIN="suaempresa"
  PYTHONPATH=. python3 scripts/smoke_kommo_http.py
"""
from __future__ import annotations

import asyncio
import os
import sys

from dotenv import load_dotenv


async def main() -> None:
    load_dotenv()
    token = os.getenv("KOMMO_ACCESS_TOKEN")
    sub = os.getenv("KOMMO_SUBDOMAIN")
    if not token or not sub:
        print("Defina KOMMO_ACCESS_TOKEN e KOMMO_SUBDOMAIN (ou preencha no .env).", file=sys.stderr)
        sys.exit(1)
    from crm_auditor.modules.kommo.kommo_http_client import KommoHttpClient

    client = KommoHttpClient(token, sub)
    pipelines = await client.list_pipelines("smoke")
    users = await client.list_users("smoke")
    leads = await client.list_leads("smoke", page=1, limit=5)
    print(f"OK — pipelines={len(pipelines)} users={len(users)} leads_sample={len(leads)}")


if __name__ == "__main__":
    asyncio.run(main())
