from __future__ import annotations

import os

from fastapi.testclient import TestClient

os.environ["ADK_ENABLED"] = "false"

from ai.app.main import app  # noqa: E402


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "adk_enabled" in data
    assert "adk_text_model" in data
    assert "adk_video_model" in data


def test_analyze_stub() -> None:
    payload = {
        "session": {"id": "session-1"},
        "chunk": {"id": "chunk-1"},
        "events": [],
    }
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "issues" in data
    assert data["chunk_id"] == "chunk-1"


def test_chat_stub() -> None:
    payload = {
        "session": {"id": "session-1"},
        "analysis": {"summary": "ok"},
        "events": [],
        "message": "hello",
        "mode": "investigate",
        "model": "default",
    }
    response = client.post("/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
