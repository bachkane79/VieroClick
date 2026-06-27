from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.settings import settings
from app.api.router import api_router

logger = structlog.get_logger()

app = FastAPI(
    title="VieroClick Agent API",
    description="AI agent service for autonomous project management",
    version="0.0.1",
    docs_url="/docs" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
