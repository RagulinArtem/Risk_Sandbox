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

Analysts are also grounded in verified historical episodes (real market
data, replayed on THIS portfolio by the engine — see analogue_service),
so "how did this portfolio fare in comparable episodes" is a fact, not
an opinion. The LLM may only pick *which* listed episode is relevant and
say why; the numbers come from the engine.

Orchestration shape: the browser fans out one POST /api/ai/committee/
analyst call per seat (cards render as each model answers), then one
POST /api/ai/committee/verdict call. The API stays stateless — no job
queue, no SSE. A failed analyst is simply absent from the verdict call;
the chair reconciles whoever succeeded.
"""

import json
import logging
from concurrent.futures import ThreadPoolExecutor

from app.core.config import Settings
from app.integrations.ai.base import AIProviderUnavailableError
from app.integrations.ai.openrouter import (
    asset_lines,
    clean_rationale,
    clean_shocks,
    complete_json,
)
from app.schemas.committee import (
    AnalogueRef,
    AnalystView,
    CommitteeContext,
    CommitteeRoster,
    CommitteeSeatInfo,
    RevisionView,
    VerdictRequest,
)
from app.schemas.market import MarketContextSignal
from app.services.analogue_service import analogue_prompt_block, historical_scenarios

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


def _clean_analogues(raw: object, limit: int) -> list[AnalogueRef]:
    """Keep only picks of verified episodes we actually have real data for;
    anything else the model named is dropped, never shown."""
    known = {s.id: s for s in historical_scenarios()}
    out: list[AnalogueRef] = []
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict) or item.get("id") not in known:
            continue  # an episode we have no real data for is dropped
        if any(a.id == item["id"] for a in out):
            continue
        out.append(
            AnalogueRef(
                id=item["id"],
                title=known[item["id"]].title,
                why=str(item.get("why") or "").strip()[:300],
                difference=str(item.get("difference") or "").strip()[:300],
            )
        )
    return out[:limit]


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
                    "analogues": _clean_analogues(
                        [a.model_dump() for a in view.analogues], 3
                    ),
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


def _context_block(
    context: CommitteeContext, market_signal: MarketContextSignal | None = None
) -> str:
    holdings = "\n".join(
        f"- {p.symbol}: {p.weight:.0%} of the portfolio"
        for p in sorted(context.portfolio.positions, key=lambda p: -p.weight)
    )
    transmission = "\n".join(f"- {step}" for step in context.transmission) or "- (not provided)"
    block = (
        f"Scenario: {context.scenario_title}\n"
        f"Description: {context.scenario_description or '(not provided)'}\n"
        f"Horizon: {context.horizon}\n"
        f"Transmission chain:\n{transmission}\n\n"
        f"The user's portfolio:\n{holdings}\n"
        f"Total value: {context.portfolio.total_value:,.0f} {context.portfolio.currency}"
    )
    if market_signal is not None:
        change = (
            f"{market_signal.change_7d_pp:+.1f} pp over 7d"
            if market_signal.change_7d_pp is not None
            else "no 7d history"
        )
        change_30d = (
            f", {market_signal.change_30d_pp:+.1f} pp over 30d"
            if market_signal.change_30d_pp is not None
            else ""
        )
        block += (
            f"\n\nLive prediction-market signal (Polymarket, {market_signal.source_status}): "
            f'"{market_signal.question}" — market-implied probability '
            f"{market_signal.probability:.1%} ({change}{change_30d}, as of "
            f"{market_signal.as_of or 'unknown'}). This is a market-implied probability, "
            "not a forecast; use it as context only."
        )
    block += (
        "\n\nVerified historical episodes (REAL market data; the portfolio impacts "
        "were computed by our deterministic engine, so treat them as facts):\n"
        + analogue_prompt_block(context.portfolio)
    )
    return block


_ANALYST_PROMPT = """You are the {label} on a portfolio risk committee. Your lens: {lens}.

{context}

Argue YOUR lens specifically — do not hedge everything to the middle. Be \
independent: the other analysts see the same scenario and will reach their \
own conclusions. Ground magnitudes in the historical episodes above and each \
asset's typical sensitivity; anchor on the 1-2 most relevant episodes and say \
how this scenario differs (bigger, smaller, different mechanism). Never cite \
an episode that is not listed.

These are the assets you may shock:
{assets}

