"""
Assigner agent: recommends optimal task assignments based on member profiles.
Phase 1: suggest only, never auto-assign.
"""
from typing import Any
import json

from app.agents.gemini_client import generate

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

    content = await generate(SYSTEM_PROMPT, json.dumps(payload), as_json=True)
    return json.loads(content or "{}")
