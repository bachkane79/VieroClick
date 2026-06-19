"""
run_all.py
Launch all 5 Band agents concurrently.

Each agent connects to Band via WebSocket and listens for @mentions.
They run indefinitely until interrupted (Ctrl+C).

Usage:
    python run_all.py

Requirements:
    - agent_config.yaml with Band agent IDs and API keys
    - .env with LLM API keys and VieroClick config
    - Band room created with all 5 agents and the human user invited
"""
import asyncio
import logging
import signal
import sys
from dotenv import load_dotenv

# Configure logging before anything else
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)-20s] %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)

load_dotenv()
logger = logging.getLogger("run_all")

from agents.planner.main import run_planner
from agents.developer.main import run_developer
from agents.qa.main import run_qa
from agents.reviewer.main import run_reviewer
from agents.notifier.main import run_notifier


async def main():
    logger.info("=" * 60)
    logger.info("🤖 VieroClick × Band AI Multi-Agent Pipeline")
    logger.info("=" * 60)
    logger.info("")
    logger.info("Starting 5 agents:")
    logger.info("  1. @planner    — Planner (Abstract breakdown & Milestones)")
    logger.info("  2. @developer  — Assigner (Allocates tasks to Người 1, 2, 3)")
    logger.info("  3. @qa_agent   — QA Chatbot (Standalone Q&A for project info)")
    logger.info("  4. @reviewer   — Reporter (Morning/Evening comparison reports)")
    logger.info("  5. @notifier   — Notifier (Syncs tasks & assignees to VieroClick)")
    logger.info("")
    logger.info("Pipeline flow:")
    logger.info("  Human → @planner → [approve] → @notifier → @developer → @notifier → VieroClick DB")
    logger.info("  Standalone: @qa_agent [Question] | @reviewer [sáng/tối]")
    logger.info("=" * 60)


    # Run all 5 agents concurrently
    tasks = [
        asyncio.create_task(run_planner(),   name="planner"),
        asyncio.create_task(run_developer(), name="developer"),
        asyncio.create_task(run_qa(),        name="qa"),
        asyncio.create_task(run_reviewer(),  name="reviewer"),
        asyncio.create_task(run_notifier(),  name="notifier"),
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
