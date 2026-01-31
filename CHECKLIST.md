# QA Assist Implementation Checklist

Legend: [x] done · [~] partial/stub · [ ] not started

## 01 — Problem and Goals (`plan/01-problem-and-goals.md`)
- [x] Record active-tab video. (extension/offscreen.js, extension/background.js)
- [x] Capture console logs. (extension/background.js via Debugger API)
- [x] Capture network logs. (extension/background.js via Debugger API)
- [x] Capture user interactions. (extension/content.js)
- [x] Markers/annotations during session. (overlay + shortcuts)
- [~] Environment metadata (window/screen size, OS, browser version). (viewport/screen/platform/userAgentData added)
- [x] Store session artifacts in backend. (backend/lib/qa_assist/storage/local.ex)
- [~] AI analysis per chunk. (heuristics + ADK)
- [x] Aggregated report after session end. (session analysis on stop)

## 02 — Requirements and Decisions (`plan/02-requirements-and-decisions.md`)
- [x] Start/stop recording from extension UI. (extension/popup.*)
- [x] 10-minute chunked video. (extension/background.js)
- [x] Console + network logs. (extension/background.js)
- [x] Interaction capture with DOM context. (extension/content.js)
- [x] Marker input via shortcut + annotation overlay.
- [x] Persist session list locally and sync to backend. (popup syncs list)
- [x] Web playback with timeline + logs + annotations + chat UI.
- [x] AI per chunk with aggregated report. (ADK agents with filtered inputs + checkpoint context)
- [~] Resumable uploads. (GCS resumable supported)
- [~] Tab switch + idle handling. (auto-pause with resume prompt)
- [~] GCS storage + signed URLs. (supported via env)
- [x] Redis queues. (backend/lib/qa_assist/redis_queue.ex)
- [x] Tailwind v4 UI. (webapp/extension compiled with Tailwind v4 build)

## 03 — Architecture and Data Flow (`plan/03-architecture-and-dataflow.md`)
- [x] Extension UI/background/content script split. (extension/)
- [x] Web app playback UI. (webapp/)
- [x] Phoenix API for sessions/events/chunks. (backend/lib/qa_assist_web/controllers/*)
- [~] Storage layer. (local + GCS supported)
- [x] Redis job dispatch. (backend/lib/qa_assist/redis_worker.ex)
- [x] ADK Python multi-agent orchestration. (ai/adk_orchestrator.py)
- [~] Signed upload URLs + resumable uploads. (GCS supports signed/resumable)

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
- [x] `GET /sessions/:id/artifacts` (artifact list)
- [x] `GET /artifacts/:id` (download script)
- [x] `GET /` root API ping. (root_controller.ex)

## 06 — Extension (`plan/06-extension.md`)
- [x] Start/stop session.
- [x] Active-tab video capture.
- [x] Console + network logs.
- [x] Interaction capture + DOM context.
- [~] Idle detection (auto-stop). (resume prompt)
- [~] Tab switch handling (auto-stop). (resume prompt)
- [x] Markers + annotations overlay.
- [x] Session list stored locally. (popup syncs list)

## 07 — Web App (`plan/07-webapp.md`)
- [x] Session list view. (webapp/app.js)
- [x] Session detail view.
- [x] Video playback (multi-chunk timeline UI)
- [x] Logs panel (console + network)
- [x] Interaction trail (clicks + DOM context)
- [x] Annotations overlay.
- [x] Chat UI.
- [~] Downloadable repro scripts. (Playwright stub)

## 08 — AI Orchestration (`plan/08-ai-orchestration.md`)
- [x] ADK Python multi-agent pipeline. (ai/adk_orchestrator.py)
- [x] Per-chunk analysis workflow. (log/video/repro agents wired)
- [x] Video analysis. (ADK multimodal prompt)
- [x] Repro planner / synthesizer. (ADK agents + checkpoint context)
- [ ] Playwright generator + verifier. (deferred)
- [~] Script export. (Playwright stub)

## 09 — Milestones and Risks (`plan/09-milestones-and-risks.md`)
- [x] Capture MVP. (core capture + ingest works)
- [x] Playback MVP. (timeline + logs + overlays)
- [~] AI MVP. (heuristics + ADK)
- [~] Polish (idle resume, annotations, chat, badges). (issue severity badges added)

## 10 — Hackathon Compliance (`plan/10-hackathon-compliance.md`)
- [x] Gemini 3 API usage. (ADK defaults to Gemini 3 models)
- [~] Submission artifacts (demo video, public link, writeup). (draft docs in docs/)
- [x] Marathon agent requirements (autonomy timeline in UI, checkpoints persisted).

## 11 — Demo Script (`plan/11-demo-script.md`)
- [x] Demo runbook prepared.
- [x] Deterministic bug scenario.
- [x] Autonomy timeline view.
