# QA Assist — Demo Script

## Goal
Show a complete loop: capture → annotate → analyze → playback → chat.

## Script Outline (2–4 minutes)
1) **Intro (15s)**  
   - “QA Assist captures video, logs, and interactions in one click.”

2) **Start capture (20s)**  
   - Open extension popup.  
   - Set API URL + start session.  
   - Mention auto-chunking.

3) **Reproduce a bug (45s)**  
   - Trigger a console error or UI issue.  
   - Add a marker (Ctrl+Shift+M) and an annotation (Ctrl+Shift+K).

4) **Stop capture (10s)**  
   - End the session.

5) **Playback (45s)**  
   - Open web app.  
   - Load session by device id.  
   - Show timeline, markers, annotations, and logs.  
   - Scrub across chunks.

6) **AI analysis (45s)**  
   - Show analysis summary + issue cards.  
   - Open autonomy timeline to show agent outputs.  
   - Ask chat: “Summarize top issues and repro steps.”

7) **Wrap (15s)**  
   - “This is an exploratory testing assistant that turns messy sessions into actionable bug reports.”

## Backup Notes
- If AI API is offline, show stubbed analysis; explain ADK pipeline architecture.
