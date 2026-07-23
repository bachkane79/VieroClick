"""
message_parser.py
Utilities for extracting structured JSON from LLM responses.

Agents ask Gemini for JSON but responses may arrive as a bare object or wrapped
in a ```json ... ``` fence — this normalizes both.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Matches a JSON block fenced as ```json ... ```
_JSON_BLOCK_RE = re.compile(r"```json\s*(.*?)\s*```", re.DOTALL)


def extract_json_payload(message_text: str) -> Optional[dict[str, Any]]:
    """Extract the first JSON object/array from an LLM response, or None."""
    if not message_text:
        return None

    cleaned = message_text.strip()
    if (cleaned.startswith("{") and cleaned.endswith("}")) or (
        cleaned.startswith("[") and cleaned.endswith("]")
    ):
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

    match = _JSON_BLOCK_RE.search(message_text)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse JSON payload: %s", e)
        return None
