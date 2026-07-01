from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str

    # Auth
    agent_api_secret: str = "change-me"

    # LLM provider: company Gemini API (native google-genai)
    gemini_api_key: str = ""
    gemini_base_url: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_planner_model: str = "gemini-2.5-pro"
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
    if not settings.gemini_api_key:
        missing.append("GEMINI_API_KEY")
    if not settings.vieroc_api_key:
        missing.append("VIEROC_API_KEY")
    if not settings.agent_api_secret or settings.agent_api_secret == "change-me":
        missing.append("AGENT_API_SECRET")
    return missing
