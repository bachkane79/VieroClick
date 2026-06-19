"""
shared/message_parser.py
Utilities for parsing structured data embedded in Band chat messages.

Band agents communicate by posting formatted text to rooms.
This module extracts JSON payloads and keywords from those messages.
"""
from __future__ import annotations
import re
import json
import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

# Regex to find a JSON block wrapped in ```json ... ```
_JSON_BLOCK_RE = re.compile(r"```json\s*(.*?)\s*```", re.DOTALL)

# Status keywords used across the pipeline
HITL_APPROVE_KEYWORDS = {"approve", "approved", "ok", "yes", "lgtm", "create"}
HITL_REJECT_KEYWORDS = {"reject", "cancel", "block", "no", "stop"}


def extract_json_payload(message_text: str) -> Optional[dict[str, Any]]:
    """
    Extract the first JSON block from a message.
    Agents embed structured data like:
      ```json
      {"status": "ready_for_dev", ...}
      ```
    """
    try:
        cleaned = message_text.strip()
        if (cleaned.startswith("{") and cleaned.endswith("}")) or (cleaned.startswith("[") and cleaned.endswith("]")):
            return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    match = _JSON_BLOCK_RE.search(message_text)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse JSON payload: {e}")
        return None


def extract_status(message_text: str) -> Optional[str]:
    """Extract a STATUS: field from a message (simple line-based extraction)."""
    for line in message_text.splitlines():
        if line.strip().upper().startswith("STATUS:"):
            return line.split(":", 1)[1].strip().lower()
    return None


def is_human_approval(message_text: str) -> bool:
    """Check if a message contains a human approval keyword."""
    words = set(re.findall(r"\b\w+\b", message_text.lower()))
    return not words.isdisjoint(HITL_APPROVE_KEYWORDS)


def is_human_rejection(message_text: str) -> bool:
    """Check if a message contains a human rejection keyword."""
    words = set(re.findall(r"\b\w+\b", message_text.lower()))
    return not words.isdisjoint(HITL_REJECT_KEYWORDS)


def format_agent_message(header: str, body: str, payload: Optional[dict] = None, next_mention: Optional[str] = None) -> str:
    """
    Format a structured message that other agents can parse.
    
    Args:
        header: Short human-readable header
        body: Main message body (markdown)
        payload: Optional JSON payload to embed
        next_mention: The @handle of the next agent to call, if any
    """
    parts = [f"**{header}**\n", body]

    if payload:
        json_str = json.dumps(payload, indent=2, ensure_ascii=False)
        parts.append(f"\n```json\n{json_str}\n```")

    if next_mention:
        parts.append(f"\n\n{next_mention} please proceed with the above.")

    return "\n".join(parts)
