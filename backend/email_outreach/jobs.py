"""Jobs periódicos do Email Outreach.

Sprint 1: apenas healthcheck de inboxes (a cada hora).
Sprint 3 vai adicionar:
    - dispatch_due_messages (a cada 30s)
    - send_queued_messages (a cada 30s)
Sprint 6 vai adicionar:
    - imap_reply_poller (a cada 3min)

Tudo vive num único ``AsyncIOScheduler`` para manter footprint baixo.
A inicialização acontece no ``startup`` event do FastAPI (main.py).
"""
from __future__ import annotations

import logging
import os

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from crm_auditor.jobs.snapshot_job import capture_daily_snapshots
from email_outreach.core.health import check_all_inboxes
from email_outreach.reply_poller import run_reply_poll
from email_outreach.sequencer import run_tick as run_sequencer_tick

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="UTC")
    return _scheduler


def start_scheduler() -> AsyncIOScheduler:
    """Idempotente — pode chamar várias vezes sem duplicar jobs."""
    sched = get_scheduler()

    # Se o módulo não tem credenciais, não faz sentido subir os jobs.
    if not os.getenv("SUPABASE_URL"):
        logger.warning("[email_outreach.jobs] SUPABASE_URL ausente, scheduler não iniciado.")
        return sched

    interval_minutes = int(os.getenv("EO_HEALTHCHECK_INTERVAL_MINUTES", "60"))
    job_id = "eo_healthcheck_inboxes"

    if not sched.get_job(job_id):
        sched.add_job(
            check_all_inboxes,
            trigger=IntervalTrigger(minutes=interval_minutes),
            id=job_id,
            name="Healthcheck periódico de inboxes EO",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        logger.info(
            "[email_outreach.jobs] Healthcheck registrado (a cada %d min).",
            interval_minutes,
        )

    # Sequencer (E2 Brick E) — drena fila de envios + avança enrollments.
    sequencer_seconds = int(os.getenv("EO_SEQUENCER_INTERVAL_SECONDS", "60"))
    sequencer_job_id = "eo_sequencer_tick"

    if not sched.get_job(sequencer_job_id):
        sched.add_job(
            run_sequencer_tick,
            trigger=IntervalTrigger(seconds=sequencer_seconds),
            id=sequencer_job_id,
            name="Sequencer tick (drena queue + avança enrollments)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        logger.info(
            "[email_outreach.jobs] Sequencer tick registrado (a cada %d s).",
            sequencer_seconds,
        )

    # Reply poller (E2 Brick F) — detecta replies/bounces nas inboxes Gmail.
    reply_minutes = int(os.getenv("EO_REPLY_POLL_INTERVAL_MINUTES", "3"))
    reply_job_id = "eo_reply_poll"

    if not sched.get_job(reply_job_id):
        sched.add_job(
            run_reply_poll,
            trigger=IntervalTrigger(minutes=reply_minutes),
            id=reply_job_id,
            name="Reply detection poll (Gmail inboxes)",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        logger.info(
            "[email_outreach.jobs] Reply poller registrado (a cada %d min).",
            reply_minutes,
        )

    # BAI — snapshot diário de KPIs (F8). Roda 03:30 UTC todo dia (≈ 00:30 BRT).
    snapshot_job_id = "bai_daily_kpi_snapshot"
    snapshot_hour = int(os.getenv("BAI_SNAPSHOT_HOUR_UTC", "3"))
    snapshot_minute = int(os.getenv("BAI_SNAPSHOT_MINUTE_UTC", "30"))

    if not sched.get_job(snapshot_job_id):
        sched.add_job(
            capture_daily_snapshots,
            trigger=CronTrigger(hour=snapshot_hour, minute=snapshot_minute),
            id=snapshot_job_id,
            name="Snapshot diário (D-1) de KPIs do BAI",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        logger.info(
            "[bai.jobs] KPI snapshot diário registrado (cron %02d:%02d UTC).",
            snapshot_hour, snapshot_minute,
        )

    if not sched.running:
        sched.start()
        logger.info("[email_outreach.jobs] Scheduler iniciado.")

    return sched


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[email_outreach.jobs] Scheduler encerrado.")
    _scheduler = None
