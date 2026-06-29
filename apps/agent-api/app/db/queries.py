"""Raw async DB queries for the agent-api service."""
from sqlalchemy import text

from app.db.connection import AsyncSessionLocal


async def find_workspace_by_default_chat(chat_id: str) -> str | None:
    """Return workspace_id for the bot whose default_chat_id matches chat_id."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(
                "SELECT workspace_id FROM telegram_bots "
                "WHERE default_chat_id = :chat_id AND is_active = true "
                "LIMIT 1"
            ),
            {"chat_id": chat_id},
        )
        row = result.fetchone()
        return str(row[0]) if row else None


async def find_bot_by_chat_id(chat_id: str) -> dict | None:
    """Return {workspace_id, bot_token, default_chat_id} for the active bot
    whose default_chat_id matches chat_id, or None."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(
                "SELECT workspace_id, bot_token, default_chat_id FROM telegram_bots "
                "WHERE default_chat_id = :chat_id AND is_active = true "
                "LIMIT 1"
            ),
            {"chat_id": chat_id},
        )
        row = result.fetchone()
        if not row:
            return None
        return {
            "workspace_id": str(row[0]),
            "bot_token": row[1],
            "default_chat_id": row[2],
        }


async def get_project_ids_for_workspace(workspace_id: str) -> list[str]:
    """Return all active project IDs for the given workspace."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT id FROM projects WHERE workspace_id = :workspace_id"),
            {"workspace_id": workspace_id},
        )
        return [str(row[0]) for row in result.fetchall()]
