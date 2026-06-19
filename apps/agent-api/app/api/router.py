from fastapi import APIRouter
from app.api.routes import band, jobs, suggestions, telegram

api_router = APIRouter()
api_router.include_router(band.router, prefix="/band", tags=["band"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(suggestions.router, prefix="/suggestions", tags=["suggestions"])
api_router.include_router(telegram.router, prefix="/telegram", tags=["telegram"])
