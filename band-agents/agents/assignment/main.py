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


async def run(project_id: str | None = None, payload: dict | None = None) -> dict:
    """Calculate and apply task assignments for a project. Pure local I/O."""
    vieroc = VieroClickClient()
    project_id = project_id or vieroc.default_project_id
    if not project_id:
        return {"ok": False, "error": "No projectId provided for assignment."}

    logger.info("Assignment agent: calculating assignments for %s", project_id)

    proj_data = await vieroc.fetch_project_data(project_id)
    if not proj_data or "tasks" not in proj_data:
        return {"ok": False, "error": "Could not retrieve project tasks and members."}

    tasks_list = proj_data.get("tasks", [])
    members_list = proj_data.get("members", [])
    unassigned_tasks = [t for t in tasks_list if not t.get("assigneeMemberId")]
    if not unassigned_tasks:
        return {"ok": True, "projectId": project_id, "assignmentsApplied": 0, "note": "All tasks are already assigned."}

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
        return {"ok": False, "error": f"Assignment LLM call failed: {e}"}

    if not result or "assignments" not in result:
        return {"ok": False, "error": "LLM response was not valid JSON."}

    resp = await vieroc.apply_assignments(project_id, result)
    if resp and resp.get("ok"):
        applied = resp.get("assignmentsApplied", 0)
        logger.info("Assignment applied: %s assignments", applied)
        return {"ok": True, "projectId": project_id, "assignmentsApplied": applied, "assignments": result["assignments"]}

    return {"ok": False, "error": "Recommendations generated, but applying them failed.", "assignments": result["assignments"]}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    import sys

    pid = sys.argv[1] if len(sys.argv) > 1 else None
    print(json.dumps(asyncio.run(run(pid)), indent=2, ensure_ascii=False, default=str))
