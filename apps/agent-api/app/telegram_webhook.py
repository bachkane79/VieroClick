"""Auto-register Telegram bot webhooks on app startup.

Reads every active bot token from `telegram_bots` (plus the optional global
TELEGRAM_BOT_TOKEN) and calls Telegram's setWebhook so each one points back
at this service's `/api/telegram/webhook` route.
"""
from __future__ import annotations

import asyncio

import httpx
import structlog
from sqlalchemy import text

from app.db.connection import AsyncSessionLocal
from app.settings import settings

logger = structlog.get_logger()

TELEGRAM_API = "https://api.telegram.org"


async def _collect_bot_tokens() -> list[str]:
    tokens: list[str] = []
    if settings.telegram_bot_token:
        tokens.append(settings.telegram_bot_token)

    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("SELECT bot_token FROM telegram_bots WHERE is_active = true")
            )
            tokens.extend(row[0] for row in result.fetchall() if row[0])
    except Exception as exc:
        logger.warning("telegram_webhook.db_lookup_failed", error=str(exc))

    # Dedupe while preserving order.
    seen: set[str] = set()
    unique: list[str] = []
    for tok in tokens:
        if tok not in seen:
            seen.add(tok)
            unique.append(tok)
    return unique


async def _set_webhook(client: httpx.AsyncClient, token: str, url: str) -> None:
    payload: dict[str, object] = {"url": url}
    if settings.telegram_webhook_secret:
        payload["secret_token"] = settings.telegram_webhook_secret

    try:
        resp = await client.post(f"{TELEGRAM_API}/bot{token}/setWebhook", json=payload)
        body = resp.json()
    except Exception as exc:
        logger.error("telegram_webhook.request_failed", bot=token[:10], error=str(exc))
        return

    if resp.status_code == 200 and body.get("ok"):
        logger.info("telegram_webhook.registered", bot=token[:10], url=url)
    else:
        logger.error(
            "telegram_webhook.rejected",
            bot=token[:10],
            status=resp.status_code,
            description=body.get("description"),
        )


async def register_all_webhooks() -> None:
    """Register the webhook URL for every active bot token."""
    base = settings.public_base_url.rstrip("/")
    if not base:
        logger.warning(
            "telegram_webhook.skipped",
            reason="PUBLIC_BASE_URL not set — bots will not receive updates",
        )
        return

    url = f"{base}{settings.telegram_webhook_path}"
    tokens = await _collect_bot_tokens()
    if not tokens:
        logger.info("telegram_webhook.no_bots")
        return

    async with httpx.AsyncClient(timeout=10) as client:
        await asyncio.gather(*(_set_webhook(client, tok, url) for tok in tokens))
