import hmac
from typing import Any

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text

from app.agents.telegram_agent import handle_telegram_update
from app.api.deps import verify_api_secret
from app.db.connection import AsyncSessionLocal
from app.settings import settings
from app.telegram_webhook import (
    build_webhook_url,
)
from app.telegram_webhook import (
    delete_webhook as tg_delete_webhook,
)
from app.telegram_webhook import (
    set_webhook as tg_set_webhook,
)

router = APIRouter()
logger = structlog.get_logger()


def _verify_telegram_secret(request: Request) -> None:
    secret = settings.telegram_webhook_secret
    if not secret:
        return
    token = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Invalid webhook token")


async def _lookup_bot(bot_id: str) -> dict[str, Any] | None:
    """Return {id, workspace_id, default_chat_id, token} for the bot, or None."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(
                "SELECT id, workspace_id, default_chat_id, bot_token FROM telegram_bots "
                "WHERE id = :id AND is_active = true LIMIT 1"
            ),
            {"id": bot_id},
        )
        row = result.fetchone()
        if not row:
            return None
        return {
            "id": str(row[0]),
            "workspace_id": str(row[1]),
            "default_chat_id": row[2],
            "token": row[3],
        }


async def _set_default_chat_id(bot_id: str, chat_id: str) -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                "UPDATE telegram_bots SET default_chat_id = :chat_id, updated_at = now() "
                "WHERE id = :id AND default_chat_id IS NULL"
            ),
            {"chat_id": chat_id, "id": bot_id},
        )
        await session.commit()


@router.post("/webhook/{bot_id}")
async def telegram_webhook(bot_id: str, request: Request) -> dict[str, str]:
    """Inbound update from Telegram for one specific bot.

    The bot is identified by the path parameter (Telegram doesn't include bot
    identity in the payload itself). On the first incoming chat we backfill
    `telegram_bots.default_chat_id` so the user doesn't need to "Auto-detect" —
    the chat id appears in the UI on next refresh.
    """
    _verify_telegram_secret(request)

    bot = await _lookup_bot(bot_id)
    if not bot:
        # Unknown or inactive bot — accept and drop so Telegram doesn't retry.
        return {"ok": "true"}

    update = await request.json()

    if not bot["default_chat_id"]:
        chat = (
            update.get("message", {}).get("chat")
            or update.get("channel_post", {}).get("chat")
            or update.get("my_chat_member", {}).get("chat")
        )
        if chat and chat.get("id") is not None:
            await _set_default_chat_id(bot_id, str(chat["id"]))
            logger.info("telegram_webhook.chat_id_detected", bot_id=bot_id, chat_id=chat["id"])

    await handle_telegram_update(update, bot)
    return {"ok": "true"}


class WebhookAdminRequest(BaseModel):
    bot_id: str
    bot_token: str


@router.post("/admin/register-webhook", dependencies=[Depends(verify_api_secret)])
async def admin_register_webhook(body: WebhookAdminRequest) -> dict[str, Any]:
    """Called by the web app right after it persists a bot. Registers the
    webhook URL for that single bot. Returns 502 if Telegram rejects."""
    url = build_webhook_url(body.bot_id)
    if not url:
        raise HTTPException(
            status_code=500,
            detail="PUBLIC_BASE_URL not configured on agent-api",
        )
    async with httpx.AsyncClient(timeout=10) as client:
        ok, desc = await tg_set_webhook(client, body.bot_token, url)
    if not ok:
        raise HTTPException(status_code=502, detail=f"Telegram setWebhook failed: {desc}")
    return {"ok": True, "url": url}


@router.post("/admin/delete-webhook", dependencies=[Depends(verify_api_secret)])
async def admin_delete_webhook(body: WebhookAdminRequest) -> dict[str, Any]:
    """Called by the web app when a bot is disconnected. Best-effort —
    failures here don't block the DB delete on the web side."""
    async with httpx.AsyncClient(timeout=10) as client:
        ok, desc = await tg_delete_webhook(client, body.bot_token)
    if not ok:
        raise HTTPException(status_code=502, detail=f"Telegram deleteWebhook failed: {desc}")
    return {"ok": True}
