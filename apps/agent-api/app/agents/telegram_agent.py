"""
Telegram agent (§2.8 / §4.5).

Three input channels, in priority order:

1. **Slash commands** (`/status`, `/member`, `/report`, `/ask`, …) — always
   honored. Read commands render `/api/agent/project-summary`; `/blocker` and
   `/update` open the write-approval flow.
2. **Y/N approval replies** — only meaningful while a write proposal is pending
   for the chat. `Y` commits the proposed blocker/daily-update (owned by the
   project lead); `N <reason>` cancels it and records the reason. A bare Y/N
   sent with no pending proposal is ignored (out of flow).
3. **Free-text messages** — classified into the fixed intent set
   {daily_update, blocker_report, task_question, status_query, general_message}
   and routed: questions → project_qa (answered directly); a suspected blocker
   or daily-update → a Y/N proposal; `general_message` → ignored.

Every actionable input gets a reply; chit-chat and stray approvals do not act.
"""
import asyncio
import json
from typing import Any, Optional

import httpx
import structlog

from app.agents import telegram_commands as tc
from app.agents.gemini_client import generate
from app.agents.vieroc_client import VieroClickClient
from app.db.queries import (
    create_pending_action,
    get_pending_action,
    resolve_pending_action,
)
from app.telegram_webhook import _html_escape, send_message

logger = structlog.get_logger()

# Fixed intent set — the classifier's output is constrained to these.
INTENT_VALUES = {"daily_update", "blocker_report", "task_question", "status_query", "general_message"}

INTENT_PROMPT = """Classify the intent of this Telegram message in a project management context.
Respond ONLY as JSON: {"intent": one of
["daily_update","blocker_report","task_question","status_query","general_message"], "confidence": 0..1}.
- daily_update: the user reports what they did / are doing / progress.
- blocker_report: the user is stuck / blocked / needs something to proceed.
- task_question / status_query: the user asks about the project, tasks, or status.
- general_message: greetings, chit-chat, or anything not actionable.
"""

BLOCKER_EXTRACT_PROMPT = """Extract a project blocker from the user's message.
Respond ONLY as JSON: {"title": "<=120 char summary", "description": "full detail",
"severity": one of ["low","medium","high","urgent"]}.
"""

UPDATE_EXTRACT_PROMPT = """Extract a daily work update from the user's message.
Respond ONLY as JSON: {"completedText": "what was done", "inProgressText": "what is in progress",
"blockersText": "any blockers, or empty string"}.
"""

_APPROVE = {"y", "yes", "ok", "okay", "có", "co", "approve", "duyệt", "duyet", "đồng ý", "dong y"}
_REJECT_FIRST = {"n", "no", "không", "khong", "reject"}


# ─── Intent classification ──────────────────────────────────────────────────


async def classify_message(text: str) -> str:
    try:
        content = await generate(INTENT_PROMPT, text, as_json=True)
        data = json.loads(content or "{}")
    except Exception as e:
        logger.warning("telegram.classify_failed", error=str(e))
        return "general_message"
    intent = data.get("intent")
    return intent if intent in INTENT_VALUES else "general_message"


def parse_approval(text: str) -> tuple[Optional[str], Optional[str]]:
    """Return ("approve", None) | ("reject", reason) | (None, None)."""
    t = text.strip().lower()
    if t in _APPROVE:
        return "approve", None
    parts = t.split(maxsplit=1)
    first = parts[0] if parts else ""
    if first in _REJECT_FIRST or t.startswith("từ chối") or t.startswith("tu choi"):
        reason = parts[1].strip() if len(parts) > 1 else ""
        return "reject", reason
    return None, None


def _is_bare_approval(text: str) -> bool:
    """A standalone Y/N token (used to ignore stray approvals out of flow)."""
    return text.strip().lower() in (_APPROVE | {"n", "no", "không", "khong"})


async def _first_project_id(workspace_id: Optional[str]) -> Optional[str]:
    if not workspace_id:
        return None
    from app.db.queries import get_project_ids_for_workspace

    try:
        ids = await get_project_ids_for_workspace(workspace_id)
    except Exception as e:
        logger.warning("telegram.project_lookup_failed", error=str(e))
        return None
    return ids[0] if ids else None


# ─── Write-approval flow ────────────────────────────────────────────────────


