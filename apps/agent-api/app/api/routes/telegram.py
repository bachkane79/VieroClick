from fastapi import APIRouter, Request, HTTPException
from app.settings import settings
from app.agents.telegram_agent import handle_telegram_update
import hashlib
import hmac

router = APIRouter()


@router.post("/webhook")
async def telegram_webhook(request: Request) -> dict[str, str]:
    secret = settings.telegram_webhook_secret
    if secret:
        token = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if not hmac.compare_digest(token, secret):
            raise HTTPException(status_code=401, detail="Invalid webhook token")

    update = await request.json()
    await handle_telegram_update(update)
    return {"ok": "true"}
