import json

import pytest

from app.core.config import get_settings
from app.services.scenario_service import ScenarioNotFoundError, get_scenario_service


def test_list_scenarios_returns_at_least_five():
    scenarios = get_scenario_service().list_scenarios()
    assert len(scenarios) >= 5


def test_get_known_scenario():
    scenario = get_scenario_service().get_scenario("semiconductor-supply-shock")
    assert scenario.title == "Semiconductor Supply Shock"
    assert scenario.source_status == "illustrative"


def test_get_unknown_scenario_raises():
    with pytest.raises(ScenarioNotFoundError):
        get_scenario_service().get_scenario("does-not-exist")


def test_all_demo_scenarios_only_shock_supported_assets():
    supported_assets_path = get_settings().data_dir / "assets" / "supported_assets.json"
    supported = {a["symbol"] for a in json.loads(supported_assets_path.read_text())["assets"]}
    for scenario in get_scenario_service().list_scenarios():
        assert set(scenario.asset_shocks).issubset(supported)


def test_verified_scenarios_carry_full_provenance():
    """Any scenario claiming source_status != "illustrative" must have a
    real citation — never a verified/live label with no source behind it
    (Principle 3/5 in AGENTS.md)."""
    for scenario in get_scenario_service().list_scenarios():
        if scenario.source_status != "illustrative":
            assert scenario.source_name, f"{scenario.id} is missing source_name"
            assert scenario.source_url, f"{scenario.id} is missing source_url"
            assert scenario.source_date, f"{scenario.id} is missing source_date"


def test_historical_2022_scenario_is_verified_and_present():
    scenario = get_scenario_service().get_scenario("historical-2022-rate-hike-selloff")
    assert scenario.source_status == "verified"
    assert scenario.source_name
    assert scenario.source_url.startswith("https://")
    assert set(scenario.asset_shocks) == {"NVDA", "QQQ", "SPY", "BTC", "GLD", "TLT"}
