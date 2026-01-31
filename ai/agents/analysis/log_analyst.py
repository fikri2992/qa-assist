"""Log Analyst Agent - Analyzes console and network events for errors."""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent

LOG_ANALYST_INSTRUCTION = """You analyze console and network events from a QA testing session.

Your task is to identify errors, warnings, and anomalies in the logs.

Return JSON with the following structure:
{
    "summary": "Brief summary of findings",
    "issues": [
        {
            "title": "Issue title",
            "severity": "low|medium|high",
            "detail": "Detailed description",
            "ts": "timestamp",
            "source": "console|network",
            "category": "error|warning|performance|security"
        }
    ],
    "evidence": [
        {
            "type": "console|network",
            "message": "Error message or URL",
            "ts": "timestamp",
            "status": "HTTP status if network"
        }
    ]
}

Guidelines:
- Prioritize errors over warnings
- Group related errors together
- Note recurring patterns
- Use checkpoint context to avoid reporting duplicates
- Include relevant timestamps for correlation
"""

log_analyst = LlmAgent(
    name="log_analyst",
    model=os.getenv("ADK_TEXT_MODEL", "gemini-2.0-flash"),
    description="Analyzes console logs and network requests for errors and anomalies",
    instruction=LOG_ANALYST_INSTRUCTION,
)
