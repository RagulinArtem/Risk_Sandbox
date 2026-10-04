import math


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ai_status_defaults_to_mock_not_live(client):
    response = client.get("/api/ai/status")
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "mock"
    assert body["is_live"] is False


def test_list_scenarios(client):
    response = client.get("/api/scenarios")
    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 5
    assert all("asset_shocks" in s for s in body)


def test_get_scenario_known(client):
    response = client.get("/api/scenarios/semiconductor-supply-shock")
    assert response.status_code == 200
    assert response.json()["id"] == "semiconductor-supply-shock"


def test_get_scenario_unknown_returns_404(client):
    response = client.get("/api/scenarios/does-not-exist")
    assert response.status_code == 404


def test_demo_portfolio(client):
    response = client.get("/api/portfolio/demo")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "global-multi-asset"
    assert len(body["positions"]) == 15
    assert abs(sum(p["weight"] for p in body["positions"]) - 1.0) < 1e-9


def test_portfolios_list_and_lookup(client):
    ids = [p["id"] for p in client.get("/api/portfolios").json()]
    assert ids == ["global-multi-asset", "demo-tech"]
    assert client.get("/api/portfolios/demo-tech").json()["name"] == "Technology Heavy Portfolio"
    assert client.get("/api/portfolios/nope").status_code == 404


def test_risk_radar_accepts_portfolio_id(client):
    assert client.get("/api/risk-radar?portfolio_id=demo-tech").status_code == 200
    assert client.get("/api/risk-radar?portfolio_id=nope").status_code == 404


def test_stress_test_with_known_scenario(client, demo_portfolio_payload):
    response = client.post(
        "/api/stress-test",
        json={"portfolio": demo_portfolio_payload, "scenario_id": "semiconductor-supply-shock"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["scenario_id"] == "semiconductor-supply-shock"
    assert body["estimated_impact_value"] < 0
    assert len(body["asset_impacts"]) == len(demo_portfolio_payload["positions"])


def test_stress_test_with_unknown_scenario_returns_404(client, demo_portfolio_payload):
    response = client.post(
        "/api/stress-test",
        json={"portfolio": demo_portfolio_payload, "scenario_id": "does-not-exist"},
    )
    assert response.status_code == 404


def test_stress_test_with_custom_shocks(client, demo_portfolio_payload):
    response = client.post(
        "/api/stress-test",
        json={"portfolio": demo_portfolio_payload, "custom_shocks": {"NVDA": -0.5}},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["scenario_id"] is None
    assert body["scenario_title"] == "Custom Scenario"


def test_stress_test_rejects_both_scenario_and_custom_shocks(client, demo_portfolio_payload):
    response = client.post(
        "/api/stress-test",
        json={
            "portfolio": demo_portfolio_payload,
            "scenario_id": "semiconductor-supply-shock",
            "custom_shocks": {"NVDA": -0.5},
        },
    )
    assert response.status_code == 422


def test_stress_test_with_unsupported_asset_has_no_assumption(client):
    portfolio = {
        "id": "custom",
        "name": "Custom",
        "currency": "USD",
        "total_value": 1000,
        "positions": [{"symbol": "XYZ", "weight": 1.0}],
    }
    response = client.post(
        "/api/stress-test",
        json={"portfolio": portfolio, "scenario_id": "semiconductor-supply-shock"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["asset_impacts"][0]["has_assumption"] is False
    assert body["estimated_impact_value"] == 0


def test_stress_test_rejects_invalid_portfolio_weights(client):
    portfolio = {
        "id": "bad",
        "name": "Bad",
        "currency": "USD",
        "total_value": 1000,
        "positions": [{"symbol": "NVDA", "weight": 0.2}],
    }
    response = client.post(
        "/api/stress-test",
        json={"portfolio": portfolio, "scenario_id": "semiconductor-supply-shock"},
    )
    assert response.status_code == 422


def test_risk_radar(client):
    response = client.get("/api/risk-radar")
    assert response.status_code == 200
    assert len(response.json()) >= 5


def test_parse_scenario_single_trigger_recognized(client):
    response = client.post("/api/ai/parse-scenario", json={"text": "Nasdaq falls 15%"})
    assert response.status_code == 200
    body = response.json()
    assert body["recognized"] is True
    assert math.isclose(body["scenario"]["asset_shocks"]["QQQ"], -0.15)


def test_parse_scenario_multi_trigger_recognized(client):
    response = client.post(
        "/api/ai/parse-scenario",
        json={"text": "What if oil rises 40% and Nasdaq falls 15%?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["recognized"] is True
    matched_line = next(
        line for line in body["scenario"]["transmission"] if line.startswith("Matched trigger(s)")
    )
    assert "Oil price move" in matched_line
    assert "Nasdaq / technology move" in matched_line


def test_parse_scenario_unrecognized_is_graceful(client):
    response = client.post("/api/ai/parse-scenario", json={"text": "gibberish with no numbers"})
    assert response.status_code == 200
    body = response.json()
    assert body["recognized"] is False
    assert body["scenario"] is None
    assert body["message"]


def test_parse_ai_bubble_title_returns_canonical_demo_scenario(client):
    library = client.get("/api/scenarios/ai-capex-bust").json()

    for text in ("AI BUBBLE BURSTS", "AI bubble burst", "If the AI bubble bursts?"):
        parsed = client.post("/api/ai/parse-scenario", json={"text": text})
        assert parsed.status_code == 200
        scenario = parsed.json()["scenario"]
        assert scenario["id"] == "ai-capex-bust"
        assert scenario["asset_shocks"] == library["asset_shocks"]

    portfolio = client.get("/api/portfolio/demo").json()
    result = client.post(
        "/api/stress-test",
        json={"portfolio": portfolio, "custom_shocks": scenario["asset_shocks"]},
    )
    assert result.status_code == 200
    assert result.json()["estimated_impact_value"] == -9690
    assert result.json()["estimated_impact_pct"] == -0.0969
    biggest = result.json()["biggest_negative_contributor"]
    assert biggest["symbol"] == "NVDA"
    assert math.isclose(biggest["impact_value"], -3150.0)


def test_list_assets_covers_demo_portfolio(client):
    response = client.get("/api/assets")
    assert response.status_code == 200
    assets = {a["symbol"]: a for a in response.json()}
    portfolio = client.get("/api/portfolio/demo").json()
    for position in portfolio["positions"]:
        assert position["symbol"] in assets
        assert assets[position["symbol"]]["name"]
        assert assets[position["symbol"]]["asset_class"]
