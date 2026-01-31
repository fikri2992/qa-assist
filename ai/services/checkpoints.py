from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict

from ai.core.config import settings


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _sanitize_session_id(session_id: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in session_id)


@dataclass
class CheckpointStore:
    base_dir: Path
    ttl_hours: int = 48

    @classmethod
    def from_env(cls) -> "CheckpointStore":
        raw_dir = os.getenv("CHECKPOINT_DIR")
        base_dir = Path(raw_dir) if raw_dir and raw_dir.strip() else Path(settings.checkpoint_dir)
        raw_ttl = os.getenv("CHECKPOINT_TTL_HOURS")
        ttl_hours = int(raw_ttl) if raw_ttl and raw_ttl.strip() else settings.checkpoint_ttl_hours
        return cls(base_dir=base_dir, ttl_hours=ttl_hours)

    def load(self, session_id: str) -> Dict[str, Any]:
        if not session_id:
            return {}
        path = self._path(session_id)
        if not path.exists():
            return {}

        data = self._read(path)
        if not data:
            path.unlink(missing_ok=True)
            return {}

        if self._is_expired(path, data):
            path.unlink(missing_ok=True)
            return {}

        return data

    def save(self, session_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        if not session_id:
            return {}
        self.base_dir.mkdir(parents=True, exist_ok=True)
        payload = dict(data)
        payload["session_id"] = session_id
        payload["updated_at"] = _now().isoformat()
        self._write(self._path(session_id), payload)
        return payload

    def append_chunk(self, session_id: str, chunk_report: Dict[str, Any]) -> Dict[str, Any]:
        if not session_id:
            return {}
        state = self.load(session_id)
        chunk_reports = list(state.get("chunk_reports", []))
        chunk_reports.append(chunk_report)

        issues = [issue for report in chunk_reports for issue in report.get("issues", [])]
        evidence = [item for report in chunk_reports for item in report.get("evidence", [])]
        repro_steps = [step for report in chunk_reports for step in report.get("repro_steps", [])]

        state.update(
            {
                "chunk_reports": chunk_reports,
                "issues": issues,
                "evidence": evidence,
                "repro_steps": repro_steps,
                "summary": chunk_report.get("summary") or state.get("summary"),
                "suspected_root_cause": chunk_report.get("suspected_root_cause")
                or state.get("suspected_root_cause"),
                "last_chunk_id": chunk_report.get("chunk_id") or state.get("last_chunk_id"),
                "last_chunk_idx": chunk_report.get("chunk_idx") or state.get("last_chunk_idx"),
            }
        )
        return self.save(session_id, state)

    def _path(self, session_id: str) -> Path:
        safe = _sanitize_session_id(session_id)
        return self.base_dir / f"{safe}.json"

    def _read(self, path: Path) -> Dict[str, Any]:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}

    def _write(self, path: Path, data: Dict[str, Any]) -> None:
        tmp_path = path.with_suffix(f".{uuid.uuid4().hex}.tmp")
        tmp_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp_path, path)

    def _is_expired(self, path: Path, data: Dict[str, Any]) -> bool:
        if self.ttl_hours <= 0:
            return False
        cutoff = _now() - timedelta(hours=self.ttl_hours)
        updated_at = _parse_ts(data.get("updated_at"))
        if updated_at is None:
            try:
                updated_at = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
            except OSError:
                return False
        return updated_at < cutoff
