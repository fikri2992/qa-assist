from __future__ import annotations

from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI

from ai.models.requests import AggregateRequest, AnalyzeRequest, ChatRequest
from ai.services.orchestrator import Orchestrator

load_dotenv()

app = FastAPI(title="QA Assist AI")

orchestrator = Orchestrator()


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
def analyze(payload: AnalyzeRequest) -> Dict[str, Any]:
    return orchestrator.analyze_chunk(payload.session, payload.chunk, payload.events)


@app.post("/aggregate")
def aggregate(payload: AggregateRequest) -> Dict[str, Any]:
    return orchestrator.aggregate_session(payload.session, payload.chunk_reports)


@app.post("/chat")
def chat(payload: ChatRequest) -> Dict[str, Any]:
    return orchestrator.chat(payload.session, payload.analysis, payload.events, payload.message, payload.mode, payload.model)
