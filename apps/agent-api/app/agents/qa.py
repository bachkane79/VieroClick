"""
QA agent: answers natural-language questions about a project using RAG over knowledge_chunks.
"""
from typing import Any
from openai import AsyncOpenAI
import json

from app.settings import settings

client = AsyncOpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a knowledgeable project assistant with access to project documents,
decisions, task history, and activity logs. Answer questions accurately and concisely.
If information is unavailable, say so clearly.
"""


async def get_embedding(text: str) -> list[float]:
    response = await client.embeddings.create(
        model=settings.embedding_model,
        input=text,
    )
    return response.data[0].embedding


async def answer_question(
    question: str,
    context_chunks: list[str],
) -> str:
    context = "\n\n---\n\n".join(context_chunks)

    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {question}",
            },
        ],
    )

    return response.choices[0].message.content or ""
