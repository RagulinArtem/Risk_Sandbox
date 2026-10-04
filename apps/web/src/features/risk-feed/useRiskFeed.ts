import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import type { RiskFeedResponse } from "../../types";

const POLL_MS = 60_000;
const feedCache = new Map<string, RiskFeedResponse>();
const pendingFeeds = new Map<string, Promise<RiskFeedResponse>>();

function cacheKey(portfolioId: string, onlyRelevant: boolean) {
  return `${portfolioId}:${onlyRelevant}`;
}

export function prefetchRiskFeed(portfolioId: string, onlyRelevant = true) {
  const key = cacheKey(portfolioId, onlyRelevant);
  if (feedCache.has(key)) return Promise.resolve(feedCache.get(key)!);
  const pending = pendingFeeds.get(key);
  if (pending) return pending;

  const request = api.getRiskFeed(portfolioId, onlyRelevant).then((response) => {
    feedCache.set(key, response);
    pendingFeeds.delete(key);
    return response;
  }).catch((error: unknown) => {
    pendingFeeds.delete(key);
    throw error;
  });
  pendingFeeds.set(key, request);
  return request;
}

export function useRiskFeed(portfolioId: string | undefined, onlyRelevant: boolean) {
  const key = portfolioId ? cacheKey(portfolioId, onlyRelevant) : null;
  const [data, setData] = useState<RiskFeedResponse | null>(() => key ? feedCache.get(key) ?? null : null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!portfolioId) return;
    try {
      const requestKey = cacheKey(portfolioId, onlyRelevant);
      const response = pendingFeeds.get(requestKey)
        ? await pendingFeeds.get(requestKey)!
        : await api.getRiskFeed(portfolioId, onlyRelevant);
      feedCache.set(requestKey, response);
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Couldn't load the risk feed.");
    } finally {
      setLoading(false);
    }
  }, [portfolioId, onlyRelevant]);

  useEffect(() => {
    const cached = portfolioId ? feedCache.get(cacheKey(portfolioId, onlyRelevant)) : null;
    if (cached) setData(cached);
    setLoading(!cached);
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [load, onlyRelevant, portfolioId]);

  return { data, error, loading, reload: load };
}
