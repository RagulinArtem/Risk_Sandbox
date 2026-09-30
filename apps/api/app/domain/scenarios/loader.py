import json
from pathlib import Path

from app.schemas.scenario import Scenario


class ScenarioLoadError(RuntimeError):
    pass


def load_scenarios_from_dir(directory: Path) -> dict[str, Scenario]:
    """Load every *.json file in `directory` as a Scenario, keyed by id.

    Each file is independent — adding a new demo scenario never requires a
    Python change (see docs/EDITING_GUIDE.md).
    """
    if not directory.exists():
        raise ScenarioLoadError(f"Scenario directory not found: {directory}")

    scenarios: dict[str, Scenario] = {}
    for path in sorted(directory.glob("*.json")):
        try:
            raw = json.loads(path.read_text())
            scenario = Scenario.model_validate(raw)
        except Exception as exc:  # noqa: BLE001 - surface which file was bad
            raise ScenarioLoadError(f"Failed to load scenario file {path}: {exc}") from exc

        if scenario.id in scenarios:
            raise ScenarioLoadError(
                f"Duplicate scenario id '{scenario.id}' in {path} "
                f"(already defined by another file)"
            )
        scenarios[scenario.id] = scenario

    return scenarios