Respond with ONLY a JSON object, no markdown:
{{
  "asset_shocks": {{"NVDA": -0.22, ...}},
  "rationale": {{"NVDA": "one short sentence", ...}},
  "thesis": "at most 2 sentences",
  "key_risk": "what would make this materially worse",
  "confidence": "low | medium | high",
  "analogues": [{{"id": "<episode id>", "why": "one sentence", \
"difference": "how today differs"}}]
}}
asset_shocks: signed decimal price move over the horizon (-0.22 = -22%), one \
per asset, 0 if genuinely unaffected. Describe risk only — never recommend \
buying, selling or hedging. Never predict whether the scenario will happen."""

def run_analyst(
    seat_key: str,
    context: CommitteeContext,
    settings: Settings,
    market_signal: MarketContextSignal | None = None,
) -> AnalystView:
    spec = next((s for s in _seat_specs(settings) if s["seat"] == seat_key), None)
    if spec is None:
        raise ValueError(f"Unknown committee seat: {seat_key}")

    prompt = _ANALYST_PROMPT.format(
        label=spec["label"],
        lens=spec["lens"],
        context=_context_block(context, market_signal),
        assets=asset_lines([p.symbol for p in context.portfolio.positions]),
    )
    data, used_model = _complete(settings, spec["model"], prompt)

    shocks = clean_shocks(data.get("asset_shocks"))
    if not shocks:
        raise AIProviderUnavailableError(f"The {spec['label']} returned no usable shocks.")
    confidence = _coerce_confidence(data.get("confidence"))

    return AnalystView(
        seat=spec["seat"],
        label=spec["label"],
        model=used_model,
        fallback_from=spec["model"] if used_model != spec["model"] else None,
        asset_shocks=shocks,
        rationale=clean_rationale(data.get("rationale"), shocks),
        thesis=str(data.get("thesis") or "").strip()[:_MAX_TEXT_CHARS],
        key_risk=str(data.get("key_risk") or "").strip()[:_MAX_TEXT_CHARS],
        confidence=confidence,
        analogues=_clean_analogues(data.get("analogues"), 2),
        market_context=market_signal,
    )


_REBUTTAL_PROMPT = """You are the {label} on a portfolio risk committee. Your lens: {lens}.

{context}

Your own first-round view:
{own_view}

Two other analysts — whose identities and models you do NOT know — reviewed the same \
scenario independently:
{peers}

Reconsider your first-round assumptions. Keep them if you still believe them, or revise them if \
the peers surfaced something you missed. Do not average: stay in your lens. Describe risk only — \
never recommend buying, selling or hedging.

Respond with ONLY a JSON object, no markdown:
{{
  "asset_shocks": {{"NVDA": -0.22, ...}},
  "rationale": {{"NVDA": "one short sentence", ...}},
  "change": "one sentence: what you changed and why, or 'unchanged'",
  "confidence": "low | medium | high"
}}
asset_shocks: signed decimal price move over the horizon, one per asset, 0 if unaffected."""


def _payload(view: AnalystView) -> dict:
    return {
        "seat": view.seat, "label": view.label, "model": view.model,
        "asset_shocks": view.asset_shocks, "rationale": view.rationale,
        "thesis": view.thesis, "key_risk": view.key_risk, "confidence": view.confidence,
        "analogues": [a.model_dump() for a in view.analogues],
    }


def _anonymized(view: AnalystView) -> dict:
    return {
        "asset_shocks": view.asset_shocks, "rationale": view.rationale,
        "thesis": view.thesis, "key_risk": view.key_risk,
        "analogues": [a.model_dump() for a in view.analogues],
    }


def _fallback_revision(view: AnalystView) -> RevisionView:
    return RevisionView(
        seat=view.seat, label=view.label, model=view.model,
        asset_shocks=view.asset_shocks, rationale=view.rationale,
        change="", confidence=view.confidence, revised=False,
    )


def run_debate(
    views: list[AnalystView],
    context: CommitteeContext,
    settings: Settings,
    market_signal: MarketContextSignal | None = None,
) -> list[RevisionView]:
    """One rebuttal round, in parallel. A seat whose rebuttal call fails
    keeps its first-round view — the debate degrades, it never fails the
    committee. Fewer than two views means there is nothing to debate."""
    if len(views) < 2:
        return []
    context_text = _context_block(context, market_signal)
    specs = {spec["seat"]: spec for spec in _seat_specs(settings)}

    def revise(view: AnalystView) -> RevisionView:
        spec = specs[view.seat]
        peers = [_anonymized(other) for other in views if other.seat != view.seat]
        prompt = _REBUTTAL_PROMPT.format(
            label=spec["label"], lens=spec["lens"], context=context_text,
            own_view=json.dumps(_payload(view), indent=2), peers=json.dumps(peers, indent=2),
        )
        try:
            data, _ = _complete(settings, view.model, prompt)
        except AIProviderUnavailableError as exc:
            logger.warning("Rebuttal for %s failed: %s", view.seat, exc)
            return _fallback_revision(view)
        shocks = clean_shocks(data.get("asset_shocks"))
        if not shocks:
            return _fallback_revision(view)
        return RevisionView(
            seat=view.seat, label=view.label, model=view.model,
            asset_shocks=shocks,
            rationale=clean_rationale(data.get("rationale"), shocks),
            change=str(data.get("change") or "").strip()[:_MAX_TEXT_CHARS],
            confidence=_coerce_confidence(data.get("confidence")),
            revised=True,
        )

    with ThreadPoolExecutor(max_workers=len(views)) as pool:
        return list(pool.map(revise, views))


_CHAIR_PROMPT = """You are the {label} of a portfolio risk committee. Three analysts \
argued independently from different lenses. Weigh their arguments — do not \
just average their numbers. Name where they split and which side you lean \
to and why. You may quote the historical replay figures above; the analysts' \
episode picks are context for which analogues matter.

