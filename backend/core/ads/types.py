from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional


@dataclass
class NormalizedCampaign:
    external_id: str
    account_id: str
    name: str
    status: str           # ACTIVE | PAUSED | ARCHIVED | DELETED
    objective: Optional[str]
    daily_budget: Optional[float]
    lifetime_budget: Optional[float]
    start_date: Optional[date]
    end_date: Optional[date]
    raw: dict = field(default_factory=dict)


@dataclass
class NormalizedAdSet:
    external_id: str
    campaign_id: str
    name: str
    status: str
    daily_budget: Optional[float]
    raw: dict = field(default_factory=dict)


@dataclass
class NormalizedDailyMetrics:
    campaign_id: str
    adset_id: Optional[str]
    date: date
    impressions: int
    clicks: int
    spend: float
    reach: Optional[int]
    leads: int
    purchases: int
    purchase_value: float
    raw: dict = field(default_factory=dict)
