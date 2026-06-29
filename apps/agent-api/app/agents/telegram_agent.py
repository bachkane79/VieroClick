"""
Telegram agent: classifies incoming messages, routes to correct handler.
"""
import asyncio
import json
from typing import Any

from app.agents.gemini_client import generate

INTENT_PROMPT = """Classify the intent of this Telegram message in a project management context.
Possible intents: daily_update, blocker_report, task_question, status_query, general_message.
Respond as JSON: {intent, confidence, extracted_data}.
"""


async def classify_message(text: str) -> dict[str, Any]:
    content = await generate(INTENT_PROMPT, text, as_json=True)
    return json.loads(content or "{}")


async def handle_telegram_update(update: dict[str, Any]) -> None:
    message = update.get("message", {})
    text = message.get("text", "").strip()
    chat_id = str(message.get("chat", {}).get("id", ""))

    if not text:
        return

    if text.startswith("/report"):
        if chat_id:
            from app.agents.report_runner import handle_report_command
            asyncio.create_task(handle_report_command(chat_id))
        return

    classification = await classify_message(text)
    intent = classification.get("intent", "general_message")

    import structlog
    logger = structlog.get_logger()
    await logger.ainfo("telegram_message", intent=intent, text=text[:100])
