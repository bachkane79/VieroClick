"""
agents/reviewer/main.py (Acting as Reporter Agent)
Reporter Agent — Band entry point.

Listens for @reviewer mentions (acting as @reviewer handle).
Generates daily morning status reports (scheduled tasks) and evening status reports (progress comparisons).
"""
from __future__ import annotations
import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

from band import Agent
from band.core.simple_adapter import SimpleAdapter
from band.config import load_agent_config

from shared.llm import call_llm
from shared.message_parser import extract_json_payload

load_dotenv()
logger = logging.getLogger(__name__)

REVIEWER_HANDLE = os.getenv("REVIEWER_HANDLE", "@reviewer")

REPORTER_SYSTEM_PROMPT = """You are an expert project status report writer for VieroClick.
Given project task states, updates, and blockers, generate a concise and clear status report in Vietnamese.

Format:
- **Morning Report (Báo cáo Sáng)**: Focus on tasks scheduled for today, active blockers, and daily goals.
- **Evening Report (Báo cáo Tối)**: Highlight progress made today compared to the morning state (completed tasks, updates, blocker changes), and next steps for tomorrow.
"""

REPORTER_USER_TEMPLATE = """Report Type: {report_type}
Morning Timestamp: {morning_time}
Evening/Current Timestamp: {current_time}

Project Data comparison:
{project_data}

Please write a structured, professional Vietnamese report.
"""

# Realistic mock data representing the VieroClick project tasks and their transition today
MOCK_PROJECT_DATA_MORNING = {
    "tasks": [
        {"id": "task_1", "title": "Xây dựng module xác thực NextAuth", "assignee": "Người 1", "status": "IN_PROGRESS", "priority": "HIGH"},
        {"id": "task_2", "title": "Thiết kế Gantt chart kéo thả", "assignee": "Người 2", "status": "TODO", "priority": "HIGH"},
        {"id": "task_3", "title": "Upload file lên S3 và đính kèm comment", "assignee": "Người 3", "status": "IN_PROGRESS", "priority": "MEDIUM"},
    ],
    "blockers": [
        {"id": "block_1", "title": "Neon Database connection pool limit", "severity": "MEDIUM", "status": "ACTIVE"}
    ]
}

MOCK_PROJECT_DATA_EVENING = {
    "tasks": [
        {"id": "task_1", "title": "Xây dựng module xác thực NextAuth", "assignee": "Người 1", "status": "COMPLETED", "priority": "HIGH"},
        {"id": "task_2", "title": "Thiết kế Gantt chart kéo thả", "assignee": "Người 2", "status": "IN_PROGRESS", "priority": "HIGH"},
        {"id": "task_3", "title": "Upload file lên S3 và đính kèm comment", "assignee": "Người 3", "status": "COMPLETED", "priority": "MEDIUM"},
    ],
    "blockers": [
        {"id": "block_1", "title": "Neon Database connection pool limit", "severity": "MEDIUM", "status": "RESOLVED"}
    ]
}


class ReporterAdapter(SimpleAdapter):
    """
    Reporter agent adapter (acting as @reviewer handle).
    Generates daily project status reports for the leader.
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

        is_mentioned = (
            f"[[{self.agent_id}]]" in msg.content 
            or REVIEWER_HANDLE in msg.content 
            or "@reviewer" in msg.content
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
        logger.info("Reporter agent triggered")
        
        clean_msg = message.replace("@reviewer", "").lower().strip()
        
        # Determine report type
        if "sáng" in clean_msg or "morning" in clean_msg:
            await self._send_morning_report(room_context)
        elif "tối" in clean_msg or "evening" in clean_msg or "chiều" in clean_msg:
            await self._send_evening_report(room_context)
        else:
            # General status summary
            await room_context.send_message(
                "Xin chào! Mình là Reporter Bot của VieroClick. Hãy tag mình kèm từ khóa:\n"
                "- `@reviewer sáng` để nhận Báo cáo công việc đầu ngày.\n"
                "- `@reviewer tối` để nhận Báo cáo tiến triển cuối ngày."
            )

    async def _send_morning_report(self, room_context):
        await room_context.send_message("⏳ Đang tổng hợp báo cáo sáng sớm...")
        
        morning_time = (datetime.now() - timedelta(hours=17)).strftime("%Y-%m-%d 08:00:00")
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        project_data = {
            "state": "Start of Day",
            "active_tasks": MOCK_PROJECT_DATA_MORNING["tasks"],
            "blockers": MOCK_PROJECT_DATA_MORNING["blockers"]
        }
        
        try:
            report = await call_llm(
                system_prompt=REPORTER_SYSTEM_PROMPT,
                user_prompt=REPORTER_USER_TEMPLATE.format(
                    report_type="MORNING_REPORT",
                    morning_time=morning_time,
                    current_time=current_time,
                    project_data=json.dumps(project_data, indent=2)
                ),
                response_format_json=False,
                model_override=os.getenv("REVIEWER_MODEL")
            )
            await room_context.send_message(f"🌅 **BÁO CÁO CÔNG VIỆC ĐẦU NGÀY**\n\n{report}")
        except Exception as e:
            logger.error(f"Failed to generate morning report: {e}")
            await room_context.send_message(f"❌ Không thể tạo báo cáo sáng: {e}")

    async def _send_evening_report(self, room_context):
        await room_context.send_message("⏳ Đang đối chiếu dữ liệu và tổng hợp báo cáo cuối ngày...")
        
        morning_time = (datetime.now() - timedelta(hours=10)).strftime("%Y-%m-%d 08:00:00")
        current_time = datetime.now().strftime("%Y-%m-%d 18:00:00")
        
        # Comparison data payload showing transition
        comparison_data = {
            "comparison": "True",
            "morning_state": MOCK_PROJECT_DATA_MORNING,
            "evening_state": MOCK_PROJECT_DATA_EVENING
        }
        
        try:
            report = await call_llm(
                system_prompt=REPORTER_SYSTEM_PROMPT,
                user_prompt=REPORTER_USER_TEMPLATE.format(
                    report_type="EVENING_REPORT",
                    morning_time=morning_time,
                    current_time=current_time,
                    project_data=json.dumps(comparison_data, indent=2)
                ),
                response_format_json=False,
                model_override=os.getenv("REVIEWER_MODEL")
            )
            await room_context.send_message(f"🌃 **BÁO CÁO TIẾN TRIỂN CUỐI NGÀY**\n\n{report}")
        except Exception as e:
            logger.error(f"Failed to generate evening report: {e}")
            await room_context.send_message(f"❌ Không thể tạo báo cáo tối: {e}")


async def run_reviewer():
    """Entry point — called by run_all.py."""
    agent_id, api_key = load_agent_config("reviewer")
    adapter = ReporterAdapter(agent_id)
    agent = Agent.create(agent_id=agent_id, api_key=api_key, adapter=adapter)
    logger.info("🚀 Reporter agent started — listening for @reviewer mentions")
    await agent.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    asyncio.run(run_reviewer())