async def _extract_payload(action_type: str, text: str) -> dict:
    """LLM-extract structured fields for the proposed write, with a raw-text fallback."""
    prompt = BLOCKER_EXTRACT_PROMPT if action_type == "blocker" else UPDATE_EXTRACT_PROMPT
    try:
        content = await generate(prompt, text, as_json=True)
        data = json.loads(content or "{}")
    except Exception as e:
        logger.warning("telegram.extract_failed", action_type=action_type, error=str(e))
        data = {}

    if action_type == "blocker":
        title = str(data.get("title") or "").strip() or text.strip()[:120]
        severity = str(data.get("severity") or "medium").lower()
        if severity not in ("low", "medium", "high", "urgent"):
            severity = "medium"
        return {
            "title": title[:120],
            "description": str(data.get("description") or text).strip(),
            "severity": severity,
        }
    return {
        "completedText": str(data.get("completedText") or text).strip(),
        "inProgressText": str(data.get("inProgressText") or "").strip(),
        "blockersText": str(data.get("blockersText") or "").strip(),
    }


def _format_proposal(action_type: str, payload: dict) -> str:
    esc = _html_escape
    footer = "\n\nReply <b>Y</b> to confirm, or <b>N &lt;reason&gt;</b> to cancel."
    if action_type == "blocker":
        return (
            f"<b>Propose blocker</b>\n"
            f"[{esc(payload.get('severity', 'medium'))}] {esc(payload.get('title', ''))}\n"
            f"{esc(payload.get('description', ''))}" + footer
        )
    lines = ["<b>Propose daily-update</b>"]
    if payload.get("completedText"):
        lines.append(f"✅ {esc(payload['completedText'])}")
    if payload.get("inProgressText"):
        lines.append(f"🔄 {esc(payload['inProgressText'])}")
    if payload.get("blockersText"):
        lines.append(f"⛔ {esc(payload['blockersText'])}")
    return "\n".join(lines) + footer


async def _propose_write(
    action_type: str, text: str, chat_id: str, workspace_id: Optional[str]
) -> str:
    """Build a proposed write, persist it as pending, and return the Y/N prompt."""
    project_id = await _first_project_id(workspace_id)
    if not project_id or not workspace_id:
        return "I couldn't find a project to attach this to — please use the app."

    payload = await _extract_payload(action_type, text)
    action_id = await create_pending_action(
        workspace_id=workspace_id,
        project_id=project_id,
        chat_id=chat_id,
        action_type=action_type,
        payload=payload,
    )
    if not action_id:
        return "Something went wrong preparing that action — please try again."
    return _format_proposal(action_type, payload)


async def _resolve_pending(
    pending: dict, decision: str, reason: Optional[str]
) -> str:
    """Commit or cancel a pending write and return the confirmation text."""
    if decision == "reject":
        await resolve_pending_action(pending["id"], "rejected", reason or None)
        suffix = f" Reason: {_html_escape(reason)}" if reason else ""
        return f"❌ Cancelled — no changes made.{suffix}"

    # approve → commit via the web API (owned by the project lead)
    project_id = pending.get("project_id")
    action_type = pending["action_type"]
    if not project_id:
        await resolve_pending_action(pending["id"], "expired")
        return "This action expired — its project is no longer available."

    vieroc = VieroClickClient()
    resp = await vieroc.commit_telegram_action(project_id, action_type, pending["payload"])
    if resp and resp.get("ok"):
        await resolve_pending_action(pending["id"], "approved")
        if action_type == "blocker":
            return f"✅ Blocker filed: {_html_escape(resp.get('title', ''))}"
        return f"✅ Daily-update logged for {_html_escape(resp.get('workDate', ''))}."

    # Keep the row pending so the user can retry, but surface the failure.
    detail = resp.get("error") if isinstance(resp, dict) else None
    return f"⚠️ Couldn't apply that ({_html_escape(detail or 'API error')}). Reply Y to retry."


# ─── Command dispatch ───────────────────────────────────────────────────────


async def _answer_question(question: str, workspace_id: Optional[str]) -> str:
    project_id = await _first_project_id(workspace_id)
    if not project_id:
        return "I couldn't find a project to answer that against — please ask inside the app."
    from app.agents.roles.project_qa import run as qa_run

    result = await qa_run(project_id=project_id, payload={"question": question})
    if result.get("ok") and result.get("answer"):
        # Answer is free-form LLM text; escape it since replies render as HTML.
        return _html_escape(str(result["answer"]))
    return "I couldn't answer that from the project data."


