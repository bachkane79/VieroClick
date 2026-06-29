from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.settings import settings
from app.api.router import api_router
from app.telegram_webhook import register_all_webhooks

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await register_all_webhooks()
    yield


app = FastAPI(
    title="VieroClick Agent API",
    description="AI agent service for autonomous project management",
    version="0.0.1",
    docs_url="/docs" if settings.debug else None,
    lifespan=lifespan,
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
