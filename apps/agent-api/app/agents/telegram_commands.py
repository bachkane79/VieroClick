"""
Telegram slash-command handlers and message formatters (§2.8 command set).

Read-only commands render the consolidated `/api/agent/project-summary` read
model (health-score + team metrics + resolved task/blocker/risk/milestone/
daily-update lists) as Telegram HTML. The dispatcher in `telegram_agent.py`
parses the command and calls the matching formatter here; write commands
(`/blocker`, `/update`) and `/ask` are handled by the dispatcher directly.

All LLM/DB strings are HTML-escaped before they reach Telegram.
"""
from __future__ import annotations

from typing import Any

from app.telegram_webhook import _html_escape

MAX_TELEGRAM_MESSAGE = 4000
_MAX_ROWS = 25

# Command → one-line description, rendered by /help. Order matters for display.
COMMAND_HELP: list[tuple[str, str]] = [
    ("/help", "Show this command list"),
    ("/status", "Project snapshot: health, task counts, blockers, risks"),
    ("/health", "Project health score breakdown"),
    ("/report", "Generate & send the daily leader report"),
    ("/member [name]", "Team roster with load & scores, or one member's metrics"),
    ("/tasks [status|@name]", "List tasks, optionally filtered"),
    ("/blockers", "Open blockers"),
    ("/risks", "Open risks"),
    ("/milestones", "Upcoming milestones"),
    ("/updates", "Recent daily updates"),
    ("/ask <question>", "Ask the project Q&A agent"),
    ("/blocker <text>", "File a blocker (asks Y/N to confirm)"),
    ("/update <text>", "Log a daily-update (asks Y/N to confirm)"),
]


def _esc(value: Any) -> str:
    return _html_escape(str(value if value is not None else ""))


def _clip(text: str) -> str:
    if len(text) <= MAX_TELEGRAM_MESSAGE:
        return text
    return text[: MAX_TELEGRAM_MESSAGE - len("\n…(truncated)")] + "\n…(truncated)"


def _pct(value: Any) -> str:
    try:
        return f"{round(float(value) * 100)}%"
    except (TypeError, ValueError):
        return "—"


def format_help() -> str:
    lines = ["<b>VieroClick bot — commands</b>", ""]
    lines += [f"{_esc(cmd)} — {_esc(desc)}" for cmd, desc in COMMAND_HELP]
    lines += [
        "",
        "Free-text messages are classified and routed automatically: a suspected "
        "blocker or daily-update is proposed for your <b>Y/N</b> confirmation; a "
        "question is answered by the Q&A agent.",
    ]
    return _clip("\n".join(lines))


def _project_header(summary: dict) -> str:
    project = summary.get("project") or {}
    return f"<b>{_esc(project.get('name', 'Project'))}</b>"


def format_status(summary: dict) -> str:
    health = summary.get("health") or {}
    tasks = summary.get("tasks") or []
    counts: dict[str, int] = {}
    for t in tasks:
        counts[t.get("statusType", "?")] = counts.get(t.get("statusType", "?"), 0) + 1

    lines = [
        _project_header(summary),
        f"Health: <b>{_esc(health.get('score', '—'))}/100</b>",
        f"Tasks: {health.get('doneTasks', 0)}/{health.get('totalTasks', 0)} done "
        f"({_pct(health.get('completionPct'))})",
    ]
    if counts:
        by_status = ", ".join(f"{_esc(k)}: {v}" for k, v in sorted(counts.items()))
        lines.append(f"By status: {by_status}")
    lines += [
        f"Overdue tasks: {health.get('overdueTaskCount', 0)}",
        f"Open blockers: {health.get('openBlockerCount', 0)}",
        f"High risks: {health.get('highRiskCount', 0)}",
    ]
    return _clip("\n".join(lines))


def format_health(summary: dict) -> str:
    h = summary.get("health") or {}
    lines = [
        f"{_project_header(summary)} — health <b>{_esc(h.get('score', '—'))}/100</b>",
        "",
        f"• Completion: {h.get('doneTasks', 0)}/{h.get('totalTasks', 0)} "
        f"({_pct(h.get('completionPct'))})",
        f"• Overdue tasks: {h.get('overdueTaskCount', 0)} (−5 each, max −30)",
        f"• Open blockers: {h.get('openBlockerCount', 0)} (−8 each, max −24)",
        f"• High risks: {h.get('highRiskCount', 0)} (−5 each, max −20)",
    ]
    return _clip("\n".join(lines))


def _score_avg(scores: dict) -> float:
    vals = [
        scores.get("reliability", 0),
        scores.get("speed", 0),
        scores.get("quality", 0),
        scores.get("communication", 0),
        scores.get("blockerHandling", 0),
    ]
    nums = [float(v) for v in vals if isinstance(v, (int, float))]
    return round(sum(nums) / len(nums), 1) if nums else 0.0


