from unittest.mock import patch

import pytest

from app.core.config import Settings
from app.integrations.ai import committee
from app.integrations.ai.base import AIProviderUnavailableError
from app.schemas.committee import AnalystView, VerdictRequest
from app.schemas.portfolio import Portfolio
from app.schemas.scenario import Scenario
from app.services import committee_service

_LIVE = Settings(ai_provider="openrouter", openrouter_api_key="test-key")


@pytest.fixture()
def scenario(client) -> Scenario:
    return Scenario.model_validate(client.get("/api/scenarios/semiconductor-supply-shock").json())


@pytest.fixture()
def portfolio(demo_portfolio_payload) -> Portfolio:
    return Portfolio.model_validate(demo_portfolio_payload)


def _view(label: str, nvda: float, btc: float) -> AnalystView:
    return AnalystView(
        role="macro",
        label=label,
        model=f"lab/{label}",
        thesis="t",
        key_risk="k",
        confidence="medium",
        asset_shocks={"NVDA": nvda, "BTC": btc},
        latency_ms=1,
    )


def test_analyst_uses_its_own_model_and_cleans_output(scenario, portfolio):
    reply = {
        "thesis": "Chips hit hardest.",
        "key_risk": "Fab shutdown.",
        "confidence": "very high",  # invalid -> medium
        "asset_shocks": {"NVDA": -0.2, "FAKE": -0.9},
        "rationale": {"NVDA": "Direct exposure."},
    }
    with patch.object(committee, "chat_json", return_value=reply) as chat:
        view = committee.run_analyst(_LIVE, "sector", scenario, portfolio)

    assert chat.call_args.args[1] == _LIVE.committee_sector_model
    assert "NVDA 30%" in chat.call_args.args[2]  # portfolio is in the prompt
    assert view.asset_shocks == {"NVDA": -0.2}
    assert view.confidence == "medium"
    assert view.label == "Sector & Earnings Analyst"


def test_committee_requires_openrouter(scenario, portfolio):
    with pytest.raises(AIProviderUnavailableError):
        committee.run_analyst(Settings(ai_provider="mock"), "macro", scenario, portfolio)


def test_verdict_numbers_come_from_the_engine(scenario, portfolio):
    chair = {
        "asset_shocks": {"NVDA": -0.2, "BTC": -0.1},
        "rationale": {"NVDA": "Middle of the range."},
        "verdict": "v",
        "insights": ["a", "b", "c", "d"],
        "disagreements": ["x"],
        "watch": ["w"],
        "confidence": "high",
    }
    views = [_view("A", -0.1, -0.2), _view("B", -0.3, 0.0)]
    with (
        patch.object(committee_service, "get_settings", return_value=_LIVE),
        patch.object(committee, "chat_json", return_value=chair),
    ):
        verdict = committee_service.build_verdict(
            VerdictRequest(scenario=scenario, portfolio=portfolio, views=views)
        )

    # consensus impact: 30% * -20% + 10% * -10% = -7%
    assert verdict.consensus_result.estimated_impact_pct == pytest.approx(-0.07)
    assert [round(v.estimated_impact_pct, 4) for v in verdict.view_impacts] == [-0.05, -0.09]
    assert verdict.shock_ranges["NVDA"].min == -0.3
    assert verdict.shock_ranges["NVDA"].max == -0.1
    assert verdict.insights == ["a", "b", "c"]
    assert verdict.scenario.source_status == "illustrative"
    assert verdict.scenario.shock_rationale == {"NVDA": "Middle of the range."}


def test_roster_endpoint_lists_three_analysts_and_chair(client):
    body = client.get("/api/ai/committee").json()
    assert [a["role"] for a in body["analysts"]] == ["macro", "sector", "cross_asset"]
    assert body["chair"]["role"] == "chair"


def test_analyst_endpoint_returns_503_on_mock(client, demo_portfolio_payload):
    scenario = client.get("/api/scenarios/oil-supply-disruption").json()
    response = client.post(
        "/api/ai/committee/analyst",
        json={"scenario": scenario, "portfolio": demo_portfolio_payload, "role": "macro"},
    )
    assert response.status_code == 503


def test_analysts_get_real_history_and_unknown_analogues_are_dropped(scenario, portfolio):
    reply = {
        "thesis": "t",
        "key_risk": "k",
        "confidence": "high",
        "asset_shocks": {"NVDA": -0.2},
        "analogues": [
            {"id": "historical-covid-crash-2020", "why": "w", "difference": "d"},
            {"id": "made-up-1987-crash", "why": "w", "difference": "d"},
        ],
    }
    with patch.object(committee, "chat_json", return_value=reply) as chat:
        view = committee.run_analyst(_LIVE, "macro", scenario, portfolio)
    prompt = chat.call_args.args[2]
    assert "historical-svb-banking-stress-2023" in prompt
    assert "THIS portfolio's real impact if replayed" in prompt
    assert [a.id for a in view.analogues] == ["historical-covid-crash-2020"]


def test_verdict_historical_impacts_come_from_the_engine(scenario, portfolio):
    from app.services.analogue_service import replay_history

    chair = {
        "asset_shocks": {"NVDA": -0.2},
        "rationale": {},
        "verdict": "v",
        "insights": [],
        "disagreements": [],
        "watch": [],
        "confidence": "medium",
        "analogues": [{"id": "historical-gfc-2008", "why": "credit", "difference": "smaller"}],
    }
    with (
        patch.object(committee_service, "get_settings", return_value=_LIVE),
        patch.object(committee, "chat_json", return_value=chair),
    ):
        verdict = committee_service.build_verdict(
            VerdictRequest(scenario=scenario, portfolio=portfolio, views=[_view("A", -0.1, -0.2)])
        )
    [h] = verdict.historical
    expected = replay_history(portfolio)["historical-gfc-2008"]
    assert h.impact_pct == pytest.approx(expected.impact_pct)
    assert h.why == "credit" and "2008" in h.window
