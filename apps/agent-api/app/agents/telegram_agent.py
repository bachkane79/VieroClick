"""
Telegram agent: classifies incoming messages, routes to correct handler.
"""
from typing import Any
import json

from app.agents.openai_client import get_openai_client
from app.settings import settings

INTENT_PROMPT = """Classify the intent of this Telegram message in a project management context.
Possible intents: daily_update, blocker_report, task_question, status_query, general_message.
Respond as JSON: {intent, confidence, extracted_data}.
"""


async def classify_message(text: str) -> dict[str, Any]:
    response = await get_openai_client().chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": INTENT_PROMPT},
            {"role": "user", "content": text},
        ],
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content or "{}"
    return json.loads(content)


async def handle_telegram_update(update: dict[str, Any]) -> None:
    message = update.get("message", {})
    text = message.get("text", "")

    if not text:
        return

    classification = await classify_message(text)
    intent = classification.get("intent", "general_message")

    # Store message and classification in DB via repository
    # For now, log it
    import structlog
    logger = structlog.get_logger()
    await logger.ainfo("telegram_message", intent=intent, text=text[:100])
