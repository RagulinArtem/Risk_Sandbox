import { useEffect, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import type { RiskRadarItem } from "../../types";

export function useRiskRadar() {
  const [items, setItems] = useState<RiskRadarItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getRiskRadar()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load risk radar.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, error, loading };
}
