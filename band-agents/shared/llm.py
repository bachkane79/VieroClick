"""
shared/llm.py
Unified LLM caller for all local agents — backed by the company Gemini API.

All agents call Gemini 2.5 Flash by default; the planning agent overrides to
Gemini 2.5 Pro for deeper reasoning. The provider is the native Google Gemini
API via the `google-genai` SDK (GEMINI_API_KEY). An optional GEMINI_BASE_URL is
honoured for company gateway / proxy deployments.
"""
from __future__ import annotations

import asyncio
import logging
import os
import random

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

_client = None


def _get_client():
    """Lazily construct a shared google-genai client."""
    global _client
    if _client is not None:
        return _client

    from google import genai
    from google.genai import types

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required for LLM calls")

    base_url = os.getenv("GEMINI_BASE_URL", "").strip()
    if base_url:
        _client = genai.Client(api_key=api_key, http_options=types.HttpOptions(base_url=base_url))
    else:
        _client = genai.Client(api_key=api_key)
    return _client


async def call_llm(
    system_prompt: str,
    user_prompt: str,
    response_format_json: bool = False,
    model_override: str | None = None,
) -> str:
    """
    Call the company Gemini API and return the text content.

    Args:
        system_prompt: System instruction.
        user_prompt: User content.
        response_format_json: When True, ask Gemini for a JSON response.
        model_override: Specific Gemini model id (e.g. "gemini-2.5-pro").
    """
    from google.genai import types

    model = (model_override or DEFAULT_MODEL).strip()
    client = _get_client()

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.2,
        response_mime_type="application/json" if response_format_json else "text/plain",
    )

    max_retries = 6
    base_delay = 2.0

    for attempt in range(max_retries):
        try:
            logger.info(f"Calling Gemini model: {model} (attempt {attempt + 1}/{max_retries})")
            response = await client.aio.models.generate_content(
                model=model,
                contents=user_prompt,
                config=config,
            )
            return response.text or ""
        except Exception as e:
            err_msg = str(e).lower()
            is_rate_limited = (
                "429" in err_msg
                or "resource_exhausted" in err_msg
                or "quota" in err_msg
                or "too many requests" in err_msg
                or "overloaded" in err_msg
                or "503" in err_msg
            )
            if is_rate_limited and attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt) + random.uniform(0.5, 1.5)
                logger.warning(
                    f"Gemini call rate-limited/overloaded: {e}. "
                    f"Retrying in {delay:.2f}s... (attempt {attempt + 1}/{max_retries})"
                )
                await asyncio.sleep(delay)
            else:
                raise e

    raise RuntimeError("Gemini call failed after all retries")
