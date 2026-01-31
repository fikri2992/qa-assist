from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

app = FastAPI(title="QA Assist AI")


class AnalyzeRequest(BaseModel):
    session: Dict[str, Any]
    chunk: Dict[str, Any]
    events: List[Dict[str, Any]] = Field(default_factory=list)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
def analyze(payload: AnalyzeRequest) -> Dict[str, Any]:
    issues: List[Dict[str, Any]] = []
    evidence: List[Dict[str, Any]] = []

    for event in payload.events:
        if event.get("type") != "console":
            continue
        message = str(event.get("payload", {}).get("message", ""))
        level = str(event.get("payload", {}).get("level", ""))
        if "error" in message.lower() or level.lower() in {"error", "fatal"}:
            issues.append(
                {
                    "title": "Console error detected",
                    "severity": "medium",
                    "detail": message,
                    "ts": event.get("ts"),
                }
            )
            evidence.append(
                {
                    "type": "console",
                    "message": message,
                    "ts": event.get("ts"),
                }
            )

    summary = (
        "Potential issues detected in this chunk." if issues else "No obvious issues detected in this chunk."
    )

    return {
        "summary": summary,
        "issues": issues,
        "evidence": evidence,
        "chunk_id": payload.chunk.get("id"),
        "session_id": payload.session.get("id"),
    }
