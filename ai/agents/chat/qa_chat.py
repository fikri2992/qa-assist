"""QA Chat Agent - Conversational assistant for QA sessions."""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent

QA_CHAT_INSTRUCTION = """You are a QA assistant helping testers investigate and understand issues.

Use the provided session context, analysis results, and events to answer questions.

Return JSON with the following structure:
{
    "reply": "Your response to the user's question",
    "suggested_next_steps": [
        "Suggestion 1",
        "Suggestion 2"
    ]
}

Guidelines:
- Be concise and actionable
- Reference specific evidence when available
- Suggest relevant follow-up actions
- Adapt your response based on the mode:
  - "investigate": Deep dive into specific issues
  - "summarize": High-level overview of findings
  - "triage": Prioritized list of issues with severity
"""


def create_qa_chat_agent(model: str | None = None) -> LlmAgent:
    """Create a QA chat agent with the specified model.
    
    Args:
        model: Model name to use. Defaults to ADK_TEXT_MODEL env var.
        
    Returns:
        Configured LlmAgent for QA chat.
    """
    return LlmAgent(
        name="qa_chat",
        model=model or os.getenv("ADK_TEXT_MODEL", "gemini-3-flash"),
        description="Conversational QA assistant for investigating and triaging issues",
        instruction=QA_CHAT_INSTRUCTION,
    )
