"""
LLM client for the agent-api service.

Chat generation goes through the xKiro OpenAI-compatible gateway
(`https://api.xkiro.com/v1`): all agents use `deepseek/deepseek-v4-pro`, except
the Q&A agent which uses `deepseek/deepseek-v4-flash`. Call sites keep the small
`generate(...)` helper — the model is chosen per caller via the `model` kwarg
(default `settings.llm_model`).

Embeddings still use the company Gemini API (native google-genai), since the
DeepSeek models do not expose an embedding surface.

LLM calls retry with exponential backoff + jitter on transient rate-limit /
overload errors (429, quota, 503, overloaded, timeout), so both the scheduled
and interactive agent paths get the same resilience.
"""
import asyncio
import logging
import random
from functools import lru_cache
from typing import Any, Awaitable, Callable, TypeVar

from google import genai
from google.genai import types
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessage

from app.settings import settings

T = TypeVar("T")

logger = logging.getLogger(__name__)

# Substrings that mark a transient, retryable LLM error (xKiro/OpenAI + Gemini).
_RETRYABLE_MARKERS = (
    "429",
    "resource_exhausted",
    "quota",
    "too many requests",
    "rate limit",
    "overloaded",
    "503",
    "502",
    "unavailable",
    "timeout",
    "timed out",
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
def get_llm_client() -> AsyncOpenAI:
    """OpenAI-compatible client pointed at the xKiro gateway (chat generation)."""
    if not settings.llm_api_key:
        raise RuntimeError("LLM_API_KEY is required for AI agent calls")
    return AsyncOpenAI(api_key=settings.llm_api_key, base_url=settings.llm_base_url)


@lru_cache(maxsize=1)
def get_gemini_client() -> genai.Client:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is required for embeddings")

    if settings.gemini_base_url:
        return genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(base_url=settings.gemini_base_url),
        )
    return genai.Client(api_key=settings.gemini_api_key)


async def _with_retry(make_call: Callable[[], Awaitable[T]], *, label: str) -> T:
    """Run an async LLM call with exponential backoff on transient errors.

    Shared by `generate` and `chat_with_tools` so both the single-turn and the
    tool-calling paths get the same rate-limit/overload resilience.
    """
    total_slept = 0.0
    for attempt in range(_MAX_RETRIES):
        try:
            logger.info("LLM call %s (attempt %d/%d)", label, attempt + 1, _MAX_RETRIES)
            return await make_call()
        except Exception as e:
            delay = min(_BASE_DELAY * (2 ** attempt) + random.uniform(0.5, 1.5), _MAX_SINGLE_DELAY)
            budget_left = _MAX_TOTAL_DELAY - total_slept
            if _is_retryable(e) and attempt < _MAX_RETRIES - 1 and delay <= budget_left:
                logger.warning(
                    "LLM call rate-limited/overloaded: %s. Retrying in %.2fs (attempt %d/%d)",
                    e, delay, attempt + 1, _MAX_RETRIES,
                )
                await asyncio.sleep(delay)
                total_slept += delay
            else:
                raise

    raise RuntimeError("LLM call failed after all retries")


def _thinking_extra_body() -> dict:
    # Pass both spellings the DeepSeek-family gateways accept; unknown keys in
    # extra_body are ignored by the gateway, so this is safe across providers.
    return {
        "reasoning_effort": settings.llm_reasoning_effort,
        "thinking": {"type": "enabled"},
    }


async def generate(
    system_prompt: str,
    user_prompt: str,
    *,
    model: str | None = None,
    as_json: bool = False,
    thinking: bool = False,
) -> str:
    """Single-turn generation with retry on transient errors. Returns response text.

    When `thinking=True` (and settings.llm_thinking_enabled), the request asks the
    xKiro gateway to run the model in extended-reasoning ("thinking") mode via
    extra_body. The final answer stays in message.content (reasoning is surfaced
    separately as reasoning_content), so `as_json` + extract_json_payload still
    work unchanged. The extra_body key is provider-specific — see settings.
    """
    client = get_llm_client()
    model_id = model or settings.llm_model
    kwargs: dict = {
        "model": model_id,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }
    if as_json:
        kwargs["response_format"] = {"type": "json_object"}
    if thinking and settings.llm_thinking_enabled:
        kwargs["extra_body"] = _thinking_extra_body()

    async def _call() -> str:
        response = await client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or ""

    return await _with_retry(_call, label=f"model={model_id}")


async def chat_with_tools(
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    *,
    model: str | None = None,
    tool_choice: str = "auto",
    thinking: bool = False,
) -> ChatCompletionMessage:
    """One assistant turn in a tool-calling loop.

    Takes the running OpenAI-format `messages` transcript plus the `tools` schema
    and returns the assistant message — which may carry `tool_calls` (the caller
    executes them, appends the results, and calls again) or a final `content`.
    Retries transient errors like `generate`.
    """
    client = get_llm_client()
    model_id = model or settings.llm_model
    kwargs: dict = {
        "model": model_id,
        "messages": messages,
        "tools": tools,
        "tool_choice": tool_choice,
        "temperature": 0.2,
    }
    if thinking and settings.llm_thinking_enabled:
        kwargs["extra_body"] = _thinking_extra_body()

    async def _call() -> ChatCompletionMessage:
        response = await client.chat.completions.create(**kwargs)
        return response.choices[0].message

    return await _with_retry(_call, label=f"model={model_id} tools={len(tools)}")


async def generate_stream(
    system_prompt: str,
    user_prompt: str,
    *,
    model: str | None = None,
    thinking: bool = False,
):
    """Streaming single-turn generation.

    Yields (kind, delta) tuples where kind is "thinking" (extended-reasoning
    tokens, DeepSeek `reasoning_content`) or "output" (the answer tokens). Used by
    the intake-review live panel so the UI can render the agent's inference as it
    happens. No retry wrapper — a stream that drops mid-flight surfaces as an
    error event to the client (which can just re-run the review).
    """
    client = get_llm_client()
    model_id = model or settings.llm_model
    kwargs: dict = {
        "model": model_id,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "stream": True,
    }
    if thinking and settings.llm_thinking_enabled:
        kwargs["extra_body"] = {
            "reasoning_effort": settings.llm_reasoning_effort,
            "thinking": {"type": "enabled"},
        }

    logger.info("LLM stream model=%s", model_id)
    stream = await client.chat.completions.create(**kwargs)
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        # DeepSeek reasoning surfaces as reasoning_content; some gateways use
        # `reasoning`. Emit either as a "thinking" delta.
        reasoning = getattr(delta, "reasoning_content", None) or getattr(delta, "reasoning", None)
        if reasoning:
            yield ("thinking", reasoning)
        content = getattr(delta, "content", None)
        if content:
            yield ("output", content)


async def embed(text: str) -> list[float]:
    """Embed a single piece of text (Gemini — DeepSeek has no embedding surface)."""
    client = get_gemini_client()
    response = await client.aio.models.embed_content(
        model=settings.gemini_embedding_model,
        contents=text,
    )
    return list(response.embeddings[0].values)
