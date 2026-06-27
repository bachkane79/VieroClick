"""
server.py
Local agent service — exposes the 6 agents over plain HTTP (request → response),
replacing the previous Band.ai WebSocket mesh. No rooms, no @mentions: each agent
is a normal I/O data stream you POST to and get a JSON result back.

    POST /agents/{role}   body: { "projectId": "...", "payload": {...}, "question": "..." }
    GET  /health

Roles: planning | assignment | observer | daily_report | morning_briefing | project_qa

Run with:  python run_all.py   (or: uvicorn server:app --port 8001)
"""
from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

load_dotenv()
logger = logging.getLogger("agent_service")

from agents.assignment.main import run as run_assignment
from agents.daily_report.main import run as run_daily_report
from agents.morning_briefing.main import run as run_morning_briefing
from agents.observer.main import run as run_observer
from agents.planning.main import run as run_planning
from agents.project_qa.main import run as run_project_qa

# role → coroutine function (project_id, payload) -> dict
AGENT_RUNNERS = {
    "planning": run_planning,
    "assignment": run_assignment,
    "observer": run_observer,
    "daily_report": run_daily_report,
    "morning_briefing": run_morning_briefing,
    "project_qa": run_project_qa,
}

# Shared secret — matches AGENT_API_SECRET / VIEROC_API_TOKEN on the web side.
SERVICE_SECRET = os.getenv("AGENT_SERVICE_SECRET") or os.getenv("VIEROC_API_TOKEN", "")

app = FastAPI(title="VieroClick Local Agent Service", version="1.0.0")


class AgentRequest(BaseModel):
    projectId: str | None = None
    payload: dict | None = None
    message: str | None = None
    question: str | None = None
    senderRole: str | None = None
    targetRole: str | None = None


def verify_secret(
    x_api_secret: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> None:
    if not SERVICE_SECRET:
        return  # auth disabled when no secret configured (local dev)
    presented = x_api_secret
    if not presented and authorization and authorization.lower().startswith("bearer "):
        presented = authorization[7:]
    if presented != SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Invalid agent service secret")


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "agents": list(AGENT_RUNNERS.keys())}


@app.post("/agents/{role}")
async def run_agent(role: str, body: AgentRequest, _: None = Depends(verify_secret)) -> dict:
    runner = AGENT_RUNNERS.get(role)
    if not runner:
        raise HTTPException(status_code=404, detail=f"Unknown agent role '{role}'")

    # Merge the loose request fields into a single payload dict for the runner.
    payload = dict(body.payload or {})
    if body.message and "message" not in payload:
        payload["message"] = body.message
    if body.question and "question" not in payload:
        payload["question"] = body.question

    logger.info("Dispatching agent '%s' for project=%s", role, body.projectId)
    try:
        result = await runner(project_id=body.projectId, payload=payload)
    except Exception as e:  # surface clean error to the caller
        logger.exception("Agent '%s' failed", role)
        raise HTTPException(status_code=500, detail=f"Agent '{role}' failed: {e}")

    return {"dispatched": True, "role": role, "result": result}
