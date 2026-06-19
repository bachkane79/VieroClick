"""
shared/hitl.py
Human-in-the-Loop (HITL) gate patterns for the Band pipeline.

Band's @mention system is HITL by design:
  - Agents only fire when @mentioned
  - The human is always in control of when the next step runs

This module provides helpers for agents to post HITL prompts and
document the expected human response format.
"""
from __future__ import annotations
import logging
from .message_parser import format_agent_message

logger = logging.getLogger(__name__)


def make_hitl_prompt(
    stage: str,
    summary: str,
    approve_instruction: str,
    reject_instruction: str,
    next_agent_handle: str,
) -> str:
    """
    Build the HITL pause message that an agent posts to the room.
    
    After posting this, the agent's run() loop simply waits.
    It will only continue when the human @mentions the next agent
    (or when the human @mentions this agent with an approval keyword).
    
    Args:
        stage: Label for this HITL checkpoint (e.g., "after_planner")
        summary: What just happened and what the human needs to review
        approve_instruction: What the human should type to approve
        reject_instruction: What the human should type to reject/cancel
        next_agent_handle: The Band handle of the next agent (for guidance)
    
    Returns:
        Formatted message string to post to the Band room
    """
    body = (
        f"{summary}\n\n"
        f"---\n"
        f"⏸️ **HUMAN REVIEW REQUIRED** — Stage: `{stage}`\n\n"
        f"✅ To **approve**: {approve_instruction}\n"
        f"❌ To **reject/cancel**: {reject_instruction}\n\n"
        f"*Next agent ({next_agent_handle}) will only proceed after your approval.*"
    )
    return format_agent_message(
        header=f"🔔 Waiting for human input [{stage}]",
        body=body,
    )


def make_hitl_approved_message(stage: str, next_agent_handle: str) -> str:
    """Message to post when human has approved and next agent is being called."""
    return (
        f"✅ Human approved stage `{stage}`.\n\n"
        f"{next_agent_handle} please proceed."
    )


def make_hitl_rejected_message(stage: str) -> str:
    """Message to post when human has rejected the pipeline."""
    return (
        f"❌ Human rejected/cancelled stage `{stage}`.\n"
        f"Pipeline halted. Please start a new request if needed."
    )
