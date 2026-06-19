from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import verify_api_secret
from app.band_registry import PublicBandAgentEndpoint, list_public_band_agents
from app.settings import settings

router = APIRouter(dependencies=[Depends(verify_api_secret)])


class BandAgentsResponse(BaseModel):
    room_id_configured: bool
    agents: list[PublicBandAgentEndpoint]


@router.get("/agents", response_model=BandAgentsResponse)
async def get_band_agents() -> BandAgentsResponse:
    room_id_configured = bool(settings.band_room_id and settings.band_room_id != "your-band-room-id")
    return BandAgentsResponse(
        room_id_configured=room_id_configured,
        agents=list_public_band_agents(),
    )
