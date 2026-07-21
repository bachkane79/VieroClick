"""
vieroc_client.py
HTTP client for the VieroClick web API, shared by all agent-api agent roles.

Agents never touch the database directly — they read live project state from the
Next.js API (`GET /api/project-data`) and submit suggestions/actions back through
the same REST surface. Auth uses the shared bearer token (VIEROC_API_KEY).

Requests retry with exponential backoff on transient failures (network errors and
retryable 5xx/429); non-retryable errors (4xx other than 429) fail fast. All
public methods keep their best-effort contract (return {}/False on failure) so a
web-side hiccup never crashes an agent run.

Consolidated from the former band-agents/shared/vieroc_client.py; reads config
from app.settings instead of raw os.getenv.
"""
from __future__ import annotations

import asyncio
import logging
import random
from typing import Any, Optional

import httpx

from app.settings import settings

logger = logging.getLogger(__name__)

_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 3
_BASE_DELAY = 1.0


async def _request_json(
    method: str,
    url: str,
    *,
    headers: dict,
    json: Any = None,
    params: Optional[dict] = None,
    timeout: float = 30.0,
) -> Any:
    """Perform an HTTP request with retry/backoff. Raises on terminal failure."""
    last_exc: Optional[Exception] = None
    for attempt in range(_MAX_ATTEMPTS):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.request(method, url, headers=headers, json=json, params=params)
            # Retry transient server/rate-limit statuses; fail fast on other 4xx.
            if resp.status_code in _RETRYABLE_STATUS and attempt < _MAX_ATTEMPTS - 1:
                delay = _BASE_DELAY * (2 ** attempt) + random.uniform(0, 0.5)
                logger.warning("VieroClick %s %s → %s; retrying in %.2fs", method, url, resp.status_code, delay)
                await asyncio.sleep(delay)
                continue
            resp.raise_for_status()
            return resp.json()
        except (httpx.TransportError, httpx.TimeoutException) as e:
            last_exc = e
            if attempt < _MAX_ATTEMPTS - 1:
                delay = _BASE_DELAY * (2 ** attempt) + random.uniform(0, 0.5)
                logger.warning("VieroClick %s %s network error: %s; retrying in %.2fs", method, url, e, delay)
                await asyncio.sleep(delay)
                continue
            raise
    if last_exc:
        raise last_exc
    raise RuntimeError("request failed after retries")


