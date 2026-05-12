"""
Camada de segurança (MVP: pass-through).

TODO: validar JWT / API key interna e injetar tenant autorizado.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Header, HTTPException, status


async def tenant_id_header(
    x_tenant_id: Annotated[str | None, Header(alias="X-Tenant-Id")] = None,
) -> str | None:
    """Opcional: reforça tenant em header para chamadas futuras autenticadas."""
    return x_tenant_id


def ensure_tenant_match(path_tenant_id: str, header_tenant_id: str | None) -> None:
    if header_tenant_id and header_tenant_id != path_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant do header não coincide com o recurso solicitado.",
        )
