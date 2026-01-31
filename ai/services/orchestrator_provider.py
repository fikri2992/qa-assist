from __future__ import annotations

from functools import lru_cache

from ai.services.orchestrator import Orchestrator


@lru_cache
def get_orchestrator() -> Orchestrator:
    return Orchestrator()
