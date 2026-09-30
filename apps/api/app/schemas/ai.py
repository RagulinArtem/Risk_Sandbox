from pydantic import BaseModel

from app.schemas.scenario import Scenario


class ParseScenarioRequest(BaseModel):
    text: str


class ParseScenarioResponse(BaseModel):
    recognized: bool
    scenario: Scenario | None
    message: str | None
