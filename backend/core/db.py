"""Supabase client singleton for backend use (service role key).

Workaround: forçamos HTTP/1.1 no httpx do postgrest. O default
(``http2=True``) sofre com ``RemoteProtocolError`` quando o Supabase
fecha conexões ociosas — o cliente reusa o stream morto e o request
seguinte estoura ``<ConnectionTerminated NO_ERROR>``.
"""
from __future__ import annotations

import os

import httpx
from supabase import AsyncClient, acreate_client

_client: AsyncClient | None = None


async def _force_http1(client: AsyncClient) -> None:
    """Troca a session httpx do postgrest por uma HTTP/1.1."""
    pg = getattr(client, "postgrest", None)
    if pg is None:
        return
    old = getattr(pg, "session", None)
    if old is None:
        return
    new_session = httpx.AsyncClient(
        base_url=str(old.base_url),
        headers=dict(old.headers),
        timeout=old.timeout,
        follow_redirects=True,
        http2=False,
    )
    pg.session = new_session
    try:
        await old.aclose()
    except Exception:  # noqa: BLE001
        pass


async def get_db() -> AsyncClient:
    """Returns a lazily-created Supabase async client."""
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_KEY"]
        _client = await acreate_client(url, key)
        await _force_http1(_client)
    return _client
