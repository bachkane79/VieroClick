"""
Assignment role — score candidates per unassigned task and apply the assignments.

Load balancing uses allocationPercent as a HARD constraint (2.10a): a member's
capacity is availabilityHoursPerWeek * allocationPercent%. A member whose
committed estimated hours (their active tasks) would exceed capacity if given the
task is ineligible. If every member is over capacity, we fall back to the least
overloaded one so tasks are never left unassigned.

Deterministic fit scoring (skills, availability, seniority, reliability, quality,
remaining-capacity) runs first, then an LLM confirmation pass, then apply.
"""
from __future__ import annotations

import json
import logging
import re

from app.agents.gemini_client import generate
from app.agents.message_parser import extract_json_payload
from app.agents.vieroc_client import VieroClickClient

logger = logging.getLogger(__name__)

# Composite fit weights. Overridable per dispatch via payload["weights"] (4.1).
# Must sum to ~1.0; the five *_score signals are the learned member scores (4.1).
DEFAULT_WEIGHTS = {
    "skill": 0.25,
    "availability": 0.10,
    "seniority": 0.10,
    "reliability": 0.15,
    "quality": 0.10,
    "speed": 0.10,
    "communication": 0.05,
    "blocker": 0.05,
    "load": 0.10,
}


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", (text or "").lower()))

ASSIGNMENT_SYSTEM_PROMPT = """You are an expert Task Assignment Agent.
For each task you are given a ranked list of candidate members (each with skills
and a pre-computed fit score that already respects the member's capacity). Choose
exactly ONE member_id per task, picking only from that task's candidate options.
Prefer the higher-scored candidate unless the leader's extra instructions justify
another choice. If unsure, use the candidate marked as the default.
Return only structured JSON in this exact format:
{
  "assignments": [
    {
      "task_id": "uuid-of-task",
      "task_title": "Task title",
      "member_id": "uuid-of-chosen-member",
      "member_name": "Full name",
      "confidence": 0.85,
      "reason": "Brief reason",
      "risk": "Brief risk"
    }
  ]
}
"""

ASSIGNMENT_USER_TEMPLATE = """{context}Review these tasks and pick the best assignee for each.
Tasks:
{tasks}

Per-task candidate options (choose one member_id per task from its own options):
{candidates}
{instructions}
Confirm the best match, write reasons and risks, and return structured JSON.
"""

DEFAULT_AVAILABILITY = 40.0


