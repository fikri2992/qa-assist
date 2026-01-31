"""
ADK Orchestrator - Coordinates ADK agents for QA analysis.

Uses the agents defined in ai/agents/ package.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from google.adk.agents import LlmAgent
from google.adk.sessions import InMemorySessionService
from google.genai import types

from ai.services.checkpoints import CheckpointStore
from ai.agents.analysis import log_analyst, video_analyst, repro_planner, synthesizer
from ai.agents.chat import create_qa_chat_agent
from ai.tools.event_tools import filter_console_events, filter_network_events, filter_interaction_events
from ai.tools.checkpoint_tools import load_checkpoint_context

try:
    from google.adk.runners import Runner
except ImportError:  # pragma: no cover - fallback for older module layout
    from google.adk.runners.runner import Runner


@dataclass
class AgentOutput:
    name: str
    summary: str
    issues: List[Dict[str, Any]]
    evidence: List[Dict[str, Any]]
    repro_steps: List[str]
    root_cause: Optional[str] = None
    severity_breakdown: Dict[str, Any] = field(default_factory=dict)
    top_issues: List[Dict[str, Any]] = field(default_factory=list)


class AdkOrchestrator:
    """Orchestrates ADK agents for QA session analysis."""
    
    def __init__(self) -> None:
        self.app_name = "qa-assist-ai"
        self.user_id = "qa-assist"
        self.session_service = InMemorySessionService()
        self.checkpoints = CheckpointStore.from_env()

        self.text_model = os.getenv("ADK_TEXT_MODEL", "gemini-2.0-flash")
        self.video_model = os.getenv("ADK_VIDEO_MODEL", "gemini-2.0-flash")

        # Use agents from ai/agents/analysis/
        self.log_agent = log_analyst
        self.video_agent = video_analyst
        self.repro_agent = repro_planner
        self.synth_agent = synthesizer

    def analyze_chunk(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self._run_sync(self._analyze_chunk_async(session, chunk, events))

    def aggregate_session(self, session: Dict[str, Any], chunk_reports: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self._run_sync(self._aggregate_session_async(session, chunk_reports))

    def chat(
        self,
        session: Dict[str, Any],
        analysis: Dict[str, Any],
        events: List[Dict[str, Any]],
        message: str,
        mode: str,
        model: str
    ) -> Dict[str, Any]:
        return self._run_sync(self._chat_async(session, analysis, events, message, mode, model))

    async def analyze_chunk_async(
        self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        return await self._analyze_chunk_async(session, chunk, events)

    async def aggregate_session_async(
        self, session: Dict[str, Any], chunk_reports: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        return await self._aggregate_session_async(session, chunk_reports)

    async def chat_async(
        self,
        session: Dict[str, Any],
        analysis: Dict[str, Any],
        events: List[Dict[str, Any]],
        message: str,
        mode: str,
        model: str
    ) -> Dict[str, Any]:
        return await self._chat_async(session, analysis, events, message, mode, model)

    async def _analyze_chunk_async(
        self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        session_id = session.get("id") if isinstance(session, dict) else None
        checkpoint = self.checkpoints.load(session_id) if session_id else {}
        payload = self._build_payload(session, chunk, events, checkpoint)
        log_payload = self._build_log_payload(payload)
        repro_payload = self._build_repro_payload(payload)
        video_payload = self._build_video_payload(payload)

        log_result = await self._call_agent(self.log_agent, log_payload, "Analyze console/network logs.")
        video_result = await self._call_agent(self.video_agent, video_payload, "Analyze video for UI/UX issues.")
        repro_result = await self._call_agent(self.repro_agent, repro_payload, "Generate repro steps.")

        issues = log_result.issues + video_result.issues
        evidence = log_result.evidence + video_result.evidence
        repro_steps = repro_result.repro_steps

        synth_payload = {
            "session": {"id": session.get("id")},
            "chunk": {"id": chunk.get("id"), "idx": chunk.get("idx")},
            "log_summary": log_result.summary,
            "video_summary": video_result.summary,
            "issues": issues,
            "repro_steps": repro_steps,
            "environment": session.get("metadata", {}),
            "checkpoint": payload.get("checkpoint", {}),
        }
        synth = await self._call_agent(self.synth_agent, synth_payload, "Summarize findings.")

        severity_breakdown = synth.severity_breakdown or self._severity_breakdown(issues)
        top_issues = synth.top_issues or issues[:5]

        report = {
            "summary": synth.summary or "Analysis complete.",
            "suspected_root_cause": synth.root_cause,
            "severity_breakdown": severity_breakdown,
            "top_issues": top_issues,
            "issues": issues,
            "evidence": evidence,
            "repro_steps": repro_steps,
            "agents": [
                self._agent_dict(log_result),
                self._agent_dict(video_result),
                self._agent_dict(repro_result),
                self._agent_dict(synth),
            ],
            "chunk_id": chunk.get("id"),
            "chunk_idx": chunk.get("idx"),
            "session_id": session.get("id"),
        }
        if session_id:
            self.checkpoints.append_chunk(session_id, report)
        return report

    async def _aggregate_session_async(
        self, session: Dict[str, Any], chunk_reports: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        session_id = session.get("id") if isinstance(session, dict) else None
        if not chunk_reports and session_id:
            checkpoint = self.checkpoints.load(session_id)
            if checkpoint.get("chunk_reports"):
                chunk_reports = checkpoint["chunk_reports"]

        issues = [issue for report in chunk_reports for issue in report.get("issues", [])]
        evidence = [item for report in chunk_reports for item in report.get("evidence", [])]
        steps = [step for report in chunk_reports for step in report.get("repro_steps", [])]

        synth_payload = {
            "session": {"id": session.get("id")},
            "chunk_count": len(chunk_reports),
            "issues": issues,
            "evidence": evidence,
            "repro_steps": steps,
        }
        synth = await self._call_agent(self.synth_agent, synth_payload, "Summarize session-level findings.")

        summary = synth.summary or (
            f"{len(issues)} total issues detected across {len(chunk_reports)} chunks."
            if chunk_reports
            else "No chunk analysis available."
        )

        severity_breakdown = synth.severity_breakdown or self._severity_breakdown(issues)
        top_issues = synth.top_issues or issues[:8]

        report = {
            "summary": summary,
            "severity_breakdown": severity_breakdown,
            "top_issues": top_issues,
            "issues": issues,
            "evidence": evidence,
            "repro_steps": steps,
            "session_id": session.get("id"),
        }
        if session_id:
            checkpoint = self.checkpoints.load(session_id)
            checkpoint.update(
                {
                    "summary": summary,
                    "issues": issues,
                    "evidence": evidence,
                    "repro_steps": steps,
                }
            )
            self.checkpoints.save(session_id, checkpoint)
        return report

    async def _chat_async(
        self,
        session: Dict[str, Any],
        analysis: Dict[str, Any],
        events: List[Dict[str, Any]],
        message: str,
        mode: str,
        model: str
    ) -> Dict[str, Any]:
        session_id = session.get("id") if isinstance(session, dict) else None
        checkpoint = self.checkpoints.load(session_id) if session_id else {}
        prompt = {
            "instruction": self._mode_instruction(mode),
            "mode": mode,
            "user_message": message,
            "session": session,
            "analysis": analysis,
            "events": self._trim_events(events),
            "checkpoint": self._checkpoint_context(checkpoint),
        }
        # Use chat agent factory from ai/agents/chat/
        agent = create_qa_chat_agent(self._pick_model(model))
        response_text = await self._run_agent(agent, json.dumps(prompt, ensure_ascii=False))
        parsed = self._parse_json(response_text)
        reply = parsed.get("reply") or "No response generated."
        return {
            "reply": reply,
            "suggested_next_steps": parsed.get("suggested_next_steps", []),
            "mode": mode,
            "model": self._pick_model(model),
            "session_id": session.get("id"),
        }

    def _build_payload(
        self,
        session: Dict[str, Any],
        chunk: Dict[str, Any],
        events: List[Dict[str, Any]],
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        video_url = (
            chunk.get("video_url")
            or chunk.get("gcs_url")
            or chunk.get("gcs_uri")
            or chunk.get("video_gcs_uri")
        )
        return {
            "session": session,
            "chunk": chunk,
            "events": self._trim_events(events),
            "video_url": video_url,
            "checkpoint": self._checkpoint_context(checkpoint or {}),
        }

    def _build_log_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        events = payload.get("events", [])
        return {
            "session": payload.get("session"),
            "chunk": payload.get("chunk"),
            "events": filter_console_events(events) + filter_network_events(events),
            "checkpoint": payload.get("checkpoint", {}),
        }

    def _build_repro_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "session": payload.get("session"),
            "chunk": payload.get("chunk"),
            "events": filter_interaction_events(payload.get("events", [])),
            "checkpoint": payload.get("checkpoint", {}),
        }

    def _build_video_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "session": payload.get("session"),
            "chunk": payload.get("chunk"),
            "video_url": payload.get("video_url"),
            "events": filter_interaction_events(payload.get("events", [])),
            "checkpoint": payload.get("checkpoint", {}),
        }

    def _pick_model(self, model: str) -> str:
        if model and model not in {"default", "auto"}:
            return model
        return self.text_model

    def _trim_events(self, events: List[Dict[str, Any]], limit: int = 300) -> List[Dict[str, Any]]:
        if not isinstance(events, list):
            return []
        return events[-limit:]

    def _severity_breakdown(self, issues: List[Dict[str, Any]]) -> Dict[str, int]:
        breakdown = {"high": 0, "medium": 0, "low": 0, "unknown": 0}
        for issue in issues or []:
            severity = str(issue.get("severity", "unknown")).lower()
            if severity not in breakdown:
                severity = "unknown"
            breakdown[severity] += 1
        return breakdown

    def _checkpoint_context(self, checkpoint: Dict[str, Any]) -> Dict[str, Any]:
        if not checkpoint:
            return {}
        issues = checkpoint.get("issues", [])
        steps = checkpoint.get("repro_steps", [])
        return {
            "summary": checkpoint.get("summary"),
            "suspected_root_cause": checkpoint.get("suspected_root_cause"),
            "issue_count": len(issues),
            "issues": issues[:20] if isinstance(issues, list) else [],
            "repro_steps": steps[:20] if isinstance(steps, list) else [],
            "last_chunk_id": checkpoint.get("last_chunk_id"),
            "last_chunk_idx": checkpoint.get("last_chunk_idx"),
            "updated_at": checkpoint.get("updated_at"),
        }

    def _mode_instruction(self, mode: str) -> str:
        if mode == "summarize":
            return "Summarize the session and highlight the most important issues."
        if mode == "triage":
            return "List top issues with severity and likely impact. Be concise."
        return "You are a QA exploratory testing assistant. Respond succinctly."

    async def _call_agent(self, agent: LlmAgent, payload: Dict[str, Any], task: str) -> AgentOutput:
        prompt = (
            f"{task}\n\nReturn ONLY valid JSON. Input JSON:\n"
            f"{json.dumps(payload, ensure_ascii=False)}"
        )
        response_text = await self._run_agent_with_payload(agent, prompt, payload)
        parsed = self._parse_json(response_text)

        issues = parsed.get("issues")
        evidence = parsed.get("evidence")
        repro_steps = parsed.get("repro_steps")
        severity_breakdown = parsed.get("severity_breakdown")
        top_issues = parsed.get("top_issues")
        return AgentOutput(
            name=agent.name,
            summary=str(parsed.get("summary", "")),
            issues=issues if isinstance(issues, list) else [],
            evidence=evidence if isinstance(evidence, list) else [],
            repro_steps=repro_steps if isinstance(repro_steps, list) else [],
            root_cause=parsed.get("suspected_root_cause"),
            severity_breakdown=severity_breakdown if isinstance(severity_breakdown, dict) else {},
            top_issues=top_issues if isinstance(top_issues, list) else [],
        )

    async def _run_agent_with_payload(self, agent: LlmAgent, prompt: str, payload: Dict[str, Any]) -> str:
        if agent.name == "video_analyst":
            video_url = payload.get("video_url")
            if video_url:
                content_type = payload.get("chunk", {}).get("content_type") or "video/webm"
                try:
                    parts = [
                        types.Part.from_uri(video_url, mime_type=content_type),
                        types.Part(text=prompt),
                    ]
                    return await self._run_agent_parts(agent, parts)
                except Exception:
                    pass
        return await self._run_agent(agent, prompt)

    async def _run_agent(self, agent: LlmAgent, prompt: str) -> str:
        return await self._run_agent_parts(agent, [types.Part(text=prompt)])

    async def _run_agent_parts(self, agent: LlmAgent, parts: List[types.Part]) -> str:
        session_id = f"{agent.name}-{uuid.uuid4().hex}"
        await self.session_service.create_session(
            app_name=self.app_name, user_id=self.user_id, session_id=session_id
        )
        runner = Runner(agent=agent, app_name=self.app_name, session_service=self.session_service)
        content = types.Content(role="user", parts=parts)

        final_text: Optional[str] = None
        async for event in runner.run_async(
            user_id=self.user_id, session_id=session_id, new_message=content
        ):
            if event.is_final_response():
                if event.content and event.content.parts:
                    final_text = event.content.parts[0].text
                break

        return final_text or "{}"

    def _parse_json(self, text: str) -> Dict[str, Any]:
        if not text:
            return {}
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(text[start : end + 1])
                except json.JSONDecodeError:
                    return {}
        return {}

    def _agent_dict(self, output: AgentOutput) -> Dict[str, Any]:
        return {
            "name": output.name,
            "summary": output.summary,
            "issues": output.issues,
            "evidence": output.evidence,
            "repro_steps": output.repro_steps,
            "suspected_root_cause": output.root_cause,
            "severity_breakdown": output.severity_breakdown,
            "top_issues": output.top_issues,
        }

    def _run_sync(self, coro):
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(coro)
        raise RuntimeError("ADK async context detected; call the async methods instead.")
