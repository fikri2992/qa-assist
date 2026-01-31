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
