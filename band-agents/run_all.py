"""
run_all.py
Launch all 6 Band agents concurrently.

Each agent connects to Band via WebSocket and listens for @mentions.
They run indefinitely until interrupted (Ctrl+C).

Usage:
    python run_all.py
"""
import asyncio
import logging
import signal
import sys
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)-20s] %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)

load_dotenv()
logger = logging.getLogger("run_all")

from agents.planning.main import run_planning
from agents.assignment.main import run_assignment
from agents.observer.main import run_observer
from agents.daily_report.main import run_daily_report
from agents.morning_briefing.main import run_morning_briefing
from agents.project_qa.main import run_project_qa


async def main():
    logger.info("=" * 60)
    logger.info("🤖 VieroClick × Band AI Multi-Agent Pipeline (6 Agents)")
    logger.info("=" * 60)
    logger.info("")
    logger.info("Starting 6 agents:")
    logger.info("  1. @planning         — Planning roadmap suggested to suggestions")
    logger.info("  2. @assignment       — Task Allocation rule-based score suggestions")
    logger.info("  3. @observer         — Project health scan alert suggestions")
    logger.info("  4. @daily_report     — Daily summary saved to pending leader reports")
    logger.info("  5. @morning_briefing  — Personal member briefings via Web & Telegram")
    logger.info("  6. @project_qa       — Context Q&A & project holes suggestion logging")
    logger.info("")
    logger.info("=" * 60)

    # Run all 6 agents concurrently
    tasks = [
        asyncio.create_task(run_planning(),         name="planning"),
        asyncio.create_task(run_assignment(),       name="assignment"),
        asyncio.create_task(run_observer(),         name="observer"),
        asyncio.create_task(run_daily_report(),     name="daily_report"),
        asyncio.create_task(run_morning_briefing(), name="morning_briefing"),
        asyncio.create_task(run_project_qa(),       name="project_qa"),
    ]

    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        logger.info("Shutting down all agents...")
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        logger.info("All agents stopped.")


def handle_shutdown(signum, frame):
    logger.info(f"Received signal {signum} — shutting down")
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    asyncio.run(main())
