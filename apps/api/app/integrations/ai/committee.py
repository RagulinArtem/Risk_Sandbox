"""AI Risk Committee: three LLM analysts from different labs, each with a
different lens, independently estimate a scenario's per-asset shocks; a
chair model reads their views and writes the consensus plus the
portfolio-specific takeaways.

LLMs only produce *assumptions and commentary*. Every portfolio number
(impact per view, consensus impact, shock ranges) is computed by the
deterministic engine in app/services/committee_service.py.
"""

import json
import time

from app.core.config import Settings
from app.integrations.ai.base import AIProviderUnavailableError
from app.integrations.ai.openrouter import (
    _RESPONSE_FORMAT,
    asset_lines,
    chat_json,
    clean_rationale,
    clean_shocks,
)
from app.schemas.committee import (
    AnalogueRef,
    AnalystRole,
    AnalystView,
    CommitteeMember,
    CommitteeRoster,
)
from app.schemas.portfolio import Portfolio
from app.schemas.scenario import Scenario
from app.services.analogue_service import analogue_prompt_block, historical_scenarios

_ROLES: dict[AnalystRole, tuple[str, str, str]] = {
    # role: (label, focus shown in the UI, lens given to the model)
    "macro": (
        "Macro & Rates Strategist",
        "Central banks, inflation, yields, the dollar",
        "You think top-down: how the scenario moves policy rates, inflation "
        "expectations, real yields and the dollar, and how that reprices each asset.",
    ),
    "sector": (
        "Sector & Earnings Analyst",
        "Company fundamentals, supply chains, valuation multiples",
        "You think bottom-up: which companies' revenues, margins and supply chains "
        "are hit, and how equity valuation multiples react.",
    ),
    "cross_asset": (
        "Cross-Asset & History Specialist",
        "Historical analogues, crypto, gold, bond duration math",
        "You anchor on comparable historical episodes and cross-asset mechanics "
        "(bond duration, gold and crypto flows, correlations under stress). "
        "Name the analogue you rely on.",
    ),
}

_MODEL_FOR = {
    "macro": lambda s: s.committee_macro_model,
    "sector": lambda s: s.committee_sector_model,
    "cross_asset": lambda s: s.committee_cross_asset_model,
}

_CONFIDENCE = ("low", "medium", "high")

_ANALYST_PROMPT = """You are the {label} on a portfolio risk committee. {lens}

Assets:
{assets}

Portfolio being reviewed: {holdings}

Scenario: {title}
Description: {description}
Horizon: {horizon}
Transmission:
{transmission}

Verified historical episodes (REAL market data; the portfolio impacts were \
computed by our deterministic engine, so treat them as facts):
{history}

Do not state an overall portfolio loss as a number; our engine computes it.

Estimate how each asset's price would move over the horizon under this \
scenario, from your lens. Be independent and specific; do not hedge \
everything to the middle. Anchor on the 1-2 most relevant episodes above and \
say how this scenario differs (bigger, smaller, different mechanism). Never \
cite an episode that is not listed.

{response_format}
Also include in the same JSON object:
"thesis": your view in at most 2 sentences,
"key_risk": one sentence on what would make this materially worse,
"confidence": "low", "medium" or "high",
"analogues": [{{"id": "<episode id>", "why": "one sentence", \
"difference": "one sentence"}}] with 1-2 items."""

_CHAIR_PROMPT = """You chair a portfolio risk committee. Three analysts from \
different backgrounds independently assessed a scenario. Reconcile their views \
into one consensus set of price shocks and explain what matters for THIS portfolio.

Assets:
{assets}

Portfolio: {holdings}

Scenario: {title}
Description: {description}
Horizon: {horizon}

Verified historical episodes (REAL data; portfolio impacts computed by our engine):
{history}

Analyst views (JSON):
{views}

Rules: weigh the arguments, not just the average; where analysts disagree, \
say why and which side you lean to. Describe risk only; never recommend \
buying, selling or hedging specific securities. Do NOT state the consensus \
portfolio loss as a number: our engine computes it from your shocks and shows \
it next to your text. You may quote the historical replay figures above.

{response_format}
In the rationale, explain how you reconciled the analysts for that asset.
Also include in the same JSON object:
"verdict": 2-3 sentences, the committee's bottom line for this portfolio,
"insights": exactly 3 short, specific observations about this portfolio's \
exposure (name holdings and weights),
"disagreements": up to 3 short items, each naming where analysts split and why,
"watch": 2-3 concrete indicators that would confirm or refute the scenario,
"confidence": "low", "medium" or "high",
"analogues": up to 3 listed episodes most relevant to this scenario, as \
[{{"id": "<episode id>", "why": "one sentence", "difference": "how today's \
scenario differs"}}]."""


