import os
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

async def call_llm(
    system_prompt: str,
    user_prompt: str,
    response_format_json: bool = False,
    model_override: str | None = None
) -> str:
    """
    Unified LLM caller that seamlessly supports both OpenAI and Anthropic.
    Auto-detects the provider based on environment variables or LLM_PROVIDER setting.
    """
    provider = os.getenv("LLM_PROVIDER", "").lower().strip()
    
    # Auto-detection logic if not explicitly specified
    if not provider:
        openai_key = os.getenv("OPENAI_API_KEY", "")
        anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
        
        # Check if keys are filled with real values (not placeholders)
        has_openai = openai_key and not openai_key.startswith("sk-your") and not openai_key.startswith("sk-...")
        has_anthropic = anthropic_key and not anthropic_key.startswith("sk-ant-your") and not anthropic_key.startswith("sk-ant-...")
        
        if has_openai:
            provider = "openai"
        elif has_anthropic:
            provider = "anthropic"
        else:
            # Default fallback
            if openai_key:
                provider = "openai"
            else:
                provider = "anthropic"

    # Cross-provider model safety check
    if model_override:
        is_anthropic_model = "claude" in model_override.lower()
        is_openai_model = "gpt" in model_override.lower()
        
        if provider == "openai" and is_anthropic_model:
            model_override = None  # Fallback to OpenAI default
        elif provider == "anthropic" and is_openai_model:
            model_override = None  # Fallback to Anthropic default

    import asyncio
    import random
    
    max_retries = 6
    base_delay = 2.0

    for attempt in range(max_retries):
        try:
            if provider == "openai":
                from openai import AsyncOpenAI
                model = model_override or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
                logger.info(f"Using OpenAI provider with model: {model} (Attempt {attempt+1}/{max_retries})")
                
                openai_base_url = os.getenv("OPENAI_BASE_URL", "").strip()
                client_kwargs = {"api_key": os.getenv("OPENAI_API_KEY")}
                if openai_base_url:
                    client_kwargs["base_url"] = openai_base_url
                    
                client = AsyncOpenAI(**client_kwargs)
                kwargs = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.2
                }
                if response_format_json:
                    kwargs["response_format"] = {"type": "json_object"}
                    
                response = await client.chat.completions.create(**kwargs)
                return response.choices[0].message.content or ""
                
            else:  # anthropic
                from anthropic import AsyncAnthropic
                model = model_override or os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
                logger.info(f"Using Anthropic provider with model: {model} (Attempt {attempt+1}/{max_retries})")
                
                anthropic_base_url = os.getenv("ANTHROPIC_BASE_URL", "").strip()
                client_kwargs = {"api_key": os.getenv("ANTHROPIC_API_KEY")}
                if anthropic_base_url:
                    client_kwargs["base_url"] = anthropic_base_url
                    
                client = AsyncAnthropic(**client_kwargs)
                response = await client.messages.create(
                    model=model,
                    max_tokens=4096,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.2
                )
                return response.content[0].text or ""
        except Exception as e:
            err_msg = str(e).lower()
            if "429" in err_msg or "concurrency" in err_msg or "too many requests" in err_msg:
                if attempt == max_retries - 1:
                    raise e
                delay = base_delay * (2 ** attempt) + random.uniform(0.5, 1.5)
                logger.warning(
                    f"LLM call got 429/concurrency limit: {e}. "
                    f"Retrying in {delay:.2f}s... (Attempt {attempt+1}/{max_retries})"
                )
                await asyncio.sleep(delay)
            else:
                raise e

