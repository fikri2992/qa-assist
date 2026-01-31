from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List
import os


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
        issues: List[Dict[str, Any]] = []
        evidence: List[Dict[str, Any]] = []
        for event in events:
            if event.get("type") != "console":
                continue
            message = str(event.get("payload", {}).get("message", ""))
            level = str(event.get("payload", {}).get("level", ""))
            if "error" in message.lower() or level.lower() in {"error", "fatal"}:
                issues.append(
                    {
                        "title": "Console error detected",
                        "severity": "medium",
                        "detail": message,
                        "ts": event.get("ts"),
                    }
                )
                evidence.append({"type": "console", "message": message, "ts": event.get("ts")})

        summary = "No console errors detected." if not issues else "Console errors detected in this chunk."
        return AgentResult(self.name, summary, issues, evidence, [])


class VideoAnalyst(BaseAgent):
    name = "video_analyst"

    def run(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> AgentResult:
        return AgentResult(self.name, "Video analysis stub.", [], [], [])


class ReproPlanner(BaseAgent):
    name = "repro_planner"

    def run(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> AgentResult:
        steps: List[str] = []
        for event in events:
            if event.get("type") != "interaction":
                continue
            text = _event_text(event)
            if text:
                steps.append(text)
        summary = "Repro steps derived from interaction events." if steps else "No interaction steps captured."
        return AgentResult(self.name, summary, [], [], steps)


class Synthesizer(BaseAgent):
    name = "synthesizer"

    def run(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> AgentResult:
        return AgentResult(self.name, "Synthesizer stub.", [], [], [])


class Orchestrator:
    def __init__(self) -> None:
        self.agents = [LogAnalyst(), VideoAnalyst(), ReproPlanner(), Synthesizer()]
        self.use_llm = bool(os.getenv("GEMINI_API_KEY"))

    def analyze_chunk(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> Dict[str, Any]:
        results = [agent.run(session, chunk, events) for agent in self.agents]
        issues = [issue for result in results for issue in result.issues]
        evidence = [item for result in results for item in result.evidence]
        steps = [step for result in results for step in result.steps]
        summary = self._summarize(results, issues)

        return {
            "summary": summary,
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
