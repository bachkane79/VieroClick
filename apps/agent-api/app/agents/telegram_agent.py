"""
Telegram agent: classifies incoming messages into a fixed intent set, routes each
to an action, and always replies with a confirmation (4.5 / 2.8).

Telegram messages carry no member/project identity (the bot is per-workspace), so
question/status intents are answered by the project Q&A role against the
workspace's project; daily-update / blocker intents are acknowledged and the user
is pointed to the app where the mutation can be attributed to them.
"""
import asyncio
import json
from typing import Any, Optional

import httpx
import structlog

from app.agents.gemini_client import generate
from app.telegram_webhook import send_message

logger = structlog.get_logger()

# Fixed intent set — the classifier's output is constrained to these.
INTENT_VALUES = {"daily_update", "blocker_report", "task_question", "status_query", "general_message"}

INTENT_PROMPT = """Classify the intent of this Telegram message in a project management context.
Respond ONLY as JSON: {"intent": one of
["daily_update","blocker_report","task_question","status_query","general_message"], "confidence": 0..1}.
"""


async def classify_message(text: str) -> str:
    try:
        content = await generate(INTENT_PROMPT, text, as_json=True)
        data = json.loads(content or "{}")
    except Exception as e:
        logger.warning("telegram.classify_failed", error=str(e))
        return "general_message"
    intent = data.get("intent")
    return intent if intent in INTENT_VALUES else "general_message"


async def _first_project_id(workspace_id: str) -> Optional[str]:
    from app.db.queries import get_project_ids_for_workspace

    try:
        ids = await get_project_ids_for_workspace(workspace_id)
    except Exception as e:
        logger.warning("telegram.project_lookup_failed", error=str(e))
        return None
    return ids[0] if ids else None


async def _route_intent(intent: str, text: str, workspace_id: Optional[str]) -> str:
    """Return the confirmation/answer text to send back to the user."""
    if intent in ("task_question", "status_query") and workspace_id:
        project_id = await _first_project_id(workspace_id)
        if project_id:
            from app.agents.roles.project_qa import run as qa_run

            result = await qa_run(project_id=project_id, payload={"question": text})
            if result.get("ok") and result.get("answer"):
                return str(result["answer"])
        return "I couldn't find a project to answer that against — please ask inside the app."

    if intent == "daily_update":
        return (
            "Got it — noted as a daily-update signal. Submit your full update in the app so it's "
            "attributed to you and feeds your progress."
        )

    if intent == "blocker_report":
        return (
            "Noted as a potential blocker. Please file it in the app so it enters the problem queue "
            "with full context and an owner."
        )

    return "Thanks — message received. Use /report for a status report, or ask a question about the project."


async def handle_telegram_update(update: dict[str, Any], bot: Optional[dict[str, Any]] = None) -> None:
    message = update.get("message", {})
    text = (message.get("text") or "").strip()
    chat_id = str(message.get("chat", {}).get("id", ""))
    if not text:
        return

    token = (bot or {}).get("token")
    workspace_id = (bot or {}).get("workspace_id")

    if text.startswith("/report"):
        if chat_id:
            from app.agents.report_runner import handle_report_command

            asyncio.create_task(handle_report_command(chat_id))
        return

    intent = await classify_message(text)
    reply = await _route_intent(intent, text, workspace_id)

    if token and chat_id:
        async with httpx.AsyncClient(timeout=15) as client:
            ok, err = await send_message(client, token, chat_id, reply, parse_mode="")
            if not ok:
                logger.warning("telegram.reply_failed", intent=intent, error=err)

    await logger.ainfo("telegram_message", intent=intent, text=text[:100])
