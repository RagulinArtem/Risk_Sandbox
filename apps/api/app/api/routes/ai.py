from fastapi import APIRouter

from app.core.config import get_settings
from app.integrations.ai import get_ai_provider
from app.integrations.ai.base import AIProviderUnavailableError, UnrecognizedScenarioError
from app.schemas.ai import (
    AIStatusResponse,
    EstimateShocksRequest,
    EstimateShocksResponse,
    ParseScenarioRequest,
    ParseScenarioResponse,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/status", response_model=AIStatusResponse)
def ai_status() -> AIStatusResponse:
    """Lets the frontend know whether scenario parsing is currently the
    offline rule-based mock or a real LLM call, so it never shows a "not
    live AI" hint while AI_PROVIDER is configured to use one."""
    provider = get_settings().ai_provider
    return AIStatusResponse(provider=provider, is_live=provider != "mock")


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


@router.post("/estimate-shocks", response_model=EstimateShocksResponse)
def estimate_shocks(request: EstimateShocksRequest) -> EstimateShocksResponse:
    """Ask the live LLM to propose per-asset shocks (with a rationale each)
    for an existing scenario. The stress engine still does all the math."""
    try:
        scenario = get_ai_provider().estimate_shocks(request.scenario)
        return EstimateShocksResponse(scenario=scenario, message=None)
    except AIProviderUnavailableError as exc:
        return EstimateShocksResponse(scenario=None, message=str(exc))
