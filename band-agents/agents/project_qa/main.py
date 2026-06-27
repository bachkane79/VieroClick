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

QA_SYSTEM_PROMPT = """You are an expert Project Q&A and Hole Detection Agent.
Your job is to answer user queries using the provided project state (docs, decisions, tasks, comments, updates).

If the information needed to answer the question is missing from the project context, you must identify this as a "project hole" and log it.

Output a structured JSON response in this exact format:
{
  "answer": "Your detailed answer answering the user's question, if information is available.",
  "hole_detected": true|false,
  "hole_details": {
    "hole_type": "missing_acceptance_criteria|missing_requirements|missing_decision|unclear_scope",
    "question": "The question asked that could not be answered",
    "affected_task_id": "uuid-of-task-or-null",
    "recommended_leader_action": "What the project lead should do to resolve this hole (e.g., Clarify expected output before member continues)"
  }
}
"""

QA_USER_TEMPLATE = """User Question: {question}
Project State:
{project_state}

Return the structured JSON Q&A response.
"""


async def run(project_id: str | None = None, payload: dict | None = None) -> dict:
    """
    Answer a project question and log a project hole if context is missing.
    The question is read from payload["question"] (or payload["message"]).
    """
    payload = payload or {}
    question = (payload.get("question") or payload.get("message") or "").strip()
    if not question:
        return {"ok": False, "error": "No question provided for Q&A."}

    vieroc = VieroClickClient()
    project_id = project_id or vieroc.default_project_id
    logger.info("Q&A agent: answering query for %s: %s", project_id, question[:100])

    proj_data = await vieroc.fetch_project_data(project_id)
    if not proj_data:
        return {"ok": False, "error": "Failed to retrieve project state for lookup."}

    try:
        llm_response = await call_llm(
            system_prompt=QA_SYSTEM_PROMPT,
            user_prompt=QA_USER_TEMPLATE.format(
                question=question,
                project_state=json.dumps(proj_data, default=str),
            ),
            response_format_json=True,
            model_override=os.getenv("PROJECT_QA_MODEL"),
        )
        result = extract_json_payload(llm_response)
    except Exception as e:
        logger.error("Q&A lookup failed: %s", e)
        return {"ok": False, "error": f"Q&A lookup failed: {e}"}

    if not result or "answer" not in result:
        return {"ok": False, "error": "Failed to resolve answer from LLM."}

    answer_text = result.get("answer", "")
    out: dict = {"ok": True, "projectId": project_id, "answer": answer_text, "hole_detected": False}

    if result.get("hole_detected", False):
        hole = result.get("hole_details", {})
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


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    import sys

    q = sys.argv[1] if len(sys.argv) > 1 else "What is the current status of this project?"
    print(json.dumps(asyncio.run(run(payload={"question": q})), indent=2, ensure_ascii=False, default=str))
