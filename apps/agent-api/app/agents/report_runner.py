"""
report_runner.py
Orchestrates the daily-report pipeline triggered by the Telegram /report command.
"""
import logging
from datetime import date

import httpx

from app.agents.reporter import generate_report
from app.db.queries import find_workspace_by_default_chat, get_project_ids_for_workspace
from app.settings import settings

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


async def _fetch_project_data(project_id: str) -> dict:
    """Fetch live project state from the Next.js API."""
    headers = {"Authorization": f"Bearer {settings.vieroc_api_key}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{settings.vieroc_api_url}/api/test-db",
            params={"projectId": project_id},
            headers=headers,
        )
        resp.raise_for_status()
        return resp.json()


async def _post_report(project_id: str, report: dict) -> dict:
    """Persist the generated report via the Next.js /api/reports endpoint."""
    headers = {
        "Authorization": f"Bearer {settings.vieroc_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "projectId": project_id,
        "reportDate": report.get("reportDate", date.today().isoformat()),
        "progressSummary": report.get("progressSummary", ""),
        "riskSummary": report.get("riskSummary"),
        "blockerSummary": report.get("blockerSummary"),
        "recommendedActions": report.get("recommendedActions", []),
        "memberDemands": report.get("memberDemands", []),
        "planDeviations": report.get("planDeviations", []),
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.vieroc_api_url}/api/reports",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        return resp.json()


async def _run_daily_report_for_project(project_id: str) -> None:
    logger.info("daily_report: generating for project %s", project_id)
    try:
        project_data = await _fetch_project_data(project_id)
    except Exception as exc:
        logger.error("daily_report: failed to fetch project data for %s: %s", project_id, exc)
        return

    try:
        report = await generate_report(project_data)
    except Exception as exc:
        logger.error("daily_report: LLM generation failed for %s: %s", project_id, exc)
        return

    if not report:
        logger.warning("daily_report: empty report for project %s", project_id)
        return

    if not report.get("progressSummary"):
        logger.warning(
            "daily_report: skipping project %s — LLM returned no progressSummary (keys=%s)",
            project_id,
            list(report.keys()),
        )
        return

    try:
        saved = await _post_report(project_id, report)
        logger.info("daily_report: saved report %s for project %s", saved.get("id"), project_id)
    except Exception as exc:
        logger.error("daily_report: failed to save report for %s: %s", project_id, exc)


async def handle_report_command(chat_id: str) -> None:
    """Entry point called when a Telegram user sends /report."""
    workspace_id = await find_workspace_by_default_chat(chat_id)
    if not workspace_id:
        logger.warning("daily_report: no active bot found for chat_id=%s", chat_id)
        return

    project_ids = await get_project_ids_for_workspace(workspace_id)
    if not project_ids:
        logger.info("daily_report: workspace %s has no projects", workspace_id)
        return

    logger.info(
        "daily_report: running for workspace=%s, projects=%s", workspace_id, project_ids
    )
    for pid in project_ids:
        await _run_daily_report_for_project(pid)
