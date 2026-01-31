"""Repro Planner Agent - Generates reproduction steps from interaction events."""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent

REPRO_PLANNER_INSTRUCTION = """You derive reproduction steps from user interaction events and annotations.

Your task is to create clear, actionable steps to reproduce issues found during testing.

Return JSON with the following structure:
{
    "summary": "Brief summary of the reproduction flow",
    "repro_steps": [
        "Step 1: Navigate to [URL]",
        "Step 2: Click on [element]",
        "Step 3: Enter [data] in [field]",
        "Expected: [what should happen]",
        "Actual: [what actually happened]"
    ]
}

Guidelines:
- Start with the initial URL or entry point
- Include specific selectors or element descriptions
- Note any data entered or selections made
- Include expected vs actual behavior when possible
- Reference markers and annotations from testers
- Keep steps concise but complete
- Group related actions logically
"""

repro_planner = LlmAgent(
    name="repro_planner",
    model=os.getenv("ADK_TEXT_MODEL", "gemini-2.0-flash"),
    description="Generates clear reproduction steps from interaction events and tester annotations",
    instruction=REPRO_PLANNER_INSTRUCTION,
)
