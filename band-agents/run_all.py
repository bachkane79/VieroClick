"""
run_all.py
Launch the local agent service (FastAPI/uvicorn).

The 6 agents no longer connect to Band.ai. They are exposed over plain local
HTTP and triggered by the VieroClick web app (or any caller) via:

    POST http://localhost:8001/agents/{role}

Usage:
    python run_all.py
"""
import logging
import os

from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)-18s] %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)

load_dotenv()
logger = logging.getLogger("run_all")


def main():
    import uvicorn

    host = os.getenv("AGENT_SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("AGENT_SERVICE_PORT", "8001"))

    logger.info("=" * 60)
    logger.info("🤖 VieroClick Local Agent Service (6 agents, no Band.ai)")
    logger.info("=" * 60)
    logger.info("  POST /agents/planning          — generate & apply project plan")
    logger.info("  POST /agents/assignment        — calculate & apply task assignments")
    logger.info("  POST /agents/observer          — project health scan → suggestions")
    logger.info("  POST /agents/daily_report      — compile pending leader report")
    logger.info("  POST /agents/morning_briefing  — per-member briefings + notifications")
    logger.info("  POST /agents/project_qa        — context Q&A + project-hole detection")
    logger.info("  GET  /health")
    logger.info("=" * 60)
    logger.info("Listening on http://%s:%s", host, port)

    uvicorn.run("server:app", host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
