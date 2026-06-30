"""
schedule.py
Async functions backing the three Celery Beat rhythms:
  - morning_briefing  (07:30 UTC+7 = 00:30 UTC)
  - midday_health_scan (12:00 UTC+7 = 05:00 UTC)
  - eod_report        (17:30 UTC+7 = 10:30 UTC)

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
    """Run deterministic deviation check → apply feedback loop (replan/notify/escalate)."""
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

    if not deviations:
        logger.info("midday_health_scan: no deviations for project=%s", project_id)
        return {"ok": True, "skipped": True, "reason": "no_deviations"}

    logger.info("midday_health_scan: %d deviations for project=%s", len(deviations), project_id)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp2 = await client.post(
            f"{settings.vieroc_api_url}/api/agent/apply-deviations",
            json={"projectId": project_id, "workspaceId": workspace_id, "deviations": deviations},
            headers=headers,
        )
        resp2.raise_for_status()
        result = resp2.json()

    return {"ok": True, "deviationCount": len(deviations), "processed": result.get("processed", 0)}


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
