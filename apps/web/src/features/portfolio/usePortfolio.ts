import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import type { Portfolio } from "../../types";

const STORAGE_KEY = "risk-sandbox.portfolio-id";

function readStoredId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** All demo portfolios plus the selected one (remembered per browser).
 * The first portfolio from the API is the primary demo. */
export function usePortfolio() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(readStoredId);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listPortfolios()
      .then((data) => {
        if (!cancelled) setPortfolios(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load portfolio.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage unavailable (private mode): the choice just isn't remembered.
    }
  }, []);

  const portfolio = portfolios.find((p) => p.id === selectedId) ?? portfolios[0] ?? null;

  return { portfolios, portfolio, select, error, loading };
}