def format_member(summary: dict, name_filter: str = "") -> str:
    team = summary.get("team") or []
    if not team:
        return "No team members on this project yet."

    nf = name_filter.strip().lower()
    if nf:
        matches = [m for m in team if nf in str(m.get("fullName", "")).lower()]
        if not matches:
            return f"No member matching “{_esc(name_filter)}”."
        lines = []
        for m in matches[:5]:
            s = m.get("scores") or {}
            lines += [
                f"<b>{_esc(m.get('fullName'))}</b> — {_esc(m.get('role'))}",
                f"Open tasks: {m.get('openTasks', 0)} · "
                f"Load: {m.get('committedHours', 0)}/{m.get('capacityHours', 0)}h"
                f"{' ⚠️ overloaded' if m.get('overloaded') else ''}",
                f"On-time: {_pct(m.get('onTimeRate'))} · "
                f"Estimate accuracy: {_pct(m.get('estimateAccuracy'))}",
                f"Scores — reliability {s.get('reliability', 0)}, speed {s.get('speed', 0)}, "
                f"quality {s.get('quality', 0)}, comms {s.get('communication', 0)}, "
                f"blockers {s.get('blockerHandling', 0)}",
                "",
            ]
        return _clip("\n".join(lines).rstrip())

    lines = [f"<b>Team — {_project_header(summary)}</b>", ""]
    for m in team[:_MAX_ROWS]:
        flag = " ⚠️" if m.get("overloaded") else ""
        lines.append(
            f"• <b>{_esc(m.get('fullName'))}</b> ({_esc(m.get('role'))}) — "
            f"{m.get('openTasks', 0)} open, "
            f"{m.get('committedHours', 0)}/{m.get('capacityHours', 0)}h{flag}, "
            f"avg {_score_avg(m.get('scores') or {})}/5"
        )
    return _clip("\n".join(lines))


def format_tasks(summary: dict, filter_arg: str = "") -> str:
    tasks = summary.get("tasks") or []
    arg = filter_arg.strip()
    label = "all"

    if arg.startswith("@"):
        needle = arg[1:].lower()
        tasks = [t for t in tasks if needle in str(t.get("assignee", "")).lower()]
        label = arg
    elif arg:
        needle = arg.lower()
        tasks = [
            t
            for t in tasks
            if needle in str(t.get("statusType", "")).lower()
            or needle in str(t.get("statusName", "")).lower()
        ]
        label = arg

    if not tasks:
        return f"No tasks match “{_esc(arg)}”." if arg else "No tasks on this project."

    lines = [f"<b>Tasks ({_esc(label)}) — {len(tasks)}</b>", ""]
    for t in tasks[:_MAX_ROWS]:
        due = f" · due {_esc(t.get('dueDate'))}" if t.get("dueDate") else ""
        who = f" · {_esc(t.get('assignee'))}" if t.get("assignee") else " · unassigned"
        lines.append(
            f"• {_esc(t.get('title'))} [{_esc(t.get('statusName'))}]{who}{due}"
        )
    if len(tasks) > _MAX_ROWS:
        lines.append(f"…and {len(tasks) - _MAX_ROWS} more")
    return _clip("\n".join(lines))


def format_blockers(summary: dict) -> str:
    blockers = [
        b for b in (summary.get("blockers") or []) if b.get("status") in ("open", "in_review")
    ]
    if not blockers:
        return "No open blockers. 🎉"
    lines = [f"<b>Open blockers — {len(blockers)}</b>", ""]
    for b in blockers[:_MAX_ROWS]:
        lines.append(
            f"• [{_esc(b.get('severity'))}] {_esc(b.get('title'))} "
            f"({_esc(b.get('status'))})"
        )
    return _clip("\n".join(lines))


def format_risks(summary: dict) -> str:
    risks = [r for r in (summary.get("risks") or []) if r.get("status") == "open"]
    if not risks:
        return "No open risks."
    lines = [f"<b>Open risks — {len(risks)}</b>", ""]
    for r in risks[:_MAX_ROWS]:
        score = (r.get("probability") or 1) * (r.get("impact") or 1)
        lines.append(f"• {_esc(r.get('title'))} — score {score}/25")
    return _clip("\n".join(lines))


def format_milestones(summary: dict) -> str:
    milestones = summary.get("milestones") or []
    if not milestones:
        return "No milestones defined."
    lines = [f"<b>Milestones — {len(milestones)}</b>", ""]
    for m in milestones[:_MAX_ROWS]:
        when = f" · {_esc(m.get('targetDate'))}" if m.get("targetDate") else ""
        lines.append(f"• {_esc(m.get('title'))} [{_esc(m.get('status'))}]{when}")
    return _clip("\n".join(lines))


def format_updates(summary: dict) -> str:
    updates = summary.get("dailyUpdates") or []
    if not updates:
        return "No daily updates yet."
    lines = [f"<b>Recent daily updates — {len(updates)}</b>", ""]
    for u in updates[:15]:
        done = _esc(u.get("completedText") or "—")
        lines += [
            f"<b>{_esc(u.get('memberName') or 'Member')}</b> · {_esc(u.get('workDate'))}",
            f"  done: {done}",
        ]
        if u.get("blockersText"):
            lines.append(f"  blockers: {_esc(u.get('blockersText'))}")
    return _clip("\n".join(lines))


# Command → (formatter, needs_summary). Formatters take (summary) or (summary, arg).
SUMMARY_COMMANDS = {
    "status": format_status,
    "health": format_health,
    "blockers": format_blockers,
    "risks": format_risks,
    "milestones": format_milestones,
    "updates": format_updates,
}

# Summary commands that also accept a free-text argument.
SUMMARY_COMMANDS_WITH_ARG = {
    "member": format_member,
    "tasks": format_tasks,
}
