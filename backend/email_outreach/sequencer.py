"""Sequencer worker do Email Outreach (E2 — Brick E).

Cada ``tick()`` faz duas passagens:

1. **Enrollment tick**: olha ``eo_campaign_leads`` enrolled cuja
   ``next_send_at`` chegou e enfileira a próxima mensagem em
   ``eo_messages`` (status=queued, scheduled_at=now), avançando
   ``current_step``.

2. **Send tick**: drena ``eo_messages`` queued cujo ``scheduled_at`` é
   passado, **respeita ``daily_limit`` por inbox em runtime** (msgs
   além do teto são re-agendadas pra próxima janela amanhã),
   **respeita send_window por timezone**, escolhe inbox via rotação
   ponderada das anexadas à campanha, envia via Gmail/SMTP, atualiza
   status + agenda próxima mensagem (delay do step seguinte).

Limitações conhecidas (próximos bricks):
- Outlook/SES adapter ausente. Tentativa em provider desconhecido
  marca como ``failed`` com mensagem clara.

O endpoint POST ``/email/sequencer/tick`` chama ``run_tick()``. APScheduler
(jobs.py) o registra pra rodar a cada N segundos via env
``EO_SEQUENCER_INTERVAL_SECONDS`` (default 60).
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from core.db import get_db
from email_outreach.adapters import gmail as gmail_adapter
from email_outreach.adapters import smtp as smtp_adapter
from email_outreach.core.crypto import decrypt_text, encrypt_text_pg
from email_outreach.templating import render_email_body
from email_outreach.tracking import inject_tracking, list_unsubscribe_headers

logger = logging.getLogger(__name__)

# Lock global pra impedir 2 run_tick() simultâneos no mesmo processo.
# (Defesa #2 contra duplicate-send; defesa #1 é o UNIQUE INDEX no DB.)
_tick_lock = asyncio.Lock()

# Quantas mensagens drenamos por tick (proteção contra flooding).
TICK_BATCH_SIZE = 25

# Domain pro Message-ID. Pode override via env se quisermos.
import os
MSGID_DOMAIN = os.environ.get("EO_MSGID_DOMAIN", "pinnpb.com")


# ── Variable rendering ──────────────────────────────────────────────────────


_VAR_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}")


def render_template(template: str, lead: dict[str, Any]) -> str:
    """Substitui ``{{first_name}}``, ``{{custom.foo}}`` etc com valores do lead."""

    def lookup(path: str) -> str:
        if path.startswith("custom."):
            cf = lead.get("custom_fields") or {}
            return str(cf.get(path[len("custom."):], ""))
        if path in lead:
            v = lead.get(path)
            return "" if v is None else str(v)
        return ""

    return _VAR_RE.sub(lambda m: lookup(m.group(1)), template)


# ── Send window enforcement ─────────────────────────────────────────────────


# Mapeia weekday() do datetime (0=segunda ... 6=domingo) → chave do send_window.
_WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _coerce_window_entry(entry: Any) -> tuple[int, int] | None:
    """Aceita ``[9,18]``, ``[9,18,outras_coisas]`` ou ``None``/``[]``.

    Retorna ``(start_hour, end_hour)`` válido em [0,24] ou ``None``
    se o dia não tem janela (= não envia).
    """
    if not entry:
        return None
    if not isinstance(entry, (list, tuple)) or len(entry) < 2:
        return None
    try:
        start = int(entry[0])
        end = int(entry[1])
    except (TypeError, ValueError):
        return None
    if start < 0 or end > 24 or start >= end:
        return None
    return (start, end)


def next_valid_send_at(
    now_utc: datetime,
    *,
    send_window: dict[str, Any] | None,
    tz_name: str = "America/Sao_Paulo",
) -> datetime:
    """Devolve o próximo ``datetime`` UTC dentro da janela de envio.

    - Se ``send_window`` é vazio/None → retorna ``now_utc`` (sem restrição).
    - Se ``now`` já está dentro da janela do dia → retorna ``now_utc``.
    - Senão, procura nas próximas 8 datas (cobre semana inteira mesmo
      com janelas todas desligadas em alguns dias).
    """
    if not send_window:
        return now_utc
    try:
        tz = ZoneInfo(tz_name or "America/Sao_Paulo")
    except Exception:
        tz = ZoneInfo("America/Sao_Paulo")

    local = now_utc.astimezone(tz)

    for offset in range(0, 8):
        candidate_date = (local + timedelta(days=offset)).date()
        weekday_idx = candidate_date.weekday()  # 0=mon
        key = _WEEKDAY_KEYS[weekday_idx]
        window = _coerce_window_entry(send_window.get(key))
        if not window:
            continue
        start_hour, end_hour = window

        # Constrói início/fim do dia em local.
        day_start = datetime(
            candidate_date.year, candidate_date.month, candidate_date.day,
            start_hour, 0, 0, tzinfo=tz,
        )
        day_end = datetime(
            candidate_date.year, candidate_date.month, candidate_date.day,
            end_hour, 0, 0, tzinfo=tz,
        )

        if offset == 0:
            # Hoje: precisamos respeitar `local` ≥ day_start E `local` < day_end.
            if local >= day_end:
                continue  # passou da janela, tenta amanhã
            if local < day_start:
                return day_start.astimezone(timezone.utc)
            # Dentro da janela.
            return now_utc
        else:
            return day_start.astimezone(timezone.utc)

    # Janela completamente vazia (todos dias desligados) — fallback: amanhã 9h.
    fallback = (local + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
    return fallback.astimezone(timezone.utc)


# ── Enrollment tick ─────────────────────────────────────────────────────────


async def _tick_enrollments(limit: int = TICK_BATCH_SIZE) -> int:
    """Avança campaign_leads due → cria eo_messages enfileiradas."""
    db = await get_db()
    now_iso = datetime.now(tz=timezone.utc).isoformat()

    # Pega N enrolled com next_send_at <= agora (ou NULL = primeira vez).
    # Filtramos campanha ativa via JOIN no app pra evitar SQL complexo.
    res = await (
        db.table("eo_campaign_leads")
        .select(
            "id, campaign_id, lead_id, current_step, variant_assignment, "
            "next_send_at, eo_campaigns(id, org_id, status), "
            "eo_leads(email, first_name, last_name, company, title, phone, "
            "linkedin_url, custom_fields, status)"
        )
        .eq("status", "enrolled")
        .or_(f"next_send_at.is.null,next_send_at.lte.{now_iso}")
        .limit(limit)
        .execute()
    )
    rows = res.data or []
    enrolled = 0

    for cl in rows:
        campaign = cl.get("eo_campaigns") or {}
        if campaign.get("status") != "active":
            continue
        lead = cl.get("eo_leads") or {}
        if lead.get("status") not in ("active", None):
            # Bounced/unsubscribed/suppressed → marca cl como tal.
            await (
                db.table("eo_campaign_leads")
                .update({
                    "status": lead.get("status", "failed"),
                    "status_reason": f"lead status: {lead.get('status')}",
                    "finished_at": now_iso,
                })
                .eq("id", cl["id"])
                .execute()
            )
            continue

        next_order = (cl.get("current_step") or 0) + 1

        # Encontra steps do próximo order (todas as variantes).
        steps_res = await (
            db.table("eo_sequence_steps")
            .select("*")
            .eq("campaign_id", cl["campaign_id"])
            .eq("step_order", next_order)
            .execute()
        )
        steps = steps_res.data or []
        if not steps:
            await (
                db.table("eo_campaign_leads")
                .update({"status": "finished", "finished_at": now_iso})
                .eq("id", cl["id"])
                .execute()
            )
            continue

        # Escolhe variante por peso (ou usa a já assinada pra este order).
        var_assignment = cl.get("variant_assignment") or {}
        chosen_variant = var_assignment.get(str(next_order))
        chosen_step = None
        if chosen_variant:
            chosen_step = next((s for s in steps if s["variant_label"] == chosen_variant), None)
        if chosen_step is None:
            chosen_step = _weighted_pick(steps, key="weight")
            var_assignment[str(next_order)] = chosen_step["variant_label"]

        # Escolhe inbox (com capacidade).
        inbox = await _pick_inbox_for_campaign(db, cl["campaign_id"])
        if not inbox:
            logger.info("Sem inbox disponível pra campaign_lead %s — adia 1 min", cl["id"])
            retry_at = (datetime.now(tz=timezone.utc) + timedelta(minutes=1)).isoformat()
            await db.table("eo_campaign_leads").update({"next_send_at": retry_at}).eq("id", cl["id"]).execute()
            continue

        # Render templates com vars do lead.
        subject = render_template(chosen_step["subject_template"], lead)
        body_html = render_template(chosen_step["body_template"], lead)

        # Threading: pega Message-ID/thread_id da última msg sent do mesmo cl
        in_reply_to = None
        thread_id = None
        if chosen_step["is_reply_to_previous"] and (cl.get("current_step") or 0) > 0:
            prev_res = await (
                db.table("eo_messages")
                .select("message_id_header, thread_id")
                .eq("campaign_lead_id", cl["id"])
                .eq("status", "sent")
                .order("sent_at", desc=True)
                .limit(1)
                .execute()
            )
            if prev_res.data:
                in_reply_to = prev_res.data[0].get("message_id_header")
                thread_id = prev_res.data[0].get("thread_id")

        msg_row = {
            "org_id": campaign["org_id"],
            "campaign_lead_id": cl["id"],
            "sequence_step_id": chosen_step["id"],
            "inbox_id": inbox["id"],
            "to_email": lead["email"],
            "to_name": _full_name(lead),
            "subject": subject,
            "body_html": body_html,
            "body_text": _html_to_text(body_html),
            "in_reply_to_header": in_reply_to,
            "thread_id": thread_id,
            "scheduled_at": now_iso,
            "status": "queued",
        }
        try:
            ins = await db.table("eo_messages").insert(msg_row).execute()
        except Exception as exc:
            # Defesa #3 contra duplicate-send: se o UNIQUE INDEX
            # eo_messages_unique_step_per_lead estourar, significa que
            # outro tick (talvez de outra instância do backend) já
            # enfileirou esta mesma message — log e segue normal.
            msg = str(exc).lower()
            if "duplicate" in msg or "unique" in msg or "23505" in msg:
                logger.warning(
                    "duplicate insert blocked for campaign_lead=%s step=%s (race vencida por outro tick) — ignorando",
                    cl["id"], chosen_step["id"],
                )
                # Mesmo bloqueado, precisamos avançar current_step do cl
                # senão o tick seguinte tenta o mesmo step de novo.
                await (
                    db.table("eo_campaign_leads")
                    .update({
                        "current_step": next_order,
                        "variant_assignment": var_assignment,
                        "next_send_at": None,
                    })
                    .eq("id", cl["id"])
                    .execute()
                )
                continue
            raise
        if not (ins.data or []):
            continue

        # Atualiza campaign_lead: avança step, salva variant_assignment, limpa next_send_at
        # (será recalculado após o envio).
        await (
            db.table("eo_campaign_leads")
            .update({
                "current_step": next_order,
                "variant_assignment": var_assignment,
                "next_send_at": None,
            })
            .eq("id", cl["id"])
            .execute()
        )
        enrolled += 1

    return enrolled


# ── Send tick ───────────────────────────────────────────────────────────────


async def _tick_send_queue(limit: int = TICK_BATCH_SIZE) -> dict[str, int]:
    db = await get_db()
    now_utc = datetime.now(tz=timezone.utc)
    now_iso = now_utc.isoformat()
    res = await (
        db.table("eo_messages")
        .select("*")
        .eq("status", "queued")
        .lte("scheduled_at", now_iso)
        .order("scheduled_at")
        .limit(limit)
        .execute()
    )
    msgs = res.data or []
    sent = 0
    failed = 0
    deferred = 0
    rate_limited = 0

    # Pré-busca settings (timezone + send_window) das campanhas afetadas
    # pra evitar 1 query por mensagem.
    campaign_lead_ids = list({m["campaign_lead_id"] for m in msgs if m.get("campaign_lead_id")})
    window_by_cl: dict[str, dict[str, Any]] = {}
    if campaign_lead_ids:
        cls_res = await (
            db.table("eo_campaign_leads")
            .select("id, eo_campaigns(timezone, send_window)")
            .in_("id", campaign_lead_ids)
            .execute()
        )
        for row in cls_res.data or []:
            window_by_cl[row["id"]] = row.get("eo_campaigns") or {}

    # Pré-busca dailylimits + uso 24h das inboxes envolvidas, pra evitar
    # N queries de count por mensagem. Cache fica vivo só dentro deste tick.
    inbox_ids = list({m["inbox_id"] for m in msgs if m.get("inbox_id")})
    inbox_meta: dict[str, dict[str, Any]] = {}
    if inbox_ids:
        ib_res = await (
            db.table("eo_inboxes")
            .select("id, email, daily_limit, status")
            .in_("id", inbox_ids)
            .execute()
        )
        cutoff_24h = (now_utc - timedelta(hours=24)).isoformat()
        for ib in ib_res.data or []:
            used_res = await (
                db.table("eo_messages")
                .select("id", count="exact")
                .eq("inbox_id", ib["id"])
                .eq("status", "sent")
                .gte("sent_at", cutoff_24h)
                .limit(1)
                .execute()
            )
            inbox_meta[ib["id"]] = {
                "daily_limit": int(ib.get("daily_limit") or 50),
                "used_24h": int(used_res.count or 0),
                "email": ib.get("email"),
                "status": ib.get("status"),
                "sent_this_tick": 0,
            }

    for m in msgs:
        # ── Send window enforcement ──────────────────────────────────
        camp = window_by_cl.get(m.get("campaign_lead_id"), {})
        next_at = next_valid_send_at(
            now_utc,
            send_window=camp.get("send_window"),
            tz_name=camp.get("timezone") or "America/Sao_Paulo",
        )
        if next_at > now_utc:
            # Fora da janela: reagenda pra próximo slot válido.
            await (
                db.table("eo_messages")
                .update({"scheduled_at": next_at.isoformat()})
                .eq("id", m["id"])
                .execute()
            )
            deferred += 1
            continue

        # ── Daily limit enforcement (warmup safety) ──────────────────
        meta = inbox_meta.get(m["inbox_id"])
        if meta is not None:
            total_today = meta["used_24h"] + meta["sent_this_tick"]
            if total_today >= meta["daily_limit"]:
                # Inbox saturada nas últimas 24h. Posterga essa msg pro
                # próximo slot válido AMANHÃ na janela (mantém ordenação:
                # vai sair como 1ª da próxima janela).
                tomorrow = now_utc + timedelta(hours=24)
                next_window = next_valid_send_at(
                    tomorrow,
                    send_window=camp.get("send_window"),
                    tz_name=camp.get("timezone") or "America/Sao_Paulo",
                )
                await (
                    db.table("eo_messages")
                    .update({"scheduled_at": next_window.isoformat()})
                    .eq("id", m["id"])
                    .execute()
                )
                rate_limited += 1
                logger.info(
                    "rate-limit hit pra inbox %s (%s/%s usadas) — msg %s adiada pra %s",
                    meta.get("email"), total_today, meta["daily_limit"],
                    m["id"], next_window.isoformat(),
                )
                continue

        try:
            await _send_one(db, m)
            sent += 1
            if meta is not None:
                meta["sent_this_tick"] += 1
        except Exception as exc:
            failed += 1
            logger.exception("Falha ao enviar message %s", m["id"])
            await (
                db.table("eo_messages")
                .update({
                    "status": "failed",
                    "error_message": str(exc)[:500],
                    "last_attempt_at": datetime.now(tz=timezone.utc).isoformat(),
                })
                .eq("id", m["id"])
                .execute()
            )

    return {
        "sent": sent,
        "failed": failed,
        "deferred": deferred,
        "rate_limited": rate_limited,
        "total": len(msgs),
    }


async def _send_one(db: Any, msg: dict[str, Any]) -> None:
    # Marca sending pra detectar zombie tasks.
    await (
        db.table("eo_messages")
        .update({
            "status": "sending",
            "attempt_count": (msg.get("attempt_count") or 0) + 1,
            "last_attempt_at": datetime.now(tz=timezone.utc).isoformat(),
        })
        .eq("id", msg["id"])
        .execute()
    )

    inbox_res = await db.table("eo_inboxes").select("*").eq("id", msg["inbox_id"]).limit(1).execute()
    inbox_rows = inbox_res.data or []
    if not inbox_rows:
        raise RuntimeError(f"inbox {msg['inbox_id']} sumiu")
    inbox = inbox_rows[0]
    if inbox["status"] != "active":
        raise RuntimeError(f"inbox {inbox['email']} status={inbox['status']}")

    # Pega flags de tracking da campanha (via campaign_lead).
    track_opens = True
    track_clicks = True
    try:
        cl_res = await (
            db.table("eo_campaign_leads")
            .select("eo_campaigns(track_opens, track_clicks)")
            .eq("id", msg["campaign_lead_id"])
            .limit(1)
            .execute()
        )
        cl_rows = cl_res.data or []
        camp = (cl_rows[0].get("eo_campaigns") if cl_rows else {}) or {}
        track_opens = bool(camp.get("track_opens", True))
        track_clicks = bool(camp.get("track_clicks", True))
    except Exception:
        logger.warning("Não consegui ler flags de tracking; usando defaults true/true")

    # Aplica templating Pinn Smart (normalização de parágrafos + estilos
    # inline + assinatura da inbox + wrapper). Resultado é o HTML
    # "pronto pra leitura" antes do tracking.
    body_html_rendered = render_email_body(msg["body_html"], inbox=inbox)

    # Injeta pixel + click rewrite + unsubscribe footer no corpo.
    body_html_tracked = inject_tracking(
        body_html_rendered,
        msg["id"],
        track_opens=track_opens,
        track_clicks=track_clicks,
    )
    extra_headers = list_unsubscribe_headers(msg["id"])

    provider = inbox["provider"]
    from_email = inbox["email"]
    from_name = inbox.get("display_name") or None

    message_id_header: str | None = None
    thread_id: str | None = msg.get("thread_id")
    provider_response: dict[str, Any] = {}

    if provider == "gmail":
        access_token = await _ensure_gmail_token(db, inbox)
        message_id_header, raw_b64 = gmail_adapter.build_rfc5322_message(
            from_email=from_email,
            from_name=from_name,
            to_email=msg["to_email"],
            to_name=msg.get("to_name"),
            subject=msg["subject"],
            body_html=body_html_tracked,
            body_text=msg.get("body_text"),
            in_reply_to=msg.get("in_reply_to_header"),
            references=msg.get("in_reply_to_header"),
            message_id_domain=MSGID_DOMAIN,
            extra_headers=extra_headers,
        )
        result = await gmail_adapter.send_message(access_token, raw_b64, thread_id=thread_id)
        thread_id = result.get("threadId")
        provider_response = result

    elif provider == "smtp":
        if not inbox.get("smtp_password_enc"):
            raise RuntimeError("inbox SMTP sem senha criptografada")
        password = decrypt_text(inbox["smtp_password_enc"])
        message_id_header, em = smtp_adapter.build_message(
            from_email=from_email,
            from_name=from_name,
            to_email=msg["to_email"],
            to_name=msg.get("to_name"),
            subject=msg["subject"],
            body_html=body_html_tracked,
            body_text=msg.get("body_text"),
            in_reply_to=msg.get("in_reply_to_header"),
            references=msg.get("in_reply_to_header"),
            message_id_domain=MSGID_DOMAIN,
            extra_headers=extra_headers,
        )
        # smtplib é bloqueante — roda em thread pra não travar o event loop.
        import asyncio

        await asyncio.to_thread(
            smtp_adapter.send_smtp,
            smtp_host=inbox["smtp_host"],
            smtp_port=inbox["smtp_port"],
            smtp_username=inbox["smtp_username"],
            smtp_password=password,
            msg=em,
        )
        provider_response = {"transport": "smtp", "host": inbox["smtp_host"]}

    else:
        raise RuntimeError(f"provider '{provider}' ainda sem adapter de envio")

    sent_at_iso = datetime.now(tz=timezone.utc).isoformat()
    await (
        db.table("eo_messages")
        .update({
            "status": "sent",
            "sent_at": sent_at_iso,
            "message_id_header": message_id_header,
            "thread_id": thread_id,
            "provider_response": provider_response,
            "error_message": None,
        })
        .eq("id", msg["id"])
        .execute()
    )
    await (
        db.table("eo_inboxes")
        .update({"last_sent_at": sent_at_iso})
        .eq("id", inbox["id"])
        .execute()
    )

    # Agenda próximo step (se houver) — calcula next_send_at do campaign_lead.
    step_res = await (
        db.table("eo_sequence_steps")
        .select("step_order, campaign_id")
        .eq("id", msg["sequence_step_id"])
        .limit(1)
        .execute()
    )
    step_rows = step_res.data or []
    step = step_rows[0] if step_rows else {}
    next_order = (step.get("step_order") or 0) + 1
    next_steps_res = await (
        db.table("eo_sequence_steps")
        .select("delay_days, delay_hours")
        .eq("campaign_id", step.get("campaign_id"))
        .eq("step_order", next_order)
        .limit(1)
        .execute()
    )
    if next_steps_res.data:
        delay = next_steps_res.data[0]
        raw_next = datetime.now(tz=timezone.utc) + timedelta(
            days=int(delay.get("delay_days") or 0),
            hours=int(delay.get("delay_hours") or 0),
        )
        # Garante que cai dentro da janela da campanha (ex: bump em 3 dias
        # caindo num sábado → empurra pra próxima segunda 9h).
        cl_camp_res = await (
            db.table("eo_campaign_leads")
            .select("eo_campaigns(timezone, send_window)")
            .eq("id", msg["campaign_lead_id"])
            .limit(1)
            .execute()
        )
        cl_camp = ((cl_camp_res.data or [{}])[0].get("eo_campaigns") or {})
        next_at = next_valid_send_at(
            raw_next,
            send_window=cl_camp.get("send_window"),
            tz_name=cl_camp.get("timezone") or "America/Sao_Paulo",
        )
        await (
            db.table("eo_campaign_leads")
            .update({"next_send_at": next_at.isoformat()})
            .eq("id", msg["campaign_lead_id"])
            .execute()
        )
    else:
        # Acabou a sequência.
        await (
            db.table("eo_campaign_leads")
            .update({"status": "finished", "finished_at": sent_at_iso})
            .eq("id", msg["campaign_lead_id"])
            .execute()
        )


# ── Inbox picking ───────────────────────────────────────────────────────────


async def _pick_inbox_for_campaign(db: Any, campaign_id: str) -> dict[str, Any] | None:
    """Escolhe uma inbox da campanha por peso, respeitando daily_limit.

    Conta envios das últimas 24h por inbox. Se nenhuma tem capacidade,
    devolve ``None`` (chamador adia).
    """
    cins_res = await (
        db.table("eo_campaign_inboxes")
        .select("inbox_id, weight, eo_inboxes(id, email, status, provider, daily_limit)")
        .eq("campaign_id", campaign_id)
        .execute()
    )
    rows = cins_res.data or []
    if not rows:
        return None

    cutoff = (datetime.now(tz=timezone.utc) - timedelta(hours=24)).isoformat()
    candidates: list[tuple[int, dict[str, Any]]] = []
    for row in rows:
        ib = row.get("eo_inboxes") or {}
        if ib.get("status") != "active":
            continue
        used_res = await (
            db.table("eo_messages")
            .select("id", count="exact")
            .eq("inbox_id", row["inbox_id"])
            .eq("status", "sent")
            .gte("sent_at", cutoff)
            .limit(1)
            .execute()
        )
        used = used_res.count or 0
        if used >= int(ib.get("daily_limit") or 50):
            continue
        candidates.append((int(row.get("weight") or 1), ib))

    if not candidates:
        return None

    return _weighted_pick([
        {"_weight": w, "_inbox": ib} for w, ib in candidates
    ], key="_weight")["_inbox"]


# ── OAuth refresh ───────────────────────────────────────────────────────────


REFRESH_THRESHOLD_SECONDS = 5 * 60


async def _ensure_gmail_token(db: Any, inbox: dict[str, Any]) -> str:
    """Pega access_token fresco da inbox Gmail, refreshando se vencido."""
    enc = inbox.get("oauth_tokens_enc")
    if not enc:
        raise RuntimeError("inbox Gmail sem tokens OAuth")

    tokens = json.loads(decrypt_text(enc))
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_at_raw = inbox.get("oauth_expires_at")

    needs_refresh = not access_token
    if not needs_refresh and expires_at_raw:
        try:
            exp = datetime.fromisoformat(expires_at_raw.replace("Z", "+00:00"))
            if exp - datetime.now(tz=timezone.utc) < timedelta(seconds=REFRESH_THRESHOLD_SECONDS):
                needs_refresh = True
        except ValueError:
            needs_refresh = True

    if needs_refresh:
        if not refresh_token:
            raise RuntimeError("Gmail token expirado e sem refresh_token")
        refreshed = await gmail_adapter.refresh_access_token(refresh_token)
        access_token = refreshed["access_token"]
        new_expires = (
            datetime.now(tz=timezone.utc)
            + timedelta(seconds=int(refreshed.get("expires_in", 3600)))
        ).isoformat()
        new_tokens = {
            **tokens,
            "access_token": access_token,
            "refresh_token": refreshed.get("refresh_token") or refresh_token,
            "token_type": refreshed.get("token_type", "Bearer"),
        }
        await (
            db.table("eo_inboxes")
            .update({
                "oauth_tokens_enc": encrypt_text_pg(json.dumps(new_tokens)),
                "oauth_expires_at": new_expires,
            })
            .eq("id", inbox["id"])
            .execute()
        )

    return access_token


# ── Helpers ─────────────────────────────────────────────────────────────────


def _weighted_pick(items: list[dict[str, Any]], key: str = "weight") -> dict[str, Any]:
    weights = [max(1, int(it.get(key) or 1)) for it in items]
    return random.choices(items, weights=weights, k=1)[0]


def _full_name(lead: dict[str, Any]) -> str | None:
    fn = (lead.get("first_name") or "").strip()
    ln = (lead.get("last_name") or "").strip()
    full = " ".join(p for p in (fn, ln) if p).strip()
    return full or None


def _html_to_text(html: str) -> str:
    return re.sub(r"<[^>]+>", "", html).strip()


# ── Tick orquestrador ───────────────────────────────────────────────────────


async def run_tick() -> dict[str, Any]:
    """Roda um ciclo: enrollment + send. Chamado pelo scheduler ou endpoint manual.

    Protegido por ``_tick_lock`` (asyncio.Lock global do processo) pra evitar
    duplicate-send em race entre o tick automático do APScheduler e chamadas
    manuais via ``POST /email/sequencer/tick``. Para defesa entre múltiplas
    instâncias do backend, ver UNIQUE INDEX ``eo_messages_unique_step_per_lead``
    (migration 20260518200000) + tratamento de violation em ``_tick_enrollments``.
    """
    if _tick_lock.locked():
        logger.info("run_tick: outro tick em andamento, pulando este ciclo (proteção contra duplicate-send)")
        return {"enrolled": 0, "sent": 0, "failed": 0, "total": 0, "skipped": True}

    async with _tick_lock:
        enrolled = await _tick_enrollments()
        send_result = await _tick_send_queue()
        return {"enrolled": enrolled, **send_result}
