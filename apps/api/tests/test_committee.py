import json
from unittest.mock import patch

import pytest

from app.domain.risk.engine import DirectAssetShockEngine
from app.integrations.ai.base import AIProviderUnavailableError
from app.schemas.committee import AnalystRequest, AnalystView, VerdictRequest
from app.schemas.portfolio import Portfolio, PortfolioPosition

_ENGINE = DirectAssetShockEngine()


def _portfolio() -> Portfolio:
    return Portfolio(
        id="demo",
        name="Demo",
        total_value=100_000,
        positions=[
            PortfolioPosition(symbol="NVDA", weight=0.30),
            PortfolioPosition(symbol="QQQ", weight=0.25),
            PortfolioPosition(symbol="SPY", weight=0.15),
            PortfolioPosition(symbol="BTC", weight=0.10),
            PortfolioPosition(symbol="TLT", weight=0.10),
            PortfolioPosition(symbol="GLD", weight=0.10),
        ],
    )


def _context(seat: str = "macro") -> AnalystRequest:
    return AnalystRequest(
        scenario_title="Semiconductor supply shock",
        scenario_description="Chip export controls tighten.",
        horizon="30d",
        transmission=["Export controls", "Supply squeeze", "Tech reprices"],
        portfolio=_portfolio(),
        seat=seat,
    )


def _analyst_body(**overrides) -> dict:
    body = {
        "asset_shocks": {"NVDA": -0.30, "QQQ": -0.12, "GLD": 0.05},
        "rationale": {"NVDA": "Supply cut.", "ZZZ": "ignored"},
        "thesis": "Chips reprice hard.",
        "key_risk": "Demand holds up.",
        "confidence": "very high",  # invalid enum -> coerced to medium
    }
    body.update(overrides)
    return json.dumps(body)


def test_roster_disabled_on_mock_provider(client):
    response = client.get("/api/ai/committee")
    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is False
    assert len(body["seats"]) == 3
    assert body["chair"]["seat"] == "chair"
    assert body["note"]


def test_analyst_cleans_shocks_and_coerces_confidence():
    from app.integrations.ai.committee import run_analyst

    with patch(
        "app.integrations.ai.committee.complete_json", return_value=json.loads(_analyst_body())
    ):
        view = run_analyst("macro", _context(), _settings())

    assert view.seat == "macro"
    # unknown symbol dropped, rationale for unknown symbol dropped
    assert view.asset_shocks == {"NVDA": -0.30, "QQQ": -0.12, "GLD": 0.05}
    assert view.rationale == {"NVDA": "Supply cut."}
    assert view.confidence == "medium"
    assert view.label == "Macro & Rates Strategist"


def test_analyst_unknown_seat_is_a_clean_422():
    from app.integrations.ai.committee import run_analyst

    with pytest.raises(ValueError):
        run_analyst("chief-vibes-officer", _context(), _settings())


def test_analyst_without_usable_shocks_raises_unavailable():
    from app.integrations.ai.committee import run_analyst

    with patch(
        "app.integrations.ai.committee.complete_json", return_value={"asset_shocks": {}}
    ):
        with pytest.raises(AIProviderUnavailableError):
            run_analyst("macro", _context(), _settings())


def _chair_body() -> dict:
    return json.dumps(
        {
            "consensus": {"NVDA": -0.25, "QQQ": -0.10, "GLD": 0.04},
            "consensus_rationale": {"NVDA": "Averaged the split."},
            "verdict": "Concentrated chip exposure dominates the loss.",
            "insights": ["one", "two", "three", "four"],  # truncated to 3
            "disagreements": ["Sector wants -35%, macro says -15%."],
            "watch": ["Export-control votes."],
            "confidence": "high",
        }
    )


def _settings():
    from app.core.config import Settings

    return Settings(openrouter_api_key="test-key", ai_provider="openrouter")


