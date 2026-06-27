from __future__ import annotations

import asyncio
import json
import logging
import os
import re

from band import Agent
from band.config import load_agent_config
from band.core.simple_adapter import SimpleAdapter
from dotenv import load_dotenv

from shared.llm import call_llm
from shared.message_parser import extract_json_payload
from shared.vieroc_client import VieroClickClient

load_dotenv()
logger = logging.getLogger(__name__)

PLANNING_SYSTEM_PROMPT = """You are an expert AI Planning Agent.
Analyze the project intake details, constraints, deliverables, docs, and members to generate a structured project plan.
Return WBS nodes, tasks, milestones, dependencies, risks, assumptions, and acceptance criteria.
Tasks must include a wbsTitle matching one of the WBS phase titles when possible.
Tasks should include ISO date-only startDate and dueDate values when a reasonable timeline can be inferred.
Do not assign tasks to members yet.

Respond ONLY with a structured JSON object in this exact format:
{
  "wbs": [
    { "title": "Requirements", "description": "Requirements phase", "node_type": "phase" }
  ],
  "tasks": [
    {
      "title": "Database Schema Setup",
      "description": "Establish PostgreSQL migration tables.",
      "priority": "high",
      "estimateHours": 8,
      "wbsTitle": "Implementation",
      "startDate": "2026-06-20",
      "dueDate": "2026-06-23",
      "acceptanceCriteria": ["All tables created with correct foreign keys"]
    }
  ],
  "milestones": [
    { "title": "Core Schemas Locked", "description": "Database and models complete", "targetDate": "2026-06-30" }
  ],
  "dependencies": [
    { "blockerTaskTitle": "Database Schema Setup", "blockedTaskTitle": "API Endpoints Implementation" }
  ],
  "risks": [
    { "title": "Database Connection Limit", "description": "Connection pooling threshold reached", "probability": 2, "impact": 4, "mitigation": "Configure pooling" }
  ],
  "assumptions": ["Development environment is ready"],
  "acceptance_criteria": ["All tasks must compile and pass typechecks"]
}
"""

PLANNING_USER_TEMPLATE = """Project state:
{request}

Build a practical implementation plan for this project. Return only structured JSON.
"""


class RoomContextWrapper:
    def __init__(self, tools, msg):
        self.tools = tools
        self.msg = msg

    async def send_message(self, content: str):
        mentions = re.findall(r"(?<!\w)@[\w\-/]+", content)
        if not mentions:
            mentions = [os.getenv("BAND_STATUS_MENTION", "bachkane79")]
        await self.tools.send_message(content, mentions=list(dict.fromkeys(mentions)))


class PlanningAdapter(SimpleAdapter):
    def __init__(self, agent_id: str):
        super().__init__()
        self.agent_id = agent_id
        self.vieroc = VieroClickClient()
        self.handle = os.getenv("PLANNING_HANDLE", "@planning")

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
            await tools.send_event(content="Skipping own message", message_type="thought")
            return

        is_mentioned = (
            f"[[{self.agent_id}]]" in msg.content
            or "@planning" in msg.content
            or self.handle in msg.content
        )
        if not is_mentioned:
            await tools.send_event(content="Not addressed to planning agent - skipping", message_type="thought")
            return

        dispatch = extract_json_payload(msg.content) or {}
        if not (dispatch.get("projectId") or self.vieroc.default_project_id):
            await tools.send_event(content="No projectId in planning request - skipping", message_type="thought")
            return

        await self.handle_message(msg.content, RoomContextWrapper(tools, msg))

    async def handle_message(self, message: str, room_context):
        logger.info("Planning agent received request: %s", message[:120])
        dispatch = extract_json_payload(message) or {}
        project_id = dispatch.get("projectId") or self.vieroc.default_project_id
        if not project_id:
            return

        await room_context.send_message("Planning Agent: generating and applying project plan...")

        project_data = await self.vieroc.fetch_project_data(project_id)
        if not project_data:
            await room_context.send_message("Planning failed: could not fetch project data from VieroClick.")
            return

        try:
            llm_response = await call_llm(
                system_prompt=PLANNING_SYSTEM_PROMPT,
                user_prompt=PLANNING_USER_TEMPLATE.format(
                    request=json.dumps(project_data, ensure_ascii=False, default=str)
                ),
                response_format_json=True,
                model_override=os.getenv("PLANNING_MODEL"),
            )
            plan = extract_json_payload(llm_response)
        except Exception as e:
            logger.error("Planning failed: %s", e)
            await room_context.send_message(f"Planning failed: {e}")
            return

        if not plan:
            await room_context.send_message("Planning failed: LLM response was not valid JSON.")
            return

        resp = await self.vieroc.apply_plan(project_id, plan)
        if resp and resp.get("ok"):
            await room_context.send_message(
                "**Planning roadmap applied to VieroClick!**\n\n"
                f"- Tasks created: {resp.get('tasksCreated', 0)}\n"
                f"- WBS nodes created: {resp.get('wbsCreated', 0)}\n"
                f"- Milestones created: {resp.get('milestonesCreated', 0)}\n"
                f"- Risks created: {resp.get('risksCreated', 0)}\n\n"
                "Assignment agent has been triggered through Band."
            )
        else:
            await room_context.send_message(
                "Planning generated a roadmap, but applying it to VieroClick failed."
            )


async def run_planning():
    agent_id, api_key = load_agent_config("planning")
    adapter = PlanningAdapter(agent_id)
    agent = Agent.create(agent_id=agent_id, api_key=api_key, adapter=adapter)
    logger.info("Planning agent started - listening for planning mentions")
    await agent.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    asyncio.run(run_planning())
