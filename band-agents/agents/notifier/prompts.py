"""
agents/notifier/prompts.py
Templates for the Notifier agent messages.
"""

def format_task_comment(plan: dict, dev_output: dict, qa_output: dict, review: dict) -> str:
    """Format a comprehensive comment to attach to the created VieroClick task."""
    lines = [
        "## 🤖 AI Pipeline Summary",
        "",
        "This task was created and reviewed by the VieroClick AI agent pipeline.",
        "",
        "### 📋 Plan",
        f"- **Priority**: {plan.get('priority', 'medium').capitalize()}",
        f"- **Estimate**: {plan.get('estimated_days', '?')} day(s)",
        "",
        "### ✅ Acceptance Criteria",
    ]
    for ac in plan.get("acceptance_criteria", []):
        lines.append(f"- [{ac.get('id', '?')}] {ac.get('description', '')}")

    lines += [
        "",
        "### 🛠️ Implementation Notes",
        dev_output.get("implementation_summary", "N/A"),
        "",
        "### 🧪 Test Coverage",
        qa_output.get("coverage_summary", "N/A"),
        "",
        "### 🔍 Review Decision",
        f"**{review.get('decision', '?').upper()}** — Risk: {review.get('risk_level', '?').upper()}",
        review.get("approval_notes", ""),
    ]

    return "\n".join(lines)


def format_telegram_message(task_title: str, task_id: str, vieroc_url: str) -> str:
    """Format a Telegram notification message."""
    return (
        f"🚀 *New Task Created via AI Pipeline*\n\n"
        f"📌 *{task_title}*\n\n"
        f"✅ Reviewed and approved by multi-agent pipeline\n"
        f"🔗 [View in VieroClick]({vieroc_url}/tasks/{task_id})"
    )


def format_band_completion_message(task_title: str, task_id: str, vieroc_url: str) -> str:
    """Format the final completion message posted to the Band room."""
    return (
        f"🎉 **Pipeline Complete!**\n\n"
        f"✅ Task created in VieroClick:\n"
        f"**{task_title}** (ID: `{task_id}`)\n\n"
        f"🔗 Link: {vieroc_url}/tasks/{task_id}\n\n"
        f"📬 Team notifications sent.\n\n"
        f"---\n"
        f"*Powered by VieroClick × Band AI multi-agent pipeline*"
    )
