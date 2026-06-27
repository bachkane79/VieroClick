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
Your job is to scan the project data (tasks, blockers, daily updates, milestones, risks) and identify anomalies, risks, plan deviations, or issues that need attention.

Look specifically for:
- Silent members: members with no recent updates.
- Overdue tasks: due date passed but not completed.
- Unclear blockers: vague description of blockers.
- Tasks with missing acceptance criteria.
- General project health issues.

Output a structured JSON list of detected suggestions.
Each suggestion must follow this exact format:
{
  "suggestions": [
    {
      "suggestion_type": "risk_detected|blocker_escalation|plan_deviation|clarification_needed",
      "title": "Clear concise title of the issue",
      "body": "Detailed description of what was detected and recommendation",
      "payload": {
        "affected_task_ids": ["uuid1"],
        "affected_member_ids": ["uuid2"]
      }
    }
  ]
}
"""

OBSERVER_USER_TEMPLATE = """Current date: {current_date}
Analyze the project state:
{project_state}

Identify any issues and format them as the requested JSON structure.
"""


async def run(project_id: str | None = None, payload: dict | None = None) -> dict:
    """Scan project health and persist suggestions. Pure local I/O."""
    vieroc = VieroClickClient()
    project_id = project_id or vieroc.default_project_id
    logger.info("Observer agent: scanning project health for %s", project_id)

    proj_data = await vieroc.fetch_project_data(project_id)
    if not proj_data:
        return {"ok": False, "error": "Failed to retrieve project state for audit."}

    try:
        llm_response = await call_llm(
            system_prompt=OBSERVER_SYSTEM_PROMPT,
            user_prompt=OBSERVER_USER_TEMPLATE.format(
                current_date=date.today().isoformat(),
                project_state=json.dumps(proj_data, default=str),
            ),
            response_format_json=True,
            model_override=os.getenv("OBSERVER_MODEL"),
        )
        result = extract_json_payload(llm_response)
    except Exception as e:
        logger.error("Observer scan failed: %s", e)
        return {"ok": False, "error": f"Project health scan failed: {e}"}

    if not result or "suggestions" not in result:
        return {"ok": False, "error": "Failed to parse observer suggestions payload."}

    suggestions = result["suggestions"]
    if not suggestions:
        return {"ok": True, "projectId": project_id, "savedCount": 0, "note": "No critical anomalies or risks detected."}

    saved_count = 0
    saved = []
    for sug in suggestions:
        resp = await vieroc.create_suggestion(
            suggestion_type=sug.get("suggestion_type", "risk_detected"),
            title=sug.get("title", "Observer Alert"),
            body=sug.get("body", ""),
            payload=sug.get("payload", {}),
            project_id=project_id,
        )
        if resp and "id" in resp:
            saved_count += 1
            saved.append({"title": sug.get("title"), "type": sug.get("suggestion_type")})

    logger.info("Observer audit complete: saved %s suggestions", saved_count)
    return {"ok": True, "projectId": project_id, "savedCount": saved_count, "suggestions": saved}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    import sys

    pid = sys.argv[1] if len(sys.argv) > 1 else None
    print(json.dumps(asyncio.run(run(pid)), indent=2, ensure_ascii=False, default=str))
