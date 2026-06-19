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

ASSIGNMENT_SYSTEM_PROMPT = """You are an expert Task Assignment Agent.
Given a list of tasks, candidates, and their pre-computed assignment scores, review the recommendations.
Provide a clear, brief reason and risk assessment for each recommendation.

Your output must be a structured JSON object in this exact format:
{
  "assignments": [
    {
      "task_id": "uuid-of-task",
      "task_title": "Task title",
      "member_id": "uuid-of-recommended-member",
      "member_name": "Full name of recommended member",
      "confidence": 0.85,
      "reason": "Explain reasoning briefly (e.g. strong skill match and low current workload)",
      "risk": "Explain risk briefly (e.g. potential blocker handling delay)"
    }
  ]
}
"""

ASSIGNMENT_USER_TEMPLATE = """Review these calculated task assignments:
Tasks:
{tasks}

Candidates with pre-calculated fit scores:
{candidates}

Analyze the options, confirm the best match, write the reasons and risks, and return the structured JSON.
"""


class AssignmentAdapter(SimpleAdapter):
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

        is_mentioned = f"[[{self.agent_id}]]" in msg.content or "@assignment" in msg.content
        if not is_mentioned:
            await tools.send_event(content="Not addressed to assignment agent — skipping", message_type="thought")
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
        logger.info("Assignment agent received request.")
        await room_context.send_message("⏳ Assignment Agent: Fetching project metrics and calculating rule-based assignments...")

        # 1. Fetch project data from VieroClick
        proj_data = await self.vieroc.fetch_project_data()
        if not proj_data or "tasks" not in proj_data:
            await room_context.send_message("❌ Failed to retrieve project tasks and members for allocation.")
            return

        tasks_list = proj_data.get("tasks", [])
        members_list = proj_data.get("members", [])

        # Filter unassigned tasks
        unassigned_tasks = [t for t in tasks_list if not t.get("assigneeMemberId")]
        if not unassigned_tasks:
            await room_context.send_message("✅ All tasks are currently assigned. No recommendation needed!")
            return

        # 2. Rule-Based Scoring Logic
        calculated_assignments = []
        for task in unassigned_tasks:
            best_member = None
            best_score = -1.0
            task_title = task.get("title", "").lower()
            task_desc = task.get("description", "").lower()
            task_priority = task.get("priority", "medium").lower()

            for m in members_list:
                # Skill Match (0.30)
                skills = [s.lower() for s in m.get("skills") or []]
                skill_match = 0.1
                for s in skills:
                    if s in task_title or s in task_desc:
                        skill_match = 1.0
                        break

                # Availability (0.20)
                avail_hours = float(m.get("availabilityHoursPerWeek") or 40.0)
                availability = min(avail_hours / 40.0, 1.0)

                # Seniority Fit (0.15)
                seniority = int(m.get("seniorityLevel") or 1)
                if task_priority in ["high", "urgent"]:
                    seniority_fit = 1.0 if seniority >= 3 else (0.5 if seniority == 2 else 0.2)
                else:
                    seniority_fit = 1.0 if seniority <= 2 else 0.7

                # Reliability (0.15)
                reliability = float(m.get("reliabilityScore") or 4.0) / 5.0

                # Quality (0.10)
                quality = float(m.get("qualityScore") or 4.0) / 5.0

                # Risk Balance (Load) (0.10)
                active_assigned_count = sum(1 for t in tasks_list if t.get("assigneeMemberId") == m.get("id") and not t.get("completedAt"))
                risk_balance = max(1.0 - (active_assigned_count / 10.0), 0.1)

                # Final weighted score
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
                    best_member = m

            if best_member:
                calculated_assignments.append({
                    "task": task,
                    "recommended_member": best_member,
                    "score": round(best_score, 2)
                })

        # 3. LLM Refinement & Reasoning
        try:
            llm_response = await call_llm(
                system_prompt=ASSIGNMENT_SYSTEM_PROMPT,
                user_prompt=ASSIGNMENT_USER_TEMPLATE.format(
                    tasks=json.dumps([{"id": x["task"]["id"], "title": x["task"]["title"]} for x in calculated_assignments]),
                    candidates=json.dumps([{
                        "task_id": x["task"]["id"],
                        "member_id": x["recommended_member"]["id"],
                        "member_name": x["recommended_member"]["fullName"],
                        "score": x["score"]
                    } for x in calculated_assignments])
                ),
                response_format_json=True,
                model_override=os.getenv("DEVELOPER_MODEL")
            )
            result = extract_json_payload(llm_response)
        except Exception as e:
            logger.error(f"Assignment generation failed: {e}")
            await room_context.send_message(f"❌ Assignment recommendation generation failed: {e}")
            return

        if not result or "assignments" not in result:
            await room_context.send_message("❌ Failed to parse recommendation payload.")
            return

        # Store suggestion in VieroClick
        suggestion_body = "AI-calculated task allocation recommendations matching team workload capacity, skills matrix, and seniority levels."
        
        # Build text description
        lines = ["**Task Allocation Recommendations:**"]
        for asm in result["assignments"]:
            lines.append(f"- **{asm.get('task_title')}** -> **{asm.get('member_name')}** (Match score: {asm.get('confidence')})")
            lines.append(f"  *Reason*: {asm.get('reason')}")
            lines.append(f"  *Risk*: {asm.get('risk')}")

        resp = await self.vieroc.create_suggestion(
            suggestion_type="assignment_suggestion",
            title="AI Task Allocation Recommendations",
            body="\n".join(lines),
            payload=result
        )

        if resp and "id" in resp:
            await room_context.send_message(
                f"✅ **Task allocation recommendations generated!**\n\n"
                + "\n".join(lines)
                + "\n\n👉 **Leader action required**: Click **'Review Assignments'** in the VieroClick UI to approve and apply."
            )
        else:
            await room_context.send_message("❌ Recommendations generated, but failed to save in VieroClick database.")


async def run_assignment():
    agent_id, api_key = load_agent_config("assignment")
    adapter = AssignmentAdapter(agent_id)
    agent = Agent.create(agent_id=agent_id, api_key=api_key, adapter=adapter)
    logger.info("🚀 Assignment agent started — listening for @assignment mentions")
    await agent.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    asyncio.run(run_assignment())
