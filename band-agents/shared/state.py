"""
shared/state.py
Pydantic models for the shared pipeline state passed between agents via Band messages.
"""
from __future__ import annotations
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class PipelineStatus(str, Enum):
    PENDING = "pending"
    PLANNING = "planning"
    READY_FOR_DEV = "ready_for_dev"
    READY_FOR_QA = "ready_for_qa"
    READY_FOR_REVIEW = "ready_for_review"
    APPROVED = "approved"
    BLOCKED = "blocked"
    COMPLETED = "completed"


class AcceptanceCriteria(BaseModel):
    id: str
    description: str
    testable: bool = True


class Subtask(BaseModel):
    title: str
    description: str
    estimated_hours: float = 0.0


class PlannerOutput(BaseModel):
    """Output produced by the Planner agent."""
    task_title: str
    task_description: str
    priority: str = "medium"
    estimated_days: float = 1.0
    subtasks: list[Subtask] = Field(default_factory=list)
    acceptance_criteria: list[AcceptanceCriteria] = Field(default_factory=list)
    status: PipelineStatus = PipelineStatus.READY_FOR_DEV


class DeveloperOutput(BaseModel):
    """Output produced by the Developer agent."""
    implementation_summary: str
    schema_changes: list[str] = Field(default_factory=list)
    key_files: list[str] = Field(default_factory=list)
    api_endpoints: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    notes: str = ""
    status: PipelineStatus = PipelineStatus.READY_FOR_QA


class TestCase(BaseModel):
    name: str
    description: str
    steps: list[str] = Field(default_factory=list)
    expected_result: str


class QAOutput(BaseModel):
    """Output produced by the QA agent."""
    test_cases: list[TestCase] = Field(default_factory=list)
    edge_cases: list[str] = Field(default_factory=list)
    risk_areas: list[str] = Field(default_factory=list)
    coverage_summary: str = ""
    status: PipelineStatus = PipelineStatus.READY_FOR_REVIEW


class ReviewDecision(str, Enum):
    APPROVED = "approved"
    BLOCKED = "blocked"
    NEEDS_REVISION = "needs_revision"


class ReviewerOutput(BaseModel):
    """Output produced by the Reviewer agent."""
    decision: ReviewDecision
    risk_level: str = "low"  # low / medium / high
    risk_notes: list[str] = Field(default_factory=list)
    approval_notes: str = ""
    status: PipelineStatus = PipelineStatus.APPROVED


class PipelineState(BaseModel):
    """Full pipeline state — assembled across agents."""
    pipeline_id: str
    original_request: str
    planner_output: Optional[PlannerOutput] = None
    developer_output: Optional[DeveloperOutput] = None
    qa_output: Optional[QAOutput] = None
    reviewer_output: Optional[ReviewerOutput] = None
    vieroc_task_id: Optional[str] = None
    current_status: PipelineStatus = PipelineStatus.PENDING
    hitl_pending: bool = False
    hitl_stage: Optional[str] = None  # "after_planner" or "after_reviewer"
