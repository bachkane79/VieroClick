"""
Planning role — generate and apply a project plan.

Two modes:
- initial (default): generate a full plan from scratch.
- replan: load current plan state and produce a MINIMAL change set.

Self-fetching agent: reads project state and applies the plan through the web API
(never touches the DB directly).
"""
from __future__ import annotations

import json
import logging

from app.agents.gemini_client import generate
from app.agents.message_parser import extract_json_payload
from app.agents.vieroc_client import VieroClickClient
from app.settings import settings

logger = logging.getLogger(__name__)

PLANNING_SYSTEM_PROMPT = """You are an expert AI Planning Agent.
Analyze the project intake details, constraints, deliverables, docs, and members to generate a structured project plan.
Return WBS nodes, tasks, milestones, dependencies, risks, assumptions, and acceptance criteria.
Tasks must include a wbsTitle matching one of the WBS phase titles when possible.
Tasks should include ISO date-only startDate and dueDate values when a reasonable timeline can be inferred.
Do not assign tasks to members yet.

Each element MUST include a "planRef" field: a lowercase kebab-case slug prefixed by entity type
(task:, wbs:, milestone:, risk:). Max 64 characters. Must be deterministic —
the same conceptual element should produce the same planRef across multiple planning runs.

Respond ONLY with a structured JSON object in this exact format:
{
  "wbs": [
    { "planRef": "wbs:requirements", "title": "Requirements", "description": "Requirements phase", "node_type": "phase" }
  ],
  "tasks": [
    {
      "planRef": "task:database-schema-setup",
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
    { "planRef": "milestone:core-schemas-locked", "title": "Core Schemas Locked", "description": "Database and models complete", "targetDate": "2026-06-30" }
  ],
  "dependencies": [
    { "blockerTaskTitle": "Database Schema Setup", "blockedTaskTitle": "API Endpoints Implementation" }
  ],
  "risks": [
    { "planRef": "risk:connection-limit", "title": "Database Connection Limit", "description": "Connection pooling threshold reached", "probability": 2, "impact": 4, "mitigation": "Configure pooling" }
  ],
  "assumptions": ["Development environment is ready"],
  "acceptance_criteria": ["All tasks must compile and pass typechecks"]
}
"""

REPLAN_SYSTEM_PROMPT = """You are an expert AI Replanning Agent.
Your job is to produce the MINIMAL change set needed to bring the project plan in line with the change reason provided.

Rules:
1. Each element MUST include an "action" field: "add" | "update" | "keep".
2. Each element MUST include a "planRef" field. For existing elements, use the EXACT planRef from the current plan.
   For new elements, generate a new lowercase kebab-case slug (task:, wbs:, milestone:, risk:). Max 64 chars.
3. NEVER assign action "delete" to any element.
4. Any task with status other than "todo" MUST have action "keep" — do NOT modify tasks that are
   in_progress, in_review, blocked, done, or cancelled.
5. Elements with action "keep" must still include their planRef so the system can detect orphans.
6. Include a "reason" field on each changed element explaining why it changed.
7. Return only elements you are adding or changing, plus keep entries for existing unchanged elements.

Output format: same JSON schema as initial planner but every element has "action" and "reason" fields.
{
  "wbs": [
    { "planRef": "wbs:requirements", "action": "keep", "title": "Requirements", "node_type": "phase", "reason": "No change" }
  ],
  "tasks": [
    {
      "planRef": "task:database-schema-setup",
      "action": "update",
      "title": "Database Schema Setup",
      "dueDate": "2026-07-10",
      "reason": "Deadline extended due to replan"
    }
  ],
  "milestones": [...],
  "dependencies": [...],
  "risks": [...]
}
"""

PLANNING_USER_TEMPLATE = """Project state:
{request}

Build a practical implementation plan for this project. Return only structured JSON.
"""

REPLAN_USER_TEMPLATE = """Current project state (tasks with their current statuses and assignees, milestones, risks):
{current_plan_state}

Reason for replan:
{reason}

Return the minimal change set as structured JSON. Every element must have "action" and "planRef" fields.
"""


async def run(project_id: str | None = None, payload: dict | None = None) -> dict:
    mode = (payload or {}).get("mode", "initial")
    reason = (payload or {}).get("reason", "")

    vieroc = VieroClickClient()
    project_id = project_id or vieroc.default_project_id
    if not project_id:
        return {"ok": False, "error": "No projectId provided for planning."}

    logger.info("Planning agent: mode=%s project=%s", mode, project_id)

    project_data = await vieroc.fetch_project_data(project_id)
    if not project_data:
        return {"ok": False, "error": "Could not fetch project data from VieroClick."}

    if mode == "replan":
        system_prompt = REPLAN_SYSTEM_PROMPT
        user_prompt = REPLAN_USER_TEMPLATE.format(
            current_plan_state=json.dumps(project_data, ensure_ascii=False, default=str),
            reason=reason or "General replan requested.",
        )
    else:
        system_prompt = PLANNING_SYSTEM_PROMPT
        user_prompt = PLANNING_USER_TEMPLATE.format(
            request=json.dumps(project_data, ensure_ascii=False, default=str),
        )

    try:
        llm_response = await generate(
            system_prompt,
            user_prompt,
            model=settings.gemini_planner_model,
            as_json=True,
        )
        plan = extract_json_payload(llm_response)
    except Exception as e:
        logger.error("Planning failed: %s", e)
        return {"ok": False, "error": f"Planning LLM call failed: {e}"}

    if not plan:
        return {"ok": False, "error": "LLM response was not valid JSON."}

    resp = await vieroc.apply_plan(project_id, plan, mode=mode)
    if resp and resp.get("ok"):
        summary = resp.get("summary", {
            "created": resp.get("tasksCreated", 0),
            "updated": 0,
            "skipped": 0,
            "flagged": 0,
        })
        logger.info("Planning applied (mode=%s): %s", mode, summary)
        return {"ok": True, "projectId": project_id, "mode": mode, "summary": summary, "plan": plan}

    return {"ok": False, "error": "Generated a roadmap, but applying it to VieroClick failed.", "plan": plan}
