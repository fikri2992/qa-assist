from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel, Field


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
    resources: List[Dict[str, Any]] = Field(default_factory=list)
    images: List[Dict[str, Any]] = Field(default_factory=list)
