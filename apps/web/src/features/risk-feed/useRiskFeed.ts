import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import type { RiskFeedResponse } from "../../types";

const POLL_MS = 60_000;

export function useRiskFeed(portfolioId: string | undefined, onlyRelevant: boolean) {
  const [data, setData] = useState<RiskFeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!portfolioId) return;
    try {
      setData(await api.getRiskFeed(portfolioId, onlyRelevant));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Couldn't load the risk feed.");
    } finally {
      setLoading(false);
    }
  }, [portfolioId, onlyRelevant]);

  useEffect(() => {
    setLoading(true);
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  return { data, error, loading, reload: load };
}
