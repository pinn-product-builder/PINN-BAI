"""Supabase client singleton for backend use (service role key)."""
from __future__ import annotations

import os

from supabase import AsyncClient, acreate_client

_client: AsyncClient | None = None


async def get_db() -> AsyncClient:
    """Returns a lazily-created Supabase async client."""
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_KEY"]
        _client = await acreate_client(url, key)
    return _client
