# Requirements and Decisions

## Functional requirements
- Start/stop recording from extension UI.
- Capture active-tab video in 10-minute chunks.
- Capture console logs and network logs for the active tab.
- Capture interactions with DOM context (selector, text, bounding box, URL).
- Provide marker input via keyboard shortcut and annotation overlay.
- Persist sessions locally on device and sync to backend.
- Web app playback with timeline + logs + annotations + chat UI.
- AI analysis per chunk with aggregated report after session end.

## Non-functional requirements
- Low friction UX (minimal prompts).
- Robust handling for tab switches and idle periods.
- Resumable uploads for large videos.
- Basic observability (session/chunk status, analysis status).
- Hackathon-grade speed over perfection.

## Constraints
- Chrome extension Manifest V3.
- Backend: Elixir Phoenix, Postgres, Redis.
- Storage: GCS for video artifacts.
- UI: plain JS + Tailwind v4.
- No authentication; device-scoped visibility only.

## Locked decisions
- Active-tab video only.
- Auto-pause on tab switch; end current chunk; resume starts new chunk.
- Logs only for the active tab (touched tab).
- Idle detection includes click/keypress/scroll/mousemove; auto-pause after 5 minutes idle.
- Session list stored locally and synced to backend.
- AI analysis runs per chunk; full report shown after session end.
