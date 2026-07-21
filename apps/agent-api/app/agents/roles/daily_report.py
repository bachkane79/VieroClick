"""
Daily report role — compile a leader report from project state and save it pending.
"""
from __future__ import annotations

import json
import logging
from datetime import date

from app.agents.gemini_client import generate
from app.agents.message_parser import extract_json_payload
from app.agents.vieroc_client import VieroClickClient

logger = logging.getLogger(__name__)

DAILY_REPORT_SYSTEM_PROMPT = """You are an expert Daily Report Agent.
Your job is to read all project events, updates, blockers, and task completions, and generate a daily summary.

You must output a structured JSON object in this exact format:
{
  "reportDate": "YYYY-MM-DD",
  "progressSummary": "A concise summary of tasks completed and progress made today",
  "riskSummary": "A concise summary of active project risks or issues identified",
  "blockerSummary": "A summary of any active blockers or stuck developers",
  "recommendedActions": [
    "Clarify requirements on Task X",
    "Allocate backup developer to help resolve blocker Y"
  ],
  "memberDemands": [
    { "memberName": "Jane Doe", "demand": "Needs feedback on PR 12" }
  ],
  "planDeviations": [
    { "taskTitle": "Database setup", "deviation": "Delayed by 2 days due to connection pooling config issues" }
  ]
}
"""

DAILY_REPORT_USER_TEMPLATE = """Generate the report for date: {current_date}
Project State:
{project_state}

Return the structured JSON daily report.
"""


async def run(project_id: str | None = None, payload: dict | None = None) -> dict:
    vieroc = VieroClickClient()
    project_id = project_id or vieroc.default_project_id
    logger.info("Daily report agent: compiling report for %s", project_id)

    proj_data = await vieroc.fetch_project_data(project_id)
    if not proj_data:
        return {"ok": False, "error": "Failed to retrieve project state for daily report generation."}

    current_date = date.today().isoformat()
    try:
        llm_response = await generate(
            DAILY_REPORT_SYSTEM_PROMPT,
            DAILY_REPORT_USER_TEMPLATE.format(
                current_date=current_date,
                project_state=json.dumps(proj_data, default=str),
            ),
            as_json=True,
        )
        report = extract_json_payload(llm_response)
    except Exception as e:
        logger.error("Daily report generation failed: %s", e)
        return {"ok": False, "error": f"Daily report generation failed: {e}"}

    if not report:
        return {"ok": False, "error": "LLM response was not valid JSON."}

    resp = await vieroc.create_report(
        report_date=report.get("reportDate", current_date),
        progress_summary=report.get("progressSummary", ""),
        risk_summary=report.get("riskSummary"),
        blocker_summary=report.get("blockerSummary"),
        recommended_actions=report.get("recommendedActions", []),
        member_demands=report.get("memberDemands", []),
        plan_deviations=report.get("planDeviations", []),
        project_id=project_id,
    )

    if resp and "id" in resp:
        logger.info("Daily report saved (pending approval) for %s", project_id)
        return {"ok": True, "projectId": project_id, "reportId": resp["id"], "report": report}

    return {
        "ok": False,
        "error": "Report generated, but failed to save in VieroClick (it may already exist for today).",
        "report": report,
    }
