import math

import pytest

from app.domain.risk.engine import FactorStressEngine
from app.schemas.portfolio import Portfolio, PortfolioPosition
from app.schemas.stress_test import StressTestRequest

# The PRD's golden case: betas 1.2 and 0.5 to nasdaq, weights 0.6/0.4,
# shock -10 -> asset impacts -12/-5, portfolio -9.2% ($90,800), shares
# 78.3%/21.7%.
BETAS = {"A": {"nasdaq": 1.2}, "B": {"nasdaq": 0.5}}


def _portfolio(total_value: float = 100_000.0) -> Portfolio:
    return Portfolio(
        id="t",
        name="Test",
        total_value=total_value,
        positions=[
            PortfolioPosition(symbol="A", weight=0.6),
            PortfolioPosition(symbol="B", weight=0.4),
        ],
    )


def test_golden_case_matches_prd_numbers():
    engine = FactorStressEngine(BETAS, beta_version="test")
    result = engine.run_factor(_portfolio(), {"nasdaq": -10.0}, scenario_title="Golden")

    assert math.isclose(result.asset_impacts[0].shock_pct, -0.12)
    assert math.isclose(result.asset_impacts[1].shock_pct, -0.05)
    assert math.isclose(result.estimated_impact_pct, -0.092)
    assert math.isclose(result.estimated_impact_value, -9_200.0)
    assert math.isclose(result.stressed_value, 90_800.0)
    shares = sorted(
        (a.impact_value / result.estimated_impact_value for a in result.asset_impacts),
        reverse=True,
    )
    assert math.isclose(shares[0], 0.783, abs_tol=0.001)
    assert math.isclose(shares[1], 0.217, abs_tol=0.001)


def test_determinism_same_input_same_output():
    engine = FactorStressEngine(BETAS, beta_version="test")
    first = engine.run_factor(_portfolio(), {"nasdaq": -10.0, "rates": 0.5})
    second = engine.run_factor(_portfolio(), {"nasdaq": -10.0, "rates": 0.5})
    assert first.model_dump() == second.model_dump()


def test_huge_shock_floors_at_minus_100_percent():
    engine = FactorStressEngine({"A": {"nasdaq": 50.0}, "B": {"nasdaq": 0.5}}, beta_version="t")
    result = engine.run_factor(_portfolio(), {"nasdaq": -10.0})
    assert result.asset_impacts[0].shock_pct == -1.0
    assert result.asset_impacts[1].shock_pct > -1.0


def test_missing_asset_beta_treated_as_zero_with_warning():
    engine = FactorStressEngine(BETAS, beta_version="test")
    portfolio = Portfolio(
        id="t",
        name="T",
        total_value=100_000,
        positions=[
            PortfolioPosition(symbol="A", weight=0.5),
            PortfolioPosition(symbol="ZZZ", weight=0.5),
        ],
    )
    result = engine.run_factor(portfolio, {"nasdaq": -10.0})
    assert result.asset_impacts[1].symbol == "ZZZ"
    assert result.asset_impacts[1].shock_pct == 0.0
    assert any("ZZZ" in warning for warning in result.warnings)


def test_missing_factor_beta_warns_and_treats_as_zero():
    engine = FactorStressEngine(BETAS, beta_version="test")  # no "oil" betas
    result = engine.run_factor(_portfolio(), {"oil": 40.0})
    assert math.isclose(result.estimated_impact_pct, 0.0)
    assert any("'oil'" in warning for warning in result.warnings)


def test_partial_factor_coverage_does_not_warn():
    # A sparse beta table is normal: only some assets carry a factor beta
    # (NVDA has no gold beta). That is not a data gap and must not warn —
    # only a factor no holding covers at all is worth flagging.
    betas = {"A": {"nasdaq": 1.0, "gold": 1.0}, "B": {"nasdaq": 0.5}}
    engine = FactorStressEngine(betas, beta_version="test")
    result = engine.run_factor(_portfolio(), {"nasdaq": -5.0, "gold": 5.0})
    assert result.warnings == []


def test_rates_shock_uses_pp_units_against_tlt_beta():
    betas = {"TLT": {"rates": -12.0}}
    engine = FactorStressEngine(betas, beta_version="test")
    portfolio = Portfolio(
        id="t",
        name="T",
        total_value=100_000,
        positions=[PortfolioPosition(symbol="TLT", weight=1.0)],
    )
    result = engine.run_factor(portfolio, {"rates": 0.5})  # +0.5pp yield
    assert math.isclose(result.asset_impacts[0].shock_pct, -0.06)


def test_service_attaches_probability_weighted_exposure():
    from app.services.stress_test_service import StressTestService

    class _NoScenario:
        def get_scenario(self, scenario_id):
            raise AssertionError("not used")

    engine = FactorStressEngine(BETAS, beta_version="test")
    service = StressTestService(_NoScenario(), engine=None, factor_engine=engine)
    request = StressTestRequest(
        portfolio=_portfolio(), factor_shocks={"nasdaq": -10.0}, probability=0.25
    )
    result = service.run(request)
    assert math.isclose(result.estimated_impact_pct, -0.092)
    assert math.isclose(result.weighted_exposure_pct, -0.023)
    assert result.probability == 0.25
    assert result.factor_shocks == {"nasdaq": -10.0}
    assert result.beta_version == engine.beta_version


def test_real_demo_beta_table_loads_and_is_sane():
    from app.services.beta_service import load_betas

    betas, version = load_betas()
    assert version.startswith("betas-")
    # Sanity rules from the technical spec: TLT negative to rates, NVDA
    # loads heavily on semis, GLD low on nasdaq, BTC positive on nasdaq.
    assert betas["TLT"]["rates"] < 0
    assert betas["NVDA"]["semis"] > 1.0
    assert abs(betas["GLD"]["nasdaq"]) < 0.3
    assert betas["BTC"]["nasdaq"] > 0


@pytest.mark.parametrize("factor", ["nasdaq", "semis", "rates", "oil", "usd"])
def test_api_factor_shocks_endpoint(client, demo_portfolio_payload, factor):
    response = client.post(
        "/api/stress-test",
        json={
            "portfolio": demo_portfolio_payload,
            "factor_shocks": {factor: -10.0},
            "probability": 0.25,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["factor_shocks"] == {factor: -10.0}
    assert body["beta_version"].startswith("betas-")
    assert body["weighted_exposure_pct"] == pytest.approx(0.25 * body["estimated_impact_pct"])


def test_api_rejects_multiple_shock_sources(client, demo_portfolio_payload):
    response = client.post(
        "/api/stress-test",
        json={
            "portfolio": demo_portfolio_payload,
            "scenario_id": "semiconductor-supply-shock",
            "factor_shocks": {"nasdaq": -10.0},
        },
    )
    assert response.status_code == 422


def test_api_rejects_probability_out_of_range(client, demo_portfolio_payload):
    response = client.post(
        "/api/stress-test",
        json={
            "portfolio": demo_portfolio_payload,
            "factor_shocks": {"nasdaq": -10.0},
            "probability": 1.5,
        },
    )
    assert response.status_code == 422
