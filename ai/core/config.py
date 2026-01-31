from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    app_name: str = "QA Assist AI"
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8000"))
    log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()
    checkpoint_dir: str = os.getenv(
        "CHECKPOINT_DIR", str(Path(__file__).resolve().parents[1] / ".checkpoints")
    )
    checkpoint_ttl_hours: int = int(os.getenv("CHECKPOINT_TTL_HOURS", "48"))


settings = Settings()
