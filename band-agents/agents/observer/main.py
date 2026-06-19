from __future__ import annotations
import asyncio
import json
import logging
import os
from datetime import datetime, date
from dotenv import load_dotenv

from band import Agent
from band.core.simple_adapter import SimpleAdapter
from band.config import load_agent_config

from shared.llm import call_llm
from shared.message_parser import extract_json_payload
from shared.vieroc_client import VieroClickClient

load_dotenv()
logger = logging.getLogger(__name__)

OBSERVER_SYSTEM_PROMPT = """You are an expert Project Observer Agent.
Your job is to scan the project data (tasks, blockers, daily updates, milestones, risks) and identify anomalies, risks, plan deviations, or issues that need attention.

Look specifically for:
- Silent members: members with no recent updates.
- Overdue tasks: due date passed but not completed.
- Unclear blockers: vague description of blockers.
- Tasks with missing acceptance criteria.
- General project health issues.

Output a structured JSON list of detected suggestions.
Each suggestion must follow this exact format:
{
  "suggestions": [
    {
      "suggestion_type": "risk_detected|blocker_escalation|plan_deviation|clarification_needed",
      "title": "Clear concise title of the issue",
      "body": "Detailed description of what was detected and recommendation",
      "payload": {
        "affected_task_ids": ["uuid1"],
        "affected_member_ids": ["uuid2"]
      }
    }
  ]
}
"""

OBSERVER_USER_TEMPLATE = """Current date: {current_date}
Analyze the project state:
{project_state}

Identify any issues and format them as the requested JSON structure.
"""


class ObserverAdapter(SimpleAdapter):
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
            return

        is_mentioned = f"[[{self.agent_id}]]" in msg.content or "@observer" in msg.content
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

    async def handle_message(self, message: str, room_context):
        logger.info("Observer agent triggered.")
        await room_context.send_message("⏳ Observer Agent: Performing automated project health scan...")

        # 1. Fetch project data from VieroClick
        proj_data = await self.vieroc.fetch_project_data()
        if not proj_data:
            await room_context.send_message("❌ Failed to retrieve project state for audit.")
            return

        # 2. LLM Scan
        try:
            llm_response = await call_llm(
                system_prompt=OBSERVER_SYSTEM_PROMPT,
                user_prompt=OBSERVER_USER_TEMPLATE.format(
                    current_date=date.today().isoformat(),
                    project_state=json.dumps(proj_data, default=str)
                ),
                response_format_json=True,
                model_override=os.getenv("QA_MODEL")
            )
            result = extract_json_payload(llm_response)
        except Exception as e:
            logger.error(f"Observer scan failed: {e}")
            await room_context.send_message(f"❌ Project health scan failed: {e}")
            return

        if not result or "suggestions" not in result:
            await room_context.send_message("❌ Failed to parse observer suggestions payload.")
            return

        suggestions = result["suggestions"]
        if not suggestions:
            await room_context.send_message("✨ Observer Agent: Project health scan complete. No critical anomalies or risks detected!")
            return

        # 3. Persist suggestions to VieroClick
        saved_count = 0
        lines = ["🔎 **Observer Health Scan Detections:**"]
        for sug in suggestions:
            resp = await self.vieroc.create_suggestion(
                suggestion_type=sug.get("suggestion_type", "risk_detected"),
                title=sug.get("title", "Observer Alert"),
                body=sug.get("body", ""),
                payload=sug.get("payload", {})
            )
            if resp and "id" in resp:
                saved_count += 1
                lines.append(f"- **{sug.get('title')}** (`{sug.get('suggestion_type')}`)")
                lines.append(f"  *Detail*: {sug.get('body')}")

        await room_context.send_message(
            f"✅ **Observer Audit Complete!** Saved {saved_count} suggestion alerts in VieroClick.\n\n"
            + "\n".join(lines)
        )


async def run_observer():
    agent_id, api_key = load_agent_config("observer")
    adapter = ObserverAdapter(agent_id)
    agent = Agent.create(agent_id=agent_id, api_key=api_key, adapter=adapter)
    logger.info("🚀 Observer agent started — listening for @observer mentions")
    await agent.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    asyncio.run(run_observer())
