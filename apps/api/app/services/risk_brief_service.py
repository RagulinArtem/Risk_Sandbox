import json
import logging

from app.core.config import get_settings
from app.domain.risk.engine import DirectAssetShockEngine
from app.integrations.ai.base import AIProviderUnavailableError
from app.integrations.ai.openrouter import chat_json
from app.schemas.cockpit import EvidenceItem, RiskBriefRequest, RiskBriefResponse

logger = logging.getLogger(__name__)

_BRIEF_PROMPT = """You are writing a concise institutional portfolio risk brief.
Use ONLY the supplied deterministic metrics and scenario metadata. Do not calculate,
alter or introduce portfolio numbers. Do not recommend trades.

Supplied analysis (JSON):
{payload}

Return ONLY JSON with these prose fields:
{{
  "summary": "2 concise sentences",
  "primary_driver": "1 sentence using only supplied driver metrics",
  "transmission": "1 concise sentence",
  "model_agreement": "1 sentence; say not assessed if no committee output",
  "key_assumption": "1 sentence",
  "signals_to_watch": ["0-3 concise items from supplied committee watch items only"]
}}
"""


def _pct(value: float) -> str:
    return f"{value:+.1%}"


def _money(value: float) -> str:
    sign = "-" if value < 0 else "+"
    return f"{sign}${abs(value):,.0f}"


def _shock_evidence(request: RiskBriefRequest) -> EvidenceItem:
    scenario = request.scenario
    if scenario.assumption_source == "user_edited":
        category = "USER INPUT"
        detail = "At least one scenario shock was edited in the browser before calculation."
    elif scenario.assumption_source == "ai_estimate" or scenario.shock_rationale:
        category = "AI ESTIMATE"
        detail = "Asset shocks were proposed by an AI model and remain illustrative assumptions."
    elif scenario.assumption_source == "historical":
        category = "HISTORICAL"
        detail = "Asset moves replay a documented historical market window."
    elif scenario.source_status == "verified":
        category = "VERIFIED"
        detail = "Shock assumptions are tied to a manually verified source."
    elif scenario.source_status == "live":
        category = "LIVE"
        detail = "Shock assumptions came from an attributed live source."
    else:
        category = "ILLUSTRATIVE"
        detail = "Shock assumptions are demo inputs, not forecasts."
    return EvidenceItem(
        component="Shock assumptions",
        category=category,
        detail=detail,
        source_name=scenario.source_name,
        source_url=scenario.source_url,
    )


def _scenario_evidence(request: RiskBriefRequest) -> EvidenceItem:
    scenario = request.scenario
    category = {
        "illustrative": "ILLUSTRATIVE",
        "verified": "VERIFIED",
        "live": "LIVE",
    }[scenario.source_status]
    return EvidenceItem(
        component="Scenario source",
        category=category,
        detail=(
            "Scenario provenance as supplied by the scenario library or current workflow."
        ),
        source_name=scenario.source_name,
        source_url=scenario.source_url,
    )


