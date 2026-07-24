"""
Project Q&A role — answer a question from live project state and log a
"project hole" suggestion when required context is missing.

The reasoning is delegated to the tool-calling Q&A agent in `app.agents.qa`
(`run_qa`), which lets the model fetch only the slices of project state it needs
(tasks, blockers, docs, …) instead of loading the whole project into one prompt.
This role keeps the side effect that belongs to the interactive path: when the
agent reports a project hole, it is recorded as an `agent_suggestion`.
"""
from __future__ import annotations

import logging

from app.agents.qa import run_qa
from app.agents.vieroc_client import VieroClickClient

logger = logging.getLogger(__name__)

# 4.5: bound input so a huge prompt can't blow up the LLM call / cost.
MAX_QUESTION_LEN = 4000


async def run(project_id: str | None = None, payload: dict | None = None) -> dict:
    payload = payload or {}
    question = (payload.get("question") or payload.get("message") or "").strip()
    if not question:
        return {"ok": False, "error": "No question provided for Q&A."}
    if len(question) > MAX_QUESTION_LEN:
        question = question[:MAX_QUESTION_LEN]

    vieroc = VieroClickClient()
    project_id = project_id or vieroc.default_project_id
    logger.info("Q&A agent: answering query for %s: %s", project_id, question[:100])

    try:
        result = await run_qa(project_id, question, client=vieroc)
    except Exception as e:
        logger.error("Q&A lookup failed: %s", e)
        return {"ok": False, "error": f"Q&A lookup failed: {e}"}

    if not result.get("ok") or not result.get("answer"):
        return {"ok": False, "error": "Failed to resolve answer from LLM."}

    out: dict = {
        "ok": True,
        "projectId": project_id,
        "answer": result["answer"],
        "hole_detected": False,
    }

    if result.get("hole_detected"):
        hole = result.get("hole_details") or {}
        hole_type = hole.get("hole_type", "unclear_scope")
        logger.info("Project hole detected: %s", hole_type)

        title = f"Project Hole Detected: {hole_type.replace('_', ' ').title()}"
        body = (
            f"The AI Q&A Agent detected missing project parameters while answering a query:\n"
            f"- **Query**: \"{hole.get('question')}\"\n"
            f"- **Action**: {hole.get('recommended_leader_action')}"
        )
        resp = await vieroc.create_suggestion(
            suggestion_type="project_hole",
            title=title,
            body=body,
            payload=hole,
            project_id=project_id,
        )
        out["hole_detected"] = True
        out["hole_details"] = hole
        out["hole_logged"] = bool(resp and "id" in resp)

    return out
