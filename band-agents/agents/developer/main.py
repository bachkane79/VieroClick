"""
agents/developer/main.py (Actying as Assigner Agent)
Assigner Agent — Band entry point.

Listens for @developer mentions (triggered by planner after human approval).
Recommends optimal task assignments based on real team member profiles.
Posts results and calls @qa_agent.
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

from shared.llm import call_llm
from shared.message_parser import extract_json_payload, format_agent_message

load_dotenv()
logger = logging.getLogger(__name__)

QA_HANDLE = os.getenv("QA_HANDLE", "@qa_agent")
NOTIFIER_HANDLE = os.getenv("NOTIFIER_HANDLE", "@notifier")
DEVELOPER_HANDLE = os.getenv("DEVELOPER_HANDLE", "@developer")

ASSIGNER_SYSTEM_PROMPT = """You are a project resource allocation expert.
Given a list of tasks (each has an 'id' and a 'title') and a list of team members with their skills, roles, and strengths,
recommend the optimal assignee for each task.

Always allocate tasks based on these profiles:
- member_1 (Người 1): Handles Auth, NextAuth, Notifications, Telegram bots, Webhooks, Integrations, Email notification.
- member_2 (Người 2): Handles Gantt charts, Task system, Milestones, Projects, Core Workflows, drag-and-drop.
- member_3 (Người 3): Handles Comments, File uploads, S3 storage, Daily updates, Blockers, Risks, collaboration features.

Always respond as structured JSON in this exact format, copying the 'id' of the task exactly to the 'task_id' field:
{
  "assignments": [
    {
      "task_id": "Task ID",
      "task_title": "Task Title",
      "recommended_member_id": "member_1|member_2|member_3",
      "recommended_member_name": "Người 1|Người 2|Người 3",
      "confidence": 0.95,
      "reasoning": "Reason why this member is best suited based on their specific skills."
    }
  ]
}
"""

ASSIGNER_USER_TEMPLATE = """Tasks list to assign:
{tasks_json}

Please recommend the best team member for each task.
"""


class AssignerAdapter(SimpleAdapter):
    """
    Assigner agent adapter (acting as @developer handle).
    Parses the tasks from the plan, calls LLM to recommend assignments,
    and forwards result to @notifier.
    """

    def __init__(self, agent_id: str):
        super().__init__()
        self.agent_id = agent_id

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

        is_mentioned = f"[[{self.agent_id}]]" in msg.content or DEVELOPER_HANDLE in msg.content or "@developer" in msg.content
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
        logger.info("Assigner agent triggered")
        
        # Extract the plan JSON embedded in the message
        plan = extract_json_payload(message)
        
        if not plan:
            logger.info("Assigner triggered, but no plan payload was found. Ignoring message.")
            return

        tasks = plan.get("tasks", [])
        if not tasks:
            await room_context.send_message("⚠️ No tasks found in the plan to assign.")
            return

        await room_context.send_message("⏳ Matching tasks with optimal team member profiles...")
        
        try:
            content = await call_llm(
                system_prompt=ASSIGNER_SYSTEM_PROMPT,
                user_prompt=ASSIGNER_USER_TEMPLATE.format(tasks_json=json.dumps(tasks, indent=2)),
                response_format_json=True,
                model_override=os.getenv("DEVELOPER_MODEL")
            )
            assignments_data = extract_json_payload(content)
        except Exception as e:
            logger.error(f"Assigner LLM call failed: {e}")
            await room_context.send_message(f"❌ Assigner agent failed: {e}")
            return

        if not assignments_data or "assignments" not in assignments_data:
            await room_context.send_message("❌ Failed to parse assignment suggestions.")
            return

        # Combine plan and assignments in payload
        combined_payload = {
            "plan": plan,
            "assignments": assignments_data.get("assignments", [])
        }

        # Format and post the output
        body = self._format_assignments_summary(assignments_data)
        dev_message = format_agent_message(
            header=f"🛠️ Task Assignments: {plan.get('project_title', 'Project')}",
            body=body,
            payload=combined_payload,
            next_mention=NOTIFIER_HANDLE,
        )
        await room_context.send_message(dev_message)
        logger.info("Task assignments posted — @notifier notified")

    def _format_assignments_summary(self, data: dict) -> str:
        lines = ["Here are the recommended resource allocations for the project tasks:", ""]
        for asm in data.get("assignments", []):
            lines.append(f"📌 Task: **{asm.get('task_title')}**")
            lines.append(f"   *Assignee*: **{asm.get('recommended_member_name')}** (`{asm.get('recommended_member_id')}`)")
            lines.append(f"   *Confidence*: `{int(asm.get('confidence', 0.8) * 100)}%`")
            lines.append(f"   *Reason*: {asm.get('reasoning')}")
            lines.append("")
        return "\n".join(lines)


async def run_developer():
    """Entry point — called by run_all.py."""
    agent_id, api_key = load_agent_config("developer")
    adapter = AssignerAdapter(agent_id)
    agent = Agent.create(agent_id=agent_id, api_key=api_key, adapter=adapter)
    logger.info("🚀 Assigner agent started — listening for @developer mentions")
    await agent.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    asyncio.run(run_developer())
