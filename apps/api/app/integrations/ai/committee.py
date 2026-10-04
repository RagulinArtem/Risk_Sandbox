"""AI Risk Committee — multi-agent orchestration (PRD differentiator).

One model gives you false confidence. Three analysts from three different
labs, each arguing an independent lens, reconciled by a chair from a
fourth lab, surface both the consensus AND how uncertain it is. The math
stays out of the LLMs entirely (Principle 2 in AGENTS.md): analysts and
the chair only ever propose *assumptions* (per-asset shocks) and
commentary; every portfolio number is computed by the deterministic
engine in the verdict route.

Why different labs: models trained by the same lab tend to share blind
spots. Why different lenses: an identical prompt pulls answers toward the
middle, so each seat gets a distinct role — that's what makes the spread
between analysts informative instead of noise.

Orchestration shape: the browser fans out one POST /api/ai/committee/
analyst call per seat (cards render as each model answers), then one
POST /api/ai/committee/verdict call. The API stays stateless — no job
queue, no SSE. A failed analyst is simply absent from the verdict call;
the chair reconciles whoever succeeded.
"""

import json
import logging

from app.core.config import Settings
from app.integrations.ai.base import AIProviderUnavailableError
from app.integrations.ai.openrouter import (
    _ASSET_LINES,
    clean_rationale,
    clean_shocks,
    complete_json,
)
from app.schemas.committee import (
    AnalystView,
    CommitteeContext,
    CommitteeRoster,
    CommitteeSeatInfo,
    VerdictRequest,
)

logger = logging.getLogger(__name__)

_MAX_TEXT_CHARS = 400
_MAX_LIST_ITEMS = 5

# Reasoning effort "low" cuts latency 2-3x on reasoning models with no
# visible quality loss for this task (benchmark 2026-10-04).
_OPENROUTER_REASONING_EFFORT = "low"

_ALLOWED_SEATS = ("macro", "sector", "cross_asset")


def _seat_specs(settings: Settings) -> list[dict]:
    return [
        {
            "seat": "macro",
            "label": "Macro & Rates Strategist",
            "lens": "Top-down: central banks, inflation, real yields, the dollar",
            "model": settings.committee_macro_model,
        },
        {
            "seat": "sector",
            "label": "Sector & Earnings Analyst",
            "lens": "Bottom-up: revenues, margins, supply chains, valuation multiples",
            "model": settings.committee_sector_model,
        },
        {
            "seat": "cross_asset",
            "label": "Cross-Asset & History Specialist",
            "lens": "Historical analogues, bond duration math, gold and crypto flows",
            "model": settings.committee_cross_asset_model,
        },
    ]


def chair_spec(settings: Settings) -> dict:
    return {
        "seat": "chair",
        "label": "Committee Chair",
        "lens": "Reconciles the analysts and writes the portfolio takeaways",
        "model": settings.committee_chair_model,
    }


def _coerce_confidence(raw: object) -> str:
    confidence = str(raw or "medium").strip().lower()
    return confidence if confidence in ("low", "medium", "high") else "medium"


def sanitize_views(views: list[AnalystView]) -> list[AnalystView]:
    """Apply the same guard rails to client-supplied views that we apply to
    model output: known seats only, no duplicates, supported symbols, shocks
    outside -95%..+200% dropped, rationale only for kept symbols, texts capped."""
    cleaned: list[AnalystView] = []
    seen: set[str] = set()
    for view in views:
        if view.seat not in _ALLOWED_SEATS or view.seat in seen:
            logger.warning("Dropping committee view with seat %r", view.seat)
            continue
        shocks = clean_shocks(view.asset_shocks)
        if not shocks:
            logger.warning("Dropping committee view %r with no usable shocks", view.seat)
            continue
        seen.add(view.seat)
        cleaned.append(
            view.model_copy(
                update={
                    "asset_shocks": shocks,
                    "rationale": clean_rationale(view.rationale, shocks),
                    "thesis": view.thesis[:_MAX_TEXT_CHARS],
                    "key_risk": view.key_risk[:_MAX_TEXT_CHARS],
                    "confidence": _coerce_confidence(view.confidence),
                }
            )
        )
    return cleaned


def get_roster(settings: Settings) -> CommitteeRoster:
    enabled = settings.ai_provider == "openrouter" and bool(settings.openrouter_api_key)
    note = None
    if not enabled:
        note = (
            "The committee needs AI_PROVIDER=openrouter with OPENROUTER_API_KEY set. "
            "The rest of the app keeps working offline."
        )
    return CommitteeRoster(
        enabled=enabled,
        provider=settings.ai_provider,
        seats=[CommitteeSeatInfo(**spec) for spec in _seat_specs(settings)],
        chair=CommitteeSeatInfo(**chair_spec(settings)),
        note=note,
    )


def _context_block(context: CommitteeContext) -> str:
    holdings = "\n".join(
        f"- {p.symbol}: {p.weight:.0%} of the portfolio"
        for p in sorted(context.portfolio.positions, key=lambda p: -p.weight)
    )
    transmission = "\n".join(f"- {step}" for step in context.transmission) or "- (not provided)"
    return (
        f"Scenario: {context.scenario_title}\n"
        f"Description: {context.scenario_description or '(not provided)'}\n"
        f"Horizon: {context.horizon}\n"
        f"Transmission chain:\n{transmission}\n\n"
        f"The user's portfolio:\n{holdings}\n"
        f"Total value: {context.portfolio.total_value:,.0f} {context.portfolio.currency}"
    )


