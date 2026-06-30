from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import date

from dotenv import load_dotenv

from shared.llm import call_llm
from shared.message_parser import extract_json_payload
from shared.vieroc_client import VieroClickClient

load_dotenv()
logger = logging.getLogger(__name__)

OBSERVER_SYSTEM_PROMPT = """You are an expert Project Observer Agent.
You receive:
1. Pre-computed plan deviations (task delays, milestone risks, dependency conflicts) — calculated by deterministic code. DO NOT re-flag these.
2. Full project state (tasks, blockers, daily updates, members, comments).

Your job is ONLY the qualitative judgment layer — find things code cannot detect:
- Blockers with vague or unclear descriptions that nobody can act on (suggestion_type: blocker_escalation)
- Tasks growing in scope beyond original acceptance criteria (suggestion_type: plan_deviation)
- Members who have not submitted daily updates in 3+ days (suggestion_type: silent_member)
- Tasks missing acceptance criteria entirely (suggestion_type: clarification_needed)
- Risks that appear to have escalated beyond their listed mitigation (suggestion_type: risk_detected)
- Multiple tasks blocked by the same hidden root cause (suggestion_type: plan_deviation)

Each suggestion MUST include an action_type that tells the system exactly what to do:
- "create_risk"      — observer found a new risk not yet in the risk register
- "escalate_blocker" — a blocker needs immediate lead attention
- "trigger_replan"   — plan deviation is severe enough to warrant a replan
- "notify_lead"      — lead needs to know, but no automated action needed
- "notify_member"    — a specific member needs to be notified

Output format:
{
  "suggestions": [
    {
      "suggestion_type": "risk_detected|blocker_escalation|plan_deviation|clarification_needed|silent_member",
      "action_type": "create_risk|escalate_blocker|trigger_replan|notify_lead|notify_member",
      "title": "Concise title (max 80 chars)",
      "body": "Description and recommendation",
      "payload": {
        "affected_task_ids": ["uuid or empty list"],
        "affected_member_ids": ["uuid or empty list"],
        "blocker_id": "uuid or null",
        "severity": "low|medium|high|urgent"
      }
    }
  ]
}

If no qualitative issues are found beyond the pre-computed deviations, return {"suggestions": []}.
"""

OBSERVER_WITH_DEVIATIONS_TEMPLATE = """Current date: {current_date}

Pre-computed plan deviations (from deterministic code — do NOT re-flag these):
{plan_deviations}

Full project state:
{project_state}

Apply your qualitative judgment. Return only issues not already covered by plan_deviations above.
"""


async def run(project_id: str | None = None, payload: dict | None = None) -> dict:
    """
    Scan project health for qualitative issues code cannot detect.
    Accepts pre-computed plan_deviations in payload to avoid overlapping with deterministic checks.
    """
    vieroc = VieroClickClient()
    project_id = project_id or vieroc.default_project_id
    if not project_id:
        return {"ok": False, "error": "No projectId provided for observer."}

    logger.info("Observer agent: scanning project %s", project_id)

    proj_data = await vieroc.fetch_project_data(project_id)
    if not proj_data:
        return {"ok": False, "error": "Failed to retrieve project state for observer scan."}

    # Accept pre-computed deviations from caller (triggerObserver passes these from detectPlanDeviations)
    # If not provided, pass empty list — LLM still scans for qualitative issues
    plan_deviations = (payload or {}).get("plan_deviations", [])

    user_prompt = OBSERVER_WITH_DEVIATIONS_TEMPLATE.format(
        current_date=date.today().isoformat(),
        plan_deviations=json.dumps(plan_deviations, ensure_ascii=False, default=str),
        project_state=json.dumps(proj_data, ensure_ascii=False, default=str),
    )

    try:
        llm_response = await call_llm(
            system_prompt=OBSERVER_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_format_json=True,
            model_override=os.getenv("OBSERVER_MODEL"),
        )
        result = extract_json_payload(llm_response)
    except Exception as e:
        logger.error("Observer scan failed: %s", e)
        return {"ok": False, "error": f"Observer LLM call failed: {e}"}

    if not result or "suggestions" not in result:
        return {"ok": False, "error": "Failed to parse observer suggestions payload."}

    suggestions = result["suggestions"]
    if not suggestions:
        logger.info("Observer: no qualitative issues found for project %s", project_id)
        return {"ok": True, "projectId": project_id, "savedCount": 0, "note": "No qualitative issues detected."}

    # Post to apply-observer-suggestions route — executes actions immediately instead of just storing
    resp = await vieroc.post_observer_suggestions(
        project_id=project_id,
        suggestions=suggestions,
    )

    saved_count = resp.get("processed", 0) if resp else 0
    logger.info("Observer scan complete: %s suggestions processed for project %s", saved_count, project_id)
    return {
        "ok": True,
        "projectId": project_id,
        "savedCount": saved_count,
        "suggestions": [
            {"title": s.get("title"), "type": s.get("suggestion_type"), "action": s.get("action_type")}
            for s in suggestions
        ],
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    import sys

    pid = sys.argv[1] if len(sys.argv) > 1 else None
    print(json.dumps(asyncio.run(run(pid)), indent=2, ensure_ascii=False, default=str))
