"""
Planner agent: given project context, suggests task breakdown + milestones.
Phase 1: generates suggestions only, never mutates DB directly.
"""
from typing import Any
from openai import AsyncOpenAI

from app.settings import settings

client = AsyncOpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are an expert project manager AI assistant.
Given a project's context, goals, and current state, you generate:
1. A prioritized task breakdown with estimates
2. Milestone suggestions
3. Risk flags

Always respond as structured JSON.
"""


async def plan_project(project_context: dict[str, Any]) -> dict[str, Any]:
    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Project context:\n{project_context}",
            },
        ],
        response_format={"type": "json_object"},
    )

    import json
    content = response.choices[0].message.content or "{}"
    return json.loads(content)