def _holdings(portfolio: Portfolio) -> str:
    return ", ".join(f"{p.symbol} {p.weight:.0%}" for p in portfolio.positions)


def _confidence(raw: object) -> str:
    return raw if raw in _CONFIDENCE else "medium"


def _str_list(raw: object, limit: int) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [str(x).strip()[:300] for x in raw if str(x).strip()][:limit]


def _clean_analogues(raw: object, limit: int) -> list[AnalogueRef]:
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


def _require_openrouter(settings: Settings) -> None:
    if settings.ai_provider != "openrouter":
        raise AIProviderUnavailableError(
            "The AI Risk Committee needs AI_PROVIDER=openrouter (it calls several models)."
        )


def roster(settings: Settings) -> CommitteeRoster:
    return CommitteeRoster(
        analysts=[
            CommitteeMember(role=role, label=label, focus=focus, model=_MODEL_FOR[role](settings))
            for role, (label, focus, _lens) in _ROLES.items()
        ],
        chair=CommitteeMember(
            role="chair",
            label="Committee Chair",
            focus="Reconciles the analysts; writes the takeaways",
            model=settings.committee_chair_model,
        ),
    )


def run_analyst(
    settings: Settings, role: AnalystRole, scenario: Scenario, portfolio: Portfolio
) -> AnalystView:
    _require_openrouter(settings)
    label, _focus, lens = _ROLES[role]
    model = _MODEL_FOR[role](settings)
    started = time.monotonic()
    data = chat_json(
        settings,
        model,
        _ANALYST_PROMPT.format(
            label=label,
            lens=lens,
            assets=asset_lines([p.symbol for p in portfolio.positions]),
            holdings=_holdings(portfolio),
            title=scenario.title,
            description=scenario.description,
            horizon=scenario.horizon,
            transmission="\n".join(f"- {step}" for step in scenario.transmission),
            history=analogue_prompt_block(portfolio),
            response_format=_RESPONSE_FORMAT,
        ),
    )
    shocks = clean_shocks(data.get("asset_shocks"))
    if not shocks:
        raise AIProviderUnavailableError(f"{label} ({model}) didn't return usable shocks.")
    return AnalystView(
        role=role,
        label=label,
        model=model,
        thesis=str(data.get("thesis") or "").strip()[:400],
        key_risk=str(data.get("key_risk") or "").strip()[:300],
        confidence=_confidence(data.get("confidence")),
        asset_shocks=shocks,
        rationale=clean_rationale(data.get("rationale"), shocks),
        analogues=_clean_analogues(data.get("analogues"), 2),
        latency_ms=int((time.monotonic() - started) * 1000),
    )


def run_chair(
    settings: Settings, scenario: Scenario, portfolio: Portfolio, views: list[AnalystView]
) -> dict:
    """Returns the chair's cleaned output; the service adds the numbers."""
    _require_openrouter(settings)
    views_json = json.dumps(
        [
            {
                "analyst": v.label,
                "model": v.model,
                "thesis": v.thesis,
                "key_risk": v.key_risk,
                "confidence": v.confidence,
                "asset_shocks": v.asset_shocks,
                "rationale": v.rationale,
                "analogues": [a.model_dump() for a in v.analogues],
            }
            for v in views
        ],
        indent=1,
    )
    data = chat_json(
        settings,
        settings.committee_chair_model,
        _CHAIR_PROMPT.format(
            assets=asset_lines([p.symbol for p in portfolio.positions]),
            holdings=_holdings(portfolio),
            title=scenario.title,
            description=scenario.description,
            horizon=scenario.horizon,
            views=views_json,
            history=analogue_prompt_block(portfolio),
            response_format=_RESPONSE_FORMAT,
        ),
        max_tokens=3000,
    )
    shocks = clean_shocks(data.get("asset_shocks"))
    if not shocks:
        raise AIProviderUnavailableError("The committee chair didn't return usable shocks.")
    return {
        "asset_shocks": shocks,
        "rationale": clean_rationale(data.get("rationale"), shocks),
        "verdict": str(data.get("verdict") or "").strip()[:800],
        "insights": _str_list(data.get("insights"), 3),
        "disagreements": _str_list(data.get("disagreements"), 3),
        "watch": _str_list(data.get("watch"), 3),
        "confidence": _confidence(data.get("confidence")),
        "analogues": _clean_analogues(data.get("analogues"), 3),
    }
