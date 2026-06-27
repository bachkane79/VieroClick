"""
Agent dispatch route.

Historically this forwarded messages into a Band.ai room. Band.ai is gone — this
now forwards the dispatch to the local agent service over plain HTTP, preserving
the original request/response contract so existing callers keep working.
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import verify_api_secret
from app.band_registry import BAND_AGENT_ROLES, BandAgentRole
from app.settings import settings

router = APIRouter(dependencies=[Depends(verify_api_secret)])


class AgentsResponse(BaseModel):
    service_configured: bool
    agents: list[str]


class DispatchRequest(BaseModel):
    targetRole: BandAgentRole
    projectId: str
    message: str
    senderRole: BandAgentRole | None = None
    payload: dict | None = None


@router.get("/agents", response_model=AgentsResponse)
async def get_agents() -> AgentsResponse:
    return AgentsResponse(
        service_configured=bool(settings.agent_service_url),
        agents=list(BAND_AGENT_ROLES),
    )


@router.post("/dispatch")
async def dispatch_message(body: DispatchRequest) -> dict:
    """Forward the dispatch to the local agent service: POST /agents/{role}."""
    base_url = settings.agent_service_url.rstrip("/")
    if not base_url:
        raise HTTPException(status_code=400, detail="AGENT_SERVICE_URL is not configured")

    headers = {"Content-Type": "application/json"}
    if settings.agent_service_secret:
        headers["X-Api-Secret"] = settings.agent_service_secret

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{base_url}/agents/{body.targetRole}",
                json={
                    "projectId": body.projectId,
                    "message": body.message,
                    "payload": body.payload or {},
                    "senderRole": body.senderRole,
                    "targetRole": body.targetRole,
                },
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Local agent service call failed: {e}")

    return {
        "dispatched": True,
        "targetRole": body.targetRole,
        "senderRole": body.senderRole,
        "result": data.get("result"),
    }
