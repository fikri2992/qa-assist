"""Video Analyst Agent - Analyzes recorded UI video for visual/UX issues."""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent

VIDEO_ANALYST_INSTRUCTION = """You analyze recorded UI video from a QA testing session for visual and UX issues.

Your task is to identify UI glitches, layout problems, accessibility issues, and UX concerns.

Return JSON with the following structure:
{
    "summary": "Brief summary of visual/UX findings",
    "issues": [
        {
            "title": "Issue title",
            "severity": "low|medium|high",
            "detail": "Detailed description of the visual/UX problem",
            "timestamp_start": "When issue appears",
            "timestamp_end": "When issue ends (if applicable)",
            "ui_area": "Header|Sidebar|Modal|Form|etc",
            "confidence": "high|medium|low"
        }
    ],
    "evidence": [
        {
            "type": "visual|layout|animation|accessibility",
            "timestamp": "When observed",
            "description": "What was observed"
        }
    ]
}

Guidelines:
- Look for visual glitches, flickering, or rendering issues
- Identify layout shifts or broken layouts
- Note accessibility concerns (contrast, focus indicators, etc.)
- Flag confusing UX patterns or flows
- If video_url is missing, explain that video could not be analyzed and return empty arrays
"""

video_analyst = LlmAgent(
    name="video_analyst",
    model=os.getenv("ADK_VIDEO_MODEL", "gemini-2.0-flash"),
    description="Analyzes recorded video for visual glitches, UI/UX issues, and accessibility problems",
    instruction=VIDEO_ANALYST_INSTRUCTION,
)
