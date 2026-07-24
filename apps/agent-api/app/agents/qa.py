"""
QA agent.

Two entry points share this module:

* `answer_question(question, context_chunks)` — the legacy RAG path still used by
  the async Celery worker (`workers/tasks.py`). Unchanged.
* `run_qa(project_id, question, ...)` — the tool-calling path. Instead of
  stuffing the whole project into one prompt, the LLM is given a set of tools
  (defined **in this file**) that each fetch one slice of project state, and it
  calls only the ones it needs to answer. This is the path the interactive
  `project_qa` role and the Telegram agent point at.

Tool budget (enforced by `run_qa`): every tool may be called **at most once per
answer**, so the model can combine several different tools in a single turn but
can't loop on the same fetch. The one exception is `read_document`, which may be
called repeatedly so the model can read as many docs as the question needs.

The tools mirror the Telegram `/slash` command surface (`get_status`,
`get_health`, `get_team`, `get_tasks`, `get_blockers`, `get_risks`,
`get_milestones`, `get_daily_updates`) plus deeper Q&A fetches (overview,
decisions, comments, WBS, reports, documents) — so anything a slash command can
answer, the Q&A agent can now answer from free text too.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable, Optional

from app.agents.gemini_client import chat_with_tools, embed, generate
from app.agents.message_parser import extract_json_payload
from app.agents.vieroc_client import VieroClickClient
from app.settings import settings

logger = logging.getLogger(__name__)

# ─── Legacy RAG path (Celery worker) ─────────────────────────────────────────

SYSTEM_PROMPT = """You are a knowledgeable project assistant with access to project documents,
decisions, task history, and activity logs. Answer questions accurately and concisely.
If information is unavailable, say so clearly.
"""


async def get_embedding(text: str) -> list[float]:
    return await embed(text)


async def answer_question(
    question: str,
    context_chunks: list[str],
) -> str:
    context = "\n\n---\n\n".join(context_chunks)
    return await generate(
        SYSTEM_PROMPT,
        f"Context:\n{context}\n\nQuestion: {question}",
        model=settings.llm_qa_model,
    )


# ─── Tool-calling path ───────────────────────────────────────────────────────

# How many list rows a single tool returns (keeps tool payloads bounded so a big
# project can't blow up the context / cost of the loop).
_MAX_ROWS = 40
_MAX_COMMENTS = 60
# Safety net on the tool-calling loop (each iteration is one assistant turn).
_MAX_ITERATIONS = 8


class _ProjectCache:
    """Fetches the two web read models once each and hands slices to the tools.

    Both endpoints are hit lazily and memoised for the lifetime of a single
    `run_qa` call, so ten tools reading different slices cost at most two HTTP
    round-trips regardless of how the model sequences them.
    """

    def __init__(self, client: VieroClickClient, project_id: str) -> None:
        self._client = client
        self._project_id = project_id
        self._data: Optional[dict] = None
        self._summary: Optional[dict] = None

    async def data(self) -> dict:
        """Raw project state from GET /api/project-data (docs, decisions, …)."""
        if self._data is None:
            self._data = await self._client.fetch_project_data(self._project_id) or {}
        return self._data

    async def summary(self) -> dict:
        """Resolved read model from GET /api/agent/project-summary (health/team/…).

        This is the exact model the Telegram slash commands render, so the
        status/health/team/tasks/etc. tools answer identically to `/status`,
        `/health`, `/member`, … .
        """
        if self._summary is None:
            self._summary = await self._client.fetch_project_summary(self._project_id) or {}
        return self._summary


def _rows(items: Any, limit: int = _MAX_ROWS) -> list:
    return list(items or [])[:limit]


# ─── Tool implementations (each fetches one slice) ───────────────────────────
#
# Every tool takes the shared _ProjectCache and returns a JSON-serialisable
# result. They never raise for missing data — an empty slice just comes back
# empty so the model can report "not recorded" rather than erroring the turn.


async def tool_project_overview(cache: _ProjectCache, **_: Any) -> dict:
    p = (await cache.data()).get("project") or {}
    return {
        "name": p.get("name"),
        "description": p.get("description"),
        "scope": p.get("scope"),
        "status": p.get("status"),
        "projectType": p.get("projectType"),
        "startDate": p.get("startDate"),
        "targetEndDate": p.get("targetEndDate"),
        "goals": p.get("goals"),
        "constraints": p.get("constraints"),
        "expectedDeliverables": p.get("expectedDeliverables"),
        "initialContext": p.get("initialContext"),
        "intakeStatus": p.get("intakeStatus"),
        "agentAutonomy": p.get("agentAutonomy"),
    }


async def tool_get_status(cache: _ProjectCache, **_: Any) -> dict:
    s = await cache.summary()
    return {"project": s.get("project"), "health": s.get("health")}


async def tool_get_health(cache: _ProjectCache, **_: Any) -> dict:
    return {"health": (await cache.summary()).get("health")}


async def tool_get_team(cache: _ProjectCache, name: str | None = None, **_: Any) -> dict:
    team = (await cache.summary()).get("team") or []
    if name:
        needle = name.strip().lower()
        team = [m for m in team if needle in str(m.get("fullName", "")).lower()]
    return {"team": _rows(team)}


async def tool_get_tasks(
    cache: _ProjectCache, status: str | None = None, assignee: str | None = None, **_: Any
) -> dict:
    tasks = (await cache.summary()).get("tasks") or []
    if status:
        needle = status.strip().lower()
        tasks = [
            t
            for t in tasks
            if needle in str(t.get("statusType", "")).lower()
            or needle in str(t.get("statusName", "")).lower()
        ]
    if assignee:
        needle = assignee.strip().lstrip("@").lower()
        tasks = [t for t in tasks if needle in str(t.get("assignee", "")).lower()]
    return {"count": len(tasks), "tasks": _rows(tasks)}


async def tool_get_blockers(cache: _ProjectCache, **_: Any) -> dict:
    return {"blockers": _rows((await cache.summary()).get("blockers"))}


async def tool_get_risks(cache: _ProjectCache, **_: Any) -> dict:
    return {"risks": _rows((await cache.summary()).get("risks"))}


async def tool_get_milestones(cache: _ProjectCache, **_: Any) -> dict:
    return {"milestones": _rows((await cache.summary()).get("milestones"))}


async def tool_get_daily_updates(cache: _ProjectCache, **_: Any) -> dict:
    return {"dailyUpdates": _rows((await cache.summary()).get("dailyUpdates"))}


async def tool_get_decisions(cache: _ProjectCache, **_: Any) -> dict:
    return {"decisions": _rows((await cache.data()).get("decisions"))}


async def tool_get_comments(cache: _ProjectCache, **_: Any) -> dict:
    return {"comments": _rows((await cache.data()).get("comments"), _MAX_COMMENTS)}


async def tool_get_wbs(cache: _ProjectCache, **_: Any) -> dict:
    return {"wbs": _rows((await cache.data()).get("wbs"))}


async def tool_get_reports(cache: _ProjectCache, **_: Any) -> dict:
    return {"reports": _rows((await cache.data()).get("reports"))}


async def tool_list_documents(cache: _ProjectCache, **_: Any) -> dict:
    """List doc/file descriptors (titles + ids) without their bodies, so the
    model can pick which ones to open with `read_document`."""
    data = await cache.data()
    docs = [
        {"id": d.get("id"), "title": d.get("title"), "type": d.get("type")}
        for d in (data.get("docs") or [])
    ]
    files = [
        {"fileId": f.get("fileId"), "fileName": f.get("fileName"), "mimeType": f.get("mimeType")}
        for f in (data.get("intakeFiles") or [])
    ]
    return {"documents": docs, "intakeFiles": files}


async def tool_read_document(
    cache: _ProjectCache, doc_id: str | None = None, title: str | None = None, **_: Any
) -> dict:
    """Return the full content of one project doc, matched by id or title.

    Unlike the other tools this may be called multiple times per answer, so the
    model can read every document a question needs.
    """
    docs = (await cache.data()).get("docs") or []
    match = None
    if doc_id:
        match = next((d for d in docs if str(d.get("id")) == str(doc_id)), None)
    if match is None and title:
        needle = title.strip().lower()
        match = next((d for d in docs if needle in str(d.get("title", "")).lower()), None)
    if match is None:
        return {
            "error": "No matching document. Call list_documents first to see available ids/titles.",
        }
    return {
        "id": match.get("id"),
        "title": match.get("title"),
        "type": match.get("type"),
        "content": match.get("content"),
    }


# name → (implementation, may_repeat). All tools are once-per-answer except
# read_document, which the model may call for as many docs as it needs.
TOOL_FUNCS: dict[str, tuple[Callable[..., Awaitable[dict]], bool]] = {
    "get_project_overview": (tool_project_overview, False),
    "get_status": (tool_get_status, False),
    "get_health": (tool_get_health, False),
    "get_team": (tool_get_team, False),
    "get_tasks": (tool_get_tasks, False),
    "get_blockers": (tool_get_blockers, False),
    "get_risks": (tool_get_risks, False),
    "get_milestones": (tool_get_milestones, False),
    "get_daily_updates": (tool_get_daily_updates, False),
    "get_decisions": (tool_get_decisions, False),
    "get_comments": (tool_get_comments, False),
    "get_wbs": (tool_get_wbs, False),
    "get_reports": (tool_get_reports, False),
    "list_documents": (tool_list_documents, False),
    "read_document": (tool_read_document, True),
}


def _no_arg_tool(name: str, description: str) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": {}},
        },
    }


# OpenAI-format tool schemas advertised to the model.
TOOL_SPECS: list[dict[str, Any]] = [
    _no_arg_tool(
        "get_project_overview",
        "Project metadata: name, description, scope, type, start/end dates, goals, "
        "constraints, expected deliverables, initial context and AI-autonomy settings.",
    ),
    _no_arg_tool(
        "get_status",
        "One-shot project snapshot: name plus the resolved health score, task "
        "completion, overdue/blocker/risk counts (same data as the /status command).",
    ),
    _no_arg_tool(
        "get_health",
        "Detailed health-score breakdown: completion, overdue tasks, open blockers, "
        "high risks and the point deductions (same as the /health command).",
    ),
    {
        "type": "function",
        "function": {
            "name": "get_team",
            "description": "Team roster with per-member load, capacity and performance scores "
            "(same as /member). Optionally filter to one member by name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Optional member name to filter by."}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_tasks",
            "description": "List tasks with status, priority, due date and assignee (same as "
            "/tasks). Optionally filter by status name/type and/or assignee name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "description": "Optional status name or type filter."},
                    "assignee": {"type": "string", "description": "Optional assignee name filter."},
                },
            },
        },
    },
    _no_arg_tool("get_blockers", "Blockers with severity and status (same as /blockers)."),
    _no_arg_tool("get_risks", "Risks with probability/impact and status (same as /risks)."),
    _no_arg_tool("get_milestones", "Milestones with target dates and status (same as /milestones)."),
    _no_arg_tool(
        "get_daily_updates",
        "Recent daily updates: who reported what was done / in progress / blocked "
        "(same as /updates).",
    ),
    _no_arg_tool("get_decisions", "Decision log: recorded decisions, their reasons and affected tasks."),
    _no_arg_tool("get_comments", "Recent task comments across the project."),
    _no_arg_tool("get_wbs", "Work-breakdown-structure nodes (phases / deliverables hierarchy)."),
    _no_arg_tool("get_reports", "Past daily leader reports (progress / risk / blocker summaries)."),
    _no_arg_tool(
        "list_documents",
        "List available project documents and intake files (id, title, type) WITHOUT "
        "their content — use this to decide which to open with read_document.",
    ),
    {
        "type": "function",
        "function": {
            "name": "read_document",
            "description": "Read the full text of one project document, by id or by title. "
            "May be called multiple times to read several documents.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doc_id": {"type": "string", "description": "Document id from list_documents."},
                    "title": {"type": "string", "description": "Document title (partial match) if id unknown."},
                },
            },
        },
    },
]

QA_SYSTEM_PROMPT = """You are the VieroClick Project Q&A agent.

