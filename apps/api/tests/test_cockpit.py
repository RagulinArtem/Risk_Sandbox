import copy
import math
from datetime import date
from unittest.mock import patch

import pytest

from app.integrations.market_data import yahoo
from app.schemas.cockpit import RiskAttentionRequest
from app.schemas.portfolio import Portfolio
from app.schemas.risk import RiskRadarItem
from app.services import price_history_service
from app.services.portfolio_service import get_demo_portfolio
from app.services.risk_attention_service import RiskAttentionService
from app.services.risk_factor_catalog import list_risk_factors
from app.services.scenario_comparison_service import get_scenario_comparison_service


def test_scenario_comparison_matches_standalone_stress_test(client, demo_portfolio_payload):
    scenario_id = "semiconductor-supply-shock"
    standalone = client.post(
        "/api/stress-test",
        json={"portfolio": demo_portfolio_payload, "scenario_id": scenario_id},
    ).json()
    response = client.post(
        "/api/scenario-comparison",
        json={"portfolio": demo_portfolio_payload, "scenario_ids": [scenario_id]},
    )
    assert response.status_code == 200
    row = response.json()["scenarios"][0]
    assert row["impact_value"] == standalone["estimated_impact_value"]
    assert row["impact_pct"] == standalone["estimated_impact_pct"]
    assert sum(item["impact_value"] for item in row["asset_contributions"]) == pytest.approx(
        row["impact_value"]
    )


def test_scenario_comparison_identifies_worst_and_handles_empty(client, demo_portfolio_payload):
    response = client.post(
        "/api/scenario-comparison",
        json={"portfolio": demo_portfolio_payload, "scenario_ids": None},
    ).json()
    impacts = [row["impact_pct"] for row in response["scenarios"]]
    assert response["worst_scenario"]["impact_pct"] == min(impacts)
    assert response["most_vulnerable_asset"]["symbol"] in {
        position["symbol"] for position in demo_portfolio_payload["positions"]
    }

    empty = client.post(
        "/api/scenario-comparison",
        json={"portfolio": demo_portfolio_payload, "scenario_ids": []},
    )
    assert empty.status_code == 200
    assert empty.json()["scenarios"] == []
    assert empty.json()["worst_scenario"] is None


def test_scenario_comparison_unknown_scenario_is_explicit(client, demo_portfolio_payload):
    response = client.post(
        "/api/scenario-comparison",
        json={"portfolio": demo_portfolio_payload, "scenario_ids": ["missing"]},
    )
    assert response.status_code == 404


def _hypothetical(payload: dict) -> dict:
    after = copy.deepcopy(payload)
    after["id"] = "hypothetical"
    after["name"] = "Hypothetical allocation"
    positions = {position["symbol"]: position for position in after["positions"]}
    positions["NVDA"]["weight"] -= 0.10
    positions["TLT"]["weight"] += 0.10
    return after


def test_mitigation_reuses_engine_and_does_not_mutate_input(client, demo_portfolio_payload):
    original = copy.deepcopy(demo_portfolio_payload)
    after = _hypothetical(demo_portfolio_payload)
    response = client.post(
        "/api/mitigation/compare",
        json={
            "original_portfolio": original,
            "hypothetical_portfolio": after,
            "scenario_ids": ["semiconductor-supply-shock"],
        },
    )
    assert response.status_code == 200
    row = response.json()["scenarios"][0]
    standalone_before = client.post(
        "/api/stress-test",
        json={
            "portfolio": original,
            "scenario_id": "semiconductor-supply-shock",
        },
    ).json()
    standalone_after = client.post(
        "/api/stress-test",
        json={
            "portfolio": after,
            "scenario_id": "semiconductor-supply-shock",
        },
    ).json()
    assert row["before_impact_pct"] == standalone_before["estimated_impact_pct"]
    assert row["after_impact_pct"] == standalone_after["estimated_impact_pct"]
    assert original == demo_portfolio_payload
    assert row["before_impact_pct"] != row["after_impact_pct"]


def test_mitigation_rejects_invalid_weights_and_different_total(client, demo_portfolio_payload):
    invalid = _hypothetical(demo_portfolio_payload)
    invalid["positions"][0]["weight"] = 0.01
    response = client.post(
        "/api/mitigation/compare",
        json={
            "original_portfolio": demo_portfolio_payload,
            "hypothetical_portfolio": invalid,
        },
    )
    assert response.status_code == 422

    different_total = _hypothetical(demo_portfolio_payload)
    different_total["total_value"] = 200000
    response = client.post(
        "/api/mitigation/compare",
        json={
            "original_portfolio": demo_portfolio_payload,
            "hypothetical_portfolio": different_total,
        },
    )
    assert response.status_code == 422


def test_risk_driver_aggregation_is_deterministic_and_catalog_bound(client, demo_portfolio_payload):
    first = client.post("/api/risk-drivers", json={"portfolio": demo_portfolio_payload})
    second = client.post("/api/risk-drivers", json={"portfolio": demo_portfolio_payload})
    assert first.status_code == 200
    assert first.json() == second.json()
    known = {factor.id for factor in list_risk_factors()}
    assert {driver["driver"] for driver in first.json()["drivers"]} <= known
    assert all(driver["scenarios"] for driver in first.json()["drivers"])


