"""
Reporter agent: generates daily/weekly project status reports.
Reads daily_updates, blockers, task progress from DB and synthesizes.
"""
from typing import Any
import json

from app.agents.gemini_client import generate

SYSTEM_PROMPT = """You are a project status report writer.
Given daily updates, blockers, and task completion data, generate a concise report for the project lead.
Include: progress summary, active blockers, risks, recommended actions.
Respond as structured JSON.
"""


async def generate_report(project_data: dict[str, Any]) -> dict[str, Any]:
    content = await generate(
        SYSTEM_PROMPT,
        f"Project data:\n{json.dumps(project_data, default=str)}",
        as_json=True,
    )
    return json.loads(content or "{}")
