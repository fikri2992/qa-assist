from __future__ import annotations

from fastapi import FastAPI

from ai.app.api.analysis import router as analysis_router
from ai.app.api.chat import router as chat_router
from ai.app.api.health import router as health_router
from ai.core.config import settings
from ai.core.logging import configure_logging

configure_logging()

app = FastAPI(title=settings.app_name)
app.include_router(health_router)
app.include_router(analysis_router)
app.include_router(chat_router)
app.include_router(health_router, prefix="/v1")
app.include_router(analysis_router, prefix="/v1")
app.include_router(chat_router, prefix="/v1")
