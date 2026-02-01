"""Synthesizer Agent - Consolidates findings from all analysis agents."""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent

SYNTHESIZER_INSTRUCTION = """You consolidate findings from multiple analysis agents into a coherent summary.

Your task is to synthesize log analysis, video analysis, and reproduction steps into actionable insights.

Return JSON with the following structure:
{
    "summary": "Executive summary of all findings (2-3 sentences)",
    "suspected_root_cause": "Most likely root cause based on evidence",
    "severity_breakdown": {
        "high": 0,
        "medium": 0,
        "low": 0
    },
    "top_issues": [
        {
            "title": "Issue title",
            "severity": "high|medium|low",
            "detail": "Brief description",
            "source": "log_analyst|video_analyst"
        }
    ]
}

Guidelines:
- Prioritize issues by severity and impact
- Correlate findings across different sources (logs + video)
- Identify patterns that suggest root causes
- Keep the summary actionable and concise
- Limit top_issues to the 5 most important findings
- Consider the testing context and environment
"""

synthesizer = LlmAgent(
    name="synthesizer",
    model=os.getenv("ADK_TEXT_MODEL", "gemini-3-flash"),
    description="Consolidates findings from all analysis agents into actionable insights",
    instruction=SYNTHESIZER_INSTRUCTION,
)
