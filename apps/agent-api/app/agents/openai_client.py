from functools import lru_cache

from openai import AsyncOpenAI

from app.settings import settings


@lru_cache(maxsize=1)
def get_openai_client() -> AsyncOpenAI:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for AI agent calls")

    return AsyncOpenAI(api_key=settings.openai_api_key)
