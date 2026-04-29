from .types import NormalizedContact, NormalizedAppointment, NormalizedDeal, NormalizedActivity
from .base import CRMAdapter
from .registry import register_adapter, get_adapter, ADAPTER_REGISTRY

__all__ = [
    "NormalizedContact",
    "NormalizedAppointment",
    "NormalizedDeal",
    "NormalizedActivity",
    "CRMAdapter",
    "register_adapter",
    "get_adapter",
    "ADAPTER_REGISTRY",
]
