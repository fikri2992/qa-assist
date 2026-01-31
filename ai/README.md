# QA Assist AI Service

Run locally:

```
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Endpoints:
- GET /health
- POST /analyze
- POST /aggregate

Optional env:
- ADK_ENABLED (default: true when API key is present)
- GOOGLE_API_KEY (preferred for ADK)
- ADK_TEXT_MODEL (default: gemini-3-flash)
- ADK_VIDEO_MODEL (default: gemini-3-pro-preview)
- GEMINI_API_KEY (legacy fallback)
- GEMINI_MODEL (default: gemini-1.5-pro)
