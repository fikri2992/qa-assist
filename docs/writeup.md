# QA Assist - Hackathon Writeup

## What it is
QA Assist is an exploratory testing assistant that captures a full testing session - video, console/network logs, and interaction context - then uses AI to summarize issues and suggest repro steps. It is built as a Chrome extension + web playback app with a Phoenix backend and a Python ADK analysis service.

## Why it matters
Exploratory testing produces rich signals (video + logs + user intent) but they are scattered. QA Assist keeps them aligned in time and turns raw capture into actionable bug reports.

## How it works
1. **Capture**: Extension records active-tab video in 10-minute chunks and listens to console/network via the Debugger API. Interactions + markers/annotations are captured with DOM context.
2. **Ingest**: Backend stores session/chunk metadata and uploads video to local storage or GCS.
3. **Analyze**: AI service uses Google ADK to orchestrate agents:
   - Log analyst (console/network)
   - Video analyst (UI/UX issues)
   - Repro planner (steps + expected vs actual)
   - Synthesizer (root cause + summary)
   Checkpoints persist across chunks to maintain context.
4. **Playback**: Web app provides timeline playback, overlays, logs, annotations, and chat.

## Gemini/ADK usage
- Gemini 3 Flash: fast log triage + repro planning
- Gemini 3 Pro Preview: video analysis
- ADK: multi-agent orchestration + persistent checkpoints across chunks

## Key features
- Chunked video capture with continuity in the web player
- Marker + annotation shortcuts for QA notes
- Autonomy timeline showing agent outputs per chunk
- Chat UI for follow-up questions and triage
- GCS-ready storage and signed URLs

## Tech stack
- Extension: Chrome MV3 + JS + Tailwind v4
- Web: Vite + Vue + PrimeVue + Tailwind v4
- Backend: Elixir Phoenix + Postgres + Redis
- AI: FastAPI + Google ADK + Gemini models

## What's next
- More robust video timestamp alignment
- Playwright verifier + replay stabilization
- Polished demo hosting and public link
