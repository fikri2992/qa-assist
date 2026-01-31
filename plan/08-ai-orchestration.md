# AI Orchestration (ADK Python)

## Agents
- **Log Analyst**: console + network anomaly detection.
- **Video Analyst**: UI/UX issues, visual bugs, interaction anomalies.
- **Repro Planner**: reproduce steps with expected/actual.
- **Synthesizer**: consolidate evidence and severity.
- **Playwright Generator**: turn repro steps into a Playwright script.
- **Verifier**: run Playwright script, collect assertions, and attach artifacts.
- **Script Exporter**: package runnable repro scripts for download.

## Per-chunk workflow
1. Fetch chunk metadata + event window.
2. Analyze logs (console/network) for errors.
3. Analyze video chunk for visual/interaction issues.
4. Generate chunk report with evidence links.

## Session-level aggregation
- Merge chunk reports after session ends.
- Produce a final bug report with steps and references.

## Playwright repro + verifier (optional MVP+)
- Generate Playwright test from repro steps and interaction timeline (default script format).
- Add assertions based on detected UI states or network responses.
- Run in a sandboxed worker; capture screenshots/video and attach to report.
- Export script artifacts even if verifier is not run (local/intranet support).

## Inputs
- Event timeline (interactions, markers, annotations).
- Video chunk manifest (GCS URIs).
- Environment metadata.

## Outputs
- Structured report JSON:
  - Summary
  - Suspected root cause
  - Repro steps
  - Evidence (timestamps, logs, screenshots if available)
