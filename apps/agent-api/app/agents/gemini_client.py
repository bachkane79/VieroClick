"""
Gemini client for the agent-api service — company Gemini API (native google-genai).

All agents call gemini-2.5-flash by default; the planner uses gemini-2.5-pro.
Replaces the previous OpenAI client. Exposes small async helpers instead of the
OpenAI chat/embeddings surface so call sites stay simple.
"""
from functools import lru_cache

from google import genai
from google.genai import types

from app.settings import settings


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
    """Single-turn generation. Returns the response text."""
    client = get_gemini_client()
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.2,
        response_mime_type="application/json" if as_json else "text/plain",
    )
    response = await client.aio.models.generate_content(
        model=model or settings.gemini_model,
        contents=user_prompt,
        config=config,
    )
    return response.text or ""


async def embed(text: str) -> list[float]:
    """Embed a single piece of text."""
    client = get_gemini_client()
    response = await client.aio.models.embed_content(
        model=settings.gemini_embedding_model,
        contents=text,
    )
    return list(response.embeddings[0].values)