def _est_hours(task: dict) -> float:
    """Estimated hours for a task. numeric columns arrive as strings/None over JSON."""
    try:
        return float(task.get("estimateHours") or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _is_active(task: dict) -> bool:
    return not task.get("completedAt")


# Status kinds that mean work has already started (or is closed) — the reassign
# flow must NOT touch these; it only moves future / not-started work.
IN_FLIGHT_STATUS_TYPES = {"in_progress", "in_review", "blocked", "done", "cancelled"}


def _status_type(task: dict) -> str:
    return str(task.get("statusType") or "").lower()


def _is_future(task: dict) -> bool:
    """A future (not-started, not-completed) task, eligible for reassignment.

    Anything explicitly in-progress / in-review / blocked / done / cancelled is
    preserved. `todo` or an unknown/empty status counts as future (backlog)."""
    if task.get("completedAt"):
        return False
    return _status_type(task) not in IN_FLIGHT_STATUS_TYPES


def _capacity_hours(member: dict, alloc_by_member: dict[str, int]) -> float:
    avail = float(member.get("availabilityHoursPerWeek") or DEFAULT_AVAILABILITY)
    alloc = alloc_by_member.get(member.get("id"), 100)
    return max(avail * (alloc / 100.0), 0.0)


def _score_member(task: dict, member: dict, remaining_ratio: float, weights: dict) -> float:
    task_priority = (task.get("priority") or "medium").lower()
    task_tokens = _tokens(task.get("title", "")) | _tokens(task.get("description", ""))

    # Token/word-boundary skill match (a skill matches only when all its tokens
    # appear as whole words in the task) — avoids "java" matching "javascript".
    def _skill_hit(skill: str) -> bool:
        st = _tokens(skill)
        return bool(st) and st.issubset(task_tokens)

    skills = [str(s) for s in (member.get("skills") or [])]
    skill_match = 1.0 if any(_skill_hit(s) for s in skills) else 0.1
    availability = min(float(member.get("availabilityHoursPerWeek") or DEFAULT_AVAILABILITY) / 40.0, 1.0)
    seniority = int(member.get("seniorityLevel") or 1)
    seniority_fit = 1.0 if (task_priority in ["high", "urgent"] and seniority >= 3) else 0.7
    # Learned member scores (0..5 → 0..1). Unset (0) falls back to a neutral 0.6.
    def _score(field: str) -> float:
        raw = float(member.get(field) or 0.0)
        return (raw / 5.0) if raw > 0 else 0.6

    load_balance = max(min(remaining_ratio, 1.0), 0.1)
    return (
        skill_match * weights["skill"]
        + availability * weights["availability"]
        + seniority_fit * weights["seniority"]
        + _score("reliabilityScore") * weights["reliability"]
        + _score("qualityScore") * weights["quality"]
        + _score("speedScore") * weights["speed"]
        + _score("communicationScore") * weights["communication"]
        + _score("blockerHandlingScore") * weights["blocker"]
        + load_balance * weights["load"]
    )


async def run(project_id: str | None = None, payload: dict | None = None) -> dict:
    vieroc = VieroClickClient()
    project_id = project_id or vieroc.default_project_id
    if not project_id:
        return {"ok": False, "error": "No projectId provided for assignment."}

    # Per-project weight overrides (4.1) merged over defaults.
    weights = {**DEFAULT_WEIGHTS, **((payload or {}).get("weights") or {})}
    dispatch_id = (payload or {}).get("dispatch_id")

    # Reassign mode (Team page "Giao việc lại"): only future / not-started tasks
    # are moved; completed and in-progress work is preserved. keep_existing keeps
    # each future task with its current owner (fill only unassigned gaps); when
    # false, all future tasks are rebalanced across the team.
    reassign = (payload or {}).get("mode") == "reassign"
    keep_existing = bool((payload or {}).get("keepExistingAssignments"))
    instructions = str((payload or {}).get("instructions") or "").strip()

    logger.info(
        "Assignment agent: %s for %s",
        "reassigning future tasks" if reassign else "calculating assignments",
        project_id,
    )

    proj_data = await vieroc.fetch_project_data(project_id)
    if not proj_data or "tasks" not in proj_data:
        return {"ok": False, "error": "Could not retrieve project tasks and members."}

    tasks_list = proj_data.get("tasks", [])
    members_list = proj_data.get("members", [])
    project_members = proj_data.get("projectMembers", [])

    # workspaceMemberId -> allocationPercent for this project (default 100%).
    alloc_by_member: dict[str, int] = {}
    for pm in project_members:
        wm_id = pm.get("workspaceMemberId")
        if wm_id is not None:
            alloc_by_member[wm_id] = int(pm.get("allocationPercent") or 100)

    # Candidate tasks to (re)assign.
    if reassign:
        future_tasks = [t for t in tasks_list if _is_future(t)]
        if keep_existing:
            # Only fill gaps — future tasks nobody owns yet.
            candidate_tasks = [t for t in future_tasks if not t.get("assigneeMemberId")]
        else:
            # Rebalance every future task across the team.
            candidate_tasks = future_tasks
    else:
        candidate_tasks = [t for t in tasks_list if not t.get("assigneeMemberId")]

    if not candidate_tasks:
        note = "No future tasks to reassign." if reassign else "All tasks are already assigned."
        return {"ok": True, "projectId": project_id, "assignmentsApplied": 0, "note": note}

    candidate_ids = {t.get("id") for t in candidate_tasks}

    # Running committed hours per member from their existing active tasks. Tasks
    # about to be (re)assigned are excluded so the load baseline reflects only work
    # that stays put (in-progress tasks; and, in keep_existing mode, future tasks
    # left with their current owner). Multi-assignee: a task's estimate is split
    # evenly across its assignees (falling back to the primary assigneeMemberId).
    committed: dict[str, float] = {}
    for t in tasks_list:
        if not _is_active(t) or t.get("id") in candidate_ids:
            continue
        assignees = t.get("assignees") or ([t["assigneeMemberId"]] if t.get("assigneeMemberId") else [])
        if not assignees:
            continue
        share = _est_hours(t) / len(assignees)
        for aid in assignees:
            committed[aid] = committed.get(aid, 0.0) + share

    capacity = {m.get("id"): _capacity_hours(m, alloc_by_member) for m in members_list}

    calculated_assignments = []
    overflow_count = 0
    for task in candidate_tasks:
        est = _est_hours(task)

        # Hard constraint: a member fits only if this task keeps them within capacity.
        eligible = [
            m
            for m in members_list
            if committed.get(m.get("id"), 0.0) + est <= capacity.get(m.get("id"), 0.0)
        ]
        used_fallback = False
        if not eligible:
            # Everyone is over capacity — fall back to the least-overloaded member.
            used_fallback = True
            overflow_count += 1
            eligible = members_list

        # Rank eligible members and keep the top few as options for the LLM (so it
        # can honour the leader's free-text instructions), reserving capacity for
        # the deterministic best pick.
        ranked = []
        for member in eligible:
            cap = capacity.get(member.get("id"), 0.0) or 1.0
            remaining_ratio = max((cap - committed.get(member.get("id"), 0.0)) / cap, 0.0)
            ranked.append((_score_member(task, member, remaining_ratio, weights), member))
        ranked.sort(key=lambda pair: pair[0], reverse=True)
        top = ranked[:3]
        if not top:
            continue

        best_member = top[0][1]
        mid = best_member.get("id")
        committed[mid] = committed.get(mid, 0.0) + est  # reserve capacity for next tasks
        calculated_assignments.append(
            {
                "task": task,
                "recommended_member": best_member,
                "score": round(top[0][0], 2),
                "over_capacity": used_fallback,
                "options": [
                    {
                        "member_id": m.get("id"),
                        "member_name": m.get("fullName"),
                        "skills": [str(s) for s in (m.get("skills") or [])][:8],
                        "score": round(sc, 2),
                    }
                    for sc, m in top
                ],
            }
        )

    if not calculated_assignments:
        return {"ok": True, "projectId": project_id, "assignmentsApplied": 0, "note": "No eligible members to assign."}

    context_note = ""
    if reassign:
        context_note = (
            "This is a REASSIGNMENT of future (not-started) tasks only; completed and "
            "in-progress work is left untouched. "
            + (
                "Keep each task with its current owner unless a clearly better fit exists. "
                if keep_existing
                else "You may rebalance these future tasks freely across the team. "
            )
        )
    instructions_block = (
        f"\nLeader's extra instructions (follow these closely):\n{instructions}\n"
        if instructions
        else ""
    )
    try:
        llm_response = await generate(
            ASSIGNMENT_SYSTEM_PROMPT,
            ASSIGNMENT_USER_TEMPLATE.format(
                context=(context_note + "\n\n") if context_note else "",
                tasks=json.dumps(
                    [
                        {
                            "id": x["task"]["id"],
                            "title": x["task"].get("title"),
                            "priority": x["task"].get("priority"),
                        }
                        for x in calculated_assignments
                    ],
                    ensure_ascii=False,
                ),
                candidates=json.dumps(
                    [
                        {
                            "task_id": x["task"]["id"],
                            "default_member_id": x["recommended_member"]["id"],
                            "over_capacity": x["over_capacity"],
                            "options": x["options"],
                        }
                        for x in calculated_assignments
                    ],
                    ensure_ascii=False,
                ),
                instructions=instructions_block,
            ),
            as_json=True,
        )
        result = extract_json_payload(llm_response)
    except Exception as e:
        logger.error("Assignment generation failed: %s", e)
        return {"ok": False, "error": f"Assignment LLM call failed: {e}"}

    if not result or "assignments" not in result:
        return {"ok": False, "error": "LLM response was not valid JSON."}

    resp = await vieroc.apply_assignments(project_id, result, dispatch_id=dispatch_id)
    if resp and resp.get("ok"):
        applied = resp.get("assignmentsApplied", 0)
        pending = resp.get("pendingCount", 0)
        logger.info(
            "Assignment applied: %s applied, %s pending review (%s over-capacity fallbacks)",
            applied, pending, overflow_count,
        )
        return {
            "ok": True,
            "projectId": project_id,
            "assignmentsApplied": applied,
            "pendingCount": pending,
            "overCapacityFallbacks": overflow_count,
            "warnings": resp.get("warnings", []),
            "assignments": result["assignments"],
        }

    error = (resp or {}).get("error") or "Recommendations generated, but applying them failed."
    return {
        "ok": False,
        "error": error,
        "status": (resp or {}).get("status"),
        "assignments": result["assignments"],
    }
