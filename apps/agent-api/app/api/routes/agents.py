"""
Synchronous agent dispatch route.

The web app POSTs a job here and gets the structured result back in the same
request (request → response, no queue). This is the interactive path used for
planning, assignment, and observer; the automated rhythms run via Celery Beat.

    POST /api/agents/{role}
    body: { projectId, payload?, message?, question?, senderRole?, targetRole? }

agent-api is the single agent process, so there is no cross-service HTTP hop.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.agents.roles import AGENT_RUNNERS
from app.api.deps import verify_api_secret

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(verify_api_secret)])


class AgentRequest(BaseModel):
    projectId: str | None = None
    payload: dict | None = None
    message: str | None = None
    question: str | None = None
    senderRole: str | None = None
    targetRole: str | None = None
    # Single-use dispatch record id minted by the web dispatcher; callback roles
    # must present it to the apply-* routes (validated + consumed there).
    dispatchId: str | None = None


@router.get("/")
async def list_agents() -> dict:
    return {"agents": list(AGENT_RUNNERS.keys())}


@router.post("/{role}")
async def run_agent(role: str, body: AgentRequest) -> dict:
    runner = AGENT_RUNNERS.get(role)
    if not runner:
        raise HTTPException(status_code=404, detail=f"Unknown agent role '{role}'")

    # Merge the loose request fields into a single payload dict for the runner.
    payload = dict(body.payload or {})
    if body.message and "message" not in payload:
        payload["message"] = body.message
    if body.question and "question" not in payload:
        payload["question"] = body.question
    if body.dispatchId:
        payload["dispatch_id"] = body.dispatchId

    logger.info("Dispatching agent '%s' for project=%s", role, body.projectId)
    try:
        result = await runner(project_id=body.projectId, payload=payload)
    except Exception as e:
        logger.exception("Agent '%s' failed", role)
        raise HTTPException(status_code=500, detail=f"Agent '{role}' failed: {e}")

    return {"dispatched": True, "role": role, "result": result}
