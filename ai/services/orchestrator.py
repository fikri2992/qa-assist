"""
Orchestrator - Main service for coordinating QA analysis.

Provides both stub (non-LLM) and ADK-powered analysis depending on configuration.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class AgentResult:
    name: str
    summary: str
    issues: List[Dict[str, Any]]
    evidence: List[Dict[str, Any]]
    steps: List[str]


def _event_text(event: Dict[str, Any]) -> str:
    payload = event.get("payload", {})
    if event.get("type") == "interaction":
        return f"{payload.get('action')} {payload.get('selector')}"
    if event.get("type") == "console":
        return payload.get("message", "")
    if event.get("type") == "network":
        return f"{payload.get('status')} {payload.get('url')}"
    return str(payload)


class BaseAgent:
    name = "agent"

    def run(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> AgentResult:
        raise NotImplementedError


class LogAnalyst(BaseAgent):
    name = "log_analyst"

    def run(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> AgentResult:
        from ai.tools.event_tools import extract_error_events
        
        issues: List[Dict[str, Any]] = []
        evidence: List[Dict[str, Any]] = []
        
        for event in extract_error_events(events):
            if event.get("type") == "console":
                message = str(event.get("payload", {}).get("message", ""))
                issues.append({
                    "title": "Console error detected",
                    "severity": "medium",
                    "detail": message,
                    "ts": event.get("ts"),
                })
                evidence.append({"type": "console", "message": message, "ts": event.get("ts")})
            elif event.get("type") == "network":
                status = event.get("payload", {}).get("status")
                url = event.get("payload", {}).get("url", "")
                issues.append({
                    "title": "Network error detected",
                    "severity": "medium",
                    "detail": f"{status} {url}",
                    "ts": event.get("ts"),
                })
                evidence.append({"type": "network", "status": status, "url": url, "ts": event.get("ts")})

        summary = "No console errors detected." if not issues else "Console errors detected in this chunk."
        return AgentResult(self.name, summary, issues, evidence, [])


class VideoAnalyst(BaseAgent):
    name = "video_analyst"

    def run(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> AgentResult:
        return AgentResult(self.name, "Video analysis stub.", [], [], [])


class ReproPlanner(BaseAgent):
    name = "repro_planner"

    def run(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> AgentResult:
        from ai.tools.event_tools import filter_interaction_events
        
        steps: List[str] = []
        for event in filter_interaction_events(events):
            event_type = event.get("type")
            if event_type == "interaction":
                text = _event_text(event)
                if text:
                    steps.append(text)
            elif event_type == "marker":
                label = event.get("payload", {}).get("label") or event.get("payload", {}).get("message")
                if label:
                    steps.append(f"Marker: {label}")
            elif event_type == "annotation":
                text = event.get("payload", {}).get("text")
                if text:
                    steps.append(f"Annotation: {text}")
                    
        summary = "Repro steps derived from interaction events." if steps else "No interaction steps captured."
        return AgentResult(self.name, summary, [], [], steps)


class Synthesizer(BaseAgent):
    name = "synthesizer"

    def run(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> AgentResult:
        return AgentResult(self.name, "Synthesizer stub.", [], [], [])


class StubOrchestrator:
    """Non-LLM orchestrator for testing and fallback."""
    
    def __init__(self) -> None:
        self.agents = [LogAnalyst(), VideoAnalyst(), ReproPlanner(), Synthesizer()]
        self.use_llm = bool(os.getenv("GEMINI_API_KEY"))

    def analyze_chunk(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> Dict[str, Any]:
        results = [agent.run(session, chunk, events) for agent in self.agents]
        issues = [issue for result in results for issue in result.issues]
        evidence = [item for result in results for item in result.evidence]
        steps = [step for result in results for step in result.steps]
        summary = self._summarize(results, issues)
        suspected_root_cause = issues[0]["detail"] if issues else None

        return {
            "summary": summary,
            "suspected_root_cause": suspected_root_cause,
            "issues": issues,
            "evidence": evidence,
            "repro_steps": steps,
            "agents": [result.__dict__ for result in results],
            "chunk_id": chunk.get("id"),
            "session_id": session.get("id"),
        }

    def aggregate_session(self, session: Dict[str, Any], chunk_reports: List[Dict[str, Any]]) -> Dict[str, Any]:
        issues = [issue for report in chunk_reports for issue in report.get("issues", [])]
        evidence = [item for report in chunk_reports for item in report.get("evidence", [])]
        steps = [step for report in chunk_reports for step in report.get("repro_steps", [])]

        summary = (
            f"{len(issues)} total issues detected across {len(chunk_reports)} chunks."
            if chunk_reports
            else "No chunk analysis available."
        )

        return {
            "summary": summary,
            "issues": issues,
            "evidence": evidence,
            "repro_steps": steps,
            "session_id": session.get("id"),
        }

    def _summarize(self, results: List[AgentResult], issues: List[Dict[str, Any]]) -> str:
        if self.use_llm:
            try:
                import google.generativeai as genai

                genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
                model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")
                model = genai.GenerativeModel(model_name)
                prompt = "Summarize QA findings from this chunk. Issues: " + str(issues)
                response = model.generate_content(prompt)
                return response.text.strip()
            except Exception:
                pass

        if not issues:
            return "No obvious issues detected in this chunk."
        return "Potential issues detected in this chunk."


def _should_use_adk() -> bool:
    """Check if ADK should be enabled based on environment."""
    adk_enabled = os.getenv("ADK_ENABLED", "true").lower() in {"1", "true", "yes"}
    google_key = os.getenv("GOOGLE_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not google_key and gemini_key:
        os.environ["GOOGLE_API_KEY"] = gemini_key
        google_key = gemini_key
    return adk_enabled and bool(google_key)


class Orchestrator:
    """Main orchestrator that delegates to ADK or stub implementation."""
    
    def __init__(self) -> None:
        self.stub = StubOrchestrator()
        self.adk = None
        if _should_use_adk():
            try:
                from ai.services.adk_orchestrator import AdkOrchestrator
                self.adk = AdkOrchestrator()
            except Exception:
                self.adk = None

    def analyze_chunk(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> Dict[str, Any]:
        if self.adk:
            return self.adk.analyze_chunk(session, chunk, events)
        return self.stub.analyze_chunk(session, chunk, events)

    def aggregate_session(self, session: Dict[str, Any], chunk_reports: List[Dict[str, Any]]) -> Dict[str, Any]:
        if self.adk:
            return self.adk.aggregate_session(session, chunk_reports)
        return self.stub.aggregate_session(session, chunk_reports)

    def chat(
        self,
        session: Dict[str, Any],
        analysis: Dict[str, Any],
        events: List[Dict[str, Any]],
        message: str,
        mode: str,
        model: str
    ) -> Dict[str, Any]:
        if self.adk:
            return self.adk.chat(session, analysis, events, message, mode, model)
        return self._stub_chat(session, analysis, events, message, mode, model)

    def _stub_chat(
        self,
        session: Dict[str, Any],
        analysis: Dict[str, Any],
        _events: List[Dict[str, Any]],
        message: str,
        mode: str,
        model: str
    ) -> Dict[str, Any]:
        summary = analysis.get("summary") if isinstance(analysis, dict) else None
        response = "ADK is disabled. "
        if summary:
            response += f"Latest analysis summary: {summary}"
        else:
            response += "No analysis summary available yet."
        return {
            "reply": response,
            "mode": mode,
            "model": model,
            "session_id": session.get("id") if isinstance(session, dict) else None,
            "message": message
        }
