from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Any, Dict, List

from orchestrator import Orchestrator

app = FastAPI(title="QA Assist AI")

orchestrator = Orchestrator()


class AnalyzeRequest(BaseModel):
    session: Dict[str, Any]
    chunk: Dict[str, Any]
    events: List[Dict[str, Any]] = Field(default_factory=list)


class AggregateRequest(BaseModel):
    session: Dict[str, Any]
    chunk_reports: List[Dict[str, Any]] = Field(default_factory=list)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
def analyze(payload: AnalyzeRequest) -> Dict[str, Any]:
    return orchestrator.analyze_chunk(payload.session, payload.chunk, payload.events)


@app.post("/aggregate")
def aggregate(payload: AggregateRequest) -> Dict[str, Any]:
    return orchestrator.aggregate_session(payload.session, payload.chunk_reports)
