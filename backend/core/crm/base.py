from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from .types import (
    NormalizedActivity,
    NormalizedAppointment,
    NormalizedContact,
    NormalizedDeal,
)


class CRMAdapter(ABC):
    """
    Contrato que todo adapter de CRM deve implementar.

    Cada CRM novo = uma subclasse isolada.
    O restante do sistema nunca sabe qual CRM está por baixo.
    """

    def __init__(self, tenant_id: str, credentials: dict) -> None:
        self.tenant_id = tenant_id
        self.credentials = credentials

    # ── Leitura ────────────────────────────────────────────────────────────────

    @abstractmethod
    async def get_contacts(
        self,
        since: Optional[datetime] = None,
    ) -> list[NormalizedContact]:
        """Retorna contatos criados/atualizados desde `since` (ou todos se None)."""
        ...

    @abstractmethod
    async def get_appointments(
        self,
        since: Optional[datetime] = None,
    ) -> list[NormalizedAppointment]:
        """Retorna agendamentos/tarefas desde `since`."""
        ...

    @abstractmethod
    async def get_deals(
        self,
        contact_id: str,
    ) -> list[NormalizedDeal]:
        """Retorna negócios (leads/oportunidades) de um contato específico."""
        ...

    @abstractmethod
    async def get_activities(
        self,
        contact_id: str,
    ) -> list[NormalizedActivity]:
        """Retorna atividades (calls, notas, e-mails) de um contato específico."""
        ...

    # ── Webhook ────────────────────────────────────────────────────────────────

    @abstractmethod
    async def handle_webhook(self, payload: dict) -> None:
        """
        Processa payload de webhook recebido do CRM.
        O payload já chega parseado (dict) — a camada HTTP faz o decode.
        """
        ...

    # ── Verificação ────────────────────────────────────────────────────────────

    @abstractmethod
    async def verify_credentials(self) -> bool:
        """Testa se as credenciais estão válidas. Retorna True se OK."""
        ...

    # ── Helpers (não abstratos) ────────────────────────────────────────────────

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} tenant={self.tenant_id}>"
