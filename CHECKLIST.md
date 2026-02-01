# QA Assist Implementation Checklist

Legend: [x] done - [~] partial/stub - [ ] not started

## 01 - Problem and Goals (`plan/01-problem-and-goals.md`)
- [x] Record active-tab video. (extension/offscreen.js, extension/background.js)
- [x] Chunk recording every 10 minutes. (extension/offscreen.js)
- [x] Capture console logs. (extension/background.js via Debugger API)
- [x] Capture network logs. (extension/background.js via Debugger API)
- [x] Capture user interactions. (extension/content.js)
- [x] Markers/annotations during session. (overlay + shortcuts + popup buttons)
- [x] Marker/annotation overlays in page. (extension/content.js)
- [x] Environment metadata (window/screen size, OS, browser version). (viewport/screen/platform/userAgentData added)
- [x] Idle/tab-switch auto-pause with resume prompt. (extension/background.js + content.js)
- [x] Store session artifacts in backend. (backend/lib/qa_assist/storage/local.ex)
- [x] AI analysis per chunk. (chunk ready now enqueues for GCS + local)
- [x] Aggregated report after session end. (stop flow calls stop API + flush)

## 02 - Requirements and Decisions (`plan/02-requirements-and-decisions.md`)
- [x] Start/stop recording from extension UI. (stop API called after flush + upload)
- [x] Stop flow flushes events and final chunk before ending session.
- [x] Require login for extension + webapp (seeded demo user, bearer token, no expiry).
- [x] 10-minute chunked video. (extension/background.js)
- [x] Console + network logs. (extension/background.js)
- [x] Interaction capture with DOM context. (extension/content.js)
- [x] Marker input via shortcut + annotation overlay. (popup buttons wired)
- [x] Persist session list locally and sync to backend. (popup syncs list)
- [x] Web playback timeline with chunk navigation. (webapp/src/components/VideoPlayer.vue)
- [x] Logs panel (console + network). (webapp/src/components/tabs/LogsTab.vue)
- [x] Interaction trail (clicks + DOM context). (webapp/src/components/tabs/EventsTab.vue)
- [x] Annotations overlay on video. (video overlay + pins)
- [x] Chat UI. (webapp/src/components/AssistantPanel.vue)
- [x] AI per chunk with aggregated report. (GCS + local enqueue)
- [x] Resumable uploads. (GCS resumable supported)
- [x] Tab switch + idle handling. (auto-pause with resume prompt)
- [x] GCS storage + signed URLs. (supported via env)
- [x] Redis queues. (backend/lib/qa_assist/redis_queue.ex)
- [x] Tailwind v4 UI. (webapp tailwind input added; build passes)

