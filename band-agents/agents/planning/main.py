from __future__ import annotations

import asyncio
import json
import logging
import os

from dotenv import load_dotenv

from shared.llm import call_llm
from shared.message_parser import extract_json_payload
from shared.vieroc_client import VieroClickClient

load_dotenv()
logger = logging.getLogger(__name__)

# Planner uses the most capable model; everything else defaults to Flash.
PLANNING_MODEL = os.getenv("PLANNING_MODEL") or "gemini-2.5-pro"

PLANNING_SYSTEM_PROMPT = """You are an expert AI Planning Agent.
Analyze the project intake details, constraints, deliverables, docs, and members to generate a structured project plan.
Return WBS nodes, tasks, milestones, dependencies, risks, assumptions, and acceptance criteria.
Tasks must include a wbsTitle matching one of the WBS phase titles when possible.
Tasks should include ISO date-only startDate and dueDate values when a reasonable timeline can be inferred.
Do not assign tasks to members yet.

Respond ONLY with a structured JSON object in this exact format:
{
  "wbs": [
    { "title": "Requirements", "description": "Requirements phase", "node_type": "phase" }
  ],
  "tasks": [
    {
      "title": "Database Schema Setup",
      "description": "Establish PostgreSQL migration tables.",
      "priority": "high",
      "estimateHours": 8,
      "wbsTitle": "Implementation",
      "startDate": "2026-06-20",
      "dueDate": "2026-06-23",
      "acceptanceCriteria": ["All tables created with correct foreign keys"]
    }
  ],
  "milestones": [
    { "title": "Core Schemas Locked", "description": "Database and models complete", "targetDate": "2026-06-30" }
  ],
  "dependencies": [
    { "blockerTaskTitle": "Database Schema Setup", "blockedTaskTitle": "API Endpoints Implementation" }
  ],
  "risks": [
    { "title": "Database Connection Limit", "description": "Connection pooling threshold reached", "probability": 2, "impact": 4, "mitigation": "Configure pooling" }
  ],
  "assumptions": ["Development environment is ready"],
  "acceptance_criteria": ["All tasks must compile and pass typechecks"]
}
"""

PLANNING_USER_TEMPLATE = """Project state:
{request}

Build a practical implementation plan for this project. Return only structured JSON.
"""


async def run(project_id: str | None = None, payload: dict | None = None) -> dict:
    """
    Generate and apply a project plan. Pure local I/O: takes a projectId,
    returns a structured result dict. No Band room, no @mentions.
    """
    vieroc = VieroClickClient()
    project_id = project_id or vieroc.default_project_id
    if not project_id:
        return {"ok": False, "error": "No projectId provided for planning."}

    logger.info("Planning agent: generating and applying project plan for %s", project_id)

    project_data = await vieroc.fetch_project_data(project_id)
    if not project_data:
        return {"ok": False, "error": "Could not fetch project data from VieroClick."}

    try:
        llm_response = await call_llm(
            system_prompt=PLANNING_SYSTEM_PROMPT,
            user_prompt=PLANNING_USER_TEMPLATE.format(
                request=json.dumps(project_data, ensure_ascii=False, default=str)
            ),
            response_format_json=True,
            model_override=PLANNING_MODEL,
        )
        plan = extract_json_payload(llm_response)
    except Exception as e:
        logger.error("Planning failed: %s", e)
        return {"ok": False, "error": f"Planning LLM call failed: {e}"}

    if not plan:
        return {"ok": False, "error": "LLM response was not valid JSON."}

    resp = await vieroc.apply_plan(project_id, plan)
    if resp and resp.get("ok"):
        logger.info(
            "Planning applied: %s tasks, %s WBS, %s milestones, %s risks",
            resp.get("tasksCreated", 0),
            resp.get("wbsCreated", 0),
            resp.get("milestonesCreated", 0),
            resp.get("risksCreated", 0),
        )
        return {
            "ok": True,
            "projectId": project_id,
            "tasksCreated": resp.get("tasksCreated", 0),
            "wbsCreated": resp.get("wbsCreated", 0),
            "milestonesCreated": resp.get("milestonesCreated", 0),
            "risksCreated": resp.get("risksCreated", 0),
            "plan": plan,
        }

    return {"ok": False, "error": "Generated a roadmap, but applying it to VieroClick failed.", "plan": plan}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    import sys

    pid = sys.argv[1] if len(sys.argv) > 1 else None
    print(json.dumps(asyncio.run(run(pid)), indent=2, ensure_ascii=False, default=str))
