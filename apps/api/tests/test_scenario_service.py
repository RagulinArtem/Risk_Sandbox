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
