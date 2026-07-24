from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str

    # Auth
    agent_api_secret: str = "change-me"

    # LLM provider: xKiro OpenAI-compatible gateway (chat generation)
    llm_api_key: str = ""
    llm_base_url: str = "https://api.xkiro.com/v1"
    # All agents use the "pro" model; the Q&A agent uses the "flash" model.
    llm_model: str = "deepseek/deepseek-v4-pro"
    llm_planner_model: str = "deepseek/deepseek-v4-pro"
    llm_qa_model: str = "deepseek/deepseek-v4-flash"
    # Plan-intake review agent — same "pro" model, run with thinking mode on.
    llm_intake_model: str = "deepseek/deepseek-v4-pro"
    # Thinking / extended-reasoning mode for the long-context planning + intake
    # agents. Enabled via extra_body on the xKiro OpenAI-compatible gateway.
    # NOTE: the exact key is provider-specific — verify against xKiro. Kept in
    # settings so switching key/effort is a config change, not a code change.
    llm_thinking_enabled: bool = True
    llm_reasoning_effort: str = "high"

    # Embeddings still use the company Gemini API (native google-genai)
    gemini_api_key: str = ""
    gemini_base_url: str = ""
    gemini_embedding_model: str = "text-embedding-004"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Telegram
    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""
    # Optional chat id for best-effort broadcasts (e.g. morning briefing overview).
    telegram_broadcast_chat_id: str = ""
    # Public HTTPS base URL that Telegram can reach (ngrok in dev, real domain in prod).
    # When set, all active bots get their webhook auto-registered on app startup.
    public_base_url: str = ""
    telegram_webhook_path: str = "/api/telegram/webhook"

    # VieroClick web API (used by agent roles + report_runner)
    vieroc_api_url: str = "http://localhost:3000"
    vieroc_api_key: str = ""

    # Celery
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # App
    debug: bool = Field(default=False, validation_alias="AGENT_API_DEBUG")
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()


def check_required_settings() -> list[str]:
    """Names of critical secrets that are missing or still at a placeholder value."""
    missing: list[str] = []
    if not settings.llm_api_key:
        missing.append("LLM_API_KEY")
    if not settings.vieroc_api_key:
        missing.append("VIEROC_API_KEY")
    if not settings.agent_api_secret or settings.agent_api_secret == "change-me":
        missing.append("AGENT_API_SECRET")
    return missing