def test_verdict_computes_engine_impacts_and_ranges():
    from app.integrations.ai.committee import run_chair

    request = VerdictRequest(
        scenario_title="Semiconductor supply shock",
        portfolio=_portfolio(),
        views=[
            {
                "seat": "macro",
                "label": "Macro & Rates Strategist",
                "model": "m1",
                "asset_shocks": {"NVDA": -0.15, "QQQ": -0.08},
            },
            {
                "seat": "sector",
                "label": "Sector & Earnings Analyst",
                "model": "m2",
                "asset_shocks": {"NVDA": -0.35, "QQQ": -0.12},
            },
        ],
    )

    with patch(
        "app.integrations.ai.committee.complete_json",
        return_value=json.loads(_chair_body()),
    ):
        chair_view, raw = run_chair(request, _settings())

    assert chair_view.asset_shocks == {"NVDA": -0.25, "QQQ": -0.10, "GLD": 0.04}

    from app.api.routes.committee import _impact, _shock_ranges

    consensus_impact = _impact(
        seat="consensus",
        label="Committee consensus",
        model=chair_view.model,
        asset_shocks=chair_view.asset_shocks,
        portfolio=request.portfolio,
        scenario_title=request.scenario_title,
    )
    expected = _ENGINE.run(
        portfolio=request.portfolio,
        asset_shocks=chair_view.asset_shocks,
        scenario_id=None,
        scenario_title="x",
    )
    assert consensus_impact.impact_pct == expected.estimated_impact_pct
    assert consensus_impact.impact_value == expected.estimated_impact_value

    ranges = _shock_ranges(request.views)
    assert ranges["NVDA"] == {"min": -0.35, "max": -0.15}
    assert ranges["QQQ"] == {"min": -0.12, "max": -0.08}

    from app.integrations.ai.committee import extract_commentary

    commentary = extract_commentary(raw)
    assert len(commentary["insights"]) == 3  # exactly 3, extra truncated
    assert commentary["disagreements"]
    assert commentary["watch"]


def test_verdict_endpoint_requires_at_least_one_view(client):
    request = {
        "scenario_title": "X",
        "portfolio": _portfolio().model_dump(),
        "views": [],
    }
    response = client.post("/api/ai/committee/verdict", json=request)
    assert response.status_code == 422


def test_verdict_endpoint_degrades_gracefully_without_provider(client):
    request = {
        "scenario_title": "X",
        "portfolio": _portfolio().model_dump(),
        "views": [
            {
                "seat": "macro",
                "label": "Macro",
                "model": "m1",
                "asset_shocks": {"NVDA": -0.2},
            }
        ],
    }
    # default test settings are mock/unconfigured -> chair raises
    # AIProviderUnavailableError -> VerdictResponse(message=...) with 200
    with patch(
        "app.integrations.ai.committee.complete_json",
        side_effect=AIProviderUnavailableError("OpenRouter is not configured."),
    ):
        response = client.post("/api/ai/committee/verdict", json=request)
    assert response.status_code == 200
    body = response.json()
    assert body["verdict"] is None
    assert body["message"]


def test_analyst_endpoint_maps_provider_errors_to_message(client):
    request = _context().model_dump()
    with patch(
        "app.integrations.ai.committee.complete_json",
        side_effect=AIProviderUnavailableError("OpenRouter is out of credits (402)."),
    ):
        response = client.post("/api/ai/committee/analyst", json=request)
    assert response.status_code == 200
    body = response.json()
    assert body["view"] is None
    assert "out of credits" in body["message"]


def test_sanitize_views_drops_unknown_seats_dupes_and_bad_shocks():
    from app.integrations.ai.committee import sanitize_views

    views = [
        {
            "seat": "macro",
            "label": "M",
            "model": "m1",
            "asset_shocks": {"NVDA": -0.2, "ZZZ": 9, "SPY": -5},
        },
        {"seat": "macro", "label": "M", "model": "m1", "asset_shocks": {"NVDA": -0.1}},  # dupe
        {"seat": "chair", "label": "C", "model": "m2", "asset_shocks": {"NVDA": -0.1}},  # bad seat
        {"seat": "sector", "label": "S", "model": "m3", "asset_shocks": {"XTRA": -0.2}},  # no usable
    ]
    cleaned = sanitize_views([AnalystView.model_validate(v) for v in views])
    assert [v.seat for v in cleaned] == ["macro"]
    assert cleaned[0].asset_shocks == {"NVDA": -0.2}  # ZZZ dropped, SPY -500% clamped away


def test_verdict_rejects_views_with_no_usable_shocks(client):
    request = {
        "scenario_title": "X",
        "portfolio": _portfolio().model_dump(),
        "views": [{"seat": "macro", "label": "M", "model": "m", "asset_shocks": {"ZZZ": 1}}],
    }
    response = client.post("/api/ai/committee/verdict", json=request)
    assert response.status_code == 422


def test_verdict_context_rejects_oversized_prompt_inputs(client):
    base = {
        "scenario_title": "X",
        "portfolio": _portfolio().model_dump(),
        "views": [
            {"seat": "macro", "label": "M", "model": "m", "asset_shocks": {"NVDA": -0.2}}
        ],
    }
    response = client.post(
        "/api/ai/committee/verdict", json={**base, "scenario_description": "x" * 4001}
    )
    assert response.status_code == 422
    response = client.post(
        "/api/ai/committee/verdict", json={**base, "transmission": ["s"] * 11}
    )
    assert response.status_code == 422


