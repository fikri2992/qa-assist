"""
QA Assist AI Agents Package

This package contains all ADK agents organized by domain:
- analysis/: Agents for analyzing logs, video, and generating repro steps
- chat/: Conversational QA assistant agent

The root_agent is the main orchestrator that coordinates all sub-agents.
"""
from __future__ import annotations

from ai.agents.agent import root_agent

__all__ = ["root_agent"]
