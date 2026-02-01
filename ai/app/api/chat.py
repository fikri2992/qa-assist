from __future__ import annotations

from fastapi import APIRouter, Depends

from ai.models.requests import ChatRequest
from ai.services.orchestrator import Orchestrator
from ai.services.orchestrator_provider import get_orchestrator

router = APIRouter()


@router.post("/chat")
def chat(payload: ChatRequest, orchestrator: Orchestrator = Depends(get_orchestrator)) -> dict:
    return orchestrator.chat(
        payload.session,
        payload.analysis,
        payload.events,
        payload.message,
        payload.mode,
        payload.model,
        payload.resources,
        payload.images,
    )
