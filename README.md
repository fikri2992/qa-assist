# QA Assist

Monorepo for the exploratory testing assistant.

## Components
- `backend/` Phoenix API + Postgres
- `extension/` Chrome MV3 recorder
- `webapp/` Vite + Vue + Tailwind playback UI
- `ai/` Python analysis service
- `infra/` Docker compose for Postgres/Redis
- `shared/` JSON schemas

## Quickstart

### 1) Infrastructure
```
cd infra
docker compose up -d
```

### 2) Backend
```
cd backend
mix setup
mix phx.server
```

API base URL: `http://localhost:4000/api`

### Optional: GCS direct uploads + signed playback URLs
Set environment variables (recommend putting them in repo root `.env`) before starting the backend:

```
STORAGE_BACKEND=gcs
GCS_BUCKET=your-bucket
GCS_SIGNING_EMAIL=service-account@project.iam.gserviceaccount.com
GCS_SIGNING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GCS_UPLOAD_EXPIRES=900
```

### 3) AI service
```
python -m venv ai/.venv
.\ai\.venv\Scripts\activate
pip install -r ai/requirements.txt
uvicorn ai.app.main:app --reload --port 8000
```

### 4) Chrome extension
- Open `chrome://extensions`
- Enable Developer Mode
- Load unpacked `extension/`
- Login in the popup (seeded user: `demo@qaassist.local` / `demo123`)
- Click Start to record
- Use the Web app button in the popup to open the Vite UI.

### 5) Web app
```
cd webapp
npm install
npm run dev
```
Open `http://localhost:5173` and login with the seeded user.

## Submission
- `docs/submission.md` — demo/video/public link placeholders
- `docs/demo-script.md` — demo flow
- `docs/writeup.md` — hackathon writeup draft
- `docs/release-checklist.md` — demo/release readiness checklist

## Playwright verifier
Download and execute the generated Playwright script for a session:

```
QA_AUTH_TOKEN=... npm run verify:playwright -- --session <session_id>
```
