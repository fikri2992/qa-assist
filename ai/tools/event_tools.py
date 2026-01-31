"""Tools for filtering and processing events."""
from __future__ import annotations

from typing import Any, Dict, List


def filter_console_events(events: List[Dict[str, Any]], limit: int = 200) -> List[Dict[str, Any]]:
    """Filter events to only console logs.
    
    Args:
        events: List of event dictionaries
        limit: Maximum number of events to return
        
    Returns:
        Filtered list of console events
    """
    filtered = [e for e in events if e.get("type") == "console"]
    return filtered[-limit:]


def filter_network_events(events: List[Dict[str, Any]], limit: int = 200) -> List[Dict[str, Any]]:
    """Filter events to only network requests.
    
    Args:
        events: List of event dictionaries
        limit: Maximum number of events to return
        
    Returns:
        Filtered list of network events
    """
    filtered = [e for e in events if e.get("type") == "network"]
    return filtered[-limit:]


def filter_interaction_events(events: List[Dict[str, Any]], limit: int = 200) -> List[Dict[str, Any]]:
    """Filter events to interactions, markers, and annotations.
    
    Args:
        events: List of event dictionaries
        limit: Maximum number of events to return
        
    Returns:
        Filtered list of interaction-related events
    """
    allowed = {"interaction", "marker", "annotation"}
    filtered = [e for e in events if e.get("type") in allowed]
    return filtered[-limit:]


def extract_error_events(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract events that indicate errors.
    
    Args:
        events: List of event dictionaries
        
    Returns:
        List of events containing errors
    """
    errors = []
    for event in events:
        event_type = event.get("type")
        payload = event.get("payload", {})
        
        if event_type == "console":
            level = str(payload.get("level", "")).lower()
            message = str(payload.get("message", "")).lower()
            if level in {"error", "fatal"} or "error" in message:
                errors.append(event)
                
        elif event_type == "network":
            status = payload.get("status")
            if isinstance(status, (int, float)) and int(status) >= 400:
                errors.append(event)
                
    return errors
