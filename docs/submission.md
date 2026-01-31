# QA Assist — Submission Artifacts

## Demo Video
- Link: `TBD`
- Length target: 2–4 minutes
- Suggested flow: see `docs/demo-script.md`

## Public Link
- Demo URL: `TBD`
- API URL: `TBD`

## Writeup (TL;DR)
QA Assist is an exploratory testing assistant built for rapid bug capture and AI-assisted analysis. A Chrome extension records video, console/network logs, and interaction context while testers annotate sessions. A Phoenix backend stores sessions and artifacts, and an ADK-powered AI service analyzes chunks, produces issue summaries, and suggests repro steps. A web app provides playback, a timeline, logs, annotations, and a chat UI for analysis follow-ups.

## Highlights
- Multimodal capture: video + console + network + interaction context.
- Chunked recording (10 min segments) with timeline stitching for playback.
- Marker/annotation shortcuts for QA notes during capture.
- ADK multi-agent analysis (log, video, repro, synthesis) with checkpointing across chunks.
- Web playback with overlays, logs, autonomy timeline, and chat.

## Tech Stack
- Extension: Chrome MV3 + Tailwind v4
- Web: Static HTML/JS + Tailwind v4
- Backend: Elixir Phoenix + Postgres + Redis
- Storage: Local or GCS (signed URLs + resumable)
- AI: Python FastAPI + Google ADK + Gemini models

## Gemini/ADK Usage
- Gemini 3 Flash for log analysis + repro planning.
- Gemini 3 Pro Preview for video analysis.
- ADK orchestrates multi-agent pipeline and persistent checkpointing across chunks.