Some analysts may also show a "revision": their second-round view after \
seeing anonymized peers. Weigh the revision where present, but keep the \
stronger argument if it is the first-round one.

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
  "confidence": "low | medium | high",
  "analogues": [{{"id": "<episode id>", "why": "one sentence", \
"difference": "how today's scenario differs"}}]
}}
consensus: signed decimal price move per asset (-0.18 = -18%), 0 if \
unaffected. analogues: up to 3 listed episodes most relevant to this scenario. \
Describe risk only — never recommend buying, selling, hedging \
or timing. Never predict whether the scenario will happen. Use no numbers \
in verdict/insights beyond those implied by the shocks you set."""


def run_chair(
    request: VerdictRequest,
    settings: Settings,
    *,
    revisions: list[RevisionView] | None = None,
    market_signal: MarketContextSignal | None = None,
) -> tuple[AnalystView, dict]:
    """The chair reconciles only the views that succeeded — failed analysts
    are absent from request.views by construction (browser fan-out).

    Returns (chair view with consensus shocks, raw chair data) so the
    verdict route can extract commentary (verdict/insights/disagreements/
    watch) from the same response."""
    spec = chair_spec(settings)
    revisions = revisions or []
    views_json = json.dumps(
        [
            {
                **_payload(view),
                "revision": next(
                    (
                        {
                            "asset_shocks": r.asset_shocks,
                            "rationale": r.rationale,
                            "change": r.change,
                            "revised": r.revised,
                        }
                        for r in revisions
                        if r.seat == view.seat
                    ),
                    None,
                ),
            }
            for view in request.views
        ],
        indent=2,
    )
    prompt = _CHAIR_PROMPT.format(
        label=spec["label"],
        context=_context_block(request, market_signal),
        views=views_json,
    )
    data, used_model = _complete(settings, spec["model"], prompt)

    shocks = clean_shocks(data.get("consensus") or data.get("asset_shocks"))
    if not shocks:
        raise AIProviderUnavailableError("The committee chair returned no usable consensus.")
    confidence = _coerce_confidence(data.get("confidence"))

    chair_view = AnalystView(
        seat="chair",
        label=spec["label"],
        model=used_model,
        fallback_from=spec["model"] if used_model != spec["model"] else None,
        asset_shocks=shocks,
        rationale=clean_rationale(data.get("consensus_rationale"), shocks),
        thesis=str(data.get("verdict") or "").strip()[:_MAX_TEXT_CHARS],
        confidence=confidence,
        key_risk="",
        analogues=_clean_analogues(data.get("analogues"), 3),
        market_context=market_signal,
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


# Errors a retry or another model can't fix: stop instead of burning calls.
_FATAL_MARKERS = ("(401", "(402", "not configured")


def _complete(settings: Settings, model: str, prompt: str) -> tuple[dict, str]:
    """complete_json for one committee seat, resilient to a single model
    misbehaving: the seat's model gets one retry (most failures are a
    truncated or malformed JSON reply), then the fallback models are tried
    in order. Returns (data, model that actually answered).

    max_tokens was 900, which truncated 15-asset answers mid-string
    ("Unterminated string ..."); 4000 leaves room for reasoning tokens."""
    fallbacks = [m.strip() for m in settings.committee_fallback_models.split(",") if m.strip()]
    chain = [model, model, *[m for m in fallbacks if m != model]]
    last: AIProviderUnavailableError | None = None
    for candidate in chain:
        try:
            data = complete_json(
                settings,
                prompt,
                model=candidate,
                max_tokens=4000,
                reasoning_effort=_OPENROUTER_REASONING_EFFORT,
            )
            return data, candidate
        except AIProviderUnavailableError as exc:
            last = exc
            logger.warning("Committee call to %s failed: %s", candidate, exc)
            if any(marker in str(exc) for marker in _FATAL_MARKERS):
                break
    assert last is not None
    raise last
