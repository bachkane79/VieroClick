"""
Morning briefing role — per-member + project-level briefings, dispatched as
in-app notifications with a best-effort Telegram team broadcast.
"""
from __future__ import annotations

import json
import logging

from app.agents.gemini_client import generate
from app.agents.message_parser import extract_json_payload
from app.agents.vieroc_client import VieroClickClient

logger = logging.getLogger(__name__)

BRIEFING_SYSTEM_PROMPT = """You are an expert Morning Briefing Agent.
Review the yesterday report, leader decisions, open blockers, today tasks, priority changes, and risks.
Generate customized daily briefings for each team member, plus project-level summaries (lead and team briefings).

Your output must be a structured JSON object in this exact format:
{
  "project_briefings": {
    "lead_briefing": "Focus points for the lead/owner today",
    "team_briefing": "General announcement for the whole team today"
  },
  "member_briefings": [
    {
      "member_id": "uuid-of-member",
      "member_name": "Full name of member",
      "briefing": "Your personalized task focus and reminders for today"
    }
  ]
}
"""

BRIEFING_USER_TEMPLATE = """Project state context:
{project_state}

Synthesize this data and return the structured JSON morning briefings.
"""


async def run(project_id: str | None = None, payload: dict | None = None) -> dict:
    vieroc = VieroClickClient()
    project_id = project_id or vieroc.default_project_id
    logger.info("Morning briefing agent: generating briefings for %s", project_id)

    proj_data = await vieroc.fetch_project_data(project_id)
    if not proj_data:
        return {"ok": False, "error": "Failed to retrieve project state for briefings."}

    try:
        llm_response = await generate(
            BRIEFING_SYSTEM_PROMPT,
            BRIEFING_USER_TEMPLATE.format(project_state=json.dumps(proj_data, default=str)),
            as_json=True,
        )
        result = extract_json_payload(llm_response)
    except Exception as e:
        logger.error("Briefing generation failed: %s", e)
        return {"ok": False, "error": f"Briefing generation failed: {e}"}

    if not result or "project_briefings" not in result:
        return {"ok": False, "error": "Failed to parse briefings payload."}

    workspace_id = proj_data.get("project", {}).get("workspaceId")
    resolved_project_id = proj_data.get("project", {}).get("id") or project_id

    p_briefings = result.get("project_briefings", {})
    team_brief = p_briefings.get("team_briefing", "")

    notified = 0
    for mb in result.get("member_briefings", []):
        member_id = mb.get("member_id")
        briefing_text = mb.get("briefing")
        if workspace_id and member_id:
            resp = await vieroc.create_notification(
                workspace_id=workspace_id,
                recipient_member_id=member_id,
                project_id=resolved_project_id,
                type="morning_briefing",
                title="Your Morning Briefing is Ready",
                body=briefing_text,
            )
            if resp and "id" in resp:
                notified += 1

    await vieroc.send_telegram_notification(f"📢 *Morning Briefing Overview*\n\n{team_brief}")

    logger.info("Morning briefing complete: %s member notifications sent", notified)
    return {
        "ok": True,
        "projectId": resolved_project_id,
        "membersNotified": notified,
        "project_briefings": p_briefings,
        "member_briefings": result.get("member_briefings", []),
    }
