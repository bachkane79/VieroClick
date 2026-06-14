from fastapi import Header, HTTPException, status
from app.settings import settings


def verify_api_secret(x_api_secret: str = Header(...)) -> None:
    if x_api_secret != settings.agent_api_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API secret")
