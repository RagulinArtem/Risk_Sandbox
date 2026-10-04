import { useEffect, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import type { Portfolio, ScenarioComparisonResponse } from "../../types";

export function useScenarioComparison(portfolio: Portfolio | null) {
  const [data, setData] = useState<ScenarioComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!portfolio) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .compareScenarios({ portfolio })
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.detail : "Failed to compare scenarios.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [portfolio]);

  return { data, error, loading };
}
