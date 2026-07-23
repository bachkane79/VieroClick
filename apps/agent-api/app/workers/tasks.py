import asyncio
from typing import Any

from app.agents import assigner, reporter
from app.db import queries
from app.workers.celery_app import celery_app
from app.workers.dead_letter import record_dead_letter


def run_async(coro: Any) -> Any:
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


class AgentTask(celery_app.Task):
    """Base task that records terminal failures (retries exhausted) to dead_letter."""

    def on_failure(self, exc: Exception, task_id: str, args: Any, kwargs: Any, einfo: Any) -> None:
        record_dead_letter(
            source=f"celery:{self.name}",
            error=str(exc),
            project_id=(kwargs or {}).get("project_id"),
            payload=(kwargs or {}).get("input_data") or {},
            retry_count=self.request.retries,
        )


# On-demand jobs: retry transient failures with exponential backoff, then dead-letter.
_RETRY_KW = dict(
    base=AgentTask,
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)


@celery_app.task(name="app.workers.tasks.generate_daily_report", bind=True, **_RETRY_KW)
def generate_daily_report(self: Any, job_id: str, project_id: str, input_data: dict[str, Any]) -> dict[str, Any]:
    result = run_async(reporter.generate_report(input_data))
    return {"job_id": job_id, "output": result}


@celery_app.task(name="app.workers.tasks.suggest_task_assignment", bind=True, **_RETRY_KW)
def suggest_task_assignment(self: Any, job_id: str, project_id: str, input_data: dict[str, Any]) -> dict[str, Any]:
    task = input_data.get("task", {})
    members = input_data.get("members", [])
    result = run_async(assigner.suggest_assignment(task, members))
    return {"job_id": job_id, "output": result}


@celery_app.task(name="app.workers.tasks.scan_project_risks", bind=True)
def scan_project_risks(self: Any, job_id: str, project_id: str, input_data: dict[str, Any]) -> dict[str, Any]:
    # Observer was removed in task 2.3 — use POST /api/agent/apply-observer-suggestions instead
    return {"job_id": job_id, "output": {"error": "Use apply-observer-suggestions route instead"}}


@celery_app.task(name="app.workers.tasks.answer_project_question", bind=True, **_RETRY_KW)
def answer_project_question(self: Any, job_id: str, project_id: str, input_data: dict[str, Any]) -> dict[str, Any]:
    from app.agents.qa import answer_question
    question = input_data.get("question", "")
    chunks = input_data.get("context_chunks", [])
    result = run_async(answer_question(question, chunks))
    return {"job_id": job_id, "output": {"answer": result}}


@celery_app.task(name="app.workers.tasks.run_scheduled_morning_briefing", bind=True,
                 max_retries=2, default_retry_delay=300)
def run_scheduled_morning_briefing(self: Any) -> dict[str, Any]:
    """07:30 UTC+7 — morning briefing for all active projects."""
    from app.workers import schedule
    projects = run_async(queries.get_all_active_projects())
    results = []
    for proj in projects:
        try:
            run_async(schedule.run_morning_briefing_for_project(proj["id"], proj["workspace_id"]))
            results.append({"project": proj["id"], "ok": True})
        except Exception as e:
            results.append({"project": proj["id"], "ok": False, "error": str(e)})
    return {"total": len(projects), "results": results}


@celery_app.task(name="app.workers.tasks.run_scheduled_health_scan", bind=True,
                 max_retries=2, default_retry_delay=300)
def run_scheduled_health_scan(self: Any) -> dict[str, Any]:
    """12:00 UTC+7 — deviation check + feedback loop for all active projects."""
    from app.workers import schedule
    projects = run_async(queries.get_all_active_projects())
    results = []
    for proj in projects:
        try:
            run_async(schedule.run_midday_health_scan(proj["id"], proj["workspace_id"]))
            results.append({"project": proj["id"], "ok": True})
        except Exception as e:
            results.append({"project": proj["id"], "ok": False, "error": str(e)})
    return {"total": len(projects), "results": results}


@celery_app.task(name="app.workers.tasks.run_scheduled_eod_report", bind=True,
                 max_retries=2, default_retry_delay=300)
def run_scheduled_eod_report(self: Any) -> dict[str, Any]:
    """17:30 UTC+7 — end-of-day report for all active projects."""
    from app.workers import schedule
    projects = run_async(queries.get_all_active_projects())
    results = []
    for proj in projects:
        try:
            run_async(schedule.run_eod_report(proj["id"], proj["workspace_id"]))
            results.append({"project": proj["id"], "ok": True})
        except Exception as e:
            results.append({"project": proj["id"], "ok": False, "error": str(e)})
    return {"total": len(projects), "results": results}


@celery_app.task(name="app.workers.tasks.run_scheduled_escalation_scan", bind=True,
                 max_retries=2, default_retry_delay=300)
def run_scheduled_escalation_scan(self: Any) -> dict[str, Any]:
    """09:00 UTC+7 — escalate stale blockers and high-risk risks for all active projects."""
    from app.workers import schedule
    projects = run_async(queries.get_all_active_projects())
    results = []
    for proj in projects:
        try:
            run_async(schedule.run_escalation_scan(proj["id"], proj["workspace_id"]))
            results.append({"project": proj["id"], "ok": True})
        except Exception as e:
            results.append({"project": proj["id"], "ok": False, "error": str(e)})
    return {"total": len(projects), "results": results}


@celery_app.task(name="app.workers.tasks.run_scheduled_daily_update_reminder", bind=True,
                 max_retries=2, default_retry_delay=300)
def run_scheduled_daily_update_reminder(self: Any) -> dict[str, Any]:
    """17:00 UTC+7 — remind members with no daily-update for today."""
    from app.workers import schedule
    projects = run_async(queries.get_all_active_projects())
    results = []
    for proj in projects:
        try:
            run_async(schedule.run_daily_update_reminder(proj["id"], proj["workspace_id"]))
            results.append({"project": proj["id"], "ok": True})
        except Exception as e:
            results.append({"project": proj["id"], "ok": False, "error": str(e)})
    return {"total": len(projects), "results": results}


@celery_app.task(name="app.workers.tasks.run_scheduled_message_retention", bind=True,
                 max_retries=2, default_retry_delay=300)
def run_scheduled_message_retention(self: Any) -> dict[str, Any]:
    """03:00 UTC+7 — WP-E2: prune old chat messages (global, not per-project)."""
    from app.workers import schedule
    return run_async(schedule.run_message_retention())
