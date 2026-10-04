from typing import Literal

from pydantic import BaseModel

from app.schemas.scenario import Scenario
from app.schemas.stress_test import StressTestResult


class ParseScenarioRequest(BaseModel):
    text: str


class ParseScenarioResponse(BaseModel):
    recognized: bool
    scenario: Scenario | None
    message: str | None


class AIStatusResponse(BaseModel):
    provider: str  # "mock" | "bedrock" | "openrouter"
    is_live: bool  # false for "mock" — lets the UI avoid claiming "not live AI" when it is


class EstimateShocksRequest(BaseModel):
    scenario: Scenario


class EstimateShocksResponse(BaseModel):
    scenario: Scenario | None
    message: str | None


class ExplainRequest(BaseModel):
    """The engine's result JSON only — never user text (see PRD FR7 and
    the security note in the technical spec)."""

    result: StressTestResult


class ExplainResponse(BaseModel):
    text: str
    # "llm" = live model output that passed the number guard;
    # "template" = deterministic fallback built from engine fields.
    ai_status: Literal["llm", "template"]