def test_analyst_prompt_includes_live_market_signal():
    from app.integrations.ai.committee import run_analyst
    from app.schemas.market import MarketContextSignal

    signal = MarketContextSignal(
        market_id="567621",
        label="China invades Taiwan (2026)",
        question="Will China invade Taiwan by end of 2026?",
        probability=0.0225,
        change_7d_pp=-0.4,
        change_30d_pp=-1.2,
        source_status="live",
        as_of="2026-10-04T00:00:00+00:00",
    )
    with patch(
        "app.integrations.ai.committee.complete_json", return_value=json.loads(_analyst_body())
    ) as mock_complete:
        view = run_analyst("macro", _context(), _settings(), market_signal=signal)

    prompt = mock_complete.call_args.args[1]
    assert "Polymarket" in prompt and "2.2%" in prompt
    assert view.market_context is signal


def test_analyst_without_market_signal_has_no_context():
    from app.integrations.ai.committee import run_analyst

    with patch(
        "app.integrations.ai.committee.complete_json", return_value=json.loads(_analyst_body())
    ):
        view = run_analyst("macro", _context(), _settings())
    assert view.market_context is None


def _prompt_aware_complete(settings, prompt, **kwargs):
    if "first-round view" in prompt:  # rebuttal prompt
        return {
            "asset_shocks": {"NVDA": -0.28, "QQQ": -0.11},
            "rationale": {"NVDA": "Peer argument on supply."},
            "change": "Lowered NVDA after the peer case.",
            "confidence": "high",
        }
    return json.loads(_chair_body())  # chair


def test_verdict_debate_returns_revisions_and_impacts(client):
    request = {
        "scenario_title": "Semiconductor supply shock",
        "portfolio": _portfolio().model_dump(),
        "views": [
            {
                "seat": "macro",
                "label": "Macro",
                "model": "m1",
                "asset_shocks": {"NVDA": -0.15, "QQQ": -0.08},
            },
            {
                "seat": "sector",
                "label": "Sector",
                "model": "m2",
                "asset_shocks": {"NVDA": -0.35, "QQQ": -0.12},
            },
        ],
        "debate": True,
    }
    with patch(
        "app.integrations.ai.committee.complete_json", side_effect=_prompt_aware_complete
    ):
        body = client.post("/api/ai/committee/verdict", json=request).json()

    verdict = body["verdict"]
    assert verdict is not None
    assert len(verdict["revisions"]) == 2
    assert all(r["revised"] for r in verdict["revisions"])
    assert len(verdict["revision_impacts"]) == 2
    assert len(verdict["view_impacts"]) == 2
    assert verdict["revisions"][0]["asset_shocks"] == {"NVDA": -0.28, "QQQ": -0.11}
    assert verdict["shock_ranges"]["NVDA"] == {"min": -0.28, "max": -0.28}  # final positions


def test_debate_falls_back_when_rebuttal_fails(client):
    def flaky(settings, prompt, **kwargs):
        if "first-round view" in prompt:
            raise AIProviderUnavailableError("provider down")
        return json.loads(_chair_body())

    request = {  # same context as above
        "scenario_title": "X",
        "portfolio": _portfolio().model_dump(),
        "views": [
            {"seat": "macro", "label": "M", "model": "m1", "asset_shocks": {"NVDA": -0.15}},
            {"seat": "sector", "label": "S", "model": "m2", "asset_shocks": {"NVDA": -0.35}},
        ],
        "debate": True,
    }
    with patch("app.integrations.ai.committee.complete_json", side_effect=flaky):
        verdict = client.post("/api/ai/committee/verdict", json=request).json()["verdict"]
    assert [r["revised"] for r in verdict["revisions"]] == [False, False]
    assert verdict["view_impacts"]  # original views still drive the numbers


def test_verdict_without_debate_has_no_revisions(client):
    request = {
        "scenario_title": "X",
        "portfolio": _portfolio().model_dump(),
        "views": [
            {"seat": "macro", "label": "M", "model": "m1", "asset_shocks": {"NVDA": -0.15}}
        ],
    }
    with patch(
        "app.integrations.ai.committee.complete_json", return_value=json.loads(_chair_body())
    ):
        verdict = client.post("/api/ai/committee/verdict", json=request).json()["verdict"]
    assert verdict["revisions"] == [] and verdict["revision_impacts"] == []
