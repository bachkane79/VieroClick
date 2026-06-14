"""
Reporter agent: generates daily/weekly project status reports.
Reads daily_updates, blockers, task progress from DB and synthesizes.
"""
from typing import Any
from openai import AsyncOpenAI
import json

from app.settings import settings

client = AsyncOpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a project status report writer.
Given daily updates, blockers, and task completion data, generate a concise report for the project lead.
Include: progress summary, active blockers, risks, recommended actions.
Respond as structured JSON.
"""


async def generate_report(project_data: dict[str, Any]) -> dict[str, Any]:
    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Project data:\n{json.dumps(project_data, default=str)}"},
        ],
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content or "{}"
    return json.loads(content)
