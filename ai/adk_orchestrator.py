from __future__ import annotations

import asyncio
import json
import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from google.adk.agents import LlmAgent
from google.adk.sessions import InMemorySessionService
from google.genai import types

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


class AdkOrchestrator:
    def __init__(self) -> None:
        self.app_name = "qa-assist-ai"
        self.user_id = "qa-assist"
        self.session_service = InMemorySessionService()

        text_model = os.getenv("ADK_TEXT_MODEL", "gemini-3-flash")
        video_model = os.getenv("ADK_VIDEO_MODEL", "gemini-3-pro-preview")

        self.log_agent = LlmAgent(
            name="log_analyst",
            model=text_model,
            instruction=(
                "You analyze console and network events. Return JSON with keys: "
                "summary (string), issues (array), evidence (array). "
                "Issues should include title, severity, detail, ts. "
                "Evidence should include type, message, ts or url/status."
            ),
        )
        self.video_agent = LlmAgent(
            name="video_analyst",
            model=video_model,
            instruction=(
                "You analyze recorded UI video for visual/UI/UX issues. "
                "Return JSON with keys: summary (string), issues (array), evidence (array). "
                "If no issues, return empty arrays."
            ),
        )
        self.repro_agent = LlmAgent(
            name="repro_planner",
            model=text_model,
            instruction=(
                "You derive reproduction steps from interaction events. "
                "Return JSON with keys: summary (string), repro_steps (array of strings)."
            ),
        )
        self.synth_agent = LlmAgent(
            name="synthesizer",
            model=text_model,
            instruction=(
                "You consolidate findings into a short summary and suspected root cause. "
                "Return JSON with keys: summary (string), suspected_root_cause (string)."
            ),
        )

    def analyze_chunk(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self._run_sync(self._analyze_chunk_async(session, chunk, events))

    def aggregate_session(self, session: Dict[str, Any], chunk_reports: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self._run_sync(self._aggregate_session_async(session, chunk_reports))

    async def analyze_chunk_async(
        self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        return await self._analyze_chunk_async(session, chunk, events)

    async def aggregate_session_async(
        self, session: Dict[str, Any], chunk_reports: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        return await self._aggregate_session_async(session, chunk_reports)

    async def _analyze_chunk_async(
        self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        payload = self._build_payload(session, chunk, events)
        log_result = await self._call_agent(self.log_agent, payload, "Analyze console/network logs.")
        video_result = await self._call_agent(self.video_agent, payload, "Analyze video for UI/UX issues.")
        repro_result = await self._call_agent(self.repro_agent, payload, "Generate repro steps.")

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
        }
        synth = await self._call_agent(self.synth_agent, synth_payload, "Summarize findings.")

        return {
            "summary": synth.summary or "Analysis complete.",
            "suspected_root_cause": synth.root_cause,
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
            "session_id": session.get("id"),
        }

    async def _aggregate_session_async(
        self, session: Dict[str, Any], chunk_reports: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
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

        return {
            "summary": summary,
            "issues": issues,
            "evidence": evidence,
            "repro_steps": steps,
            "session_id": session.get("id"),
        }

    def _build_payload(self, session: Dict[str, Any], chunk: Dict[str, Any], events: List[Dict[str, Any]]) -> Dict[str, Any]:
        video_url = (
            chunk.get("video_url")
            or chunk.get("gcs_url")
            or chunk.get("gcs_uri")
            or chunk.get("video_gcs_uri")
        )
        return {
            "session": session,
            "chunk": chunk,
            "events": events,
            "video_url": video_url,
        }

    async def _call_agent(self, agent: LlmAgent, payload: Dict[str, Any], task: str) -> AgentOutput:
        prompt = (
            f"{task}\n\nReturn ONLY valid JSON. Input JSON:\n"
            f"{json.dumps(payload, ensure_ascii=False)}"
        )
        response_text = await self._run_agent(agent, prompt)
        parsed = self._parse_json(response_text)

        issues = parsed.get("issues")
        evidence = parsed.get("evidence")
        repro_steps = parsed.get("repro_steps")
        return AgentOutput(
            name=agent.name,
            summary=str(parsed.get("summary", "")),
            issues=issues if isinstance(issues, list) else [],
            evidence=evidence if isinstance(evidence, list) else [],
            repro_steps=repro_steps if isinstance(repro_steps, list) else [],
            root_cause=parsed.get("suspected_root_cause"),
        )

    async def _run_agent(self, agent: LlmAgent, prompt: str) -> str:
        session_id = f"{agent.name}-{uuid.uuid4().hex}"
        await self.session_service.create_session(
            app_name=self.app_name, user_id=self.user_id, session_id=session_id
        )
        runner = Runner(agent=agent, app_name=self.app_name, session_service=self.session_service)
        content = types.Content(role="user", parts=[types.Part(text=prompt)])

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
        }

    def _run_sync(self, coro):
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(coro)
        raise RuntimeError("ADK async context detected; call the async methods instead.")
