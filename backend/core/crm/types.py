from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class NormalizedContact:
    external_id: str
    name: str
    email: Optional[str]
    phone: Optional[str]
    created_at: datetime
    raw: dict = field(default_factory=dict)


@dataclass
class NormalizedAppointment:
    external_id: str
    contact_id: str          # external_id do contato no CRM
    scheduled_at: datetime
    status: str              # scheduled | completed | no_show | cancelled
    raw: dict = field(default_factory=dict)


@dataclass
class NormalizedDeal:
    external_id: str
    contact_id: str          # external_id do contato no CRM
    stage: str
    value: float
    created_at: datetime
    closed_at: Optional[datetime]
    raw: dict = field(default_factory=dict)


@dataclass
class NormalizedActivity:
    external_id: str
    contact_id: str          # external_id do contato no CRM
    type: str                # call | email | note | meeting
    happened_at: datetime
    raw: dict = field(default_factory=dict)
