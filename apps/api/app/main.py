import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import (
    ai,
    assets,
    committee,
    health,
    markets,
    portfolio,
    risk_radar,
    scenarios,
    stress_test,
)
from app.core.config import get_settings

logger = logging.getLogger("portfolio_risk_copilot")

settings = get_settings()

app = FastAPI(
    title="AI Portfolio Risk Copilot API",
    description="Deterministic portfolio stress-testing API. See docs/API_CONTRACT.md.",
    version="0.2.0",
)

_allowed_origins = list(
    {settings.frontend_origin, "http://localhost:5173", "http://127.0.0.1:5173"}
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(scenarios.router)
app.include_router(portfolio.router)
app.include_router(assets.router)
app.include_router(stress_test.router)
app.include_router(risk_radar.router)
app.include_router(markets.router)
app.include_router(ai.router)
app.include_router(committee.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # HTTPException and request-validation errors already get FastAPI's own
    # structured responses before this ever runs. This only catches truly
    # unexpected errors, so the UI never sees a raw stack trace.
    logger.exception("Unhandled error while processing %s %s", request.method, request.url)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})
