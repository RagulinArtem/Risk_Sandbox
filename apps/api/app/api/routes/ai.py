import math
import re

from fastapi import APIRouter

from app.core.config import get_settings
from app.integrations.ai import get_ai_provider
from app.integrations.ai.base import AIProviderUnavailableError, UnrecognizedScenarioError
from app.integrations.ai.openrouter import complete_json
from app.schemas.ai import (
    AIStatusResponse,
    EstimateShocksRequest,
    EstimateShocksResponse,
    ExplainRequest,
    ExplainResponse,
    ParseScenarioRequest,
    ParseScenarioResponse,
)
from app.schemas.scenario import Scenario
from app.services.scenario_service import get_scenario_service

router = APIRouter(prefix="/api/ai", tags=["ai"])

_EXPLAIN_PROMPT = """Explain this portfolio stress-test result to someone with no \
finance background. Use ONLY the numbers in the JSON. Write at most 120 words \
in plain English: 1) one sentence with the headline impact; 2) which holding \
drives most of it and why, using the scenario assumptions; 3) one sentence \
that results use historical betas and the scenario assumptions and are not a \
forecast. Do not tell the user to buy, sell or hold. Do not mention \
probabilities unless the JSON has a probability.

Respond with ONLY a JSON object: {{"text": "your explanation"}}

Result JSON:
{result_json}"""

# "11,500", "-9.2", "78%", "0.078" — commas allowed in grouped digits.
_NUMBER_RE = re.compile(r"-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?")

_CANONICAL_SCENARIO_ALIASES = {
    "ai bubble burst": "ai-capex-bust",
    "ai bubble bursts": "ai-capex-bust",
    "if the ai bubble bursts": "ai-capex-bust",
}


def _canonical_scenario_for_text(text: str) -> Scenario | None:
    """Resolve explicit demo titles before calling a non-deterministic parser.

    Typing a scenario's name should be equivalent to choosing it from the
    library. This keeps the live pitch reproducible without presenting the
    illustrative assumptions as model-generated facts.
    """
    normalized = " ".join(re.sub(r"[^a-z0-9]+", " ", text.lower()).split())
    scenario_id = _CANONICAL_SCENARIO_ALIASES.get(normalized)
    return get_scenario_service().get_scenario(scenario_id) if scenario_id else None


@router.get("/status", response_model=AIStatusResponse)
def ai_status() -> AIStatusResponse:
    """Lets the frontend know whether scenario parsing is currently the
    offline rule-based mock or a real LLM call, so it never shows a "not
    live AI" hint while AI_PROVIDER is configured to use one."""
    provider = get_settings().ai_provider
    return AIStatusResponse(provider=provider, is_live=provider != "mock")


@router.post("/parse-scenario", response_model=ParseScenarioResponse)
def parse_scenario(request: ParseScenarioRequest) -> ParseScenarioResponse:
    canonical = _canonical_scenario_for_text(request.text)
    if canonical is not None:
        return ParseScenarioResponse(recognized=True, scenario=canonical, message=None)

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


@router.post("/explain", response_model=ExplainResponse)
def explain(request: ExplainRequest) -> ExplainResponse:
    """Plain-English explanation of an engine result (PRD FR7). The model
    receives ONLY the engine's result JSON and must pass the number guard:
    every figure in its text must exist in the result. Anything else —
    provider down, unconfigured, invented numbers — falls back to the
    deterministic template, labeled ai_status="template"."""
    template = _template_explanation(request.result)

    settings = get_settings()
    if settings.ai_provider == "mock":
        return ExplainResponse(text=template, ai_status="template")

    try:
        data = complete_json(
            settings,
            _EXPLAIN_PROMPT.format(result_json=request.result.model_dump_json()),
            max_tokens=400,
            temperature=0.2,
        )
    except AIProviderUnavailableError:
        return ExplainResponse(text=template, ai_status="template")

    text = str(data.get("text") or "").strip()
    if not text or not _numbers_accounted_for(text, request.result):
        return ExplainResponse(text=template, ai_status="template")
    return ExplainResponse(text=text[:1200], ai_status="llm")


def _template_explanation(result) -> str:
    """Deterministic fallback built only from engine fields."""
    share_sentence = ""
    top = result.biggest_negative_contributor
    if top is not None and result.estimated_impact_value < 0:
        share = top.impact_value / result.estimated_impact_value
        share_sentence = f" {top.symbol} accounts for about {share:.0%} of the estimated loss."
    return (
        f"In this scenario your portfolio would move by {result.estimated_impact_pct:.1%} "
        f"(from {result.initial_value:,.0f} to {result.stressed_value:,.0f})."
        f"{share_sentence} "
        "These figures use the scenario assumptions shown and are not a forecast."
    )


def _numbers_accounted_for(text: str, result) -> bool:
    """Number guard: every number the model wrote must appear in the result
    JSON (rounding-tolerant, and fraction/percent forms both allowed)."""
    allowed: set[float] = set()
    for value in (
        result.initial_value,
        result.stressed_value,
        result.estimated_impact_value,
        abs(result.estimated_impact_value),
        result.estimated_impact_pct,
        result.estimated_impact_pct * 100,
        abs(result.estimated_impact_pct * 100),
    ):
        allowed.add(float(value))
    for asset in result.asset_impacts:
        for value in (
            asset.impact_value,
            abs(asset.impact_value),
            asset.impact_pct_of_portfolio,
            asset.impact_pct_of_portfolio * 100,
            asset.weight,
            asset.weight * 100,
            asset.shock_pct,
            asset.shock_pct * 100,
            asset.position_value,
        ):
            allowed.add(float(value))
    if result.probability is not None:
        for value in (result.probability, result.probability * 100):
            allowed.add(float(value))
    if result.weighted_exposure_pct is not None:
        for value in (
            result.weighted_exposure_pct,
            result.weighted_exposure_pct * 100,
            abs(result.weighted_exposure_pct),
            abs(result.weighted_exposure_pct * 100),
        ):
            allowed.add(float(value))

    for match in _NUMBER_RE.finditer(text):
        try:
            number = float(match.group(0).replace(",", ""))
        except ValueError:
            continue
        if not any(
            math.isclose(number, candidate, rel_tol=0.02, abs_tol=0.15)
            for candidate in allowed
        ):
            return False
    return True