def _fallback(request: RiskBriefRequest) -> RiskBriefResponse:
    scenario = request.scenario
    result = DirectAssetShockEngine().run(
        portfolio=request.portfolio,
        asset_shocks=scenario.asset_shocks,
        scenario_id=scenario.id,
        scenario_title=scenario.title,
    )
    negative_total = abs(
        sum(item.impact_value for item in result.asset_impacts if item.impact_value < 0)
    )
    primary = result.biggest_negative_contributor
    share = abs(primary.impact_value) / negative_total if primary and negative_total else None
    primary_text = (
        f"{primary.symbol} contributes {_money(primary.impact_value)}"
        + (f", or {share:.0%} of modeled gross downside." if share is not None else ".")
        if primary
        else "No holding has a modeled downside contribution in this scenario."
    )
    if request.committee:
        agreement = (
            "The committee recorded no material disagreement."
            if not request.committee.disagreements
            else "Committee disagreement is concentrated in: "
            + "; ".join(request.committee.disagreements[:2])
        )
        watch = request.committee.watch[:3]
    else:
        agreement = "Model agreement was not assessed; no committee verdict was supplied."
        watch = []

    evidence = [
        _scenario_evidence(request),
        _shock_evidence(request),
        EvidenceItem(
            component="Portfolio weights",
            category="USER INPUT",
            detail="The selected portfolio allocation is the basis for every contribution.",
        ),
        EvidenceItem(
            component="Portfolio math",
            category="DETERMINISTIC",
            detail="Impact, stressed value and holding contributions use DirectAssetShockEngine.",
        ),
    ]
    if request.probability_signal and request.probability_signal.probability_value is not None:
        signal = request.probability_signal
        evidence.append(
            EvidenceItem(
                component="Prediction-market signal",
                category="LIVE",
                detail=(
                    f"External attention signal preserved at {signal.probability_value:.1%}; "
                    "it is not multiplied by scenario loss."
                ),
                source_name=signal.source_name,
                source_url=signal.source_url,
                retrieved_at=signal.retrieved_at,
            )
        )
    if request.committee and request.committee.historical:
        evidence.append(
            EvidenceItem(
                component="Historical analogues",
                category="HISTORICAL",
                detail=(
                    f"{len(request.committee.historical)} committee-selected analogue(s) "
                    "were replayed by the deterministic engine."
                ),
            )
        )

    summary = (
        f"{scenario.title} produces a modeled portfolio impact of "
        f"{_pct(result.estimated_impact_pct)} ({_money(result.estimated_impact_value)}). "
        "This is a stress-test result under explicit assumptions, not a forecast."
    )
    key_assumption = (
        f"The result is especially sensitive to the {primary.symbol} shock of "
        f"{_pct(primary.shock_pct)} because it is the largest modeled downside contributor."
        if primary
        else "No downside sensitivity dominates under the supplied assumptions."
    )
    return RiskBriefResponse(
        result=result,
        generated_by="deterministic",
        summary=summary,
        primary_driver=primary_text,
        primary_driver_share_of_downside=share,
        transmission=" → ".join(scenario.transmission),
        model_agreement=agreement,
        key_assumption=key_assumption,
        signals_to_watch=watch,
        evidence=evidence,
    )


def build_risk_brief(request: RiskBriefRequest) -> RiskBriefResponse:
    fallback = _fallback(request)
    settings = get_settings()
    if (
        not request.use_ai
        or settings.ai_provider != "openrouter"
        or not settings.openrouter_api_key
    ):
        return fallback

    payload = {
        "scenario": {
            "title": request.scenario.title,
            "description": request.scenario.description,
            "transmission": request.scenario.transmission,
        },
        "deterministic_metrics": {
            "impact_pct": fallback.result.estimated_impact_pct,
            "impact_value": fallback.result.estimated_impact_value,
            "stressed_value": fallback.result.stressed_value,
            "primary_driver": fallback.primary_driver,
            "key_assumption": fallback.key_assumption,
        },
        "committee": (
            {
                "verdict": request.committee.verdict,
                "disagreements": request.committee.disagreements,
                "watch": request.committee.watch,
            }
            if request.committee
            else None
        ),
    }
    try:
        prose = chat_json(
            settings,
            settings.openrouter_model,
            _BRIEF_PROMPT.format(payload=json.dumps(payload, indent=1)),
            max_tokens=900,
        )
    except AIProviderUnavailableError as exc:
        logger.warning("Risk brief AI unavailable; using deterministic fallback: %s", exc)
        return fallback

    def text(key: str, default: str) -> str:
        value = str(prose.get(key) or "").strip()
        return value[:900] or default

    watch = prose.get("signals_to_watch")
    safe_watch = (
        [str(item).strip()[:240] for item in watch if str(item).strip()][:3]
        if isinstance(watch, list) and request.committee
        else fallback.signals_to_watch
    )
    return fallback.model_copy(
        update={
            "generated_by": "ai",
            "model": settings.openrouter_model,
            "summary": text("summary", fallback.summary),
            "primary_driver": text("primary_driver", fallback.primary_driver),
            "transmission": text("transmission", fallback.transmission),
            "model_agreement": text("model_agreement", fallback.model_agreement),
            "key_assumption": text("key_assumption", fallback.key_assumption),
            "signals_to_watch": safe_watch,
            "evidence": [
                *fallback.evidence,
                EvidenceItem(
                    component="Risk brief commentary",
                    category="AI ESTIMATE",
                    detail=(
                        "Prose was generated from deterministic metrics; "
                        "the model did not calculate P&L."
                    ),
                    source_name=settings.openrouter_model,
                ),
            ],
        }
    )
