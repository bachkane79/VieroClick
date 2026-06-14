import asyncio
from typing import Any

from app.workers.celery_app import celery_app
from app.agents import reporter, planner, assigner, observer


def run_async(coro: Any) -> Any:
    return asyncio.get_event_loop().run_until_complete(coro)


@celery_app.task(name="app.workers.tasks.generate_daily_report", bind=True)
def generate_daily_report(self: Any, job_id: str, project_id: str, input_data: dict[str, Any]) -> dict[str, Any]:
    result = run_async(reporter.generate_report(input_data))
    return {"job_id": job_id, "output": result}


@celery_app.task(name="app.workers.tasks.suggest_task_assignment", bind=True)
def suggest_task_assignment(self: Any, job_id: str, project_id: str, input_data: dict[str, Any]) -> dict[str, Any]:
    task = input_data.get("task", {})
    members = input_data.get("members", [])
    result = run_async(assigner.suggest_assignment(task, members))
    return {"job_id": job_id, "output": result}


@celery_app.task(name="app.workers.tasks.scan_project_risks", bind=True)
def scan_project_risks(self: Any, job_id: str, project_id: str, input_data: dict[str, Any]) -> dict[str, Any]:
    events = input_data.get("events", [])
    project_state = input_data.get("project_state", {})
    result = run_async(observer.scan_project_health(events, project_state))
    return {"job_id": job_id, "output": result}


@celery_app.task(name="app.workers.tasks.answer_project_question", bind=True)
def answer_project_question(self: Any, job_id: str, project_id: str, input_data: dict[str, Any]) -> dict[str, Any]:
    from app.agents.qa import answer_question
    question = input_data.get("question", "")
    chunks = input_data.get("context_chunks", [])
    result = run_async(answer_question(question, chunks))
    return {"job_id": job_id, "output": {"answer": result}}