_ANALYST_PROMPT = """You are the {label} on a portfolio risk committee. Your lens: {lens}.

{context}

Argue YOUR lens specifically — do not hedge everything to the middle. Be \
independent: the other analysts see the same scenario and will reach their \
own conclusions. Ground magnitudes in comparable historical episodes and \
each asset's typical sensitivity; don't exaggerate.

These are the assets you may shock:
{assets}

Respond with ONLY a JSON object, no markdown:
{{
  "asset_shocks": {{"NVDA": -0.22, ...}},
  "rationale": {{"NVDA": "one short sentence", ...}},
  "thesis": "at most 2 sentences",
  "key_risk": "what would make this materially worse",
  "confidence": "low | medium | high"
}}
asset_shocks: signed decimal price move over the horizon (-0.22 = -22%), one \
per asset, 0 if genuinely unaffected. Describe risk only — never recommend \
buying, selling or hedging. Never predict whether the scenario will happen."""


def run_analyst(seat_key: str, context: CommitteeContext, settings: Settings) -> AnalystView:
    spec = next((s for s in _seat_specs(settings) if s["seat"] == seat_key), None)
    if spec is None:
        raise ValueError(f"Unknown committee seat: {seat_key}")

    prompt = _ANALYST_PROMPT.format(
        label=spec["label"],
        lens=spec["lens"],
        context=_context_block(context),
        assets=_ASSET_LINES,
    )
    data = _complete(settings, spec["model"], prompt)

    shocks = clean_shocks(data.get("asset_shocks"))
    if not shocks:
        raise AIProviderUnavailableError(f"The {spec['label']} returned no usable shocks.")
    confidence = _coerce_confidence(data.get("confidence"))

    return AnalystView(
        seat=spec["seat"],
        label=spec["label"],
        model=spec["model"],
        asset_shocks=shocks,
        rationale=clean_rationale(data.get("rationale"), shocks),
        thesis=str(data.get("thesis") or "").strip()[:_MAX_TEXT_CHARS],
        key_risk=str(data.get("key_risk") or "").strip()[:_MAX_TEXT_CHARS],
        confidence=confidence,
    )


_CHAIR_PROMPT = """You are the {label} of a portfolio risk committee. Three analysts \
argued independently from different lenses. Weigh their arguments — do not \
just average their numbers. Name where they split and which side you lean \
to and why.

{context}

The analysts' views (JSON):
{views}

Respond with ONLY a JSON object, no markdown:
{{
  "consensus": {{"NVDA": -0.18, ...}},
  "consensus_rationale": {{"NVDA": "how you reconciled the views for this asset", ...}},
  "verdict": "2-3 sentences: what this scenario means for THIS portfolio",
  "insights": ["exactly 3 short insights specific to this portfolio"],
  "disagreements": ["where the analysts split and which side you lean to"],
  "watch": ["signals to watch that would change this assessment"],
  "confidence": "low | medium | high"
}}
consensus: signed decimal price move per asset (-0.18 = -18%), 0 if \
unaffected. Describe risk only — never recommend buying, selling, hedging \
or timing. Never predict whether the scenario will happen. Use no numbers \
in verdict/insights beyond those implied by the shocks you set."""


def run_chair(request: VerdictRequest, settings: Settings) -> tuple[AnalystView, dict]:
    """The chair reconciles only the views that succeeded — failed analysts
    are absent from request.views by construction (browser fan-out).

    Returns (chair view with consensus shocks, raw chair data) so the
    verdict route can extract commentary (verdict/insights/disagreements/
    watch) from the same response."""
    spec = chair_spec(settings)
    views_json = json.dumps(
        [
            {
                "seat": view.seat,
                "label": view.label,
                "asset_shocks": view.asset_shocks,
                "rationale": view.rationale,
                "thesis": view.thesis,
                "key_risk": view.key_risk,
                "confidence": view.confidence,
            }
            for view in request.views
        ],
        indent=2,
    )
    prompt = _CHAIR_PROMPT.format(
        label=spec["label"],
        context=_context_block(request),
        views=views_json,
    )
    data = _complete(settings, spec["model"], prompt)

    shocks = clean_shocks(data.get("consensus") or data.get("asset_shocks"))
    if not shocks:
        raise AIProviderUnavailableError("The committee chair returned no usable consensus.")
    confidence = _coerce_confidence(data.get("confidence"))

    chair_view = AnalystView(
        seat="chair",
        label=spec["label"],
        model=spec["model"],
        asset_shocks=shocks,
        rationale=clean_rationale(data.get("consensus_rationale"), shocks),
        thesis=str(data.get("verdict") or "").strip()[:_MAX_TEXT_CHARS],
        confidence=confidence,
        key_risk="",
    )
    return chair_view, data


def extract_commentary(chair_data: dict) -> dict:
    """Pull the chair's commentary fields (verdict/insights/disagreements/
    watch) out of the raw chair JSON, truncated server-side. Used by the
    verdict route alongside run_chair's consensus shocks."""
    def _clean_list(raw: object, limit: int = _MAX_LIST_ITEMS) -> list[str]:
        if not isinstance(raw, list):
            return []
        return [str(item).strip()[:_MAX_TEXT_CHARS] for item in raw if str(item).strip()][
            :limit
        ]

    return {
        "verdict": str(chair_data.get("verdict") or "").strip()[:_MAX_TEXT_CHARS],
        # The design fixes the committee at exactly three insights.
        "insights": _clean_list(chair_data.get("insights"), limit=3),
        "disagreements": _clean_list(chair_data.get("disagreements")),
        "watch": _clean_list(chair_data.get("watch")),
        "confidence": str(chair_data.get("confidence") or "medium").strip().lower(),
    }


def _complete(settings: Settings, model: str, prompt: str) -> dict:
    """complete_json with the committee's per-seat model id and reasoning
    effort."""
    return complete_json(
        settings,
        prompt,
        model=model,
        max_tokens=900,
        reasoning_effort=_OPENROUTER_REASONING_EFFORT,
    )
