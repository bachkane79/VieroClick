from fastapi import APIRouter
from app.api.routes import agents, jobs, suggestions, telegram

api_router = APIRouter()
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(suggestions.router, prefix="/suggestions", tags=["suggestions"])
api_router.include_router(telegram.router, prefix="/telegram", tags=["telegram"])
