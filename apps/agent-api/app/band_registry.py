from typing import Literal

from pydantic import BaseModel

from app.settings import settings

BandAgentRole = Literal[
    "planning",
    "assignment",
    "observer",
    "daily_report",
    "morning_briefing",
    "project_qa",
]

BAND_AGENT_ROLES: tuple[BandAgentRole, ...] = (
    "planning",
    "assignment",
    "observer",
    "daily_report",
    "morning_briefing",
    "project_qa",
)


class BandAgentEndpoint(BaseModel):
    role: BandAgentRole
    agent_id: str
    api_key: str
    handle: str

    @property
    def is_configured(self) -> bool:
        return bool(self.agent_id and self.api_key and self.handle)


class PublicBandAgentEndpoint(BaseModel):
    role: BandAgentRole
    agent_id: str
    handle: str
    configured: bool


def get_band_agent(role: BandAgentRole) -> BandAgentEndpoint:
    endpoint = BandAgentEndpoint(
        role=role,
        agent_id=getattr(settings, f"{role}_agent_id"),
        api_key=getattr(settings, f"{role}_api_key"),
        handle=getattr(settings, f"{role}_handle"),
    )
    if not endpoint.is_configured:
        raise ValueError(f"Band agent '{role}' is not fully configured")
    return endpoint


def list_band_agents() -> list[BandAgentEndpoint]:
    return [get_band_agent(role) for role in BAND_AGENT_ROLES]


def list_public_band_agents() -> list[PublicBandAgentEndpoint]:
    agents: list[PublicBandAgentEndpoint] = []
    for role in BAND_AGENT_ROLES:
        endpoint = BandAgentEndpoint(
            role=role,
            agent_id=getattr(settings, f"{role}_agent_id"),
            api_key=getattr(settings, f"{role}_api_key"),
            handle=getattr(settings, f"{role}_handle"),
        )
        agents.append(
            PublicBandAgentEndpoint(
                role=role,
                agent_id=endpoint.agent_id,
                handle=endpoint.handle,
                configured=endpoint.is_configured,
            )
        )
    return agents


def band_handoff_message(role: BandAgentRole, message: str) -> str:
    endpoint = get_band_agent(role)
    return f"{endpoint.handle} {message}".strip()