def test_scenario_driver_metadata_and_assumption_provenance(client):
    illustrative = client.get("/api/scenarios/semiconductor-supply-shock").json()
    assert illustrative["risk_drivers"]
    assert {driver["importance"] for driver in illustrative["risk_drivers"]} <= {
        "low",
        "medium",
        "high",
    }
    assert illustrative["assumption_source"] == "scenario"

    historical = client.get("/api/scenarios/historical-covid-crash-2020").json()
    # A scenario absent from the hand-authored taxonomy stays explicitly
    # unmapped; the service must not invent a driver to fill the gap.
    assert historical["risk_drivers"] == []
    assert historical["assumption_source"] == "historical"


class _StaticRadar:
    def __init__(self, items: list[RiskRadarItem]):
        self._items = items

    def get_risk_radar(self, _portfolio: Portfolio) -> list[RiskRadarItem]:
        return self._items


def test_risk_attention_preserves_probability_and_invents_none():
    portfolio = get_demo_portfolio()
    signal = RiskRadarItem(
        id="live-1",
        title="Will disruption occur?",
        category="live-market",
        summary="Attributed market signal",
        portfolio_relevance="high",
        probability_signal="37% (test market)",
        probability_value=0.37,
        source_status="live",
        source_name="Test market",
        source_url="https://example.com/market",
        retrieved_at="2026-10-04T00:00:00Z",
        scenario_id="semiconductor-supply-shock",
        exposure_symbols=["NVDA"],
    )
    service = RiskAttentionService(
        _StaticRadar([signal]),  # type: ignore[arg-type]
        get_scenario_comparison_service(),
    )
    response = service.build(RiskAttentionRequest(portfolio=portfolio))
    assert len(response.points) == 1
    assert response.points[0].probability_value == 0.37
    assert response.points[0].source_url == "https://example.com/market"
    assert all(
        row.scenario_id != "semiconductor-supply-shock"
        for row in response.without_probability
    )
    assert response.without_probability  # other scenarios remain explicitly unpriced


def test_offline_risk_attention_has_no_fabricated_probability(client, demo_portfolio_payload):
    response = client.post("/api/risk-attention", json={"portfolio": demo_portfolio_payload})
    assert response.status_code == 200
    body = response.json()
    assert body["points"] == []
    assert body["without_probability"]


_DAYS = [date(2026, 1, 2), date(2026, 2, 2), date(2026, 3, 2)]


def _attribution_closes(symbol: str, _range: str):
    if symbol == "NVDA":
        return list(zip(_DAYS, [100.0, 105.0, 120.0], strict=True))
    if symbol == "BTC":
        return list(zip(_DAYS, [100.0, 95.0, 90.0], strict=True))
    return list(zip(_DAYS, [100.0, 100.0, 100.0], strict=True))


def test_performance_attribution_arithmetic_and_no_partial_data(client, demo_portfolio_payload):
    price_history_service._cache.clear()
    with patch.object(yahoo, "fetch_closes", side_effect=_attribution_closes):
        response = client.post(
            "/api/performance-attribution",
            json={"portfolio": demo_portfolio_payload, "range": "3mo"},
        )
    assert response.status_code == 200
    body = response.json()
    nvda = next(row for row in body["holdings"] if row["symbol"] == "NVDA")
    assert nvda["return_pct"] == pytest.approx(0.20)
    assert nvda["approximate_contribution_pct"] == pytest.approx(0.06)
    assert sum(row["approximate_contribution_pct"] for row in body["holdings"]) == pytest.approx(
        body["total_return_pct"]
    )

    price_history_service._cache.clear()
    with patch.object(yahoo, "fetch_closes", side_effect=yahoo.MarketDataError("blocked")):
        failed = client.post(
            "/api/performance-attribution",
            json={"portfolio": demo_portfolio_payload, "range": "3mo"},
        )
    assert failed.status_code == 503
    assert "unavailable" in failed.json()["detail"]


def test_risk_brief_provenance_preserves_user_ai_and_historical_categories(
    client, demo_portfolio_payload
):
    scenario = client.get("/api/scenarios/semiconductor-supply-shock").json()
    scenario["assumption_source"] = "user_edited"
    user = client.post(
        "/api/risk-brief",
        json={"portfolio": demo_portfolio_payload, "scenario": scenario, "use_ai": False},
    )
    assert user.status_code == 200
    categories = {item["component"]: item["category"] for item in user.json()["evidence"]}
    assert categories["Scenario source"] == "ILLUSTRATIVE"
    assert categories["Shock assumptions"] == "USER INPUT"
    assert categories["Portfolio math"] == "DETERMINISTIC"
    assert user.json()["result"]["estimated_impact_pct"] == pytest.approx(
        sum(
            position["weight"] * scenario["asset_shocks"].get(position["symbol"], 0)
            for position in demo_portfolio_payload["positions"]
        )
    )

    historical = client.get("/api/scenarios/historical-covid-crash-2020").json()
    verified = client.post(
        "/api/risk-brief",
        json={"portfolio": demo_portfolio_payload, "scenario": historical, "use_ai": False},
    ).json()
    verified_categories = {
        item["component"]: item["category"] for item in verified["evidence"]
    }
    assert verified_categories["Scenario source"] == "VERIFIED"
    assert verified_categories["Shock assumptions"] == "HISTORICAL"


def test_risk_summary_uses_transparent_metrics(client, demo_portfolio_payload):
    response = client.post("/api/risk-summary", json={"portfolio": demo_portfolio_payload})
    assert response.status_code == 200
    body = response.json()
    assert body["worst_scenario"]
    assert body["largest_concentration"]["symbol"] == "NVDA"
    assert body["live_event_signal_count"] == 0
    assert math.isclose(body["high_impact_threshold_pct"], -0.10)
