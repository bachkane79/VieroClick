"""
agents/notifier/vieroc_client.py
VieroClick API client used by the Notifier agent.

Makes HTTP calls to the running VieroClick Next.js application
to create tasks, comments, and trigger notifications.
"""
from __future__ import annotations
import logging
import os
from typing import Optional
import httpx

logger = logging.getLogger(__name__)


class VieroClickClient:
    """
    HTTP client for the VieroClick project management API.
    
    Uses the Next.js API routes / tRPC endpoints exposed by VieroClick.
    Requires VIEROC_API_URL and VIEROC_API_TOKEN env vars.
    """

    def __init__(self):
        self.base_url = os.getenv("VIEROC_API_URL", "http://localhost:3000")
        self.token = os.getenv("VIEROC_API_TOKEN", "")
        self.default_project_id = os.getenv("VIEROC_DEFAULT_PROJECT_ID", "")
        
        if not self.token:
            logger.warning("VIEROC_API_TOKEN not set — VieroClick API calls will fail auth")

    @property
    def _headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}",
        }

    async def create_project(
        self,
        name: str,
        description: str = "",
    ) -> dict:
        """Create a new project in VieroClick."""
        payload = {
            "name": name,
            "description": description,
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/api/projects",
                    json=payload,
                    headers=self._headers,
                )
                resp.raise_for_status()
                data = resp.json()
                logger.info(f"Created project: {data.get('id')} — {name}")
                return data
            except httpx.HTTPStatusError as e:
                logger.error(f"VieroClick project creation failed: {e.response.status_code} {e.response.text}")
                return {"error": str(e), "status_code": e.response.status_code}
            except Exception as e:
                logger.error(f"VieroClick request failed: {e}")
                return {"error": str(e)}

    async def create_task(
        self,
        title: str,
        description: str,
        project_id: Optional[str] = None,
        priority: str = "medium",
        estimated_days: float = 1.0,
    ) -> dict:
        """Create a new task in VieroClick."""
        project_id = project_id or self.default_project_id
        payload = {
            "title": title,
            "description": description,
            "projectId": project_id,
            "priority": priority.upper(),
            "estimatedHours": estimated_days * 8,
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/api/tasks",
                    json=payload,
                    headers=self._headers,
                )
                resp.raise_for_status()
                data = resp.json()
                logger.info(f"Created task: {data.get('id')} — {title}")
                return data
            except httpx.HTTPStatusError as e:
                logger.error(f"VieroClick task creation failed: {e.response.status_code} {e.response.text}")
                return {"error": str(e), "status_code": e.response.status_code}
            except Exception as e:
                logger.error(f"VieroClick request failed: {e}")
                return {"error": str(e)}

    async def assign_task(
        self,
        task_id: str,
        member_id: str,
    ) -> dict:
        """Assign a task to a team member in VieroClick."""
        payload = {
            "taskId": task_id,
            "memberId": member_id,
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/api/tasks/assign",
                    json=payload,
                    headers=self._headers,
                )
                resp.raise_for_status()
                data = resp.json()
                logger.info(f"Assigned task {task_id} to member {member_id}")
                return data
            except Exception as e:
                logger.error(f"VieroClick task assignment failed: {e}")
                return {"error": str(e)}

    async def add_comment(

        self,
        task_id: str,
        content: str,
    ) -> dict:
        """Add a comment to a VieroClick task."""
        payload = {
            "taskId": task_id,
            "content": content,
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/api/comments",
                    json=payload,
                    headers=self._headers,
                )
                resp.raise_for_status()
                data = resp.json()
                logger.info(f"Added comment to task {task_id}")
                return data
            except Exception as e:
                logger.error(f"VieroClick comment creation failed: {e}")
                return {"error": str(e)}

    async def send_telegram_notification(self, message: str) -> bool:
        """
        Send a Telegram notification via the VieroClick Telegram module.
        Calls the internal Telegram API endpoint if configured.
        """
        telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
        telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID")
        
        if not telegram_token or not telegram_chat_id:
            logger.warning("Telegram not configured — skipping notification")
            return False

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.post(
                    f"https://api.telegram.org/bot{telegram_token}/sendMessage",
                    json={
                        "chat_id": telegram_chat_id,
                        "text": message,
                        "parse_mode": "Markdown",
                    }
                )
                resp.raise_for_status()
                logger.info("Telegram notification sent")
                return True
            except Exception as e:
                logger.error(f"Telegram notification failed: {e}")
                return False

    async def health_check(self) -> bool:
        """Check if VieroClick API is reachable."""
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                resp = await client.get(f"{self.base_url}/api/health")
                return resp.status_code < 500
            except:
                return False
