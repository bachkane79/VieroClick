"""
QA agent: answers natural-language questions about a project using RAG over knowledge_chunks.
"""
from app.agents.gemini_client import embed, generate

SYSTEM_PROMPT = """You are a knowledgeable project assistant with access to project documents,
decisions, task history, and activity logs. Answer questions accurately and concisely.
If information is unavailable, say so clearly.
"""


async def get_embedding(text: str) -> list[float]:
    return await embed(text)


async def answer_question(
    question: str,
    context_chunks: list[str],
) -> str:
    context = "\n\n---\n\n".join(context_chunks)
    return await generate(
        SYSTEM_PROMPT,
        f"Context:\n{context}\n\nQuestion: {question}",
    )
