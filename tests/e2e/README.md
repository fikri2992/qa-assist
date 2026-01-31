# End-to-End Test (Heavy)

This suite runs a full pipeline: extension -> backend -> AI service.

## Prereqs
- Postgres running locally (dev config uses postgres/postgres).
- Elixir + Node + Python installed.
- AI deps installed: `pip install -r ai/requirements.txt`.
- Playwright browsers installed: `npx playwright install`.

## Run
```powershell
npm install
npm run test:e2e
```

## Notes
- The test launches Chromium in headed mode with the extension loaded.
- It starts backend + AI service automatically (set `QA_E2E_SKIP_SERVERS=1` to use existing servers).
- Logs are written to `tests/e2e/.logs/`.
