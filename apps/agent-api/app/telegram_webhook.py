"""Auto-register Telegram bot webhooks on app startup.

Each bot gets a unique webhook URL of the form
`{PUBLIC_BASE_URL}/api/telegram/webhook/{bot_id}` so the inbound handler can
identify the bot from the URL (Telegram doesn't include bot identity in the
update payload).
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass

import httpx
import structlog
from sqlalchemy import text

from app.db.connection import AsyncSessionLocal
from app.settings import settings

logger = structlog.get_logger()

TELEGRAM_API = "https://api.telegram.org"


@dataclass(frozen=True)
class BotRecord:
    id: str
    token: str


async def _collect_bots() -> list[BotRecord]:
    bots: list[BotRecord] = []
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("SELECT id, bot_token FROM telegram_bots WHERE is_active = true")
            )
            for row in result.fetchall():
                if row[0] and row[1]:
                    bots.append(BotRecord(id=str(row[0]), token=row[1]))
    except Exception as exc:
        logger.warning("telegram_webhook.db_lookup_failed", error=str(exc))
    return bots


def build_webhook_url(bot_id: str) -> str | None:
    """Build the per-bot webhook URL. Returns None if PUBLIC_BASE_URL is unset."""
    base = settings.public_base_url.rstrip("/")
    if not base:
        return None
    path = settings.telegram_webhook_path.rstrip("/")
    return f"{base}{path}/{bot_id}"


async def set_webhook(client: httpx.AsyncClient, token: str, url: str) -> tuple[bool, str | None]:
    """Call Telegram setWebhook for one bot.

    Returns (ok, description). Caller decides how loud to be about failures —
    the bulk startup path logs and moves on; the admin endpoint surfaces
    failures back to the web layer.
    """
    payload: dict[str, object] = {"url": url}
    if settings.telegram_webhook_secret:
        payload["secret_token"] = settings.telegram_webhook_secret

    try:
        resp = await client.post(f"{TELEGRAM_API}/bot{token}/setWebhook", json=payload)
        body = resp.json()
    except Exception as exc:
        return False, f"network error: {exc}"

    if resp.status_code == 200 and body.get("ok"):
        return True, None
    return False, body.get("description") or f"HTTP {resp.status_code}"


async def delete_webhook(client: httpx.AsyncClient, token: str) -> tuple[bool, str | None]:
    try:
        resp = await client.post(f"{TELEGRAM_API}/bot{token}/deleteWebhook")
        body = resp.json()
    except Exception as exc:
        return False, f"network error: {exc}"

    if resp.status_code == 200 and body.get("ok"):
        return True, None
    return False, body.get("description") or f"HTTP {resp.status_code}"


def _html_escape(s: str) -> str:
    """Escape the three characters Telegram HTML parse_mode requires."""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


async def send_message(
    client: httpx.AsyncClient,
    token: str,
    chat_id: str,
    text: str,
    parse_mode: str = "HTML",
) -> tuple[bool, str | None]:
    """POST {TELEGRAM_API}/bot{token}/sendMessage."""
    payload: dict[str, object] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }
    try:
        resp = await client.post(f"{TELEGRAM_API}/bot{token}/sendMessage", json=payload)
        body = resp.json()
    except Exception as exc:
        return False, f"network error: {exc}"

    if resp.status_code == 200 and body.get("ok"):
        return True, None
    return False, body.get("description") or f"HTTP {resp.status_code}"


async def register_all_webhooks() -> None:
    """Register the per-bot webhook URL for every active bot on startup."""
    if not settings.public_base_url.rstrip("/"):
        logger.warning(
            "telegram_webhook.skipped",
            reason="PUBLIC_BASE_URL not set — bots will not receive updates",
        )
        return

    bots = await _collect_bots()
    if not bots:
        logger.info("telegram_webhook.no_bots")
        return

    async def _register(client: httpx.AsyncClient, bot: BotRecord) -> None:
        url = build_webhook_url(bot.id)
        if url is None:
            return
        ok, desc = await set_webhook(client, bot.token, url)
        if ok:
            logger.info("telegram_webhook.registered", bot_id=bot.id, url=url)
        else:
            logger.error("telegram_webhook.rejected", bot_id=bot.id, description=desc)

    async with httpx.AsyncClient(timeout=10) as client:
        await asyncio.gather(*(_register(client, b) for b in bots))
