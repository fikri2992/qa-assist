from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Any, Dict, List
from dotenv import load_dotenv

from orchestrator import Orchestrator

load_dotenv()

app = FastAPI(title="QA Assist AI")

orchestrator = Orchestrator()


class AnalyzeRequest(BaseModel):
    session: Dict[str, Any]
    chunk: Dict[str, Any]
    events: List[Dict[str, Any]] = Field(default_factory=list)


class AggregateRequest(BaseModel):
    session: Dict[str, Any]
    chunk_reports: List[Dict[str, Any]] = Field(default_factory=list)


class ChatRequest(BaseModel):
    session: Dict[str, Any]
    analysis: Dict[str, Any] = Field(default_factory=dict)
    events: List[Dict[str, Any]] = Field(default_factory=list)
    message: str
    mode: str = "investigate"
    model: str = "default"


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
