from unittest.mock import patch

from app.api.routes import ai as ai_routes
from app.core.config import Settings


def test_explain_with_live_provider_formats_prompt_without_crashing(client, demo_portfolio_payload):
    """Regression: literal JSON braces in _EXPLAIN_PROMPT made .format() raise
    KeyError('"text"') -> HTTP 500 whenever a live provider was configured."""
    result = client.post(
        "/api/stress-test",
        json={"portfolio": demo_portfolio_payload, "scenario_id": "semiconductor-supply-shock"},
    ).json()
    live = Settings(ai_provider="openrouter", openrouter_api_key="k")
    with (
        patch.object(ai_routes, "get_settings", return_value=live),
        patch.object(ai_routes, "complete_json", return_value={"text": "no numbers here"}) as call,
    ):
        response = client.post("/api/ai/explain", json={"result": result})
    assert response.status_code == 200
    assert '{"text": "your explanation"}' in call.call_args.args[1]