Answer the user's question about the project using the tools provided. Each tool
fetches one slice of live project state. Rules:
- Call only the tools you actually need; you may call several different tools.
- You may call each tool at most ONCE per answer, EXCEPT read_document, which you
  may call multiple times to read every relevant document.
- Base your answer only on tool results. If the needed information is missing from
  the project, say so and treat it as a "project hole".

When you have gathered enough information, STOP calling tools and reply with a
single JSON object (no prose, no code fences) in exactly this shape:
{
  "answer": "A clear, concise answer for the user based on the tool results.",
  "hole_detected": true|false,
  "hole_details": {
    "hole_type": "missing_acceptance_criteria|missing_requirements|missing_decision|unclear_scope",
    "question": "The question that could not be answered",
    "affected_task_id": "uuid-or-null",
    "recommended_leader_action": "What the project lead should do to resolve this hole"
  }
}
Set hole_detected to false and omit hole_details when you were able to answer.
"""


async def _dispatch_tool(cache: _ProjectCache, name: str, args: dict) -> dict:
    entry = TOOL_FUNCS.get(name)
    if entry is None:
        return {"error": f"Unknown tool '{name}'."}
    func, _ = entry
    try:
        return await func(cache, **args)
    except Exception as e:  # pragma: no cover - defensive; a tool must not break the loop
        logger.warning("QA tool %s failed: %s", name, e)
        return {"error": f"Tool '{name}' failed: {e}"}


def _serialize_tool_calls(tool_calls: Any) -> list[dict]:
    return [
        {
            "id": tc.id,
            "type": "function",
            "function": {"name": tc.function.name, "arguments": tc.function.arguments},
        }
        for tc in tool_calls
    ]


async def run_qa(
    project_id: str,
    question: str,
    *,
    client: Optional[VieroClickClient] = None,
    thinking: bool = False,
) -> dict:
    """Answer `question` about `project_id` via the tool-calling loop.

    Returns {"ok", "answer", "hole_detected", ["hole_details"], "tools_used"}.
    """
    client = client or VieroClickClient()
    cache = _ProjectCache(client, project_id)

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": QA_SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]
    used: set[str] = set()
    tools_used: list[str] = []

    final_content = ""
    for _ in range(_MAX_ITERATIONS):
        message = await chat_with_tools(
            messages,
            TOOL_SPECS,
            model=settings.llm_qa_model,
            thinking=thinking,
        )
        tool_calls = getattr(message, "tool_calls", None)

        if not tool_calls:
            final_content = message.content or ""
            break

        # Record the assistant turn (with its tool calls) before answering them.
        messages.append(
            {
                "role": "assistant",
                "content": message.content or "",
                "tool_calls": _serialize_tool_calls(tool_calls),
            }
        )

        for tc in tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
                if not isinstance(args, dict):
                    args = {}
            except json.JSONDecodeError:
                args = {}

            may_repeat = TOOL_FUNCS.get(name, (None, False))[1]
            if name in used and not may_repeat:
                result: dict = {
                    "error": f"Tool '{name}' was already used this turn. "
                    "Use the data already returned instead of calling it again.",
                }
            else:
                result = await _dispatch_tool(cache, name, args)
                used.add(name)
                tools_used.append(name)

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result, default=str),
                }
            )
    else:
        # Ran out of iterations still wanting tools — force a final answer.
        logger.warning("QA loop hit iteration cap for project %s", project_id)
        messages.append(
            {
                "role": "user",
                "content": "Stop calling tools and answer now with the required JSON object.",
            }
        )
        final = await chat_with_tools(
            messages, TOOL_SPECS, model=settings.llm_qa_model, tool_choice="none"
        )
        final_content = final.content or ""

    parsed = extract_json_payload(final_content)
    if isinstance(parsed, dict) and "answer" in parsed:
        answer = str(parsed.get("answer") or "").strip()
        hole_detected = bool(parsed.get("hole_detected"))
        out: dict = {
            "ok": True,
            "projectId": project_id,
            "answer": answer,
            "hole_detected": hole_detected,
            "tools_used": tools_used,
        }
        if hole_detected:
            out["hole_details"] = parsed.get("hole_details", {})
        return out

    # Model answered in prose instead of the JSON envelope — still a valid answer.
    return {
        "ok": True,
        "projectId": project_id,
        "answer": final_content.strip(),
        "hole_detected": False,
        "tools_used": tools_used,
    }
