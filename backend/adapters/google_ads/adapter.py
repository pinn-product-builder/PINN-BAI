"""
Google Ads Adapter — Google Ads API v17 (REST/protobuf)

Docs: https://developers.google.com/google-ads/api/docs
Credenciais esperadas:
    developer_token (str): Token de desenvolvedor Google Ads
    customer_id     (str): ID do cliente (ex: "123-456-7890" ou "1234567890")
    refresh_token   (str): OAuth2 refresh token
    client_id       (str): OAuth client ID (opcional se usar service account)
    client_secret   (str): OAuth client secret (opcional se usar service account)
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Optional

import httpx

from core.ads.base import AdAdapter, register_ad_adapter
from core.ads.types import NormalizedAdSet, NormalizedCampaign, NormalizedDailyMetrics

logger = logging.getLogger(__name__)

_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
_ADS_BASE = "https://googleads.googleapis.com/v17"

_CAMPAIGN_STATUS_MAP: dict[int, str] = {
    0: "UNSPECIFIED",
    1: "UNKNOWN",
    2: "ENABLED",
    3: "PAUSED",
    4: "REMOVED",
}

_CAMPAIGN_OBJECTIVE_MAP: dict[int, str] = {
    0: "UNSPECIFIED",
    2: "SEARCH",
    3: "DISPLAY",
    4: "SHOPPING",
    5: "HOTEL",
    6: "VIDEO",
    7: "MULTI_CHANNEL",
    8: "LOCAL",
    9: "SMART",
    10: "PERFORMANCE_MAX",
    11: "LOCAL_SERVICES",
    12: "DISCOVERY",
    13: "TRAVEL",
}


@register_ad_adapter("google_ads")
class GoogleAdsAdapter(AdAdapter):

    def __init__(self, tenant_id: str, credentials: dict) -> None:
        super().__init__(tenant_id, credentials)
        self._developer_token: str = credentials["developer_token"]
        self._customer_id: str = credentials["customer_id"].replace("-", "")
        self._refresh_token: str = credentials["refresh_token"]
        self._client_id: str = credentials.get("client_id", "")
        self._client_secret: str = credentials.get("client_secret", "")
        self._access_token: Optional[str] = None

    async def _get_access_token(self) -> str:
        if self._access_token:
            return self._access_token

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                _OAUTH_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                },
            )
            resp.raise_for_status()
            self._access_token = resp.json()["access_token"]

        return self._access_token

    def _headers(self, access_token: str) -> dict:
        return {
            "Authorization": f"Bearer {access_token}",
            "developer-token": self._developer_token,
            "Content-Type": "application/json",
        }

    async def _query(self, gaql: str) -> list[dict]:
        """Executa uma Google Ads Query Language (GAQL) e retorna todas as linhas."""
        token = await self._get_access_token()
        url = f"{_ADS_BASE}/customers/{self._customer_id}/googleAds:search"
        rows: list[dict] = []
        page_token: Optional[str] = None

        async with httpx.AsyncClient(timeout=60.0) as client:
            while True:
                body: dict = {"query": gaql, "pageSize": 1000}
                if page_token:
                    body["pageToken"] = page_token

                resp = await client.post(url, headers=self._headers(token), json=body)
                resp.raise_for_status()
                data = resp.json()

                rows.extend(data.get("results") or [])

                page_token = data.get("nextPageToken")
                if not page_token:
                    break

        return rows

    async def get_campaigns(self) -> list[NormalizedCampaign]:
        gaql = """
            SELECT
              campaign.id,
              campaign.name,
              campaign.status,
              campaign.advertising_channel_type,
              campaign.campaign_budget,
              campaign.start_date,
              campaign.end_date
            FROM campaign
            WHERE campaign.status != 'REMOVED'
        """
        rows = await self._query(gaql)
        campaigns: list[NormalizedCampaign] = []

        for row in rows:
            c = row.get("campaign", {})
            try:
                campaigns.append(NormalizedCampaign(
                    external_id=str(c.get("id", "")),
                    account_id=self._customer_id,
                    name=c.get("name", ""),
                    status=c.get("status", "UNKNOWN"),
                    objective=_CAMPAIGN_OBJECTIVE_MAP.get(c.get("advertisingChannelType", 0), "UNKNOWN"),
                    daily_budget=None,  # requer query separada em campaign_budget
                    lifetime_budget=None,
                    start_date=date.fromisoformat(c["startDate"]) if c.get("startDate") and c["startDate"] != "2037-12-30" else None,
                    end_date=date.fromisoformat(c["endDate"]) if c.get("endDate") and c["endDate"] != "2037-12-30" else None,
                    raw=c,
                ))
            except Exception as exc:
                logger.warning("Google Ads: campanha ignorada (id=%s): %s", c.get("id"), exc)

        return campaigns

    async def get_adsets(self, campaign_id: str) -> list[NormalizedAdSet]:
        gaql = f"""
            SELECT
              ad_group.id,
              ad_group.name,
              ad_group.status,
              ad_group.campaign
            FROM ad_group
            WHERE ad_group.campaign = 'customers/{self._customer_id}/campaigns/{campaign_id}'
              AND ad_group.status != 'REMOVED'
        """
        rows = await self._query(gaql)
        adsets: list[NormalizedAdSet] = []

        for row in rows:
            a = row.get("adGroup", {})
            try:
                adsets.append(NormalizedAdSet(
                    external_id=str(a.get("id", "")),
                    campaign_id=campaign_id,
                    name=a.get("name", ""),
                    status=a.get("status", "UNKNOWN"),
                    daily_budget=None,
                    raw=a,
                ))
            except Exception as exc:
                logger.warning("Google Ads: adset ignorado (id=%s): %s", a.get("id"), exc)

        return adsets

    async def get_daily_metrics(
        self,
        date_start: date,
        date_end: date,
        campaign_id: Optional[str] = None,
    ) -> list[NormalizedDailyMetrics]:
        campaign_filter = (
            f"AND campaign.id = {campaign_id}" if campaign_id else ""
        )
        gaql = f"""
            SELECT
              campaign.id,
              ad_group.id,
              segments.date,
              metrics.impressions,
              metrics.clicks,
              metrics.cost_micros,
              metrics.conversions,
              metrics.conversions_value,
              metrics.all_conversions,
              metrics.view_through_conversions
            FROM ad_group
            WHERE segments.date BETWEEN '{date_start.isoformat()}' AND '{date_end.isoformat()}'
              AND campaign.status != 'REMOVED'
              {campaign_filter}
        """
        rows = await self._query(gaql)
        metrics: list[NormalizedDailyMetrics] = []

        for row in rows:
            try:
                m = row.get("metrics", {})
                segs = row.get("segments", {})
                campaign = row.get("campaign", {})
                adgroup = row.get("adGroup", {})

                spend = float(m.get("costMicros", 0)) / 1_000_000
                conversions = int(float(m.get("conversions", 0)))
                conversions_value = float(m.get("conversionsValue", 0))

                metrics.append(NormalizedDailyMetrics(
                    campaign_id=str(campaign.get("id", "")),
                    adset_id=str(adgroup.get("id", "")) if adgroup.get("id") else None,
                    date=date.fromisoformat(segs["date"]),
                    impressions=int(m.get("impressions", 0)),
                    clicks=int(m.get("clicks", 0)),
                    spend=spend,
                    reach=None,  # Google Ads não expõe reach facilmente
                    leads=conversions,
                    purchases=conversions,
                    purchase_value=conversions_value,
                    raw=row,
                ))
            except Exception as exc:
                logger.warning("Google Ads: métrica ignorada: %s", exc)

        return metrics

    async def verify_credentials(self) -> bool:
        try:
            gaql = "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1"
            rows = await self._query(gaql)
            if rows:
                customer = (rows[0].get("customer") or {})
                logger.info(
                    "Google Ads: credenciais OK (tenant=%s, account=%s)",
                    self.tenant_id,
                    customer.get("descriptiveName"),
                )
                return True
            return False
        except Exception as exc:
            logger.error("Google Ads: erro ao verificar credenciais (tenant=%s): %s", self.tenant_id, exc)
            return False
