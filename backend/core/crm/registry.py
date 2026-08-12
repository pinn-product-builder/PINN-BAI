from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .base import CRMAdapter

# slug → classe do adapter (populado via @register_adapter)
ADAPTER_REGISTRY: dict[str, type["CRMAdapter"]] = {}


def register_adapter(slug: str):
    """
    Decorator que registra um CRMAdapter no registry global.

    Uso:
        @register_adapter("kommo")
        class KommoAdapter(CRMAdapter):
            ...
    """
    def decorator(cls: type["CRMAdapter"]) -> type["CRMAdapter"]:
        if slug in ADAPTER_REGISTRY:
            raise ValueError(
                f"Adapter '{slug}' já registrado por {ADAPTER_REGISTRY[slug].__name__}. "
                "Use um slug único."
            )
        ADAPTER_REGISTRY[slug] = cls
        return cls

    return decorator


def get_adapter(slug: str, tenant_id: str, credentials: dict) -> "CRMAdapter":
    """
    Instancia o adapter correto dado o slug do CRM.

    Raises:
        KeyError: se o slug não estiver registrado.
    """
    if slug not in ADAPTER_REGISTRY:
        available = ", ".join(ADAPTER_REGISTRY.keys()) or "(nenhum)"
        raise KeyError(
            f"Adapter '{slug}' não encontrado. Disponíveis: {available}"
        )
    cls = ADAPTER_REGISTRY[slug]
    return cls(tenant_id=tenant_id, credentials=credentials)
