import { useEffect, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import type { MarketSummary } from "../../types";

export function useTrackedMarkets() {
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .listTrackedMarkets()
      .then((data) => {
        if (!cancelled) setMarkets(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load tracked markets.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { markets, error, loading };
}
