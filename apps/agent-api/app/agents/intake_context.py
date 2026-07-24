"""
Shared builder for the plan-intake context.

Both the intake_review and planning agents work from the SAME long, structured
input: the project meta + the five structured intake zones + the uploaded
context documents (converted to markdown). This module assembles that context
into an explicitly ZONE-LABELED string so the prompts can reason about each part
separately (the combined context is long, so the boundaries matter).
"""
from __future__ import annotations

import logging
from typing import Any

from app.agents.doc_preprocess import to_markdown
from app.agents.vieroc_client import VieroClickClient

logger = logging.getLogger(__name__)

# Guard the prompt size: cap per-file markdown so one huge upload can't blow the
# context window. Whole-file omission is noted inline so nothing is silent.
_MAX_FILE_CHARS = 20_000

PROJECT_TYPE_LABELS = {
    "software": "Phần mềm / Software",
    "marketing_campaign": "Chiến dịch Marketing",
    "event": "Sự kiện / Event",
    "research": "Nghiên cứu / Research",
    "product_launch": "Ra mắt sản phẩm / Product launch",
    "general": "Chung / General",
}


def _fmt_goals(goals: list[dict[str, Any]]) -> str:
    if not goals:
        return "(empty)"
    lines = []
    for g in goals:
        text = (g or {}).get("text", "")
        target = (g or {}).get("target")
        lines.append(f"- {text}" + (f" — target: {target}" if target else " — target: (none set)"))
    return "\n".join(lines)


def _fmt_constraints(constraints: list[dict[str, Any]]) -> str:
    if not constraints:
        return "(empty)"
    return "\n".join(
        f"- [{(c or {}).get('category', 'other')}] {(c or {}).get('value', '')}" for c in constraints
    )


def _fmt_deliverables(deliverables: list[dict[str, Any]]) -> str:
    if not deliverables:
        return "(empty)"
    lines = []
    for d in deliverables:
        name = (d or {}).get("name", "")
        dtype = (d or {}).get("type", "")
        note = (d or {}).get("acceptanceNote")
        lines.append(f"- {name} ({dtype})" + (f" — acceptance: {note}" if note else ""))
    return "\n".join(lines)


def _fmt_members(members: list[dict[str, Any]]) -> str:
    if not members:
        return "(none)"
    return "\n".join(
        f"- {(m or {}).get('fullName', '?')} ({(m or {}).get('role', '?')})" for m in members
    )


async def build_intake_context(
    vieroc: VieroClickClient, project_id: str, project_data: dict
) -> str:
    """Assemble the zone-labeled intake context (meta + 5 zones + doc markdown)."""
    project = project_data.get("project", {}) or {}
    members = project_data.get("members", []) or []
    intake_files = project_data.get("intakeFiles", []) or []

    ptype = project.get("projectType", "general")
    ptype_label = PROJECT_TYPE_LABELS.get(ptype, ptype)

    # Preprocess uploaded documents → markdown.
    doc_sections: list[str] = []
    for f in intake_files:
        file_id = f.get("fileId")
        file_name = f.get("fileName", "file")
        mime = f.get("mimeType", "")
        if not file_id:
            continue
        data = await vieroc.download_project_file(project_id, file_id)
        if not data:
            doc_sections.append(f"--- FILE: {file_name} ({mime}) ---\n(could not download this file)")
            continue
        markdown = await to_markdown(data, file_name)
        if not markdown:
            doc_sections.append(
                f"--- FILE: {file_name} ({mime}) ---\n(could not extract text from this file)"
            )
            continue
        truncated = markdown[:_MAX_FILE_CHARS]
        if len(markdown) > _MAX_FILE_CHARS:
            truncated += f"\n…[truncated {len(markdown) - _MAX_FILE_CHARS} chars]"
        doc_sections.append(f"--- FILE: {file_name} ({mime}) ---\n{truncated}")

    docs_block = "\n\n".join(doc_sections) if doc_sections else "(no files uploaded)"

    return f"""=== PROJECT META ===
Name: {project.get("name", "")}
Lĩnh vực (project type — seeds the phase template): {ptype_label} [{ptype}]
Description: {project.get("description") or "(empty)"}
Start date: {project.get("startDate") or "(not set)"}
Deadline: {project.get("targetEndDate") or "(not set)"}
Team members:
{_fmt_members(members)}

=== ZONE 1 — SCOPE (freeform; what is in-scope vs out-of-scope) ===
{project.get("scope") or "(empty)"}

=== ZONE 2 — GOALS (measurable objectives: text + target) ===
{_fmt_goals(project.get("goals", []))}

=== ZONE 3 — CONSTRAINTS (categorized: budget / stack / compliance / timeline / resource / other) ===
{_fmt_constraints(project.get("constraints", []))}

=== ZONE 4 — EXPECTED DELIVERABLES (name + type + acceptance note) ===
{_fmt_deliverables(project.get("expectedDeliverables", []))}

=== ZONE 5 — INITIAL CONTEXT (freeform notes) ===
{project.get("initialContext") or "(empty)"}

=== ZONE 6 — CONTEXT DOCUMENTS (uploaded files, converted to markdown) ===
{docs_block}
"""
