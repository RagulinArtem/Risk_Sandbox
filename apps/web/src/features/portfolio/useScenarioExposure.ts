import { useEffect, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import type { Portfolio, Scenario, StressTestResult } from "../../types";

export interface ScenarioExposure {
  scenario: Scenario;
  result: StressTestResult;
}

/** Runs every library scenario against the portfolio through the stress-test
 * API, so the overview can rank them. All impact math stays in the backend. */
export function useScenarioExposure(portfolio: Portfolio | null) {
  const [exposures, setExposures] = useState<ScenarioExposure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!portfolio) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listScenarios()
      .then((scenarios) =>
        Promise.all(
          scenarios.map(async (scenario) => ({
            scenario,
            result: await api.runStressTest({ portfolio, scenario_id: scenario.id }),
          })),
        ),
      )
      .then((data) => {
        if (!cancelled) {
          setExposures(
            [...data].sort(
              (a, b) => a.result.estimated_impact_pct - b.result.estimated_impact_pct,
            ),
          );
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load scenario exposure.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [portfolio]);

  return { exposures, error, loading };
}
