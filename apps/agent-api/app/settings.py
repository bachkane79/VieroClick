from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str

    # Auth
    agent_api_secret: str = "change-me"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Telegram
    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""

    # Band AI external agents
    band_room_id: str = ""
    planning_handle: str = "@planning"
    planning_agent_id: str = ""
    planning_api_key: str = ""
    assignment_handle: str = "@assignment"
    assignment_agent_id: str = ""
    assignment_api_key: str = ""
    observer_handle: str = "@observer"
    observer_agent_id: str = ""
    observer_api_key: str = ""
    daily_report_handle: str = "@daily-report"
    daily_report_agent_id: str = ""
    daily_report_api_key: str = ""
    morning_briefing_handle: str = "@morning-briefing"
    morning_briefing_agent_id: str = ""
    morning_briefing_api_key: str = ""
    project_qa_handle: str = "@project-qa"
    project_qa_agent_id: str = ""
    project_qa_api_key: str = ""

    # Celery
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # App
    debug: bool = Field(default=False, validation_alias="AGENT_API_DEBUG")
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
