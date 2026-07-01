"""
Interactive agent roles, invoked synchronously via POST /api/agents/{role}.

Each role is a self-fetching `async def run(project_id, payload) -> dict` that
reads live project state from the web API and applies its results back through
the same REST surface (never the DB directly). Consolidated from the former
band-agents/ service so agent-api is the single agent process.
"""
from __future__ import annotations

from typing import Awaitable, Callable

from app.agents.roles import (
    assignment,
    daily_report,
    morning_briefing,
    observer,
    planning,
    project_qa,
)

AgentRunner = Callable[..., Awaitable[dict]]

AGENT_RUNNERS: dict[str, AgentRunner] = {
    "planning": planning.run,
    "assignment": assignment.run,
    "observer": observer.run,
    "daily_report": daily_report.run,
    "morning_briefing": morning_briefing.run,
    "project_qa": project_qa.run,
}

__all__ = ["AGENT_RUNNERS", "AgentRunner"]
