"""
Observer agent: watches activity_events for anomalies, deadline risks, blocked chains.
Generates alerts / suggestions proactively.
"""
from typing import Any
import json

from app.agents.openai_client import get_openai_client
from app.settings import settings

SYSTEM_PROMPT = """You are a project health monitoring AI.
Analyze the provided activity events and project state.
Identify: deadline risks, stalled tasks, long-standing blockers, scope creep signals.
Respond as JSON: {alerts: [{type, severity, title, description, affected_entity_id}]}.
"""


async def scan_project_health(
    events: list[dict[str, Any]],
    project_state: dict[str, Any],
) -> dict[str, Any]:
    payload = {"recent_events": events, "project_state": project_state}

    response = await get_openai_client().chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload, default=str)},
        ],
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content or "{}"
    return json.loads(content)
