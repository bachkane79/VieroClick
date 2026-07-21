"""
Dead-letter recording for Celery tasks.

When a task fails terminally (retries exhausted), we POST the failure to the web
`/api/agent/dead-letter` endpoint so it lands in the dead_letter table for
inspection / manual retry. This keeps DB writes in the web layer — the worker
never writes domain tables directly.

Best-effort: record_dead_letter never raises, so it is safe to call from a
Celery on_failure handler.
"""
import logging
from typing import Any, Optional

import httpx

from app.settings import settings

logger = logging.getLogger(__name__)


def record_dead_letter(
    source: str,
    error: str,
    *,
    job_type: Optional[str] = None,
    project_id: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
    retry_count: int = 0,
) -> None:
    """Best-effort POST to the web dead-letter endpoint. Never raises."""
    url = f"{settings.vieroc_api_url.rstrip('/')}/api/agent/dead-letter"
    headers = {
        "Content-Type": "application/json",
        "X-Api-Secret": settings.agent_api_secret,
        "Authorization": f"Bearer {settings.vieroc_api_key}",
    }
    body = {
        "source": source,
        "jobType": job_type,
        "projectId": project_id,
        "payload": payload or {},
        "error": error[:8000],
        "retryCount": retry_count,
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json=body, headers=headers)
            resp.raise_for_status()
    except Exception as e:
        logger.error("Failed to record dead-letter (%s): %s", source, e)
