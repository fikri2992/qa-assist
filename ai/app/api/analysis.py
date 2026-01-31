from __future__ import annotations

from fastapi import APIRouter, Depends

from ai.models.requests import AggregateRequest, AnalyzeRequest
from ai.services.orchestrator import Orchestrator
from ai.services.orchestrator_provider import get_orchestrator

router = APIRouter()


@router.post("/analyze")
def analyze(payload: AnalyzeRequest, orchestrator: Orchestrator = Depends(get_orchestrator)) -> dict:
    return orchestrator.analyze_chunk(payload.session, payload.chunk, payload.events)


@router.post("/aggregate")
def aggregate(payload: AggregateRequest, orchestrator: Orchestrator = Depends(get_orchestrator)) -> dict:
    return orchestrator.aggregate_session(payload.session, payload.chunk_reports)
