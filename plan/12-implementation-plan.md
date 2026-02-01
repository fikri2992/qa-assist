# Implementation Plan (Post-Audit)

Goal: close critical gaps, align CHECKLIST.md with reality, and deliver a complete, demo-ready implementation.

## Scope priorities
P0 = must fix for correctness/demo, P1 = completeness, P2 = quality/nice-to-have.

## Phase 0 (P0): Correctness + pipeline integrity
0) Auth requirement for extension + webapp (done)
   - Require login via seeded demo user; use Bearer token for API calls.
   - Acceptance: login works in webapp + extension; token gates session APIs.

1) Stop flow correctness
   - Fix extension stop flow so `/sessions/:id/stop` is always called before clearing `sessionId`.
   - Ensure the final event batch is flushed and the last chunk is fully uploaded before stop.
   - Acceptance: backend session status becomes `ended`, `ended_at` populated, aggregated analysis enqueued.

2) Analysis enqueue for GCS
   - Update backend chunk update path to enqueue analysis when a chunk transitions to `ready` and `analysis_status=pending`.
   - Keep local upload flow unchanged.
   - Acceptance: GCS uploads trigger per-chunk analysis without additional client changes.

3) Event queue gating
   - Only enqueue events when `recording=true`.
   - Clear queue on stop, and reset state for the next session.
   - Acceptance: no pre-session events appear in the next session.

## Phase 1 (P1): UI and UX completeness
4) Popup marker/annotation buttons
   - Handle `MARKER` and `ANNOTATE` messages in background worker.
   - Reuse existing overlay logic (content script) and fallbacks.
   - Acceptance: buttons open the overlay or log fallback markers.

4a) Sidebar logout button (done)
    - Provide logout action for the authenticated webapp.
    - Acceptance: logout clears auth and returns to sessions view.

5) Webapp deep-link consistency
   - Align router with extension link (`/sessions/:id`), or update the extension to `/session/:id`.
   - Acceptance: clicking a session from the extension opens the correct page.

6) Annotation overlay in playback
   - Add an overlay layer in the video player to render annotations relative to viewport or use a side overlay panel.
   - Show annotation text on hover/click.
   - Acceptance: annotations are visible in playback and correlate with timeline pins.

7) Status mapping
   - Normalize status strings between backend and UI (`ended` -> `completed` or adjust UI mapping).
   - Acceptance: status pills show correct styling for ended sessions.

## Phase 2 (P1): Build and checklist alignment
8) Tailwind build inputs
   - Add `webapp/tailwind.css` or remove the script if unused.
   - Acceptance: `npm run tailwind:build` succeeds.

9) Update CHECKLIST.md paths and statuses
   - Fix path references for ADK orchestrator and webapp.
   - Mark partial items and add short notes for gaps.
   - Acceptance: checklist matches actual code state.

## Phase 3 (P2): AI and assistant polish
10) Gemini defaults
    - Align ADK default model names with hackathon requirement or document overrides clearly.
    - Acceptance: defaults are correct without environment overrides.

11) Assistant resources
    - Wire attachments/mentions into chat payload or remove mock UI.
    - Acceptance: attached resources appear in backend chat payload or are hidden.

12) Playwright verifier (optional)
    - Implement the deferred verifier or document why it is out-of-scope.
    - Acceptance: verifier runs on generated scripts or is explicitly deferred.

## Validation plan
- Unit checks: backend analysis enqueue (GCS + local), stop flow integration.
- Manual run: start -> record -> add markers/annotations -> stop -> confirm analysis + playback.
- UI checks: extension buttons, deep links, annotation overlay, status styling.

## Tracking (checkboxes)
- [x] P0-0 Auth login requirement (seeded user + bearer token)
- [ ] P0-1 Stop flow correctness
- [ ] P0-2 GCS analysis enqueue
- [ ] P0-3 Event queue gating
- [ ] P1-4 Popup marker/annotation buttons
- [x] P1-4a Sidebar logout button
- [ ] P1-5 Deep-link consistency
- [ ] P1-6 Annotation overlay in playback
- [ ] P1-7 Status mapping
- [ ] P1-8 Tailwind build inputs
- [ ] P1-9 CHECKLIST alignment
- [ ] P2-10 Gemini defaults
- [ ] P2-11 Assistant resources wiring
- [ ] P2-12 Playwright verifier (optional)
