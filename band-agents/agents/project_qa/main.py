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

QA_SYSTEM_PROMPT = """You are an expert Project Q&A and Hole Detection Agent.
Your job is to answer user queries using the provided project state (docs, decisions, tasks, comments, updates).

If the information needed to answer the question is missing from the project context, you must identify this as a "project hole" and log it.

Output a structured JSON response in this exact format:
{
  "answer": "Your detailed answer answering the user's question, if information is available.",
  "hole_detected": true|false,
  "hole_details": {
    "hole_type": "missing_acceptance_criteria|missing_requirements|missing_decision|unclear_scope",
    "question": "The question asked that could not be answered",
    "affected_task_id": "uuid-of-task-or-null",
    "recommended_leader_action": "What the project lead should do to resolve this hole (e.g., Clarify expected output before member continues)"
  }
}
"""

QA_USER_TEMPLATE = """User Question: {question}
Project State:
{project_state}

Return the structured JSON Q&A response.
"""


class QAAdapter(SimpleAdapter):
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

        is_mentioned = f"[[{self.agent_id}]]" in msg.content or "@project_qa" in msg.content
        if not is_mentioned:
            await tools.send_event(content="Not addressed to project_qa agent — skipping", message_type="thought")
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
        logger.info(f"Q&A agent received query: {message[:100]}...")
        await room_context.send_message("⏳ Q&A Agent: Searching project docs, decisions, and tasks...")

        # 1. Fetch project data from VieroClick
        proj_data = await self.vieroc.fetch_project_data()
        if not proj_data:
            await room_context.send_message("❌ Failed to retrieve project state for lookup.")
            return

        # Clean user mention from question
        question_clean = message.replace(f"[[{self.agent_id}]]", "").replace("@project_qa", "").strip()

        # 2. LLM resolution
        try:
            llm_response = await call_llm(
                system_prompt=QA_SYSTEM_PROMPT,
                user_prompt=QA_USER_TEMPLATE.format(
                    question=question_clean,
                    project_state=json.dumps(proj_data, default=str)
                ),
                response_format_json=True,
                model_override=os.getenv("PROJECT_QA_MODEL")
            )
            result = extract_json_payload(llm_response)
        except Exception as e:
            logger.error(f"Q&A lookup failed: {e}")
            await room_context.send_message(f"❌ Q&A lookup failed: {e}")
            return

        if not result or "answer" not in result:
            await room_context.send_message("❌ Failed to resolve answer from LLM.")
            return

        answer_text = result.get("answer", "")
        await room_context.send_message(f"💬 **Q&A Answer:**\n{answer_text}")

        # 3. Handle Hole Detection
        if result.get("hole_detected", False):
            hole = result.get("hole_details", {})
            hole_type = hole.get("hole_type", "unclear_scope")
            logger.info(f"Hole detected: {hole_type}")

            # Persist suggestion as "project_hole"
            title = f"Project Hole Detected: {hole_type.replace('_', ' ').title()}"
            body = (
                f"The AI Q&A Agent detected missing project parameters while answering a query:\n"
                f"- **Query**: \"{hole.get('question')}\"\n"
                f"- **Action**: {hole.get('recommended_leader_action')}"
            )

            resp = await self.vieroc.create_suggestion(
                suggestion_type="project_hole",
                title=title,
                body=body,
                payload=hole
            )

            if resp and "id" in resp:
                await room_context.send_message(
                    f"⚠️ **Project Hole Logged!**\n"
                    f"Created a suggestion alert in VieroClick to resolve this missing information:\n"
                    f"- *Action Required*: {hole.get('recommended_leader_action')}"
                )


async def run_project_qa():
    agent_id, api_key = load_agent_config("project_qa")
    adapter = QAAdapter(agent_id)
    agent = Agent.create(agent_id=agent_id, api_key=api_key, adapter=adapter)
    logger.info("🚀 Q&A agent started — listening for @project_qa mentions")
    await agent.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    asyncio.run(run_project_qa())
