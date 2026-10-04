import { useEffect, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import type { Portfolio, ScenarioComparisonRow } from "../../types";

export type ScenarioExposure = ScenarioComparisonRow;

/** Loads the backend's batch comparison so the overview can rank every library
 * scenario without duplicating impact math or issuing an N-request waterfall. */
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
      .compareScenarios({ portfolio })
      .then((data) => {
        if (!cancelled) {
          setExposures(data.scenarios);
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
