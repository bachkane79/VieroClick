from celery import Celery
from celery.schedules import crontab

from app.settings import settings

celery_app = Celery(
    "vieroc_agent",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {
    # 07:30 UTC+7 = 00:30 UTC
    "morning-briefing": {
        "task": "app.workers.tasks.run_scheduled_morning_briefing",
        "schedule": crontab(hour=0, minute=30),
    },
    # 12:00 UTC+7 = 05:00 UTC
    "midday-health-scan": {
        "task": "app.workers.tasks.run_scheduled_health_scan",
        "schedule": crontab(hour=5, minute=0),
    },
    # 17:30 UTC+7 = 10:30 UTC
    "eod-report": {
        "task": "app.workers.tasks.run_scheduled_eod_report",
        "schedule": crontab(hour=10, minute=30),
    },
    # 09:00 UTC+7 = 02:00 UTC
    "escalation-scan": {
        "task": "app.workers.tasks.run_scheduled_escalation_scan",
        "schedule": crontab(hour=2, minute=0),
    },
    # 17:00 UTC+7 = 10:00 UTC
    "daily-update-reminder": {
        "task": "app.workers.tasks.run_scheduled_daily_update_reminder",
        "schedule": crontab(hour=10, minute=0),
    },
    # WP-E2: 03:00 UTC+7 = 20:00 UTC (previous day) — low-traffic hour
    "message-retention": {
        "task": "app.workers.tasks.run_scheduled_message_retention",
        "schedule": crontab(hour=20, minute=0),
    },
}
