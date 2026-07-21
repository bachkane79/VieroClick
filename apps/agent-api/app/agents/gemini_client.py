"""
Gemini client for the agent-api service — company Gemini API (native google-genai).

All agents call gemini-2.5-flash by default; the planner uses gemini-2.5-pro.
Replaces the previous OpenAI client. Exposes small async helpers instead of the
OpenAI chat/embeddings surface so call sites stay simple.

LLM calls retry with exponential backoff + jitter on transient rate-limit /
overload errors (429, RESOURCE_EXHAUSTED, quota, 503, overloaded). This retry
loop was consolidated from the former band-agents/shared/llm.py so both the
scheduled and interactive agent paths get the same resilience.
"""
import asyncio
import logging
import random
from functools import lru_cache

from google import genai
from google.genai import types

from app.settings import settings

logger = logging.getLogger(__name__)

# Substrings that mark a transient, retryable Gemini error.
_RETRYABLE_MARKERS = (
    "429",
    "resource_exhausted",
    "quota",
    "too many requests",
    "overloaded",
    "503",
    "unavailable",
)

_MAX_RETRIES = 6
_BASE_DELAY = 2.0
# Hard ceiling on cumulative backoff sleep so a sustained rate-limit can't hang a
# request/worker indefinitely — give up and surface the error past this budget.
_MAX_TOTAL_DELAY = 90.0
_MAX_SINGLE_DELAY = 30.0


def _is_retryable(err: Exception) -> bool:
    msg = str(err).lower()
    return any(marker in msg for marker in _RETRYABLE_MARKERS)


@lru_cache(maxsize=1)
def get_gemini_client() -> genai.Client:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is required for AI agent calls")

    if settings.gemini_base_url:
        return genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(base_url=settings.gemini_base_url),
        )
    return genai.Client(api_key=settings.gemini_api_key)


async def generate(
    system_prompt: str,
    user_prompt: str,
    *,
    model: str | None = None,
    as_json: bool = False,
) -> str:
    """Single-turn generation with retry on transient errors. Returns response text."""
    client = get_gemini_client()
    model_id = model or settings.gemini_model
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.2,
        response_mime_type="application/json" if as_json else "text/plain",
    )

    total_slept = 0.0
    for attempt in range(_MAX_RETRIES):
        try:
            logger.info("Gemini call model=%s (attempt %d/%d)", model_id, attempt + 1, _MAX_RETRIES)
            response = await client.aio.models.generate_content(
                model=model_id,
                contents=user_prompt,
                config=config,
            )
            return response.text or ""
        except Exception as e:
            delay = min(_BASE_DELAY * (2 ** attempt) + random.uniform(0.5, 1.5), _MAX_SINGLE_DELAY)
            budget_left = _MAX_TOTAL_DELAY - total_slept
            if _is_retryable(e) and attempt < _MAX_RETRIES - 1 and delay <= budget_left:
                logger.warning(
                    "Gemini call rate-limited/overloaded: %s. Retrying in %.2fs (attempt %d/%d)",
                    e, delay, attempt + 1, _MAX_RETRIES,
                )
                await asyncio.sleep(delay)
                total_slept += delay
            else:
                raise

    raise RuntimeError("Gemini call failed after all retries")


async def embed(text: str) -> list[float]:
    """Embed a single piece of text."""
    client = get_gemini_client()
    response = await client.aio.models.embed_content(
        model=settings.gemini_embedding_model,
        contents=text,
    )
    return list(response.embeddings[0].values)