async def _handle_command(
    cmd: str, arg: str, chat_id: str, workspace_id: Optional[str]
) -> Optional[str]:
    """Return reply text, or None when the command replies out-of-band (/report)."""
    if cmd == "help" or cmd == "start":
        return tc.format_help()

    if cmd == "report":
        from app.agents.report_runner import handle_report_command

        asyncio.create_task(handle_report_command(chat_id))
        return None  # report_runner sends its own messages

    if cmd == "ask":
        if not arg:
            return "Usage: <code>/ask &lt;question&gt;</code>"
        return await _answer_question(arg, workspace_id)

    if cmd == "blocker":
        if not arg:
            return "Usage: <code>/blocker &lt;what's blocking you&gt;</code>"
        return await _propose_write("blocker", arg, chat_id, workspace_id)

    if cmd == "update":
        if not arg:
            return "Usage: <code>/update &lt;what you did today&gt;</code>"
        return await _propose_write("daily_update", arg, chat_id, workspace_id)

    if cmd in tc.SUMMARY_COMMANDS or cmd in tc.SUMMARY_COMMANDS_WITH_ARG:
        project_id = await _first_project_id(workspace_id)
        if not project_id:
            return "No project found for this workspace."
        summary = await VieroClickClient().fetch_project_summary(project_id)
        if not summary:
            return "Couldn't load project data right now — please try again."
        if cmd in tc.SUMMARY_COMMANDS_WITH_ARG:
            return tc.SUMMARY_COMMANDS_WITH_ARG[cmd](summary, arg)
        return tc.SUMMARY_COMMANDS[cmd](summary)

    return "Unknown command. Send /help for the list."


# ─── Entry point ────────────────────────────────────────────────────────────


async def handle_telegram_update(update: dict[str, Any], bot: Optional[dict[str, Any]] = None) -> None:
    message = update.get("message", {})
    text = (message.get("text") or "").strip()
    chat_id = str(message.get("chat", {}).get("id", ""))
    if not text or not chat_id:
        return

    token = (bot or {}).get("token")
    workspace_id = (bot or {}).get("workspace_id")

    reply: Optional[str] = None
    log_intent = "command" if text.startswith("/") else None

    # 1. Commands are always honored.
    if text.startswith("/"):
        cmd = text[1:].split(maxsplit=1)[0].split("@", 1)[0].lower()
        arg = text[1:].split(maxsplit=1)
        arg_text = arg[1].strip() if len(arg) > 1 else ""
        reply = await _handle_command(cmd, arg_text, chat_id, workspace_id)

    else:
        pending = await get_pending_action(chat_id)

        # 2. Y/N approval — only while a proposal is pending.
        if pending:
            decision, reason = parse_approval(text)
            if decision is None:
                reply = (
                    "You have a pending confirmation. Reply <b>Y</b> to confirm "
                    "or <b>N &lt;reason&gt;</b> to cancel."
                )
                log_intent = "awaiting_approval"
            else:
                reply = await _resolve_pending(pending, decision, reason)
                log_intent = f"approval_{decision}"

        # 3. No pending flow — classify free text.
        elif _is_bare_approval(text):
            # Stray Y/N with nothing to approve → ignore (out of flow).
            log_intent = "stray_approval_ignored"
        else:
            intent = await classify_message(text)
            log_intent = intent

            if intent in ("task_question", "status_query"):
                reply = await _answer_question(text, workspace_id)
            elif intent == "blocker_report":
                reply = await _propose_write("blocker", text, chat_id, workspace_id)
            elif intent == "daily_update":
                reply = await _propose_write("daily_update", text, chat_id, workspace_id)
            else:
                # general_message → not accepted; nudge to /help without acting.
                reply = "Not sure what you need — send /help to see what I can do."

    if reply and token and chat_id:
        async with httpx.AsyncClient(timeout=15) as client:
            ok, err = await send_message(client, token, chat_id, reply)
            if not ok:
                logger.warning("telegram.reply_failed", intent=log_intent, error=err)

    await logger.ainfo("telegram_message", intent=log_intent, text=text[:100])
