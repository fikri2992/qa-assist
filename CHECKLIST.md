# QA Assist Implementation Checklist

Legend: [x] done · [~] partial/stub · [ ] not started

## 01 — Problem and Goals (`plan/01-problem-and-goals.md`)
- [x] Record active-tab video. (extension/offscreen.js, extension/background.js)
- [x] Capture console logs. (extension/background.js via Debugger API)
- [x] Capture network logs. (extension/background.js via Debugger API)
- [x] Capture user interactions. (extension/content.js)
- [ ] Markers/annotations during session. (UI + shortcuts not implemented)
- [~] Environment metadata (window/screen size, OS, browser version). (URL/title/userAgent only)
- [x] Store session artifacts in backend. (backend/lib/qa_assist/storage/local.ex)
- [~] AI analysis per chunk. (stub only)
- [~] Aggregated report after session end. (summary exists, not gated on session end)

## 02 — Requirements and Decisions (`plan/02-requirements-and-decisions.md`)
- [x] Start/stop recording from extension UI. (extension/popup.*)
- [x] 10-minute chunked video. (extension/background.js)
- [x] Console + network logs. (extension/background.js)
- [x] Interaction capture with DOM context. (extension/content.js)
- [ ] Marker input via shortcut + annotation overlay.
- [ ] Persist session list locally and sync to backend. (device id only)
- [~] Web playback with timeline + logs + annotations + chat UI. (logs only)
- [~] AI per chunk with aggregated report. (stub)
- [ ] Resumable uploads. (not implemented)
- [~] Tab switch + idle handling. (auto-stop; no resume/new chunk)
- [ ] GCS storage + signed URLs. (local storage only)
- [ ] Redis queues. (not wired)
- [ ] Tailwind v4 UI. (plain CSS used)

## 03 — Architecture and Data Flow (`plan/03-architecture-and-dataflow.md`)
- [x] Extension UI/background/content script split. (extension/)
- [x] Web app playback UI. (webapp/)
- [x] Phoenix API for sessions/events/chunks. (backend/lib/qa_assist_web/controllers/*)
- [~] Storage layer. (local only; GCS stub exists)
- [ ] Redis job dispatch. (not wired)
- [ ] ADK Python multi-agent orchestration. (not implemented)
- [ ] Signed upload URLs + resumable uploads. (not implemented)

## 04 — Data Model (`plan/04-data-model.md`)
- [x] Devices table. (backend/priv/repo/migrations/20260131000448_create_recording_tables.exs)
- [x] Sessions table.
- [x] Chunks table.
- [x] Events table.
- [x] Analyses table.

## 05 — API (`plan/05-api.md`)
- [x] `POST /devices` create device. (device_controller.ex)
- [x] `POST /sessions` create session. (session_controller.ex)
- [x] `POST /sessions/:id/start`
- [x] `POST /sessions/:id/stop`
- [x] `GET /sessions?device_id=...`
- [x] `GET /sessions/:id`
- [x] `POST /sessions/:id/chunks`
- [x] `PATCH /chunks/:id`
- [x] `POST /sessions/:id/events`
- [x] `GET /sessions/:id/events` (extra for UI)
- [x] `GET /sessions/:id/analysis`
- [~] `GET /sessions/:id/artifacts` (returns empty list)
- [~] `GET /artifacts/:id` (always 404)
- [x] `GET /` root API ping. (root_controller.ex)

## 06 — Extension (`plan/06-extension.md`)
- [x] Start/stop session.
- [x] Active-tab video capture.
- [x] Console + network logs.
- [x] Interaction capture + DOM context.
- [~] Idle detection (auto-stop). (no resume)
- [~] Tab switch handling (auto-stop). (no resume/new chunk)
- [ ] Markers + annotations overlay.
- [ ] Session list stored locally. (device id only)

## 07 — Web App (`plan/07-webapp.md`)
- [x] Session list view. (webapp/app.js)
- [x] Session detail view.
- [~] Video playback (first chunk only, no timeline UI)
- [x] Logs panel (console + network)
- [~] Interaction trail (raw JSON only)
- [ ] Annotations overlay.
- [ ] Chat UI.
- [ ] Downloadable repro scripts.

## 08 — AI Orchestration (`plan/08-ai-orchestration.md`)
- [ ] ADK Python multi-agent pipeline. (not implemented)
- [~] Per-chunk analysis workflow. (stub only)
- [ ] Video analysis.
- [ ] Repro planner / synthesizer.
- [ ] Playwright generator + verifier.
- [ ] Script export.

## 09 — Milestones and Risks (`plan/09-milestones-and-risks.md`)
- [~] Capture MVP. (core capture + ingest works)
- [~] Playback MVP. (basic playback + logs)
- [~] AI MVP. (stub analysis)
- [ ] Polish (idle resume, annotations, chat, badges).

## 10 — Hackathon Compliance (`plan/10-hackathon-compliance.md`)
- [ ] Gemini 3 API usage.
- [ ] Submission artifacts (demo video, public link, writeup).
- [ ] Marathon agent requirements (autonomy timeline, persistence).

## 11 — Demo Script (`plan/11-demo-script.md`)
- [ ] Demo runbook prepared.
- [ ] Deterministic bug scenario.
- [ ] Autonomy timeline view.
