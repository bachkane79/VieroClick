"""
Observer agent: watches activity_events for anomalies, deadline risks, blocked chains.
Generates alerts / suggestions proactively.
"""
from typing import Any
import json

from app.agents.gemini_client import generate

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

    content = await generate(SYSTEM_PROMPT, json.dumps(payload, default=str), as_json=True)
    return json.loads(content or "{}")
