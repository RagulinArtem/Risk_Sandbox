import { useEffect, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import type { AssetNewsResponse, AssetPriceResponse, PriceRange } from "../../types";

interface Loadable<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

function detail(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.status === 503 ? fallback : "Couldn't reach the server.";
}

export function useAssetPrices(symbol: string, range: PriceRange): Loadable<AssetPriceResponse> {
  const [state, setState] = useState<Loadable<AssetPriceResponse>>({
    data: null,
    error: null,
    loading: true,
  });
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .getAssetPrices(symbol, range)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setState({ data: null, error: detail(err, "Price data unavailable"), loading: false }),
      );
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);
  return state;
}

export function useAssetNews(symbol: string): Loadable<AssetNewsResponse> {
  const [state, setState] = useState<Loadable<AssetNewsResponse>>({
    data: null,
    error: null,
    loading: true,
  });
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    api
      .getAssetNews(symbol)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setState({ data: null, error: detail(err, "Recent news unavailable"), loading: false }),
      );
    return () => {
      cancelled = true;
    };
  }, [symbol]);
  return state;
}
