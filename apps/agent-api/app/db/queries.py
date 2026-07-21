"""Raw async DB queries for the agent-api service."""
import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.connection import AsyncSessionLocal, db_url, connect_args


def _make_session() -> async_sessionmaker:
    """Create a fresh engine+session bound to the current event loop.

    The global engine/AsyncSessionLocal in connection.py is bound to the event
    loop that was running when the module was first imported (typically the
    FastAPI / uvicorn loop). Celery workers spin up their own event loops per
    task, so reusing that global engine causes asyncpg to raise
    'ValueError: not enough values to unpack'. Creating a fresh engine per
    query function avoids the issue without requiring any external state.
    """
    eng = create_async_engine(db_url, pool_pre_ping=True, connect_args=connect_args)
    return async_sessionmaker(eng, expire_on_commit=False, class_=AsyncSession)


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


# ─── Telegram pending-action approval flow (§2.8) ───────────────────────────


async def create_pending_action(
    workspace_id: str,
    project_id: str | None,
    chat_id: str,
    action_type: str,
    payload: dict,
) -> str | None:
    """Store a proposed write awaiting Y/N confirmation.

    Any prior pending row for the same chat is expired first, so at most one
    action is ever awaiting confirmation per chat and the user's next Y/N reply
    is unambiguous. Returns the new row id, or None on failure.
    """
    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                "UPDATE telegram_pending_actions "
                "SET status = 'expired', resolved_at = now() "
                "WHERE chat_id = :chat_id AND status = 'pending'"
            ),
            {"chat_id": chat_id},
        )
        result = await session.execute(
            text(
                "INSERT INTO telegram_pending_actions "
                "(workspace_id, project_id, chat_id, action_type, payload) "
                "VALUES (:workspace_id, :project_id, :chat_id, :action_type, "
                "CAST(:payload AS jsonb)) RETURNING id"
            ),
            {
                "workspace_id": workspace_id,
                "project_id": project_id,
                "chat_id": chat_id,
                "action_type": action_type,
                "payload": json.dumps(payload),
            },
        )
        row = result.fetchone()
        await session.commit()
        return str(row[0]) if row else None


async def get_pending_action(chat_id: str) -> dict | None:
    """Return the current pending action for a chat, or None."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(
                "SELECT id, workspace_id, project_id, action_type, payload "
                "FROM telegram_pending_actions "
                "WHERE chat_id = :chat_id AND status = 'pending' "
                "ORDER BY created_at DESC LIMIT 1"
            ),
            {"chat_id": chat_id},
        )
        row = result.fetchone()
        if not row:
            return None
        payload = row[4]
        if isinstance(payload, str):
            payload = json.loads(payload or "{}")
        return {
            "id": str(row[0]),
            "workspace_id": str(row[1]),
            "project_id": str(row[2]) if row[2] else None,
            "action_type": row[3],
            "payload": payload or {},
        }


async def resolve_pending_action(
    action_id: str, status: str, reason: str | None = None
) -> None:
    """Mark a pending action approved/rejected/expired."""
    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                "UPDATE telegram_pending_actions "
                "SET status = :status, rejection_reason = :reason, resolved_at = now() "
                "WHERE id = :id"
            ),
            {"id": action_id, "status": status, "reason": reason},
        )
        await session.commit()


async def get_all_active_projects() -> list[dict]:
    """Return id + workspace_id for all projects with status='active'.

    Uses a fresh engine so this is safe to call from a Celery worker that runs
    in its own event loop separate from the FastAPI import-time loop.
    """
    session_factory = _make_session()
    async with session_factory() as session:
        result = await session.execute(
            text("SELECT id, workspace_id FROM projects WHERE status = 'active'")
        )
        return [{"id": str(row[0]), "workspace_id": str(row[1])} for row in result.fetchall()]
