from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date
from typing import Optional

from .types import NormalizedAdSet, NormalizedCampaign, NormalizedDailyMetrics

_REGISTRY: dict[str, type["AdAdapter"]] = {}


def register_ad_adapter(slug: str):
    def decorator(cls: type["AdAdapter"]):
        _REGISTRY[slug] = cls
        return cls
    return decorator


def get_ad_adapter(slug: str, tenant_id: str, credentials: dict) -> "AdAdapter":
    if slug not in _REGISTRY:
        raise KeyError(f"Ad adapter '{slug}' não registrado. Disponíveis: {list(_REGISTRY)}")
    return _REGISTRY[slug](tenant_id, credentials)


AD_ADAPTER_REGISTRY = _REGISTRY


class AdAdapter(ABC):
    """
    Contrato que todo adapter de plataforma de anúncios deve implementar.
    Segue o mesmo padrão do CRMAdapter para consistência.
    """

    def __init__(self, tenant_id: str, credentials: dict) -> None:
        self.tenant_id = tenant_id
        self.credentials = credentials

    @abstractmethod
    async def get_campaigns(self) -> list[NormalizedCampaign]: ...

    @abstractmethod
    async def get_adsets(self, campaign_id: str) -> list[NormalizedAdSet]: ...

    @abstractmethod
    async def get_daily_metrics(
        self,
        date_start: date,
        date_end: date,
        campaign_id: Optional[str] = None,
    ) -> list[NormalizedDailyMetrics]: ...

    @abstractmethod
    async def verify_credentials(self) -> bool: ...

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} tenant={self.tenant_id}>"
