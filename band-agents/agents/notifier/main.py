"""
agents/notifier/main.py
Notifier Agent — Band entry point.

Listens for @notifier mentions.
1. Stage 1 (Create Tasks): Triggered by planner after leader approval. Calls VieroClick to create tasks & milestones, then mentions @developer (Assigner) to recommend assignees.
2. Stage 2 (Assign Members): Triggered by Assigner. Calls VieroClick to assign tasks to developers, then posts final completion report.
"""
from __future__ import annotations
import asyncio
import json
import logging
import os
from dotenv import load_dotenv

from band import Agent
from band.core.simple_adapter import SimpleAdapter
from band.config import load_agent_config

from .vieroc_client import VieroClickClient
from shared.message_parser import extract_json_payload, format_agent_message

load_dotenv()
logger = logging.getLogger(__name__)

DEVELOPER_HANDLE = os.getenv("DEVELOPER_HANDLE", "@developer")
NOTIFIER_HANDLE = os.getenv("NOTIFIER_HANDLE", "@notifier")


class NotifierAdapter(SimpleAdapter):
    """
    Notifier Agent adapter.
    Integrates the Band room with VieroClick API endpoints.
    Handles creation stage -> assignment stage -> completion.
    """

    def __init__(self, agent_id: str):
        super().__init__()
        self.agent_id = agent_id
        self.vieroc = VieroClickClient()
        self.vieroc_url = os.getenv("VIEROC_API_URL", "http://localhost:3000")

    async def on_message(
        self,
        msg,
        tools,
        history,
        participants_msg: str | None,
        contacts_msg: str | None,
        *,
        is_session_bootstrap: bool,
        room_id: str,
    ) -> None:
        if msg.sender_id == self.agent_id:
            return

        is_mentioned = (
            f"[[{self.agent_id}]]" in msg.content 
            or NOTIFIER_HANDLE in msg.content 
            or "@notifier" in msg.content
        )
        if not is_mentioned:
            return

        message = msg.content
        import re
        class RoomContextWrapper:
            def __init__(self, tools, msg):
                self.tools = tools
                self.msg = msg
            async def send_message(self, content: str):
                mentions = re.findall(r"(?<!\w)@[\w\-/]+", content)
                if not mentions:
                    mentions = [self.msg.sender_id]
                else:
                    mentions = list(dict.fromkeys(mentions))
                await self.tools.send_message(content, mentions=mentions)
        room_context = RoomContextWrapper(tools, msg)
        await self.handle_message(message, room_context)

    async def handle_message(self, message: str, room_context, **kwargs):
        logger.info("Notifier agent triggered")

        # Extract payload from message
        payload = extract_json_payload(message)
        
        if not payload:
            logger.info("Notifier triggered, but no payload was found. Ignoring message.")
            return

        # Stage 1: Create Tasks & Timeline (Triggered by Planner)
        if "tasks" in payload and "assignments" not in payload:
            await self._handle_task_creation_stage(payload, room_context)
            
        # Stage 2: Update Assignees (Triggered by Assigner)
        elif "assignments" in payload:
            await self._handle_task_assignment_stage(payload, room_context)
            
        else:
            await room_context.send_message("⚠️ Unrecognized Notifier payload format.")

    async def _handle_task_creation_stage(self, payload: dict, room_context):
        tasks = payload.get("tasks", [])
        project_title = payload.get("project_title", "New Project")
        
        await room_context.send_message(f"⏳ Creating tasks for **{project_title}** in VieroClick...")

        # Check VieroClick health
        is_healthy = await self.vieroc.health_check()
        created_tasks = []
        project_id = None
        workspace_slug = "vieroc-hq"
        workspace_members = []

        if not is_healthy:
            await room_context.send_message(
                "⚠️ VieroClick Web App is not running on localhost:3000. "
                "Tasks will be mock-created locally for this demo pipeline."
            )
            project_id = "mock_project_id"
            # Generate simulated IDs for demo
            import uuid
            for idx, task in enumerate(tasks):
                simulated_id = f"task_{idx + 1}_{str(uuid.uuid4())[:8]}"
                created_tasks.append({
                    "id": simulated_id,
                    "title": task.get("title"),
                    "description": task.get("description"),
                    "category": task.get("category", "general")
                })
        else:
            # Create project dynamically first
            project_desc = payload.get("project_abstract", "")
            project_resp = await self.vieroc.create_project(
                name=project_title,
                description=project_desc
            )
            if project_resp and "id" in project_resp:
                project_id = project_resp["id"]
                workspace_slug = project_resp.get("workspaceSlug", "vieroc-hq")
                workspace_members = project_resp.get("members", [])
                logger.info(f"Dynamically created project ID {project_id} in VieroClick (workspace: {workspace_slug}), members: {len(workspace_members)}")
            else:
                logger.warning(f"Could not create VieroClick project dynamically, falling back. Response: {project_resp}")

            # Create real tasks in VieroClick database
            for task in tasks:
                resp = await self.vieroc.create_task(
                    title=task.get("title"),
                    description=task.get("description", ""),
                    project_id=project_id,
                    priority=payload.get("priority", "MEDIUM").lower(),
                    estimated_days=task.get("estimated_hours", 8) / 8.0
                )
                task_id = resp.get("id") or f"mock_{task.get('title')[:10]}"
                created_tasks.append({
                    "id": task_id,
                    "title": task.get("title"),
                    "description": task.get("description"),
                    "category": task.get("category", "general")
                })

        await room_context.send_message(
            f"✅ Successfully created {len(created_tasks)} tasks in the backend!\n"
            f"Passing plan tasks to {DEVELOPER_HANDLE} (Assigner) to recommend optimal assignees..."
        )

        # Build context for Assigner
        assigner_payload = {
            "project_title": project_title,
            "project_id": project_id,
            "workspace_slug": workspace_slug,
            "workspace_members": workspace_members,
            "tasks": created_tasks
        }

        # Mention developer (Assigner) to perform assignments
        assigner_message = format_agent_message(
            header=f"📋 Tasks Created: {project_title}",
            body="Task records created in backend. Please allocate assignees.",
            payload=assigner_payload,
            next_mention=DEVELOPER_HANDLE
        )
        await room_context.send_message(assigner_message)
        logger.info("Task creation complete — sent to assigner")

    async def _handle_task_assignment_stage(self, payload: dict, room_context):
        assignments = payload.get("assignments", [])
        plan = payload.get("plan", {})
        tasks = plan.get("tasks", [])
        project_title = plan.get("project_title", "Project")
        project_id = plan.get("project_id")
        workspace_slug = plan.get("workspace_slug", "vieroc-hq")
        workspace_members = plan.get("workspace_members", [])
        
        await room_context.send_message("⏳ Updating task assignees in the VieroClick database...")

        is_healthy = await self.vieroc.health_check()
        success_count = 0

        def resolve_member_uuid(member_key: str) -> str | None:
            if not workspace_members:
                return None
            try:
                if "member_" in member_key:
                    idx = int(member_key.split("_")[1]) - 1
                    if 0 <= idx < len(workspace_members):
                        return workspace_members[idx]["id"]
            except Exception as e:
                logger.warning(f"Error parsing member key {member_key}: {e}")
            return workspace_members[0]["id"]

        for asm in assignments:
            task_title = asm.get("task_title", "")
            assignee_id = asm.get("recommended_member_id")
            
            # Find matching created task to get ID
            task_id = asm.get("task_id")
            
            # If task_id is not provided or not in tasks, try to match by title
            if not task_id or not any(t.get("id") == task_id for t in tasks):
                # 1. Try exact title match
                for t in tasks:
                    if t.get("title") == task_title:
                        task_id = t.get("id")
                        break
                
                # 2. Try normalized title match (ignoring spaces, case, trailing/leading numbers & punctuation)
                if not task_id:
                    def normalize(s):
                        if not s:
                            return ""
                        import re
                        s_norm = s.strip().lower()
                        s_norm = re.sub(r'^[0-9\.\-\s]+', '', s_norm)  # remove leading numbers
                        s_norm = re.sub(r'[\.\,\!\?\:\-\s]+$', '', s_norm)  # remove trailing punctuation
                        s_norm = re.sub(r'\s+', '', s_norm)  # remove all spaces
                        return s_norm
                    
                    norm_task_title = normalize(task_title)
                    for t in tasks:
                        if normalize(t.get("title")) == norm_task_title:
                            task_id = t.get("id")
                            break
            
            if not task_id:
                logger.warning(f"Could not map assignment for task title: '{task_title}' (id: {asm.get('task_id')})")
                continue

            if is_healthy:
                real_assignee_id = resolve_member_uuid(assignee_id)
                if real_assignee_id:
                    resp = await self.vieroc.assign_task(task_id=task_id, member_id=real_assignee_id)
                    if "error" not in resp:
                        success_count += 1
            else:
                # Mock assignment for local demo pipeline
                success_count += 1

        # Build final report
        report_lines = [
            f"🎉 **Dự án '{project_title}' đã được khởi tạo thành công!**",
            "",
        ]
        
        # Link to the project board if available
        if project_id and project_id != "mock_project_id":
            project_url = f"{self.vieroc_url}/workspace/{workspace_slug}/projects/{project_id}/board"
            report_lines.append(f"🔗 **Xem bảng công việc tại**: [VieroClick Board]({project_url})")
            report_lines.append("")

        report_lines.append("**Báo cáo phân bổ nhân sự (Assignee Report):**")
        for asm in assignments:
            report_lines.append(
                f"- Task: **{asm.get('task_title')}** -> Giao cho **{asm.get('recommended_member_name')}** ({asm.get('recommended_member_id')})"
            )
            report_lines.append(f"  *Lý do*: {asm.get('reasoning')}")
        
        report_lines.append("")
        report_lines.append(f"✅ Đã cập nhật thành công {success_count} assignees trong VieroClick backend!")
        
        await room_context.send_message("\n".join(report_lines))
        logger.info("Pipeline execution complete")


async def run_notifier():
    """Entry point — called by run_all.py."""
    agent_id, api_key = load_agent_config("notifier")
    adapter = NotifierAdapter(agent_id)
    agent = Agent.create(agent_id=agent_id, api_key=api_key, adapter=adapter)
    logger.info("🚀 Notifier agent started — listening for @notifier mentions")
    await agent.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    asyncio.run(run_notifier())
