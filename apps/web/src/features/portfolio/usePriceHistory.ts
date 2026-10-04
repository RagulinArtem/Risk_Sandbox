import { useEffect, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import type { Portfolio, PriceHistoryResponse, PriceRange } from "../../types";

export function usePriceHistory(portfolio: Portfolio, range: PriceRange) {
  const [history, setHistory] = useState<PriceHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getPriceHistory({ portfolio, range })
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setHistory(null);
        setError(
          err instanceof ApiError && err.status === 503
            ? "Live price data is unavailable right now (Yahoo Finance didn't respond). The rest of the app still works."
            : "Couldn't load price history.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [portfolio, range]);

  return { history, error, loading };
}
