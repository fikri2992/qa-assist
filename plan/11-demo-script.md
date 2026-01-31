# 3-Minute Demo Script (Marathon Agent Focus)

## Goal
Show long-running, multi-agent, multimodal analysis with clear autonomy and evidence correlation.

## Structure (<= 3 minutes)
### 0:00-0:20 - Problem and setup
- "Exploratory Testing Assistant captures video + logs + actions and turns them into a bug report."
- Show extension UI with Start button and session ID (device-scoped, no auth).

### 0:20-0:50 - Record the session
- Start recording in a test app.
- Trigger a realistic UI bug (e.g., button click causes UI glitch + console error + failed network).
- Add a marker and quick annotation.

### 0:50-1:20 - Evidence capture overview
- Show active-tab video timeline and event list (console, network, interactions).
- Highlight a chunk boundary and upload completion.

### 1:20-2:10 - Marathon agent in action
- Show per-chunk analysis badge appear.
- Open autonomy timeline view: list of agent steps per chunk.
- Highlight multi-agent outputs: log anomalies, video findings, and repro plan.
- Emphasize that the agent continues after recording ends (async).

### 2:10-2:40 - Final report
- End session to trigger aggregation.
- Show consolidated bug report with repro steps + evidence links (timestamps, logs).

### 2:40-3:00 - Why it wins
- "Long-running, multi-step agent that correlates video + logs + actions."
- "Not just a vision demo; it reasons across modalities and persists state."

## Demo tips
- Use a deterministic bug so the AI report looks credible.
- Keep on-screen text large and readable.
- Avoid any mention of private data; use a mock test app.
