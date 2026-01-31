# API (Phoenix)

## Device
- `POST /devices` → create device token

## Session
- `POST /sessions` → create session
- `POST /sessions/:id/start` → set recording status + issue signed URLs
- `POST /sessions/:id/stop` → finalize session
- `GET /sessions?device_id=...` → list sessions for device
- `GET /sessions/:id` → session detail + chunk manifest + analysis status

## Chunks
- `POST /sessions/:id/chunks` → register chunk metadata
- `PATCH /chunks/:id` → update status (ready/failed)

## Events
- `POST /sessions/:id/events` → ingest batched events

## Analysis
- `GET /sessions/:id/analysis` → aggregated report after session end

## Artifacts
- `GET /sessions/:id/artifacts` → list generated scripts and files
- `GET /artifacts/:id` → download a repro script (e.g., Playwright)

## Notes
- All endpoints accept a `device_id` token for scoping (no auth).
- Use signed URLs for direct upload to GCS.
