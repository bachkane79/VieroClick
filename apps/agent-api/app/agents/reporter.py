"""
Reporter agent: generates daily/weekly project status reports.
Reads daily_updates, blockers, task progress from DB and synthesizes.
"""
from typing import Any
import json

from app.agents.gemini_client import generate

SYSTEM_PROMPT = """You are a daily project status report writer.
Given live project data (tasks, blockers, risks, members, daily_updates), produce a leader report.

CRITICAL — progressSummary construction rules:
1. The primary source for progressSummary is `daily_updates[]`. For each entry, use:
   - `completed` field: what the member finished today
   - `in_progress` field: what they are currently working on
   Synthesize these into a coherent paragraph, attributing work to members by name when possible.
2. If `daily_updates` is empty or missing, fall back to summarising completed/in-progress tasks from `tasks[]`.
3. For any project member who has NO entry in `daily_updates` for today, explicitly state:
   "<MemberName>: no update submitted today."
4. Never produce an empty progressSummary — if truly no data exists, write "No activity recorded today."

Respond ONLY with a JSON object using EXACTLY these keys:
{
  "reportDate": "YYYY-MM-DD",
  "progressSummary": "non-empty narrative built from daily_updates (see rules above)",
  "riskSummary": "summary of active risks (or empty string)",
  "blockerSummary": "summary of blockers (or empty string)",
  "recommendedActions": ["action 1", "action 2"],
  "memberDemands": [{"memberName": "...", "demand": "..."}],
  "planDeviations": [{"taskTitle": "...", "deviation": "..."}]
}
"""


async def generate_report(project_data: dict[str, Any]) -> dict[str, Any]:
    content = await generate(
        SYSTEM_PROMPT,
        f"Project data:\n{json.dumps(project_data, default=str)}",
        as_json=True,
    )
    return json.loads(content or "{}")
