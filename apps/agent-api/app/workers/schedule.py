"""
schedule.py
Async functions backing the five Celery Beat rhythms:
  - morning_briefing       (07:30 UTC+7 = 00:30 UTC)
  - midday_health_scan     (12:00 UTC+7 = 05:00 UTC)
  - eod_report             (17:30 UTC+7 = 10:30 UTC)
  - escalation_scan        (09:00 UTC+7 = 02:00 UTC)
  - daily_update_reminder  (17:00 UTC+7 = 10:00 UTC)

Each function processes a single project. The beat Celery tasks iterate
over all active projects and call these functions per project, isolating
failures so one bad project doesn't block the rest.
"""
import logging

import httpx

from app.agents.report_runner import _fetch_project_data, _post_report
from app.agents.reporter import generate_report
from app.settings import settings

logger = logging.getLogger(__name__)


async def run_morning_briefing_for_project(project_id: str, workspace_id: str) -> dict:
    """Fetch project state → generate LLM report → save to /api/reports."""
    logger.info("morning_briefing: project=%s workspace=%s", project_id, workspace_id)
    project_data = await _fetch_project_data(project_id)
    report = await generate_report(project_data)
    if not report.get("progressSummary"):
        logger.warning("morning_briefing: empty progressSummary for project=%s", project_id)
        return {"ok": False, "reason": "empty_report"}
    saved = await _post_report(project_id, report)
    return {"ok": True, "reportId": saved.get("id")}


async def run_midday_health_scan(project_id: str, workspace_id: str) -> dict:
    """Run deterministic deviation check → apply feedback loop (replan/notify/escalate),
    then run the observer LLM for soft signals code cannot detect (4.3)."""
    logger.info("midday_health_scan: project=%s workspace=%s", project_id, workspace_id)
    headers = {"Authorization": f"Bearer {settings.vieroc_api_key}"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.vieroc_api_url}/api/agent/run-deviation-check",
            json={"projectId": project_id, "workspaceId": workspace_id},
            headers=headers,
        )
        resp.raise_for_status()
        deviations = resp.json().get("deviations", [])

    processed = 0
    if deviations:
        logger.info("midday_health_scan: %d deviations for project=%s", len(deviations), project_id)
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp2 = await client.post(
                f"{settings.vieroc_api_url}/api/agent/apply-deviations",
                json={"projectId": project_id, "workspaceId": workspace_id, "deviations": deviations},
                headers=headers,
            )
            resp2.raise_for_status()
            processed = resp2.json().get("processed", 0)
    else:
        logger.info("midday_health_scan: no deterministic deviations for project=%s", project_id)

    # Observer LLM runs even with zero deterministic deviations — its whole job
    # is the soft signals (scope creep, silent members, vague blockers) that the
    # rule pass cannot see. Best-effort: an observer failure must not fail the scan.
    observer_saved = 0
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            obs = await client.post(
                f"{settings.vieroc_api_url}/api/agent/trigger-observer",
                json={"projectId": project_id},
                headers=headers,
            )
            obs.raise_for_status()
            obs_result = (obs.json().get("result") or {}).get("result") or {}
            observer_saved = obs_result.get("savedCount", 0)
            logger.info(
                "midday_health_scan: observer processed %s suggestion(s) for project=%s",
                observer_saved, project_id,
            )
    except Exception as e:
        logger.error("midday_health_scan: observer run failed for project=%s: %s", project_id, e)

    return {
        "ok": True,
        "deviationCount": len(deviations),
        "processed": processed,
        "observerSuggestions": observer_saved,
    }


async def run_eod_report(project_id: str, workspace_id: str) -> dict:
    """End-of-day: same fetch → LLM → save pipeline as morning briefing."""
    logger.info("eod_report: project=%s workspace=%s", project_id, workspace_id)
    project_data = await _fetch_project_data(project_id)
    report = await generate_report(project_data)
    if not report.get("progressSummary"):
        logger.warning("eod_report: empty progressSummary for project=%s", project_id)
        return {"ok": False, "reason": "empty_report"}
    saved = await _post_report(project_id, report)
    return {"ok": True, "reportId": saved.get("id")}


async def run_escalation_scan(project_id: str, workspace_id: str) -> dict:
    """09:00 UTC+7 — upgrade stale blockers + high-risk risks, notify lead/owner."""
    logger.info("escalation_scan: project=%s workspace=%s", project_id, workspace_id)
    headers = {"Authorization": f"Bearer {settings.vieroc_api_key}"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.vieroc_api_url}/api/agent/run-escalation-scan",
            json={"projectId": project_id},
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    escalated = len(data.get("escalated", []))
    escalated_risks = len(data.get("escalatedRisks", []))
    logger.info(
        "escalation_scan: project=%s escalated_blockers=%d escalated_risks=%d",
        project_id, escalated, escalated_risks,
    )
    return {"ok": True, "escalatedBlockers": escalated, "escalatedRisks": escalated_risks}


async def run_daily_update_reminder(project_id: str, workspace_id: str) -> dict:
    """17:00 UTC+7 — remind members who haven't submitted today's daily update."""
    logger.info("daily_update_reminder: project=%s workspace=%s", project_id, workspace_id)
    headers = {"Authorization": f"Bearer {settings.vieroc_api_key}"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.vieroc_api_url}/api/agent/run-daily-update-reminder",
            json={"projectId": project_id},
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    reminded = data.get("reminded", 0)
    logger.info("daily_update_reminder: project=%s reminded=%d", project_id, reminded)
    return {"ok": True, "reminded": reminded}
