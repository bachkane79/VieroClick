"""
Planner agent: given project context, suggests task breakdown + milestones.
Phase 1: generates suggestions only, never mutates DB directly.
"""
import json
from typing import Any

from app.agents.gemini_client import generate
from app.settings import settings

SYSTEM_PROMPT = """You are an expert project manager AI assistant.
Given a project's context, goals, and current state, you generate:
1. A prioritized task breakdown with estimates
2. Milestone suggestions
3. Risk flags

Always respond as structured JSON.
"""


async def plan_project(project_context: dict[str, Any]) -> dict[str, Any]:
    content = await generate(
        SYSTEM_PROMPT,
        f"Project context:\n{project_context}",
        model=settings.gemini_planner_model,
        as_json=True,
    )
    return json.loads(content or "{}")
