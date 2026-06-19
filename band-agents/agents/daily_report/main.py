from __future__ import annotations
import asyncio
import json
import logging
import os
from datetime import date
from dotenv import load_dotenv

from band import Agent
from band.core.simple_adapter import SimpleAdapter
from band.config import load_agent_config

from shared.llm import call_llm
from shared.message_parser import extract_json_payload
from shared.vieroc_client import VieroClickClient

load_dotenv()
logger = logging.getLogger(__name__)

DAILY_REPORT_SYSTEM_PROMPT = """You are an expert Daily Report Agent.
Your job is to read all project events, updates, blockers, and task completions, and generate a daily summary.

You must output a structured JSON object in this exact format:
{
  "reportDate": "YYYY-MM-DD",
  "progressSummary": "A concise summary of tasks completed and progress made today",
  "riskSummary": "A concise summary of active project risks or issues identified",
  "blockerSummary": "A summary of any active blockers or stuck developers",
  "recommendedActions": [
    "Clarify requirements on Task X",
    "Allocate backup developer to help resolve blocker Y"
  ],
  "memberDemands": [
    { "memberName": "Jane Doe", "demand": "Needs feedback on PR 12" }
  ],
  "planDeviations": [
    { "taskTitle": "Database setup", "deviation": "Delayed by 2 days due to connection pooling config issues" }
  ]
}
"""

DAILY_REPORT_USER_TEMPLATE = """Generate the report for date: {current_date}
Project State:
{project_state}

Return the structured JSON daily report.
"""


class DailyReportAdapter(SimpleAdapter):
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

        is_mentioned = f"[[{self.agent_id}]]" in msg.content or "@daily_report" in msg.content
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
        logger.info("Daily Report agent triggered.")
        await room_context.send_message("⏳ Daily Report Agent: Compiling updates, task metrics, and active blockers...")

        # 1. Fetch project data from VieroClick
        proj_data = await self.vieroc.fetch_project_data()
        if not proj_data:
            await room_context.send_message("❌ Failed to retrieve project state for daily report generation.")
            return

        # 2. LLM synthesis
        current_date = date.today().isoformat()
        try:
            llm_response = await call_llm(
                system_prompt=DAILY_REPORT_SYSTEM_PROMPT,
                user_prompt=DAILY_REPORT_USER_TEMPLATE.format(
                    current_date=current_date,
                    project_state=json.dumps(proj_data, default=str)
                ),
                response_format_json=True,
                model_override=os.getenv("REVIEWER_MODEL")
            )
            report = extract_json_payload(llm_response)
        except Exception as e:
            logger.error(f"Daily report generation failed: {e}")
            await room_context.send_message(f"❌ Daily report generation failed: {e}")
            return

        if not report:
            await room_context.send_message("❌ Failed to generate report. LLM response was not valid JSON.")
            return

        # 3. Post to VieroClick leader_reports
        resp = await self.vieroc.create_report(
            report_date=report.get("reportDate", current_date),
            progress_summary=report.get("progressSummary", ""),
            risk_summary=report.get("riskSummary"),
            blocker_summary=report.get("blockerSummary"),
            recommended_actions=report.get("recommendedActions", []),
            member_demands=report.get("memberDemands", []),
            plan_deviations=report.get("planDeviations", [])
        )

        if resp and "id" in resp:
            re_message = (
                f"📊 **Daily Report Generated!**\n\n"
                f"- **Progress**: {report.get('progressSummary')}\n"
                f"- **Blockers**: {report.get('blockerSummary') or 'None logged'}\n"
                f"- **Recommendations**: {len(report.get('recommendedActions', []))} recommended actions suggested.\n\n"
                f"👉 **Leader action required**: Open the **Reports** tab in VieroClick to edit and approve this report. *It remains pending until approved.*"
            )
            await room_context.send_message(re_message)
        else:
            await room_context.send_message("❌ Report generated, but failed to save in VieroClick database. It may already exist for today.")


async def run_daily_report():
    agent_id, api_key = load_agent_config("daily_report")
    adapter = DailyReportAdapter(agent_id)
    agent = Agent.create(agent_id=agent_id, api_key=api_key, adapter=adapter)
    logger.info("🚀 Daily report agent started — listening for @daily_report mentions")
    await agent.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    asyncio.run(run_daily_report())
