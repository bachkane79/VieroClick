"""
Reporter agent: generates daily/weekly project status reports.
Reads daily_updates, blockers, task progress from DB and synthesizes.
"""
from typing import Any
import json

from app.agents.gemini_client import generate

SYSTEM_PROMPT = """You are a daily project status report writer.
Given live project data (tasks, updates, blockers, members), produce a leader report.

Respond ONLY with a JSON object using EXACTLY these keys:
{
  "reportDate": "YYYY-MM-DD",
  "progressSummary": "non-empty summary of progress today (REQUIRED, must not be empty)",
  "riskSummary": "summary of active risks (or empty string)",
  "blockerSummary": "summary of blockers (or empty string)",
  "recommendedActions": ["action 1", "action 2"],
  "memberDemands": [{"memberName": "...", "demand": "..."}],
  "planDeviations": [{"taskTitle": "...", "deviation": "..."}]
}

If there is no activity, still produce a progressSummary like "No activity recorded today."
Never return an empty progressSummary.
"""


async def generate_report(project_data: dict[str, Any]) -> dict[str, Any]:
    content = await generate(
        SYSTEM_PROMPT,
        f"Project data:\n{json.dumps(project_data, default=str)}",
        as_json=True,
    )
    return json.loads(content or "{}")
