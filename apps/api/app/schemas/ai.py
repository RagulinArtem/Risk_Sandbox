from pydantic import BaseModel

from app.schemas.scenario import Scenario


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
