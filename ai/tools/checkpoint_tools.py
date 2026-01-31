"""Tools for checkpoint management."""
from __future__ import annotations

from typing import Any, Dict, Optional

from ai.services.checkpoints import CheckpointStore


def load_checkpoint_context(
    session_id: str,
    store: Optional[CheckpointStore] = None
) -> Dict[str, Any]:
    """Load checkpoint context for a session.
    
    Provides previous analysis context to avoid duplicate reporting
    and to track recurring issues.
    
    Args:
        session_id: The session ID to load checkpoint for
        store: Optional CheckpointStore instance (creates from env if not provided)
        
    Returns:
        Dictionary with checkpoint context including:
        - summary: Previous analysis summary
        - issue_count: Number of issues found so far
        - issues: List of previously found issues (limited)
        - repro_steps: Previously generated repro steps (limited)
    """
    if not session_id:
        return {}
        
    if store is None:
        store = CheckpointStore.from_env()
        
    checkpoint = store.load(session_id)
    if not checkpoint:
        return {}
        
    issues = checkpoint.get("issues", [])
    steps = checkpoint.get("repro_steps", [])
    
    return {
        "summary": checkpoint.get("summary"),
        "suspected_root_cause": checkpoint.get("suspected_root_cause"),
        "issue_count": len(issues),
        "issues": issues[:20] if isinstance(issues, list) else [],
        "repro_steps": steps[:20] if isinstance(steps, list) else [],
        "last_chunk_id": checkpoint.get("last_chunk_id"),
        "last_chunk_idx": checkpoint.get("last_chunk_idx"),
        "updated_at": checkpoint.get("updated_at"),
    }


def save_checkpoint(
    session_id: str,
    data: Dict[str, Any],
    store: Optional[CheckpointStore] = None
) -> Dict[str, Any]:
    """Save checkpoint data for a session.
    
    Args:
        session_id: The session ID to save checkpoint for
        data: Checkpoint data to save
        store: Optional CheckpointStore instance (creates from env if not provided)
        
    Returns:
        The saved checkpoint data with metadata
    """
    if not session_id:
        return {}
        
    if store is None:
        store = CheckpointStore.from_env()
        
    return store.save(session_id, data)
