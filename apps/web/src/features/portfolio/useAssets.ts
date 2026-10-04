import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import type { Asset } from "../../types";

/** Asset names/classes keyed by symbol. Missing metadata is not fatal —
 * the overview falls back to showing the bare symbol. */
export function useAssets() {
  const [assets, setAssets] = useState<Record<string, Asset>>({});

  useEffect(() => {
    let cancelled = false;
    api
      .listAssets()
      .then((list) => {
        if (!cancelled) setAssets(Object.fromEntries(list.map((a) => [a.symbol, a])));
      })
      .catch(() => {
        // Non-critical: the holdings table just shows symbols without names.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return assets;
}
