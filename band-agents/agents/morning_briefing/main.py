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
from shared.message_parser import extract_json_payload
from shared.vieroc_client import VieroClickClient

load_dotenv()
logger = logging.getLogger(__name__)

BRIEFING_SYSTEM_PROMPT = """You are an expert Morning Briefing Agent.
Review the yesterday report, leader decisions, open blockers, today tasks, priority changes, and risks.
Generate customized daily briefings for each team member, plus project-level summaries (lead and team briefings).

Your output must be a structured JSON object in this exact format:
{
  "project_briefings": {
    "lead_briefing": "Focus points for the lead/owner today",
    "team_briefing": "General announcement for the whole team today"
  },
  "member_briefings": [
    {
      "member_id": "uuid-of-member",
      "member_name": "Full name of member",
      "briefing": "Your personalized task focus and reminders for today"
    }
  ]
}
"""

BRIEFING_USER_TEMPLATE = """Project state context:
{project_state}

Synthesize this data and return the structured JSON morning briefings.
"""


class MorningBriefingAdapter(SimpleAdapter):
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

        is_mentioned = f"[[{self.agent_id}]]" in msg.content or "@morning_briefing" in msg.content
        if not is_mentioned:
            await tools.send_event(content="Not addressed to morning_briefing agent — skipping", message_type="thought")
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
        logger.info("Morning Briefing agent triggered.")
        await room_context.send_message("⏳ Morning Briefing Agent: Generating personalized briefings and announcements...")

        # 1. Fetch project data from VieroClick
        proj_data = await self.vieroc.fetch_project_data()
        if not proj_data:
            await room_context.send_message("❌ Failed to retrieve project state for briefings.")
            return

        # 2. LLM synthesis
        try:
            llm_response = await call_llm(
                system_prompt=BRIEFING_SYSTEM_PROMPT,
                user_prompt=BRIEFING_USER_TEMPLATE.format(
                    project_state=json.dumps(proj_data, default=str)
                ),
                response_format_json=True,
                model_override=os.getenv("MORNING_BRIEFING_MODEL")
            )
            result = extract_json_payload(llm_response)
        except Exception as e:
            logger.error(f"Briefing generation failed: {e}")
            await room_context.send_message(f"❌ Briefing generation failed: {e}")
            return

        if not result or "project_briefings" not in result:
            await room_context.send_message("❌ Failed to parse briefings payload.")
            return

        # 3. Dispatch briefings
        workspace_id = proj_data.get("project", {}).get("workspaceId")
        project_id = proj_data.get("project", {}).get("id")

        p_briefings = result.get("project_briefings", {})
        lead_brief = p_briefings.get("lead_briefing", "")
        team_brief = p_briefings.get("team_briefing", "")

        # Post to Band room
        lines = [
            "☀️ **Morning Briefing Overview:**",
            f"**Lead Briefing**: {lead_brief}",
            f"**Team Briefing**: {team_brief}",
            "",
            "**Personal Member Tasks for Today:**"
        ]

        # Send Web Notifications to each member & add to report message
        for mb in result.get("member_briefings", []):
            member_id = mb.get("member_id")
            member_name = mb.get("member_name")
            briefing_text = mb.get("briefing")
            lines.append(f"- **{member_name}**: {briefing_text}")

            if workspace_id and member_id:
                await self.vieroc.create_notification(
                    workspace_id=workspace_id,
                    recipient_member_id=member_id,
                    project_id=project_id,
                    type="morning_briefing",
                    title="Your Morning Briefing is Ready",
                    body=briefing_text
                )

        final_msg = "\n".join(lines)
        await room_context.send_message(final_msg)

        # Dispatch Telegram notification
        await self.vieroc.send_telegram_notification(f"📢 *Morning Briefing Overview*\n\n{team_brief}")


async def run_morning_briefing():
    agent_id, api_key = load_agent_config("morning_briefing")
    adapter = MorningBriefingAdapter(agent_id)
    agent = Agent.create(agent_id=agent_id, api_key=api_key, adapter=adapter)
    logger.info("🚀 Morning briefing agent started — listening for @morning_briefing mentions")
    await agent.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    asyncio.run(run_morning_briefing())
