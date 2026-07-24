"""
Document preprocessing for the plan-intake flow.

Intake uploads (pdf / docx / xlsx / pptx / md / txt / csv …) are converted to
markdown with markitdown BEFORE being placed into the intake_review / planning
prompts, so the long-context LLMs read clean text instead of raw bytes.

markitdown is synchronous and CPU-bound, so conversion runs in a worker thread.
Conversion failures are non-fatal: the file is skipped with a short note so one
unreadable upload never sinks an intake run.
"""
from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from functools import lru_cache

from app.settings import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_markitdown():  # type: ignore[no-untyped-def]
    from markitdown import MarkItDown

    return MarkItDown()


@lru_cache(maxsize=1)
def _get_image_llm():  # type: ignore[no-untyped-def]
    """Sync OpenAI-compatible client for markitdown image captioning.

    Per requirement, image uploads are described by the cheap DeepSeek *flash*
    model (not pro) via the xKiro gateway. Returns (client, model) or None when
    no LLM key is configured (images then fall back to metadata-only). markitdown
    drives this client synchronously, which is safe because conversion runs in a
    worker thread (see to_markdown()).
    """
    if not settings.llm_api_key:
        return None
    from openai import OpenAI

    client = OpenAI(api_key=settings.llm_api_key, base_url=settings.llm_base_url)
    return client, settings.llm_qa_model


def _convert_sync(data: bytes, filename: str) -> str:
    md = _get_markitdown()
    # markitdown's most stable entry point is a path-based convert; the extension
    # drives converter selection, so preserve the original suffix.
    suffix = os.path.splitext(filename)[1] or ".bin"
    # Pass the flash LLM to the image converter (ignored for non-image types).
    llm = _get_image_llm()
    convert_kwargs = {"llm_client": llm[0], "llm_model": llm[1]} if llm else {}
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        result = md.convert(tmp_path, **convert_kwargs)
        return (result.text_content or "").strip()
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


async def to_markdown(data: bytes, filename: str) -> str:
    """Convert file bytes to markdown. Returns "" if conversion fails."""
    try:
        return await asyncio.to_thread(_convert_sync, data, filename)
    except Exception as e:  # noqa: BLE001 — best-effort; never crash an intake run
        logger.warning("markitdown failed for %s: %s", filename, e)
        return ""
