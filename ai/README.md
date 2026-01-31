# QA Assist AI Service

Run locally:

```
cd ..
python -m venv ai/.venv
.\ai\.venv\Scripts\activate
pip install -r ai/requirements.txt
uvicorn ai.app.main:app --reload --port 8000
```

Endpoints:
- GET /health
- POST /analyze
- POST /aggregate
- POST /chat

## Response schema (AI)
Common fields returned by `/analyze` and `/aggregate`:
- `summary` (string)
- `suspected_root_cause` (string | null)
- `issues` (array of objects)
  - `title` (string)
  - `severity` (low|medium|high|unknown)
  - `detail` (string)
  - `ts` or `timestamp_start`/`timestamp_end` (ISO string)
  - `source` / `category` (string)
- `evidence` (array of objects)
  - `type` (console|network|video|annotation|marker)
  - `message` / `url` / `status` / `timestamp` (string/number)
- `repro_steps` (array of strings)
- `severity_breakdown` (object; counts per severity)
- `top_issues` (array; subset of issues)
- `chunk_id`, `chunk_idx`, `session_id` (chunk-level only)
- `agents` (array; chunk-level only)

Structure:
- `ai/app/` FastAPI app + routes
- `ai/services/` orchestrators + integrations
- `ai/models/` Pydantic schemas
- `ai/core/` config/logging utilities

Optional env:
- ADK_ENABLED (default: true when API key is present)
- GOOGLE_API_KEY (preferred for ADK)
- ADK_TEXT_MODEL (default: gemini-3-flash)
- ADK_VIDEO_MODEL (default: gemini-3-pro-preview)
- LOG_LEVEL (default: INFO)
- CHECKPOINT_DIR (default: ai/.checkpoints)
- CHECKPOINT_TTL_HOURS (default: 48)
- GEMINI_API_KEY (legacy fallback)
- GEMINI_MODEL (default: gemini-1.5-pro)
