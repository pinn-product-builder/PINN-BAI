"""
Meta Ads Adapter — Marketing API v20

Docs: https://developers.facebook.com/docs/marketing-api/
Credenciais esperadas:
    access_token (str): Long-lived user or system user token
    account_id   (str): Ad account ID no formato "act_XXXXXXXXX"
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Optional

import httpx

from core.ads.base import AdAdapter, register_ad_adapter
from core.ads.types import NormalizedAdSet, NormalizedCampaign, NormalizedDailyMetrics

logger = logging.getLogger(__name__)

_BASE = "https://graph.facebook.com/v20.0"

# Mapeamento de objective code → label legível
_OBJECTIVE_MAP: dict[str, str] = {
    "OUTCOME_LEADS": "Geração de Leads",
    "OUTCOME_SALES": "Vendas",
    "OUTCOME_TRAFFIC": "Tráfego",
    "OUTCOME_AWARENESS": "Reconhecimento",
    "OUTCOME_ENGAGEMENT": "Engajamento",
    "OUTCOME_APP_PROMOTION": "Promoção de App",
    "LEAD_GENERATION": "Geração de Leads",
    "CONVERSIONS": "Conversões",
    "LINK_CLICKS": "Cliques no Link",
    "REACH": "Alcance",
    "VIDEO_VIEWS": "Visualizações de Vídeo",
    "BRAND_AWARENESS": "Reconhecimento de Marca",
}

# Métricas de insights solicitadas à API
_INSIGHT_FIELDS = (
    "campaign_id,campaign_name,adset_id,adset_name,"
    "date_start,date_stop,"
    "impressions,clicks,spend,reach,"
    "actions,action_values"
)


def _extract_action(actions: list[dict], action_type: str) -> int:
    for a in (actions or []):
        if a.get("action_type") == action_type:
            try:
                return int(float(a.get("value", 0)))
            except (ValueError, TypeError):
                return 0
    return 0


def _extract_action_value(action_values: list[dict], action_type: str) -> float:
    for a in (action_values or []):
        if a.get("action_type") == action_type:
            try:
                return float(a.get("value", 0))
            except (ValueError, TypeError):
                return 0.0
    return 0.0


@register_ad_adapter("meta_ads")
class MetaAdsAdapter(AdAdapter):

    def __init__(self, tenant_id: str, credentials: dict) -> None:
        super().__init__(tenant_id, credentials)
        self._token: str = credentials["access_token"]
        self._account_id: str = credentials["account_id"]
        # Garantir que account_id tem o prefixo "act_"
        if not self._account_id.startswith("act_"):
            self._account_id = f"act_{self._account_id}"

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=_BASE, timeout=60.0)

    def _params(self, **extra) -> dict:
        return {"access_token": self._token, **extra}

    async def _paginate(self, client: httpx.AsyncClient, url: str, params: dict) -> list[dict]:
        results: list[dict] = []
        next_url: Optional[str] = url

        while next_url:
            if next_url == url:
                resp = await client.get(next_url, params=params)
            else:
                # Paginação: url completa com cursor
                resp = await client.get(next_url)

            resp.raise_for_status()
            body = resp.json()

            data = body.get("data") or []
            results.extend(data)

            paging = body.get("paging") or {}
            cursors = paging.get("cursors") or {}
            next_cursor = cursors.get("after") or paging.get("next")
            if not next_cursor or next_cursor == next_url:
                break

            # Se 'next' é URL completa, use-a; se não, adicione como parâmetro
            if next_cursor.startswith("http"):
                next_url = next_cursor
                params = {}
            else:
                params = {**params, "after": next_cursor}

        return results

    async def get_campaigns(self) -> list[NormalizedCampaign]:
        fields = "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time"
        async with self._client() as client:
            raw = await self._paginate(
                client,
                f"/{self._account_id}/campaigns",
                self._params(fields=fields, limit=100),
            )

        campaigns: list[NormalizedCampaign] = []
        for c in raw:
            try:
                daily_budget = float(c["daily_budget"]) / 100 if c.get("daily_budget") else None
                lifetime_budget = float(c["lifetime_budget"]) / 100 if c.get("lifetime_budget") else None
                start_date = date.fromisoformat(c["start_time"][:10]) if c.get("start_time") else None
                end_date = date.fromisoformat(c["stop_time"][:10]) if c.get("stop_time") else None

                campaigns.append(NormalizedCampaign(
                    external_id=str(c["id"]),
                    account_id=self._account_id,
                    name=c.get("name", ""),
                    status=c.get("status", "UNKNOWN"),
                    objective=_OBJECTIVE_MAP.get(c.get("objective", ""), c.get("objective")),
                    daily_budget=daily_budget,
                    lifetime_budget=lifetime_budget,
                    start_date=start_date,
                    end_date=end_date,
                    raw=c,
                ))
            except Exception as exc:
                logger.warning("Meta Ads: campanha ignorada (id=%s): %s", c.get("id"), exc)

        return campaigns

    async def get_adsets(self, campaign_id: str) -> list[NormalizedAdSet]:
        fields = "id,name,status,daily_budget,campaign_id"
        async with self._client() as client:
            raw = await self._paginate(
                client,
                f"/{campaign_id}/adsets",
                self._params(fields=fields, limit=100),
            )

        adsets: list[NormalizedAdSet] = []
        for a in raw:
            try:
                adsets.append(NormalizedAdSet(
                    external_id=str(a["id"]),
                    campaign_id=campaign_id,
                    name=a.get("name", ""),
                    status=a.get("status", "UNKNOWN"),
                    daily_budget=float(a["daily_budget"]) / 100 if a.get("daily_budget") else None,
                    raw=a,
                ))
            except Exception as exc:
                logger.warning("Meta Ads: adset ignorado (id=%s): %s", a.get("id"), exc)

        return adsets

    async def get_daily_metrics(
        self,
        date_start: date,
        date_end: date,
        campaign_id: Optional[str] = None,
    ) -> list[NormalizedDailyMetrics]:
        params = self._params(
            fields=_INSIGHT_FIELDS,
            level="adset",
            time_increment=1,
            time_range=f'{{"since":"{date_start.isoformat()}","until":"{date_end.isoformat()}"}}',
            limit=100,
        )

        base_url = f"/{campaign_id}/insights" if campaign_id else f"/{self._account_id}/insights"

        async with self._client() as client:
            raw = await self._paginate(client, base_url, params)

        metrics: list[NormalizedDailyMetrics] = []
        for row in raw:
            try:
                actions = row.get("actions") or []
                action_values = row.get("action_values") or []

                leads = (
                    _extract_action(actions, "lead") +
                    _extract_action(actions, "offsite_conversion.fb_pixel_lead") +
                    _extract_action(actions, "onsite_conversion.lead_grouped")
                )
                purchases = (
                    _extract_action(actions, "purchase") +
                    _extract_action(actions, "offsite_conversion.fb_pixel_purchase")
                )
                purchase_value = (
                    _extract_action_value(action_values, "purchase") +
                    _extract_action_value(action_values, "offsite_conversion.fb_pixel_purchase")
                )

                metrics.append(NormalizedDailyMetrics(
                    campaign_id=str(row["campaign_id"]),
                    adset_id=str(row.get("adset_id", "")),
                    date=date.fromisoformat(row["date_start"]),
                    impressions=int(row.get("impressions") or 0),
                    clicks=int(row.get("clicks") or 0),
                    spend=float(row.get("spend") or 0),
                    reach=int(row.get("reach") or 0) if row.get("reach") else None,
                    leads=leads,
                    purchases=purchases,
                    purchase_value=purchase_value,
                    raw=row,
                ))
            except Exception as exc:
                logger.warning("Meta Ads: métrica ignorada: %s", exc)

        return metrics

    async def verify_credentials(self) -> bool:
        try:
            async with self._client() as client:
                resp = await client.get(
                    f"/{self._account_id}",
                    params=self._params(fields="id,name,account_status"),
                )
            if resp.status_code == 200:
                data = resp.json()
                logger.info("Meta Ads: credenciais OK (tenant=%s, account=%s)", self.tenant_id, data.get("name"))
                return True
            logger.warning("Meta Ads: credenciais inválidas (status=%d)", resp.status_code)
            return False
        except httpx.RequestError as exc:
            logger.error("Meta Ads: erro de conexão (tenant=%s): %s", self.tenant_id, exc)
            return False
