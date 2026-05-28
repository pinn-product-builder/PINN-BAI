"""Reply detection poller (E2 — Brick F).

A cada N minutos, pra cada inbox Gmail ativa:
1. Lista mensagens recentes (`in:inbox newer_than:1d`).
2. Pega ``In-Reply-To`` / ``References`` de cada uma.
3. Match contra ``eo_messages.message_id_header`` da nossa org.
4. Se casar:
   - Classifica: ``bounce`` (from contém mailer-daemon/postmaster ou
     header ``X-Failed-Recipients`` presente, ou ``Auto-Submitted: auto-replied``)
     vs ``reply`` (qualquer outro).
   - Insere ``eo_message_events`` (idempotente — não duplica).
   - Se ``stop_on_reply`` da campanha, marca ``eo_campaign_leads`` como replied/bounced.

IMAP poller pra SMTP fica pendente — feature flag adiciona quando precisar.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from core.db import get_db
from email_outreach.adapters import gmail as gmail_adapter
from email_outreach.core.crypto import decrypt_text

logger = logging.getLogger(__name__)


_MAX_MSGS_PER_INBOX = 50


def _classify_event(headers: dict[str, str]) -> str:
    """Decide entre 'reply' e 'bounce' baseado em headers."""
    from_h = (headers.get("From") or "").lower()
    auto = (headers.get("Auto-Submitted") or "").lower()
    failed = headers.get("X-Failed-Recipients")

    if failed or "auto-replied" in auto or auto == "auto-generated":
        return "bounce"
    if any(s in from_h for s in ("mailer-daemon", "postmaster@", "noreply-dmarc", "delivery@")):
        return "bounce"
    return "reply"


async def _ensure_gmail_access_token(db: Any, inbox: dict[str, Any]) -> str | None:
    """Reutiliza a lógica do sequencer pra refrescar Gmail. Retorna None se
    a inbox não está utilizável."""
    from email_outreach.sequencer import _ensure_gmail_token

    try:
        return await _ensure_gmail_token(db, inbox)
    except Exception:
        logger.exception("Falha ao refrescar token Gmail da inbox %s", inbox.get("id"))
        return None


async def poll_inbox_gmail(inbox: dict[str, Any]) -> dict[str, int]:
    """Processa replies/bounces de uma inbox Gmail. Retorna contadores."""
    db = await get_db()
    access_token = await _ensure_gmail_access_token(db, inbox)
    if not access_token:
        return {"checked": 0, "matched": 0, "errors": 1}

    org_id = inbox["org_id"]

    listed = await gmail_adapter.list_messages(
        access_token,
        query="in:inbox newer_than:1d",
        max_results=_MAX_MSGS_PER_INBOX,
    )

    matched = 0
    for entry in listed:
        msg_id = entry.get("id")
        if not msg_id:
            continue
        headers = await gmail_adapter.get_message_headers(access_token, msg_id)
        if not headers:
            continue

        in_reply_to = (headers.get("In-Reply-To") or "").strip()
        references = headers.get("References") or ""

        candidate_msgids: list[str] = []
        if in_reply_to:
            candidate_msgids.append(in_reply_to)
        # References é space-separated list — pega o último (mais próximo da thread).
        for ref in references.split():
            if ref and ref not in candidate_msgids:
                candidate_msgids.append(ref)

        if not candidate_msgids:
            continue

        # Procura uma das nossas eo_messages com esse Message-ID header.
        match_res = await (
            db.table("eo_messages")
            .select("id, campaign_lead_id, status, message_id_header, "
                    "eo_campaign_leads(campaign_id, lead_id, "
                    "eo_campaigns(stop_on_reply))")
            .eq("org_id", org_id)
            .in_("message_id_header", candidate_msgids)
            .limit(1)
            .execute()
        )
        if not match_res.data:
            continue

        our_msg = match_res.data[0]
        event_type = _classify_event(headers)

        # Idempotência: não duplica eventos pro mesmo message_id+gmail_msg_id.
        existing = await (
            db.table("eo_message_events")
            .select("id", count="exact")
            .eq("message_id", our_msg["id"])
            .eq("event_type", event_type)
            .contains("metadata", {"gmail_msg_id": msg_id})
            .limit(1)
            .execute()
        )
        if (existing.count or 0) > 0:
            continue

        await db.table("eo_message_events").insert({
            "message_id": our_msg["id"],
            "event_type": event_type,
            "metadata": {
                "gmail_msg_id": msg_id,
                "from": headers.get("From"),
                "subject": headers.get("Subject"),
                "via": "gmail_poll",
            },
        }).execute()
        matched += 1

        cl = our_msg.get("eo_campaign_leads") or {}
        camp = (cl or {}).get("eo_campaigns") or {}
        if event_type == "reply" and camp.get("stop_on_reply"):
            await (
                db.table("eo_campaign_leads")
                .update({
                    "status": "replied",
                    "status_reason": f"reply detected via gmail_poll (gmail_msg={msg_id})",
                    "finished_at": datetime.now(tz=timezone.utc).isoformat(),
                })
                .eq("id", our_msg["campaign_lead_id"])
                .execute()
            )
        elif event_type == "bounce":
            # Bounce sempre para a sequência E marca o lead.
            if cl.get("lead_id"):
                await (
                    db.table("eo_leads")
                    .update({"status": "bounced"})
                    .eq("id", cl["lead_id"])
                    .execute()
                )
            await (
                db.table("eo_campaign_leads")
                .update({
                    "status": "bounced",
                    "status_reason": f"bounce detected: {headers.get('From', '?')}",
                    "finished_at": datetime.now(tz=timezone.utc).isoformat(),
                })
                .eq("id", our_msg["campaign_lead_id"])
                .execute()
            )

    return {"checked": len(listed), "matched": matched, "errors": 0}


async def run_reply_poll() -> dict[str, Any]:
    """Itera todas as inboxes Gmail ativas e poll cada uma."""
    db = await get_db()
    res = await (
        db.table("eo_inboxes")
        .select("*")
        .eq("status", "active")
        .eq("provider", "gmail")
        .execute()
    )
    inboxes = res.data or []

    total = {"inboxes": len(inboxes), "checked": 0, "matched": 0, "errors": 0}
    for ib in inboxes:
        try:
            r = await poll_inbox_gmail(ib)
            total["checked"] += r.get("checked", 0)
            total["matched"] += r.get("matched", 0)
            total["errors"] += r.get("errors", 0)
        except Exception:
            logger.exception("Falha no reply poll da inbox %s", ib.get("id"))
            total["errors"] += 1

    return total
