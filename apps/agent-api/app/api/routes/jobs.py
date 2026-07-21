from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Any
import uuid

from app.api.deps import verify_api_secret
from app.workers.celery_app import celery_app

router = APIRouter(dependencies=[Depends(verify_api_secret)])

# Async job type → Celery task. This set is the single source of truth for the
# async queue and MUST match `agentJobTypeSchema` in packages/validators/src/index.ts.
TASK_MAP = {
    "daily_report": "app.workers.tasks.generate_daily_report",
    "task_assignment": "app.workers.tasks.suggest_task_assignment",
    "risk_scan": "app.workers.tasks.scan_project_risks",
    "qa": "app.workers.tasks.answer_project_question",
}


class CreateJobRequest(BaseModel):
    job_type: str
    project_id: str | None = None
    input: dict[str, Any] = Field(default_factory=dict)
    requested_by_user_id: str | None = None


class JobResponse(BaseModel):
    job_id: str
    status: str


@router.post("/", response_model=JobResponse)
async def create_job(body: CreateJobRequest) -> JobResponse:
    task_name = TASK_MAP.get(body.job_type)
    if not task_name:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown job_type '{body.job_type}'. Allowed: {', '.join(sorted(TASK_MAP))}",
        )

    job_id = str(uuid.uuid4())
    celery_app.send_task(
        task_name,
        kwargs={
            "job_id": job_id,
            "project_id": body.project_id,
            "input_data": body.input,
        },
    )

    return JobResponse(job_id=job_id, status="queued")


@router.get("/{job_id}")
async def get_job(job_id: str) -> dict[str, Any]:
    result = celery_app.AsyncResult(job_id)
    return {
        "job_id": job_id,
        "status": result.status,
        "result": result.result if result.ready() else None,
    }
