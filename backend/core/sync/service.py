"""
SyncService — reads data from a CRM adapter and upserts it into Supabase.
"""
from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

from core.crm.registry import get_adapter
from core.db import get_db

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _serialise(obj: Any) -> Any:
    """Recursively convert datetimes to ISO strings for JSON storage."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _serialise(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialise(i) for i in obj]
    return obj


class SyncService:
    """Orchestrates a full CRM sync for a single tenant + CRM combination."""

    def __init__(self, tenant_id: str, crm_slug: str, credentials: dict) -> None:
        self.tenant_id = tenant_id
        self.crm_slug = crm_slug
        self.adapter = get_adapter(
            slug=crm_slug,
            tenant_id=tenant_id,
            credentials=credentials,
        )

    # ── Public entry point ────────────────────────────────────────────────────

    async def sync_all(self) -> dict:
        """
        Runs a full sync: contacts → appointments → per-contact deals & activities.
        Returns a dict with counts of upserted records per entity.
        """
        db = await get_db()
        synced_at = _now_iso()
        counts: dict[str, int] = {
            "contacts": 0,
            "appointments": 0,
            "deals": 0,
            "activities": 0,
        }

        # ── Mark connection as syncing ────────────────────────────────────────
        await db.table("crm_connections").update(
            {"sync_status": "syncing", "sync_error": None}
        ).eq("org_id", self.tenant_id).eq("crm_slug", self.crm_slug).execute()

        try:
            # ── Contacts ─────────────────────────────────────────────────────
            contacts = await self.adapter.get_contacts()
            if contacts:
                rows = [
                    {
                        "org_id": self.tenant_id,
                        "crm_slug": self.crm_slug,
                        "external_id": c.external_id,
                        "name": c.name,
                        "email": c.email,
                        "phone": c.phone,
                        "created_at": c.created_at.isoformat(),
                        "synced_at": synced_at,
                        "raw": _serialise(c.raw),
                    }
                    for c in contacts
                ]
                await db.table("crm_contacts").upsert(
                    rows, on_conflict="org_id,crm_slug,external_id"
                ).execute()
                counts["contacts"] = len(rows)

            # ── Appointments ─────────────────────────────────────────────────
            appointments = await self.adapter.get_appointments()
            if appointments:
                rows = [
                    {
                        "org_id": self.tenant_id,
                        "crm_slug": self.crm_slug,
                        "external_id": a.external_id,
                        "contact_id": a.contact_id,
                        "scheduled_at": a.scheduled_at.isoformat(),
                        "status": a.status,
                        "synced_at": synced_at,
                        "raw": _serialise(a.raw),
                    }
                    for a in appointments
                ]
                await db.table("crm_appointments").upsert(
                    rows, on_conflict="org_id,crm_slug,external_id"
                ).execute()
                counts["appointments"] = len(rows)

            # ── Per-contact deals & activities ────────────────────────────────
            deal_rows: list[dict] = []
            activity_rows: list[dict] = []

            for contact in contacts:
                cid = contact.external_id

                deals = await self.adapter.get_deals(contact_id=cid)
                for d in deals:
                    deal_rows.append(
                        {
                            "org_id": self.tenant_id,
                            "crm_slug": self.crm_slug,
                            "external_id": d.external_id,
                            "contact_id": cid,
                            "stage": d.stage,
                            "value": d.value,
                            "created_at": d.created_at.isoformat(),
                            "closed_at": d.closed_at.isoformat() if d.closed_at else None,
                            "synced_at": synced_at,
                            "raw": _serialise(d.raw),
                        }
                    )

                activities = await self.adapter.get_activities(contact_id=cid)
                for act in activities:
                    activity_rows.append(
                        {
                            "org_id": self.tenant_id,
                            "crm_slug": self.crm_slug,
                            "external_id": act.external_id,
                            "contact_id": cid,
                            "type": act.type,
                            "happened_at": act.happened_at.isoformat(),
                            "synced_at": synced_at,
                            "raw": _serialise(act.raw),
                        }
                    )

            if deal_rows:
                await db.table("crm_deals").upsert(
                    deal_rows, on_conflict="org_id,crm_slug,external_id"
                ).execute()
                counts["deals"] = len(deal_rows)

            if activity_rows:
                await db.table("crm_activities").upsert(
                    activity_rows, on_conflict="org_id,crm_slug,external_id"
                ).execute()
                counts["activities"] = len(activity_rows)

            # ── Mark success ──────────────────────────────────────────────────
            await db.table("crm_connections").update(
                {
                    "sync_status": "success",
                    "last_sync_at": synced_at,
                    "sync_error": None,
                    "updated_at": synced_at,
                }
            ).eq("org_id", self.tenant_id).eq("crm_slug", self.crm_slug).execute()

            logger.info(
                "Sync completo (tenant=%s, crm=%s): %s",
                self.tenant_id,
                self.crm_slug,
                counts,
            )
            return counts

        except Exception as exc:
            error_msg = str(exc)
            logger.error(
                "Sync falhou (tenant=%s, crm=%s): %s",
                self.tenant_id,
                self.crm_slug,
                error_msg,
            )
            await db.table("crm_connections").update(
                {
                    "sync_status": "error",
                    "sync_error": error_msg,
                    "updated_at": synced_at,
                }
            ).eq("org_id", self.tenant_id).eq("crm_slug", self.crm_slug).execute()
            raise
