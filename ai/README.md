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
- GEMINI_API_KEY (legacy fallback)
- GEMINI_MODEL (default: gemini-1.5-pro)
