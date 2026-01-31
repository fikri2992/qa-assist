from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from ai.services.checkpoints import CheckpointStore


def test_append_and_load(tmp_path) -> None:
    store = CheckpointStore(base_dir=tmp_path, ttl_hours=48)
    report = {
        "chunk_id": "chunk-1",
        "chunk_idx": 1,
        "summary": "ok",
        "issues": [{"title": "Console error"}],
        "evidence": [{"type": "console"}],
        "repro_steps": ["click button"],
        "suspected_root_cause": "Missing handler",
    }
    store.append_chunk("session-1", report)
    state = store.load("session-1")

    assert state["session_id"] == "session-1"
    assert state["last_chunk_id"] == "chunk-1"
    assert state["last_chunk_idx"] == 1
    assert len(state["chunk_reports"]) == 1
    assert state["summary"] == "ok"
    assert state["issues"][0]["title"] == "Console error"


def test_ttl_cleanup(tmp_path) -> None:
    path = tmp_path / "session-2.json"
    stale = {
        "session_id": "session-2",
        "updated_at": (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat(),
        "chunk_reports": [],
    }
    path.write_text(json.dumps(stale), encoding="utf-8")

    store = CheckpointStore(base_dir=tmp_path, ttl_hours=1)
    assert store.load("session-2") == {}
    assert not path.exists()
