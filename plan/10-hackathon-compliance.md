# Gemini 3 Hackathon Compliance Checklist

## Submission requirements
- [x] Project uses the Gemini 3 API (not just Gemini 1.5/2.x).
- [ ] Project is built during the contest period.
- [ ] Public project link or public code repo is provided.
- [ ] Demo video is <= 3 minutes.
- [~] Submission text includes clear problem, solution, and use of Gemini 3. (draft in docs/writeup.md)

## Demo expectations (to stand out)
- [x] Show multi-agent orchestration and long-running task behavior.
- [~] Demonstrate multimodal analysis (video + logs + interactions).
- [~] Emphasize decision-making steps, not just summary output.

## Marathon Agent alignment
- [ ] Demonstrate tasks spanning long durations (hours/days), not just a single short prompt.
- [ ] Use thought signatures + thinking levels to maintain continuity across multi-step tool calls.
- [ ] Show self-correction without human supervision (retry, revise plan, re-run tools).
- [x] Persist agent state/checkpoints across chunks so analysis is continuous.
- [x] Include an autonomy timeline in the demo (what the agent did at each step).

## Product alignment
- [ ] Avoid "prompt-only" UI; show real automation or analysis workflow.
- [ ] Avoid "basic vision analyzer" framing; show temporal reasoning and evidence correlation.
- [ ] Provide a sample session that judges can access without login.

## Release checklist
- [ ] Record a clean demo run (with meaningful bug surfaced).
- [x] Publish a short README describing architecture and setup.
- [ ] Provide sanitized sample session data for reviewers.
- [~] Submission artifacts drafted. (docs/submission.md + docs/demo-script.md + docs/writeup.md)
