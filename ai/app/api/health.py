from __future__ import annotations

import os

from fastapi import APIRouter

from ai.services.orchestrator import _should_use_adk

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "adk_enabled": _should_use_adk(),
        "adk_text_model": os.getenv("ADK_TEXT_MODEL", "gemini-3-flash"),
        "adk_video_model": os.getenv("ADK_VIDEO_MODEL", "gemini-3-pro-preview"),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-1.5-pro"),
    }
