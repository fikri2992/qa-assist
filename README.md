# QA Assist

Monorepo for the exploratory testing assistant.

## Components
- `backend/` Phoenix API + Postgres
- `extension/` Chrome MV3 recorder
- `webapp/` Static playback UI
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

### Optional: GCS direct uploads
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
cd ai
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4) Chrome extension
- Open `chrome://extensions`
- Enable Developer Mode
- Load unpacked `extension/`
- Set API URL in popup and click Start

### 5) Web app
```
cd webapp
python -m http.server 5173
```
Open `http://localhost:5173` and enter the device id.
