from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from .base import get_ad_adapter
from core.db import get_db

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


class AdSyncService:
    """Sincroniza campanhas e métricas de uma plataforma de anúncios para o Supabase."""

    def __init__(self, tenant_id: str, platform_slug: str, credentials: dict) -> None:
        self.tenant_id = tenant_id
        self.platform_slug = platform_slug
        self.adapter = get_ad_adapter(
            slug=platform_slug,
            tenant_id=tenant_id,
            credentials=credentials,
        )

    async def sync_all(self, days_back: int = 30) -> dict:
        db = await get_db()
        synced_at = _now_iso()
        counts: dict[str, int] = {"campaigns": 0, "adsets": 0, "metrics": 0}

        await db.table("paid_traffic_connections").update(
            {"sync_status": "syncing", "sync_error": None}
        ).eq("org_id", self.tenant_id).eq("platform_slug", self.platform_slug).execute()

        try:
            # Campaigns
            campaigns = await self.adapter.get_campaigns()
            if campaigns:
                rows = [
                    {
                        "org_id": self.tenant_id,
                        "platform_slug": self.platform_slug,
                        "external_id": c.external_id,
                        "account_id": c.account_id,
                        "name": c.name,
                        "status": c.status,
                        "objective": c.objective,
                        "daily_budget": c.daily_budget,
                        "lifetime_budget": c.lifetime_budget,
                        "start_date": c.start_date.isoformat() if c.start_date else None,
                        "end_date": c.end_date.isoformat() if c.end_date else None,
                        "synced_at": synced_at,
                        "raw": c.raw,
                    }
                    for c in campaigns
                ]
                await db.table("paid_traffic_campaigns").upsert(
                    rows, on_conflict="org_id,platform_slug,external_id"
                ).execute()
                counts["campaigns"] = len(rows)

            # AdSets (per campaign)
            adset_rows: list[dict] = []
            for campaign in campaigns:
                adsets = await self.adapter.get_adsets(campaign.external_id)
                for a in adsets:
                    adset_rows.append({
                        "org_id": self.tenant_id,
                        "platform_slug": self.platform_slug,
                        "external_id": a.external_id,
                        "campaign_id": a.campaign_id,
                        "name": a.name,
                        "status": a.status,
                        "daily_budget": a.daily_budget,
                        "synced_at": synced_at,
                        "raw": a.raw,
                    })

            if adset_rows:
                await db.table("paid_traffic_adsets").upsert(
                    adset_rows, on_conflict="org_id,platform_slug,external_id"
                ).execute()
                counts["adsets"] = len(adset_rows)

            # Daily metrics
            date_end = date.today()
            date_start = date_end - timedelta(days=days_back)
            metrics = await self.adapter.get_daily_metrics(date_start, date_end)

            if metrics:
                metric_rows = [
                    {
                        "org_id": self.tenant_id,
                        "platform_slug": self.platform_slug,
                        "campaign_id": m.campaign_id,
                        "adset_id": m.adset_id,
                        "date": m.date.isoformat(),
                        "impressions": m.impressions,
                        "clicks": m.clicks,
                        "spend": m.spend,
                        "reach": m.reach,
                        "leads": m.leads,
                        "purchases": m.purchases,
                        "purchase_value": m.purchase_value,
                        "synced_at": synced_at,
                        "raw": m.raw,
                    }
                    for m in metrics
                ]
                await db.table("paid_traffic_daily_metrics").upsert(
                    metric_rows,
                    on_conflict="org_id,platform_slug,campaign_id,adset_id,date",
                ).execute()
                counts["metrics"] = len(metric_rows)

            await db.table("paid_traffic_connections").update(
                {"sync_status": "success", "last_sync_at": synced_at, "sync_error": None, "updated_at": synced_at}
            ).eq("org_id", self.tenant_id).eq("platform_slug", self.platform_slug).execute()

            logger.info("AdSync completo (tenant=%s, platform=%s): %s", self.tenant_id, self.platform_slug, counts)
            return counts

        except Exception as exc:
            err = str(exc)
            logger.error("AdSync falhou (tenant=%s, platform=%s): %s", self.tenant_id, self.platform_slug, err)
            await db.table("paid_traffic_connections").update(
                {"sync_status": "error", "sync_error": err, "updated_at": synced_at}
            ).eq("org_id", self.tenant_id).eq("platform_slug", self.platform_slug).execute()
            raise
