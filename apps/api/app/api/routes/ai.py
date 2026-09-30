from fastapi import APIRouter

from app.integrations.ai import get_ai_provider
from app.integrations.ai.base import AIProviderUnavailableError, UnrecognizedScenarioError
from app.schemas.ai import ParseScenarioRequest, ParseScenarioResponse

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/parse-scenario", response_model=ParseScenarioResponse)
def parse_scenario(request: ParseScenarioRequest) -> ParseScenarioResponse:
    provider = get_ai_provider()
    try:
        scenario = provider.parse_scenario(request.text)
        return ParseScenarioResponse(recognized=True, scenario=scenario, message=None)
    except UnrecognizedScenarioError:
        return ParseScenarioResponse(
            recognized=False,
            scenario=None,
            message=(
                "We couldn't automatically map this scenario. Try mentioning oil, "
                "Nasdaq/tech, interest rates, Bitcoin, or the broad market together "
                "with a percentage move — or build the scenario manually below."
            ),
        )
    except AIProviderUnavailableError as exc:
        return ParseScenarioResponse(recognized=False, scenario=None, message=str(exc))
