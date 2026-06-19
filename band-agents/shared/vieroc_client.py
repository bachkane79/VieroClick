import logging
import os
from typing import Optional, List, Dict, Any
import httpx

logger = logging.getLogger(__name__)


class VieroClickClient:
    """
    HTTP client for the VieroClick API, sharing unified access for all Band agents.
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

    async def fetch_project_data(self, project_id: Optional[str] = None) -> dict:
        """Fetch consolidated project state."""
        pid = project_id or self.default_project_id
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.get(
                    f"{self.base_url}/api/project-data?projectId={pid}",
                    headers=self._headers,
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                logger.error(f"Failed to fetch project data from VieroClick: {e}")
                return {}

    async def create_suggestion(
        self,
        suggestion_type: str,
        title: str,
        body: str,
        payload: dict,
        project_id: Optional[str] = None,
    ) -> dict:
        """Create an agent suggestion (e.g. planning_package, assignment_suggestion, etc.)"""
        pid = project_id or self.default_project_id
        data = {
            "projectId": pid,
            "suggestionType": suggestion_type,
            "title": title,
            "body": body,
            "payload": payload,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/api/suggestions",
                    json=data,
                    headers=self._headers,
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                logger.error(f"Failed to create suggestion in VieroClick: {e}")
                return {}

    async def apply_plan(self, project_id: str, plan: dict) -> dict:
        """Apply an agent-generated plan directly to VieroClick DB-backed objects."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/api/agent/apply-plan",
                    json={"projectId": project_id, "plan": plan},
                    headers=self._headers,
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                logger.error(f"Failed to apply plan in VieroClick: {e}")
                return {}

    async def apply_assignments(self, project_id: str, assignments: dict) -> dict:
        """Apply task assignments directly to VieroClick DB-backed tasks."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/api/agent/apply-assignments",
                    json={
                        "projectId": project_id,
                        "assignments": assignments.get("assignments", []),
                    },
                    headers=self._headers,
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                logger.error(f"Failed to apply assignments in VieroClick: {e}")
                return {}

    async def create_report(
        self,
        report_date: str,
        progress_summary: str,
        risk_summary: Optional[str] = None,
        blocker_summary: Optional[str] = None,
        recommended_actions: Optional[List[str]] = None,
        member_demands: Optional[List[Dict[str, Any]]] = None,
        plan_deviations: Optional[List[Dict[str, Any]]] = None,
        project_id: Optional[str] = None,
    ) -> dict:
        """Create a daily leader report."""
        pid = project_id or self.default_project_id
        data = {
            "projectId": pid,
            "reportDate": report_date,
            "progressSummary": progress_summary,
            "riskSummary": risk_summary,
            "blockerSummary": blocker_summary,
            "recommendedActions": recommended_actions or [],
            "memberDemands": member_demands or [],
            "planDeviations": plan_deviations or [],
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/api/reports",
                    json=data,
                    headers=self._headers,
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                logger.error(f"Failed to create report in VieroClick: {e}")
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
        data = {
            "workspaceId": workspace_id,
            "recipientMemberId": recipient_member_id,
            "projectId": pid,
            "type": type,
            "title": title,
            "body": body,
            "metadata": metadata or {},
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/api/notifications",
                    json=data,
                    headers=self._headers,
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                logger.error(f"Failed to create notification in VieroClick: {e}")
                return {}

    async def create_project(self, name: str, description: str = "") -> dict:
        """Create a new project (backward compatibility)."""
        payload = {"name": name, "description": description}
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/api/projects",
                    json=payload,
                    headers=self._headers,
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                logger.error(f"Project creation failed: {e}")
                return {}

    async def create_task(
        self,
        title: str,
        description: str,
        project_id: Optional[str] = None,
        priority: str = "medium",
        estimated_days: float = 1.0,
    ) -> dict:
        """Create a new task (backward compatibility)."""
        pid = project_id or self.default_project_id
        payload = {
            "title": title,
            "description": description,
            "projectId": pid,
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
                return resp.json()
            except Exception as e:
                logger.error(f"Task creation failed: {e}")
                return {}

    async def assign_task(self, task_id: str, member_id: str) -> dict:
        """Assign task (backward compatibility)."""
        payload = {"taskId": task_id, "memberId": member_id}
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/api/tasks/assign",
                    json=payload,
                    headers=self._headers,
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                logger.error(f"Task assignment failed: {e}")
                return {}

    async def send_telegram_notification(self, message: str) -> bool:
        """Send telegram message directly."""
        telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
        telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID")
        if not telegram_token or not telegram_chat_id:
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
                return True
            except Exception as e:
                logger.error(f"Telegram notification failed: {e}")
                return False

    async def health_check(self) -> bool:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                resp = await client.get(f"{self.base_url}/api/health")
                return resp.status_code < 500
            except:
                return False
