# Milestones and Risks

## Milestones (hackathon)
1. **Capture MVP**: extension start/stop, active-tab video chunks, event ingestion.
2. **Playback MVP**: session list + playback with logs/markers.
3. **AI MVP**: per-chunk analysis + final aggregation.
4. **Polish**: idle auto-pause, annotations, chat UI, status badges.

## Risks and mitigations
- **Debugger permission warning** may reduce comfort → document clearly for hackathon demo.
- **tabCapture limitations** (active tab only, user gesture required) → keep UX simple and explicit.
- **Large video uploads** → chunking + resumable uploads.
- **Model name availability** → verify actual Gemini model ID before integration.
- **No auth** → device-only access, no sharing, minimal data retention.
