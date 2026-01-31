# Chrome Extension (MV3)

## Core responsibilities
- Start/stop session
- Capture active-tab video
- Capture console + network logs for active tab
- Capture interactions + DOM context
- Markers and annotations
- Idle detection + auto-pause

## Key flows
### Start session
1. User clicks Start in extension UI.
2. Create session via API; store device/session locally.
3. Attach debugger to active tab; start `tabCapture`.
4. Begin chunk upload; send env + initial events.

### Tab switch
- Auto-pause on tab switch.
- End current chunk immediately.
- Show prompt to resume on active tab.

### Idle detection
- Track click/keypress/scroll/mousemove.
- After 5 minutes idle → auto-pause + prompt.

### Resume
- Start new chunk, reattach debugger if needed.

### Stop session
- Stop capture, finalize chunk, detach debugger.
- Mark session ended; trigger final report aggregation.

## Permissions (likely)
- `activeTab`, `tabCapture`, `debugger`, `storage`, `scripting`

## Local storage
- Device ID token
- Session list and current session state