class VieroClickClient:
    """Async HTTP wrapper around the VieroClick web API used by agent roles."""

    def __init__(self) -> None:
        self.base_url = settings.vieroc_api_url.rstrip("/")
        self.token = settings.vieroc_api_key
        # Sync dispatch always supplies a project_id; kept only as a safety net.
        self.default_project_id = ""

        if not self.token:
            logger.warning("VIEROC_API_KEY not set — VieroClick API calls will fail auth")

    @property
    def _headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}",
        }

    async def fetch_project_data(self, project_id: Optional[str] = None) -> dict:
        """Fetch consolidated project state."""
        pid = project_id or self.default_project_id
        try:
            return await _request_json(
                "GET",
                f"{self.base_url}/api/project-data",
                headers=self._headers,
                params={"projectId": pid},
            )
        except Exception as e:
            logger.error("Failed to fetch project data from VieroClick: %s", e)
            return {}

    async def fetch_project_summary(self, project_id: str) -> dict:
        """Fetch the resolved read model used by Telegram query commands (§2.8).

        Returns health details, team metrics, and resolved task/blocker/risk/
        milestone/daily-update lists. Returns {} on failure (best-effort).
        """
        try:
            return await _request_json(
                "GET",
                f"{self.base_url}/api/agent/project-summary",
                headers=self._headers,
                params={"projectId": project_id},
            )
        except Exception as e:
            logger.error("Failed to fetch project summary from VieroClick: %s", e)
            return {}

    async def commit_telegram_action(
        self, project_id: str, action_type: str, payload: dict
    ) -> dict:
        """Commit a Telegram-approved write (blocker / daily_update) owned by the
        project lead. Returns the API response, or {} on failure."""
        try:
            return await _request_json(
                "POST",
                f"{self.base_url}/api/agent/telegram-action",
                headers=self._headers,
                json={
                    "projectId": project_id,
                    "actionType": action_type,
                    "payload": payload,
                },
            )
        except Exception as e:
            logger.error("Failed to commit telegram action in VieroClick: %s", e)
            return {}

    async def create_suggestion(
        self,
        suggestion_type: str,
        title: str,
        body: str,
        payload: dict,
        project_id: Optional[str] = None,
    ) -> dict:
        """Create an agent suggestion (e.g. project_hole, etc.)."""
        pid = project_id or self.default_project_id
        try:
            return await _request_json(
                "POST",
                f"{self.base_url}/api/suggestions",
                headers=self._headers,
                json={
                    "projectId": pid,
                    "suggestionType": suggestion_type,
                    "title": title,
                    "body": body,
                    "payload": payload,
                },
            )
        except Exception as e:
            logger.error("Failed to create suggestion in VieroClick: %s", e)
            return {}

    async def post_observer_suggestions(
        self, project_id: str, suggestions: list, dispatch_id: Optional[str] = None
    ) -> dict:
        """Post observer suggestions to apply-observer-suggestions — executes actions immediately."""
        try:
            return await _request_json(
                "POST",
                f"{self.base_url}/api/agent/apply-observer-suggestions",
                headers=self._headers,
                json={
                    "projectId": project_id,
                    "suggestions": suggestions,
                    "dispatchId": dispatch_id,
                },
            )
        except httpx.HTTPStatusError as e:
            return self._apply_error("post observer suggestions", e)
        except Exception as e:
            logger.error("Failed to post observer suggestions: %s", e)
            return {"ok": False, "error": str(e)}

    async def apply_plan(
        self, project_id: str, plan: dict, mode: str = "initial", dispatch_id: Optional[str] = None
    ) -> dict:
        """Apply an agent-generated plan to VieroClick DB-backed objects."""
        try:
            return await _request_json(
                "POST",
                f"{self.base_url}/api/agent/apply-plan",
                headers=self._headers,
                json={
                    "projectId": project_id,
                    "plan": plan,
                    "mode": mode,
                    "dispatchId": dispatch_id,
                },
                timeout=60.0,
            )
        except httpx.HTTPStatusError as e:
            return self._apply_error("apply plan", e)
        except Exception as e:
            logger.error("Failed to apply plan in VieroClick: %s", e)
            return {"ok": False, "error": str(e)}

    async def apply_assignments(
        self, project_id: str, assignments: dict, dispatch_id: Optional[str] = None
    ) -> dict:
        """Apply task assignments to VieroClick DB-backed tasks."""
        try:
            return await _request_json(
                "POST",
                f"{self.base_url}/api/agent/apply-assignments",
                headers=self._headers,
                json={
                    "projectId": project_id,
                    "assignments": assignments.get("assignments", []),
                    "dispatchId": dispatch_id,
                },
                timeout=60.0,
            )
        except httpx.HTTPStatusError as e:
            return self._apply_error("apply assignments", e)
        except Exception as e:
            logger.error("Failed to apply assignments in VieroClick: %s", e)
            return {"ok": False, "error": str(e)}

    @staticmethod
    def _apply_error(action: str, e: httpx.HTTPStatusError) -> dict:
        """Surface a 4xx/5xx apply failure (validation detail, dispatch rejection)
        back to the role result instead of swallowing it as {}."""
        status = e.response.status_code
        try:
            detail = e.response.json()
        except Exception:
            detail = {"error": e.response.text[:500] or str(e)}
        error = detail.get("error") if isinstance(detail, dict) else None
        issues = detail.get("issues") if isinstance(detail, dict) else None
        message = error or str(e)
        if issues:
            message = f"{message} ({'; '.join(str(i) for i in issues[:5])})"
        logger.error("Failed to %s in VieroClick (%s): %s", action, status, message)
        return {"ok": False, "status": status, "error": message}

    async def create_report(
        self,
        report_date: str,
        progress_summary: str,
        risk_summary: Optional[str] = None,
        blocker_summary: Optional[str] = None,
        recommended_actions: Optional[list[str]] = None,
        member_demands: Optional[list[dict[str, Any]]] = None,
        plan_deviations: Optional[list[dict[str, Any]]] = None,
        project_id: Optional[str] = None,
    ) -> dict:
        """Create a daily leader report."""
        pid = project_id or self.default_project_id
        try:
            return await _request_json(
                "POST",
                f"{self.base_url}/api/reports",
                headers=self._headers,
                json={
                    "projectId": pid,
                    "reportDate": report_date,
                    "progressSummary": progress_summary,
                    "riskSummary": risk_summary,
                    "blockerSummary": blocker_summary,
                    "recommendedActions": recommended_actions or [],
                    "memberDemands": member_demands or [],
                    "planDeviations": plan_deviations or [],
                },
            )
        except Exception as e:
            logger.error("Failed to create report in VieroClick: %s", e)
            return {}

    async def create_notification(
        self,
        workspace_id: str,
        recipient_member_id: str,
        type: str,
        title: str,
        body: Optional[str] = None,
        metadata: Optional[dict] = None,
        project_id: Optional[str] = None,
    ) -> dict:
        """Trigger an in-app workspace notification."""
        pid = project_id or self.default_project_id
        try:
            return await _request_json(
                "POST",
                f"{self.base_url}/api/notifications",
                headers=self._headers,
                json={
                    "workspaceId": workspace_id,
                    "recipientMemberId": recipient_member_id,
                    "projectId": pid,
                    "type": type,
                    "title": title,
                    "body": body,
                    "metadata": metadata or {},
                },
            )
        except Exception as e:
            logger.error("Failed to create notification in VieroClick: %s", e)
            return {}

    async def send_telegram_notification(self, message: str) -> bool:
        """Best-effort broadcast to the configured Telegram chat."""
        token = settings.telegram_bot_token
        chat_id = settings.telegram_broadcast_chat_id
        if not token or not chat_id:
            return False
        try:
            await _request_json(
                "POST",
                f"https://api.telegram.org/bot{token}/sendMessage",
                headers={"Content-Type": "application/json"},
                json={"chat_id": chat_id, "text": message, "parse_mode": "Markdown"},
                timeout=10.0,
            )
            return True
        except Exception as e:
            logger.error("Telegram notification failed: %s", e)
            return False
