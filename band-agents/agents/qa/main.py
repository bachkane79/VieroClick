"""
agents/qa/main.py
QA Agent — Band entry point.

Standalone chatbot that answers natural language questions about the project,
its progress, technology, or team assignments.
"""
from __future__ import annotations
import asyncio
import logging
import os
from dotenv import load_dotenv

from band import Agent
from band.core.simple_adapter import SimpleAdapter
from band.config import load_agent_config

from shared.llm import call_llm

load_dotenv()
logger = logging.getLogger(__name__)

QA_HANDLE = os.getenv("QA_HANDLE", "@qa-agent")

QA_SYSTEM_PROMPT = """You are a knowledgeable project assistant for the VieroClick project.
VieroClick is an AI-powered project management application built with Next.js 14, Drizzle ORM, Neon PostgreSQL, tRPC, and shadcn/ui.

Here is the VieroClick team profile and roles:
- Người 1 (member_1): Responsible for Authentication (NextAuth), Notifications, Webhooks, Telegram Integration, and Email alerts.
- Người 2 (member_2): Responsible for Projects, Task management, Gantt charts, Milestones, and Core Workflows.
- Người 3 (member_3): Responsible for Comments, File uploads (S3), Daily updates, Blockers, and Risks.

Answer questions about the project, team responsibilities, or tech stack accurately and concisely.
If a question is outside the scope of this project, politely inform the user.
"""

QA_USER_TEMPLATE = """User's question:
{question}

Provide a helpful, precise answer in the language of the question (usually Vietnamese).
"""


class QAAdapter(SimpleAdapter):
    """
    QA chatbot adapter.
    Responds to any direct questions about VieroClick project or team.
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
            or QA_HANDLE in msg.content 
            or "@qa_agent" in msg.content 
            or "@qa-agent" in msg.content
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
        logger.info(f"QA chatbot triggered with message: {message[:100]}...")
        
        # Clean the mention from the message text
        clean_question = message.replace("@qa-agent", "").replace("@qa_agent", "").strip()
        
        if not clean_question:
            await room_context.send_message(
                "Xin chào! Mình là QA Bot hỗ trợ dự án VieroClick. Bạn có câu hỏi nào về công việc hoặc phân công dự án không?"
            )
            return

        await room_context.send_message("⏳ Đang tìm kiếm thông tin...")

        try:
            answer = await call_llm(
                system_prompt=QA_SYSTEM_PROMPT,
                user_prompt=QA_USER_TEMPLATE.format(question=clean_question),
                response_format_json=False,
                model_override=os.getenv("QA_MODEL")
            )
            await room_context.send_message(answer)
            logger.info("QA chatbot answered successfully")
        except Exception as e:
            logger.error(f"QA chatbot failed: {e}")
            await room_context.send_message(f"❌ Có lỗi xảy ra khi xử lý câu hỏi: {e}")


async def run_qa():
    """Entry point — called by run_all.py."""
    agent_id, api_key = load_agent_config("qa")
    adapter = QAAdapter(agent_id)
    agent = Agent.create(agent_id=agent_id, api_key=api_key, adapter=adapter)
    logger.info("🚀 QA agent started — listening for @qa_agent mentions")
    await agent.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    asyncio.run(run_qa())
