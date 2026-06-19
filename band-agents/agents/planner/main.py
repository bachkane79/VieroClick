"""
agents/planner/main.py
Planner Agent — Band entry point.

Listens for @planner mentions in the Band room.
When triggered, generates a structured task plan with tasks, milestones (timeline), and risks.
Posts the plan to the room and pauses for human approval (HITL Gate #1).
"""
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
from shared.message_parser import extract_json_payload, is_human_approval, is_human_rejection, format_agent_message
from shared.hitl import make_hitl_prompt, make_hitl_approved_message, make_hitl_rejected_message

load_dotenv()
logger = logging.getLogger(__name__)

DEVELOPER_HANDLE = os.getenv("DEVELOPER_HANDLE", "@developer")
NOTIFIER_HANDLE = os.getenv("NOTIFIER_HANDLE", "@notifier")

PLANNER_SYSTEM_PROMPT = """You are an expert project manager AI assistant.
Given a project's context, goals, and current state, you generate:
1. A prioritized task breakdown with estimates
2. Milestone suggestions (timeline)
3. Risk flags

Always respond as structured JSON in this exact format:
{
  "project_title": "Project name/title",
  "project_abstract": "Brief project description",
  "priority": "HIGH|MEDIUM|LOW",
  "estimated_days": 5.0,
  "tasks": [
    {
      "title": "Task Title",
      "description": "Detailed task description",
      "estimated_hours": 8.0,
      "category": "auth|task_system|collaboration"
    }
  ],
  "timeline": [
    {
      "milestone_title": "Milestone Title",
      "description": "What this milestone delivers",
      "target_day": 3
    }
  ],
  "risks": [
    {
      "title": "Risk Title",
      "severity": "HIGH|MEDIUM|LOW",
      "description": "Why this is a risk"
    }
  ]
}
"""

PLANNER_USER_TEMPLATE = """Project context and abstract:
{request}

Analyze the project request above, break it down into tasks, milestones, and risks, and return the structured JSON.
"""


class PlannerAdapter(SimpleAdapter):
    """
    Planner adapter.
    1. Runs LLM planning via call_llm
    2. Formats and posts the output to the room
    3. Posts a HITL prompt for human review
    """

    def __init__(self, agent_id: str):
        super().__init__()
        self.agent_id = agent_id
        self._awaiting_hitl = False
        self._last_plan = None
        
        # Load all pipeline agent IDs to ignore their messages
        self.agent_ids = set()
        for name in ["planner", "reviewer", "qa", "notifier", "developer"]:
            try:
                aid, _ = load_agent_config(name)
                self.agent_ids.add(aid)
            except Exception as e:
                logger.warning(f"Could not load agent ID for {name}: {e}")

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
        if msg.sender_id in self.agent_ids:
            return

        is_mentioned = f"[[{self.agent_id}]]" in msg.content or "@planner" in msg.content
        if not is_mentioned and not self._awaiting_hitl:
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
        """Called by Band SDK when this agent receives a message."""
        
        # --- HITL Response Handling ---
        if self._awaiting_hitl:
            if is_human_approval(message):
                self._awaiting_hitl = False
                # Re-post the plan with approval context to the next agent (Notifier)
                ctx_message = format_agent_message(
                    header=f"✅ Approved: {self._last_plan.get('project_title', 'Project')}",
                    body=make_hitl_approved_message("after_planner", NOTIFIER_HANDLE),
                    payload=self._last_plan,
                    next_mention=NOTIFIER_HANDLE
                )
                await room_context.send_message(ctx_message)
                logger.info("Human approved plan — @notifier (Notifier) notified")
            elif is_human_rejection(message):
                self._awaiting_hitl = False
                await room_context.send_message(
                    make_hitl_rejected_message("after_planner")
                )
                logger.info("Human rejected plan — pipeline halted")
            else:
                await room_context.send_message(
                    "❓ I didn't understand that. Please type **approve** to proceed or **cancel** to stop."
                )
            return

        # --- New Task Request ---
        logger.info(f"Planner received new request: {message[:100]}...")
        await room_context.send_message("⏳ Analyzing project abstract and generating plan...")
        
        try:
            llm_response = await call_llm(
                system_prompt=PLANNER_SYSTEM_PROMPT,
                user_prompt=PLANNER_USER_TEMPLATE.format(request=message),
                response_format_json=True,
                model_override=os.getenv("PLANNER_MODEL")
            )
            plan = extract_json_payload(llm_response)
        except Exception as e:
            logger.error(f"Planning failed: {e}")
            await room_context.send_message(f"❌ Planning failed: {e}")
            return

        if not plan:
            await room_context.send_message(
                "❌ Could not generate a plan. Raw response was not valid JSON."
            )
            return

        self._last_plan = plan

        # Format and post the plan
        plan_body = self._format_plan_summary(plan)
        plan_message = format_agent_message(
            header=f"📋 Plan ready: {plan.get('project_title', 'New Project')}",
            body=plan_body,
            payload=plan,
        )
        await room_context.send_message(plan_message)

        # Post HITL gate
        hitl_message = make_hitl_prompt(
            stage="after_planner",
            summary=f"I've created a plan with {len(plan.get('tasks', []))} tasks and {len(plan.get('timeline', []))} milestones.",
            approve_instruction=f"Type **approve** (I will then notify {NOTIFIER_HANDLE} to create tasks)",
            reject_instruction="Type **cancel** to halt the pipeline",
            next_agent_handle=NOTIFIER_HANDLE,
        )
        await room_context.send_message(hitl_message)
        self._awaiting_hitl = True
        logger.info("Plan posted — awaiting human approval (HITL Gate #1)")

    def _format_plan_summary(self, plan: dict) -> str:
        """Format the plan as readable markdown."""
        lines = [
            f"**Project Title**: {plan.get('project_title', 'N/A')}",
            f"**Abstract**: {plan.get('project_abstract', 'N/A')}",
            f"**Priority**: {plan.get('priority', 'MEDIUM')}",
            f"**Estimated Duration**: {plan.get('estimated_days', '?')} day(s)",
            "",
            "**Tasks:**",
        ]
        for i, task in enumerate(plan.get("tasks", []), 1):
            lines.append(f"{i}. **{task.get('title')}** (~{task.get('estimated_hours', '?')}h)")
            lines.append(f"   *Description*: {task.get('description')}")
            lines.append(f"   *Category*: `{task.get('category', 'general')}`")

        lines += ["", "**Timeline / Milestones:**"]
        for ml in plan.get("timeline", []):
            lines.append(f"- Milestone: **{ml.get('milestone_title')}** (Target: Day {ml.get('target_day')})")
            lines.append(f"  *Deliverable*: {ml.get('description')}")

        if plan.get("risks"):
            lines += ["", "**Risks identified:**"]
            for r in plan.get("risks", []):
                lines.append(f"- ⚠️ **{r.get('title')}** [{r.get('severity', 'LOW')}]")
                lines.append(f"  *Note*: {r.get('description')}")

        return "\n".join(lines)


async def run_planner():
    """Entry point — called by run_all.py."""
    agent_id, api_key = load_agent_config("planner")
    adapter = PlannerAdapter(agent_id)
    agent = Agent.create(agent_id=agent_id, api_key=api_key, adapter=adapter)
    logger.info("🚀 Planner agent started — listening for @planner mentions")
    await agent.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    asyncio.run(run_planner())
