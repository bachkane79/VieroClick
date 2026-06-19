"""
Assigner agent: recommends optimal task assignments based on member profiles.
Phase 1: suggest only, never auto-assign.
"""
from typing import Any
import json

from app.agents.openai_client import get_openai_client
from app.settings import settings

SYSTEM_PROMPT = """You are a project resource allocation expert.
Given a task description and a list of team members with their skills and availability,
recommend the best assignee with reasoning.
Respond as structured JSON: {recommended_member_id, confidence, reasoning, alternatives}.
"""


async def suggest_assignment(
    task: dict[str, Any],
    members: list[dict[str, Any]],
) -> dict[str, Any]:
    payload = {"task": task, "members": members}

    response = await get_openai_client().chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload)},
        ],
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content or "{}"
    return json.loads(content)
