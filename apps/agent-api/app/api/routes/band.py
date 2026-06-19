import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import verify_api_secret
from app.band_registry import (
    BAND_AGENT_ROLES,
    BandAgentRole,
    PublicBandAgentEndpoint,
    get_band_agent,
    list_public_band_agents,
)
from app.settings import settings

router = APIRouter(dependencies=[Depends(verify_api_secret)])


class BandAgentsResponse(BaseModel):
    room_id_configured: bool
    agents: list[PublicBandAgentEndpoint]


class BandDispatchRequest(BaseModel):
    targetRole: BandAgentRole
    projectId: str
    message: str
    senderRole: BandAgentRole | None = None
    payload: dict | None = None


@router.get("/agents", response_model=BandAgentsResponse)
async def get_band_agents() -> BandAgentsResponse:
    room_id_configured = bool(settings.band_room_id and settings.band_room_id != "your-band-room-id")
    return BandAgentsResponse(
        room_id_configured=room_id_configured,
        agents=list_public_band_agents(),
    )


@router.post("/dispatch")
async def dispatch_band_message(body: BandDispatchRequest) -> dict:
    from band.client.rest import (
        AsyncRestClient,
        ChatMessageRequest,
        ChatMessageRequestMentionsItem,
    )

    if not settings.band_room_id or settings.band_room_id == "your-band-room-id":
        raise HTTPException(status_code=400, detail="BAND_ROOM_ID is not configured")

    target = get_band_agent(body.targetRole)
    sender_role = body.senderRole
    if sender_role is None or sender_role == body.targetRole:
        sender_role = next(role for role in BAND_AGENT_ROLES if role != body.targetRole)
    sender = get_band_agent(sender_role)

    dispatch_payload = json.dumps(
        {"projectId": body.projectId, "payload": body.payload or {}},
        ensure_ascii=False,
    )
    content = (
        f"{target.handle} {body.message}\n\n"
        f"```json\n"
        f"{dispatch_payload}\n"
        f"```"
    )

    client_kwargs = {"api_key": sender.api_key}
    if settings.band_api_base_url:
        client_kwargs["base_url"] = settings.band_api_base_url

    client = AsyncRestClient(**client_kwargs)
    response = await client.agent_api_messages.create_agent_chat_message(
        settings.band_room_id,
        message=ChatMessageRequest(
            content=content,
            mentions=[
                ChatMessageRequestMentionsItem(
                    id=target.agent_id,
                    handle=target.handle.lstrip("@"),
                    name=body.targetRole,
                )
            ],
        ),
    )

    return {
        "dispatched": True,
        "targetRole": body.targetRole,
        "senderRole": sender_role,
        "message_id": getattr(response, "id", None),
    }
