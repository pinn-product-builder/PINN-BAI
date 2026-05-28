"""Analytics de campanha (E2 — Brick G).

Endpoint:
- GET /email/campaigns/{cid}/analytics → CampaignAnalytics

Calcula aggregates a partir de eo_campaign_leads + eo_messages + eo_message_events.
Não usa view materializada — pra MVP, queries diretas são suficientes (não vai
ser chamado em alta frequência).
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException

from core.db import get_db
from email_outreach.models import CampaignAnalytics, StepFunnel, TopLead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email/campaigns", tags=["email-outreach:analytics"])


def _pct(num: int, den: int) -> float:
    return round((num / den) * 100, 1) if den else 0.0


@router.get("/{campaign_id}/analytics", response_model=CampaignAnalytics)
async def get_campaign_analytics(campaign_id: str) -> CampaignAnalytics:
    db = await get_db()

    # 1) Campaign leads — status distribution
    cl_res = await (
        db.table("eo_campaign_leads")
        .select("id, lead_id, current_step, status")
        .eq("campaign_id", campaign_id)
        .execute()
    )
    cls = cl_res.data or []
    cl_ids = [r["id"] for r in cls]
    total_enrolled = len(cls)
    by_status: dict[str, int] = {}
    for r in cls:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1

    active_enrollments = by_status.get("enrolled", 0) + by_status.get("paused", 0)
    finished = by_status.get("finished", 0)
    replied = by_status.get("replied", 0)
    bounced = by_status.get("bounced", 0)
    unsubscribed = by_status.get("unsubscribed", 0)

    # 2) Messages — counts por status (filtra pelas mensagens da campanha)
    msgs_res = await (
        db.table("eo_messages")
        .select("id, sequence_step_id, status, campaign_lead_id, to_email")
        .in_("campaign_lead_id", cl_ids if cl_ids else ["00000000-0000-0000-0000-000000000000"])
        .execute()
    )
    msgs = msgs_res.data or []
    msg_ids = [m["id"] for m in msgs]
    msg_status_count = {"sent": 0, "failed": 0, "queued": 0, "sending": 0}
    msgs_by_step: dict[str, list[dict[str, Any]]] = {}
    msg_to_cl: dict[str, str] = {}
    for m in msgs:
        msg_status_count[m["status"]] = msg_status_count.get(m["status"], 0) + 1
        msgs_by_step.setdefault(m["sequence_step_id"], []).append(m)
        msg_to_cl[m["id"]] = m["campaign_lead_id"]

    messages_sent = msg_status_count.get("sent", 0)
    messages_failed = msg_status_count.get("failed", 0)
    messages_queued = msg_status_count.get("queued", 0) + msg_status_count.get("sending", 0)

    # 3) Events — agrega open/click/reply/bounce
    if msg_ids:
        evt_res = await (
            db.table("eo_message_events")
            .select("message_id, event_type, occurred_at")
            .in_("message_id", msg_ids)
            .execute()
        )
        events = evt_res.data or []
    else:
        events = []

    # Unique recipients = unique campaign_lead_id (via msg_to_cl)
    open_msg_ids: set[str] = set()
    click_msg_ids: set[str] = set()
    reply_msg_ids: set[str] = set()
    bounce_msg_ids: set[str] = set()

    total_opens = 0
    total_clicks = 0

    last_event_per_cl: dict[str, datetime] = {}

    for e in events:
        mid = e["message_id"]
        et = e["event_type"]
        cl_id = msg_to_cl.get(mid)
        if et == "open":
            open_msg_ids.add(mid)
            total_opens += 1
        elif et == "click":
            click_msg_ids.add(mid)
            total_clicks += 1
        elif et == "reply":
            reply_msg_ids.add(mid)
        elif et == "bounce":
            bounce_msg_ids.add(mid)
        if cl_id:
            ts = e.get("occurred_at")
            if ts:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00")) if isinstance(ts, str) else ts
                prev = last_event_per_cl.get(cl_id)
                if not prev or (dt and dt > prev):
                    last_event_per_cl[cl_id] = dt

    # Unique recipients = msgs distintos com event (cada msg vai pra 1 cl, então count msg = count cl).
    unique_opens = len(open_msg_ids)
    unique_clicks = len(click_msg_ids)
    unique_replies = len(reply_msg_ids) or replied  # fallback via status do enrollment
    unique_bounces = len(bounce_msg_ids) or bounced

    # 4) Rates (denom = messages_sent)
    open_rate = _pct(unique_opens, messages_sent)
    click_rate = _pct(unique_clicks, messages_sent)
    reply_rate = _pct(unique_replies, messages_sent)
    bounce_rate = _pct(unique_bounces, messages_sent)

    # 5) Funnel por step (variantes agrupadas — soma todas)
    steps_res = await (
        db.table("eo_sequence_steps")
        .select("id, step_order, variant_label")
        .eq("campaign_id", campaign_id)
        .order("step_order")
        .order("variant_label")
        .execute()
    )
    steps = steps_res.data or []

    funnel: list[StepFunnel] = []
    grouped_by_order: dict[int, list[dict[str, Any]]] = {}
    for s in steps:
        grouped_by_order.setdefault(s["step_order"], []).append(s)

    for order, variants in sorted(grouped_by_order.items()):
        all_step_ids = [v["id"] for v in variants]
        step_msgs = [m for v in variants for m in msgs_by_step.get(v["id"], [])]
        step_msg_ids = {m["id"] for m in step_msgs}

        sent_count = sum(1 for m in step_msgs if m["status"] == "sent")
        opened = len(step_msg_ids & open_msg_ids)
        clicked = len(step_msg_ids & click_msg_ids)
        replied_step = len(step_msg_ids & reply_msg_ids)
        bounced_step = len(step_msg_ids & bounce_msg_ids)

        funnel.append(StepFunnel(
            step_order=order,
            variant_label=None,  # agregamos variantes; refinar futuramente
            sent=sent_count,
            opened=opened,
            clicked=clicked,
            replied=replied_step,
            bounced=bounced_step,
        ))

    # 6) Top leads — engajados (com >= 1 open ou já avançaram steps)
    top_leads: list[TopLead] = []
    if cl_ids:
        # Lê dados dos leads referenciados
        lead_ids = {r["lead_id"] for r in cls if r.get("lead_id")}
        leads_data: dict[str, dict[str, Any]] = {}
        if lead_ids:
            leads_res = await (
                db.table("eo_leads")
                .select("id, email, first_name, last_name, company")
                .in_("id", list(lead_ids))
                .execute()
            )
            for lr in (leads_res.data or []):
                leads_data[lr["id"]] = lr

        # Agrega por cl_id
        per_cl_msgs: dict[str, list[dict[str, Any]]] = {}
        for m in msgs:
            per_cl_msgs.setdefault(m["campaign_lead_id"], []).append(m)

        for cl in cls:
            cl_id = cl["id"]
            msgs_for_cl = per_cl_msgs.get(cl_id, [])
            cl_msg_ids = {m["id"] for m in msgs_for_cl}
            sent_count = sum(1 for m in msgs_for_cl if m["status"] == "sent")
            opens_count = len(cl_msg_ids & open_msg_ids)
            clicks_count = len(cl_msg_ids & click_msg_ids)
            replied_flag = bool(cl_msg_ids & reply_msg_ids) or cl["status"] == "replied"

            engagement_score = (
                opens_count * 1
                + clicks_count * 3
                + (5 if replied_flag else 0)
                + sent_count * 0.1
            )
            if engagement_score <= 0:
                continue

            lead = leads_data.get(cl.get("lead_id") or "", {})
            top_leads.append(TopLead(
                campaign_lead_id=cl_id,
                email=lead.get("email") or "—",
                name=" ".join(p for p in [lead.get("first_name"), lead.get("last_name")] if p).strip() or None,
                company=lead.get("company"),
                status=cl["status"],
                current_step=cl.get("current_step") or 0,
                sent_count=sent_count,
                opens=opens_count,
                clicks=clicks_count,
                replied=replied_flag,
                last_event_at=last_event_per_cl.get(cl_id),
            ))

        top_leads.sort(
            key=lambda t: (t.replied, t.clicks, t.opens, t.sent_count),
            reverse=True,
        )
        top_leads = top_leads[:20]

    return CampaignAnalytics(
        campaign_id=campaign_id,
        total_enrolled=total_enrolled,
        active_enrollments=active_enrollments,
        finished=finished,
        replied=replied,
        bounced=bounced,
        unsubscribed=unsubscribed,
        messages_sent=messages_sent,
        messages_failed=messages_failed,
        messages_queued=messages_queued,
        unique_opens=unique_opens,
        total_opens=total_opens,
        unique_clicks=unique_clicks,
        total_clicks=total_clicks,
        open_rate=open_rate,
        click_rate=click_rate,
        reply_rate=reply_rate,
        bounce_rate=bounce_rate,
        funnel=funnel,
        top_leads=top_leads,
    )
