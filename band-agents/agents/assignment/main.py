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

ASSIGNMENT_SYSTEM_PROMPT = """You are an expert Task Assignment Agent.
Given a list of tasks, candidates, and pre-computed assignment scores, select the best assignee for each task.
Return only structured JSON in this exact format:
{
  "assignments": [
    {
      "task_id": "uuid-of-task",
      "task_title": "Task title",
      "member_id": "uuid-of-recommended-member",
      "member_name": "Full name",
      "confidence": 0.85,
      "reason": "Brief reason",
      "risk": "Brief risk"
    }
  ]
}
"""

ASSIGNMENT_USER_TEMPLATE = """Review these calculated task assignments:
Tasks:
{tasks}

Candidates with pre-calculated fit scores:
{candidates}

Confirm the best match, write reasons and risks, and return structured JSON.
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


class AssignmentAdapter(SimpleAdapter):
    def __init__(self, agent_id: str):
        super().__init__()
        self.agent_id = agent_id
        self.vieroc = VieroClickClient()
        self.handle = os.getenv("ASSIGNMENT_HANDLE", "@assignment")

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
            or "@assignment" in msg.content
            or self.handle in msg.content
        )
        if not is_mentioned:
            await tools.send_event(content="Not addressed to assignment agent - skipping", message_type="thought")
            return

        dispatch = extract_json_payload(msg.content) or {}
        if not (dispatch.get("projectId") or self.vieroc.default_project_id):
            await tools.send_event(content="No projectId in assignment request - skipping", message_type="thought")
            return

        await self.handle_message(msg.content, RoomContextWrapper(tools, msg))

    async def handle_message(self, message: str, room_context):
        logger.info("Assignment agent received request.")
        dispatch = extract_json_payload(message) or {}
        project_id = dispatch.get("projectId") or self.vieroc.default_project_id
        if not project_id:
            return

        await room_context.send_message("Assignment Agent: calculating and applying task assignments...")

        proj_data = await self.vieroc.fetch_project_data(project_id)
        if not proj_data or "tasks" not in proj_data:
            await room_context.send_message("Assignment failed: could not retrieve project tasks and members.")
            return

        tasks_list = proj_data.get("tasks", [])
        members_list = proj_data.get("members", [])
        unassigned_tasks = [t for t in tasks_list if not t.get("assigneeMemberId")]
        if not unassigned_tasks:
            await room_context.send_message("All tasks are already assigned.")
            return

        calculated_assignments = []
        for task in unassigned_tasks:
            best_member = None
            best_score = -1.0
            task_title = (task.get("title") or "").lower()
            task_desc = (task.get("description") or "").lower()
            task_priority = (task.get("priority") or "medium").lower()

            for member in members_list:
                skills = [str(s).lower() for s in (member.get("skills") or [])]
                skill_match = 1.0 if any(s in task_title or s in task_desc for s in skills) else 0.1
                availability = min(float(member.get("availabilityHoursPerWeek") or 40.0) / 40.0, 1.0)
                seniority = int(member.get("seniorityLevel") or 1)
                seniority_fit = 1.0 if (task_priority in ["high", "urgent"] and seniority >= 3) else 0.7
                reliability = float(member.get("reliabilityScore") or 4.0) / 5.0
                quality = float(member.get("qualityScore") or 4.0) / 5.0
                active_count = sum(
                    1
                    for t in tasks_list
                    if t.get("assigneeMemberId") == member.get("id") and not t.get("completedAt")
                )
                risk_balance = max(1.0 - (active_count / 10.0), 0.1)
                score = (
                    skill_match * 0.30
                    + availability * 0.20
                    + seniority_fit * 0.15
                    + reliability * 0.15
                    + quality * 0.10
                    + risk_balance * 0.10
                )
                if score > best_score:
                    best_score = score
                    best_member = member

            if best_member:
                calculated_assignments.append(
                    {
                        "task": task,
                        "recommended_member": best_member,
                        "score": round(best_score, 2),
                    }
                )

        try:
            llm_response = await call_llm(
                system_prompt=ASSIGNMENT_SYSTEM_PROMPT,
                user_prompt=ASSIGNMENT_USER_TEMPLATE.format(
                    tasks=json.dumps(
                        [{"id": x["task"]["id"], "title": x["task"]["title"]} for x in calculated_assignments],
                        ensure_ascii=False,
                    ),
                    candidates=json.dumps(
                        [
                            {
                                "task_id": x["task"]["id"],
                                "member_id": x["recommended_member"]["id"],
                                "member_name": x["recommended_member"]["fullName"],
                                "score": x["score"],
                            }
                            for x in calculated_assignments
                        ],
                        ensure_ascii=False,
                    ),
                ),
                response_format_json=True,
                model_override=os.getenv("ASSIGNMENT_MODEL"),
            )
            result = extract_json_payload(llm_response)
        except Exception as e:
            logger.error("Assignment generation failed: %s", e)
            await room_context.send_message(f"Assignment generation failed: {e}")
            return

        if not result or "assignments" not in result:
            await room_context.send_message("Assignment failed: LLM response was not valid JSON.")
            return

        resp = await self.vieroc.apply_assignments(project_id, result)
        if resp and resp.get("ok"):
            await room_context.send_message(
                "**Task allocation applied to VieroClick!**\n\n"
                f"Applied assignments: {resp.get('assignmentsApplied', 0)}"
            )
        else:
            await room_context.send_message("Assignment recommendations generated, but applying them failed.")


async def run_assignment():
    agent_id, api_key = load_agent_config("assignment")
    adapter = AssignmentAdapter(agent_id)
    agent = Agent.create(agent_id=agent_id, api_key=api_key, adapter=adapter)
    logger.info("Assignment agent started - listening for assignment mentions")
    await agent.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    asyncio.run(run_assignment())