## 03 - Architecture and Data Flow (`plan/03-architecture-and-dataflow.md`)
- [x] Extension UI/background/content script split. (extension/)
- [x] Web app playback UI. (webapp/)
- [x] Phoenix API for sessions/events/chunks. (backend/lib/qa_assist_web/controllers/*)
- [x] Storage layer. (local + GCS supported)
- [x] Redis job dispatch. (backend/lib/qa_assist/redis_worker.ex)
- [x] ADK Python multi-agent orchestration. (ai/services/adk_orchestrator.py)
- [x] Signed upload URLs + resumable uploads. (GCS supports signed/resumable)
- [x] Analysis service endpoints (analyze/aggregate/chat). (ai/app/api/*)

## 04 - Data Model (`plan/04-data-model.md`)
- [x] Users + auth tokens tables. (backend/priv/repo/migrations/20260201010000_create_users_and_tokens.exs)
- [x] Devices linked to user. (backend/priv/repo/migrations/20260201010100_add_user_id_to_devices.exs)
- [x] Devices table. (backend/priv/repo/migrations/20260131000448_create_recording_tables.exs)
- [x] Sessions table.
- [x] Chunks table.
- [x] Events table.
- [x] Analyses table.
- [x] Session metadata includes env + URL/title. (backend/lib/qa_assist/recording.ex)

## 05 - API (`plan/05-api.md`)
- [x] `POST /auth/login` login and issue token. (auth_controller.ex)
- [x] `POST /devices` create device. (device_controller.ex)
- [x] `POST /sessions` create session. (session_controller.ex)
- [x] `POST /sessions/:id/start`
- [x] `POST /sessions/:id/stop`
- [x] `POST /sessions/:id/pause`
- [x] `POST /sessions/:id/resume`
- [x] `GET /sessions?device_id=...`
- [x] `GET /sessions/:id`
- [x] `POST /sessions/:id/chunks`
- [x] `PATCH /chunks/:id`
- [x] `POST /sessions/:id/events`
- [x] `GET /sessions/:id/events` (extra for UI)
- [x] `GET /sessions/:id/analysis`
- [x] `POST /sessions/:id/chat`
- [x] `GET /sessions/:id/artifacts` (artifact list)
- [x] `GET /artifacts/:id` (download script)
- [x] `GET /` root API ping. (root_controller.ex)

## 06 - Extension (`plan/06-extension.md`)
- [x] Start/stop session. (stop flow fixed)
- [x] Active-tab video capture.
- [x] Console + network logs.
- [x] Interaction capture + DOM context.
- [x] Idle detection (auto-pause). (resume prompt)
- [x] Tab switch handling (auto-pause). (resume prompt)
- [x] Markers + annotations overlay. (popup buttons wired)
- [x] Session list stored locally. (popup syncs list)
- [x] Login required (token stored in popup, Bearer auth on API calls).
- [x] Event queue only records during active session. (gated to recording)

## 07 - Web App (`plan/07-webapp.md`)
- [x] Session list view. (webapp/src/pages/SessionsPage.vue)
- [x] Session detail view.
- [x] Video playback (multi-chunk timeline UI)
- [x] Logs panel (console + network)
- [x] Interaction trail (clicks + DOM context)
- [x] Annotations list tab. (webapp/src/components/tabs/AnnotationsTab.vue)
- [x] Annotations overlay. (video overlay added)
- [x] Chat UI.
- [x] Login screen + logout. (webapp/src/pages/SessionsPage.vue + sidebar)
- [x] Downloadable repro scripts. (Playwright script)
- [x] Extension deep-link route matches router. (router supports /sessions/:id + legacy redirect)

## 08 - AI Orchestration (`plan/08-ai-orchestration.md`)
- [x] ADK Python multi-agent pipeline. (ai/services/adk_orchestrator.py)
- [x] Per-chunk analysis workflow. (log/video/repro agents wired)
- [x] Video analysis. (ADK multimodal prompt)
- [x] Repro planner / synthesizer. (ADK agents + checkpoint context)
- [x] Checkpoint persistence across chunks. (ai/services/checkpoints.py)
- [x] Playwright generator + verifier. (verifier script added)
- [x] Script export. (Playwright script export with notes)

## 09 - Milestones and Risks (`plan/09-milestones-and-risks.md`)
- [x] Capture MVP. (core capture + ingest works)
- [x] Playback MVP. (timeline + logs + overlays)
- [x] AI MVP. (heuristics + ADK)
- [x] Polish (idle resume, annotations, chat, badges). (issue severity badges + summary added)

## 10 - Hackathon Compliance (`plan/10-hackathon-compliance.md`)
- [x] Gemini 3 API usage. (defaults aligned with Gemini 3)
- [~] Submission artifacts (demo video, public link, writeup). (draft docs in docs/ + release checklist)
- [x] Marathon agent requirements (autonomy timeline in UI, checkpoints persisted).
- [~] Autonomy timeline populated by real agent runs (ADK enabled).

## 11 - Demo Script (`plan/11-demo-script.md`)
- [x] Demo runbook prepared.
- [x] Deterministic bug scenario.
- [x] Autonomy timeline view.




