import math

from app.domain.risk.engine import DirectAssetShockEngine
from app.schemas.portfolio import Portfolio, PortfolioPosition


def _portfolio() -> Portfolio:
    return Portfolio(
        id="t",
        name="Test",
        currency="USD",
        total_value=1000,
        positions=[
            PortfolioPosition(symbol="NVDA", weight=0.6),
            PortfolioPosition(symbol="QQQ", weight=0.4),
        ],
    )


def test_engine_applies_shocks_deterministically():
    engine = DirectAssetShockEngine()
    result = engine.run(
        portfolio=_portfolio(),
        asset_shocks={"NVDA": -0.25, "QQQ": -0.10},
        scenario_id="s1",
        scenario_title="Test Scenario",
    )
    assert result.initial_value == 1000
    nvda = next(a for a in result.asset_impacts if a.symbol == "NVDA")
    qqq = next(a for a in result.asset_impacts if a.symbol == "QQQ")
    assert math.isclose(nvda.impact_value, 600 * -0.25)
    assert math.isclose(qqq.impact_value, 400 * -0.10)
    assert math.isclose(result.estimated_impact_value, nvda.impact_value + qqq.impact_value)
    assert math.isclose(result.stressed_value, 1000 + result.estimated_impact_value)


def test_asset_contributions_sum_to_total_impact():
    engine = DirectAssetShockEngine()
    result = engine.run(
        portfolio=_portfolio(),
        asset_shocks={"NVDA": -0.25, "QQQ": 0.05},
        scenario_id="s1",
        scenario_title="Test Scenario",
    )
    total_from_assets = sum(a.impact_value for a in result.asset_impacts)
    assert math.isclose(total_from_assets, result.estimated_impact_value, abs_tol=1e-9)


def test_missing_asset_shock_assumption_defaults_to_zero():
    engine = DirectAssetShockEngine()
    result = engine.run(
        portfolio=_portfolio(),
        asset_shocks={"NVDA": -0.25},  # no QQQ assumption in this scenario
        scenario_id="s1",
        scenario_title="Test Scenario",
    )
    qqq = next(a for a in result.asset_impacts if a.symbol == "QQQ")
    assert qqq.shock_pct == 0.0
    assert qqq.impact_value == 0.0
    assert qqq.has_assumption is False
    assert any("QQQ" in note for note in result.concentration_notes)


def test_biggest_negative_and_positive_contributors():
    engine = DirectAssetShockEngine()
    result = engine.run(
        portfolio=_portfolio(),
        asset_shocks={"NVDA": -0.25, "QQQ": 0.10},
        scenario_id="s1",
        scenario_title="Test Scenario",
    )
    assert result.biggest_negative_contributor.symbol == "NVDA"
    assert result.biggest_positive_contributor.symbol == "QQQ"


def test_concentration_note_for_large_position():
    engine = DirectAssetShockEngine()
    result = engine.run(
        portfolio=_portfolio(),  # NVDA is 60% of this portfolio
        asset_shocks={"NVDA": -0.1, "QQQ": -0.1},
        scenario_id="s1",
        scenario_title="Test Scenario",
    )
    assert any(
        "NVDA" in note and "concentrated" in note for note in result.concentration_notes
    )
