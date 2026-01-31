"""
Root Agent for QA Assist AI

This is the main orchestrator agent that coordinates all sub-agents.
Required by ADK CLI tools (adk web, adk run).
"""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent

from ai.agents.analysis import log_analyst, video_analyst, repro_planner, synthesizer

ROOT_AGENT_INSTRUCTION = """You are the QA Assist AI orchestrator.

Your role is to coordinate analysis of QA testing sessions by delegating to specialized agents:
- log_analyst: Analyzes console and network logs for errors
- video_analyst: Reviews recorded video for UI/UX issues  
- repro_planner: Generates reproduction steps from interactions
- synthesizer: Consolidates all findings into actionable insights

Based on the user's request, delegate to the appropriate agent(s) and synthesize their outputs.

For full session analysis:
1. Send logs to log_analyst
2. Send video to video_analyst
3. Send interactions to repro_planner
4. Consolidate with synthesizer

Return a comprehensive analysis report with:
- Summary of findings
- Prioritized issues
- Evidence supporting each issue
- Reproduction steps
- Suspected root cause
"""

root_agent = LlmAgent(
    name="qa_assist_orchestrator",
    model=os.getenv("ADK_TEXT_MODEL", "gemini-2.0-flash"),
    description="Main orchestrator for QA session analysis, coordinating specialized analysis agents",
    instruction=ROOT_AGENT_INSTRUCTION,
    sub_agents=[log_analyst, video_analyst, repro_planner, synthesizer],
)
