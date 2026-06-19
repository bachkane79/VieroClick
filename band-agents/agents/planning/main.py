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
from shared.vieroc_client import VieroClickClient

load_dotenv()
logger = logging.getLogger(__name__)

PLANNING_SYSTEM_PROMPT = """You are an expert AI Planning Agent.
Analyze the project intake details, constraints, deliverables, docs, and members to generate a structured project plan.
Ensure you return WBS nodes, tasks, milestones, dependencies, risks, assumptions, and acceptance criteria.
WBS nodes should represent project phases and logical groupings.

IMPORTANT: Do not assign tasks to members yet. The assignee fields should remain empty.

Respond ONLY with a structured JSON object in this exact format:
{
  "wbs": [
    { "title": "Requirements Gathering", "description": "Group for requirement WBS nodes", "node_type": "phase" }
  ],
  "tasks": [
    {
      "title": "Database Schema Setup",
      "description": "Establish PostgreSQL migration tables.",
      "priority": "high",
      "estimateHours": 8,
      "acceptanceCriteria": ["All tables created with correct foreign keys", "Migration runs cleanly"]
    }
  ],
  "milestones": [
    { "title": "Milestone Alpha: Core Schemas Locked", "description": "Database and models complete", "targetDate": "2026-06-30" }
  ],
  "dependencies": [
    { "blockerTaskTitle": "Database Schema Setup", "blockedTaskTitle": "API Endpoints Implementation" }
  ],
  "risks": [
    { "title": "Database Connection Limit", "description": "Neon db connection pooling threshold reached", "probability": 2, "impact": 4, "mitigation": "Configure PgBouncer" }
  ],
  "assumptions": [
    "Development environment is fully configured with Node.js and Docker."
  ],
  "acceptance_criteria": [
    "All tasks must compile and pass typechecks."
  ]
}
"""

PLANNING_USER_TEMPLATE = """Project intake details:
{request}

Analyze the project request above, build the WBS, tasks, milestones, dependencies, risks, assumptions, and acceptance criteria. Return the structured JSON.
"""


class PlanningAdapter(SimpleAdapter):
    def __init__(self, agent_id: str):
        super().__init__()
        self.agent_id = agent_id
        self.vieroc = VieroClickClient()

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

        is_mentioned = f"[[{self.agent_id}]]" in msg.content or "@planning" in msg.content
        if not is_mentioned:
            await tools.send_event(content="Not addressed to planning agent — skipping", message_type="thought")
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

    async def handle_message(self, message: str, room_context):
        logger.info(f"Planning agent received request: {message[:100]}...")
        await room_context.send_message("⏳ Planning Agent: Generating project implementation roadmap and WBS structure...")

        try:
            llm_response = await call_llm(
                system_prompt=PLANNING_SYSTEM_PROMPT,
                user_prompt=PLANNING_USER_TEMPLATE.format(request=message),
                response_format_json=True,
                model_override=os.getenv("PLANNING_MODEL")
            )
            plan = extract_json_payload(llm_response)
        except Exception as e:
            logger.error(f"Planning failed: {e}")
            await room_context.send_message(f"❌ Planning failed: {e}")
            return

        if not plan:
            await room_context.send_message("❌ Could not generate a plan. LLM response was not valid JSON.")
            return

        # Store as suggestion in VieroClick database
        title = "AI-Scaffolded Project Implementation Roadmap"
        body = "AI-generated backlog suggestion package including WBS, tasks, milestones, and risks. Click 'Review AI Plan' in the project UI to edit and approve."
        
        resp = await self.vieroc.create_suggestion(
            suggestion_type="planning_package",
            title=title,
            body=body,
            payload=plan
        )

        if resp and "id" in resp:
            re_message = (
                f"✅ **Planning roadmap generated and persisted!**\n\n"
                f"- Tasks suggested: {len(plan.get('tasks', []))}\n"
                f"- Milestones suggested: {len(plan.get('milestones', []))}\n"
                f"- Risks identified: {len(plan.get('risks', []))}\n\n"
                f"👉 **Leader action required**: Click **'Review AI Plan'** in the VieroClick UI to modify, approve, and auto-create these items. *No tasks have been directly created yet.*"
            )
            await room_context.send_message(re_message)
        else:
            await room_context.send_message("❌ Planning roadmap generated, but failed to persist to VieroClick database. Check server connections.")


async def run_planning():
    agent_id, api_key = load_agent_config("planning")
    adapter = PlanningAdapter(agent_id)
    agent = Agent.create(agent_id=agent_id, api_key=api_key, adapter=adapter)
    logger.info("🚀 Planning agent started — listening for @planning mentions")
    await agent.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    asyncio.run(run_planning())
