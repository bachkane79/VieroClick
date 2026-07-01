"""
report_runner.py
Orchestrates the daily-report pipeline triggered by the Telegram /report command.
"""
import logging
from datetime import date

import httpx

from app.agents.reporter import generate_report
from app.db.queries import find_bot_by_chat_id, get_project_ids_for_workspace
from app.settings import settings
from app.telegram_webhook import _html_escape, send_message

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

MAX_TELEGRAM_MESSAGE = 4000


async def _fetch_project_data(project_id: str) -> dict:
    """Fetch live project state from the Next.js API (4.5: real /api/project-data).

    Normalizes the project-data payload into the legacy shape the reporter prompt
    expects (projects[] list, snake_case `daily_updates`).
    """
    headers = {"Authorization": f"Bearer {settings.vieroc_api_key}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{settings.vieroc_api_url}/api/project-data",
            params={"projectId": project_id},
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    project = data.get("project")
    return {
        "projects": [project] if project else [],
        "members": data.get("members", []),
        "tasks": data.get("tasks", []),
        "blockers": data.get("blockers", []),
        "daily_updates": data.get("dailyUpdates", []),
        "risks": data.get("risks", []),
        "milestones": data.get("milestones", []),
        "recent_events": [],
    }


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


def _format_report_message(project_name: str, report: dict) -> str:
    """Render the report as a Telegram HTML message. LLM strings are escaped."""
    lines: list[str] = [
        f"<b>Daily Report — {_html_escape(project_name)}</b>",
        _html_escape(str(report.get("reportDate", ""))),
        "",
        "<b>Progress</b>",
        _html_escape(str(report.get("progressSummary", ""))),
    ]

    risk = report.get("riskSummary") or ""
    if risk:
        lines += ["", "<b>Risks</b>", _html_escape(str(risk))]

    blocker = report.get("blockerSummary") or ""
    if blocker:
        lines += ["", "<b>Blockers</b>", _html_escape(str(blocker))]

    actions = report.get("recommendedActions") or []
    if actions:
        lines += ["", "<b>Recommended Actions</b>"]
        lines += [f"• {_html_escape(str(a))}" for a in actions]

    out = "\n".join(lines)
    if len(out) > MAX_TELEGRAM_MESSAGE:
        out = out[: MAX_TELEGRAM_MESSAGE - len("...(truncated)")] + "...(truncated)"
    return out


async def _run_daily_report_for_project(project_id: str) -> tuple[dict, str] | None:
    """Generate + save the report for one project.

    Returns (saved_report, project_name) on full success, or None if any step
    failed (fetch / LLM / save) or the LLM returned an empty progressSummary.
    """
    logger.info("daily_report: generating for project %s", project_id)
    try:
        project_data = await _fetch_project_data(project_id)
    except Exception as exc:
        logger.error("daily_report: failed to fetch project data for %s: %s", project_id, exc)
        return None

    project_name = next(
        (
            p["name"]
            for p in project_data.get("projects", [])
            if p.get("id") == project_id
        ),
        project_id,
    )

    try:
        report = await generate_report(project_data)
    except Exception as exc:
        logger.error("daily_report: LLM generation failed for %s: %s", project_id, exc)
        return None

    if not report:
        logger.warning("daily_report: empty report for project %s", project_id)
        return None

    if not report.get("progressSummary"):
        logger.warning(
            "daily_report: skipping project %s — LLM returned no progressSummary (keys=%s)",
            project_id,
            list(report.keys()),
        )
        return None

    try:
        saved = await _post_report(project_id, report)
        logger.info("daily_report: saved report %s for project %s", saved.get("id"), project_id)
        return saved, project_name
    except Exception as exc:
        logger.error("daily_report: failed to save report for %s: %s", project_id, exc)
        return None


async def handle_report_command(chat_id: str) -> None:
    """Entry point called when a Telegram user sends /report."""
    bot = await find_bot_by_chat_id(chat_id)
    if not bot:
        logger.warning("daily_report: no active bot found for chat_id=%s", chat_id)
        return

    project_ids = await get_project_ids_for_workspace(bot["workspace_id"])
    if not project_ids:
        logger.info("daily_report: workspace %s has no projects", bot["workspace_id"])
        return

    logger.info(
        "daily_report: running for workspace=%s, projects=%s",
        bot["workspace_id"],
        project_ids,
    )

    token = bot["bot_token"]
    async with httpx.AsyncClient(timeout=10) as tg:
        await send_message(
            tg,
            token,
            chat_id,
            f"Generating report for {len(project_ids)} project(s)...",
        )

        for pid in project_ids:
            result = await _run_daily_report_for_project(pid)
            if result is None:
                await send_message(
                    tg,
                    token,
                    chat_id,
                    f"Could not generate report for project <code>{_html_escape(pid)}</code>.",
                )
                continue

            report, project_name = result
            text = _format_report_message(project_name, report)
            ok, err = await send_message(tg, token, chat_id, text)
            if not ok:
                logger.error("daily_report: sendMessage failed for %s: %s", pid, err)
