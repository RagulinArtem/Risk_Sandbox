import type {
  AIStatusResponse,
  AnalystRequest,
  AnalystResponse,
  Asset,
  AssetNewsResponse,
  AssetPriceResponse,
  CommitteeRoster,
  EstimateShocksResponse,
  ExplainRequest,
  ExplainResponse,
  MarketHistoryResponse,
  MarketSummary,
  MoveDriversResponse,
  MovePeriod,
  ParseScenarioResponse,
  Portfolio,
  PriceHistoryRequest,
  PriceRange,
  PriceHistoryResponse,
  RiskFeedResponse,
  RiskRadarItem,
  Scenario,
  StressTestRequest,
  StressTestResult,
  VerdictRequest,
  VerdictResponse,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API error ${status}: ${body}`);
  }

  /** The server's human-readable `detail`, when it sent one. */
  get detail(): string {
    try {
      const parsed = JSON.parse(this.body) as { detail?: unknown };
      if (typeof parsed.detail === "string") return parsed.detail;
    } catch {
      // not JSON
    }
    return this.message;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch {
    throw new ApiError(0, "Could not reach the API. Is the backend running?");
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, body);
  }
  return (await response.json()) as T;
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  listScenarios: () => request<Scenario[]>("/api/scenarios"),
  getScenario: (id: string) => request<Scenario>(`/api/scenarios/${encodeURIComponent(id)}`),
  getDemoPortfolio: () => request<Portfolio>("/api/portfolio/demo"),
  listPortfolios: () => request<Portfolio[]>("/api/portfolios"),
  getPortfolio: (id: string) => request<Portfolio>(`/api/portfolios/${encodeURIComponent(id)}`),
  listAssets: () => request<Asset[]>("/api/assets"),
  getAsset: (symbol: string) => request<Asset>(`/api/assets/${encodeURIComponent(symbol)}`),
  getAssetPrices: (symbol: string, range: PriceRange) =>
    request<AssetPriceResponse>(
      `/api/assets/${encodeURIComponent(symbol)}/prices?range=${encodeURIComponent(range)}`,
    ),
  getAssetNews: (symbol: string) =>
    request<AssetNewsResponse>(`/api/assets/${encodeURIComponent(symbol)}/news`),
  getMoveDrivers: (symbol: string, period: MovePeriod) =>
    request<MoveDriversResponse>(`/api/assets/${encodeURIComponent(symbol)}/move-drivers`, {
      method: "POST",
      body: JSON.stringify({ period }),
    }),
  getRiskRadar: (portfolioId?: string) =>
    request<RiskRadarItem[]>(
      portfolioId
        ? `/api/risk-radar?portfolio_id=${encodeURIComponent(portfolioId)}`
        : "/api/risk-radar",
    ),
  getRiskFeed: (portfolioId: string, onlyRelevant = true) =>
    request<RiskFeedResponse>(
      `/api/risk-feed?portfolio_id=${encodeURIComponent(portfolioId)}&only_relevant=${onlyRelevant}`,
    ),
  getAiStatus: () => request<AIStatusResponse>("/api/ai/status"),
  listTrackedMarkets: () => request<MarketSummary[]>("/api/markets/tracked"),
  getMarketHistory: (marketId: string) =>
    request<MarketHistoryResponse>(
      `/api/markets/${encodeURIComponent(marketId)}/history`,
    ),
  getCommitteeRoster: () => request<CommitteeRoster>("/api/ai/committee"),
  runCommitteeAnalyst: (body: AnalystRequest) =>
    request<AnalystResponse>("/api/ai/committee/analyst", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  runCommitteeVerdict: (body: VerdictRequest) =>
    request<VerdictResponse>("/api/ai/committee/verdict", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  explainResult: (body: ExplainRequest) =>
    request<ExplainResponse>("/api/ai/explain", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  runStressTest: (body: StressTestRequest) =>
    request<StressTestResult>("/api/stress-test", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  estimateShocks: (scenario: Scenario) =>
    request<EstimateShocksResponse>("/api/ai/estimate-shocks", {
      method: "POST",
      body: JSON.stringify({ scenario }),
    }),
  getPriceHistory: (body: PriceHistoryRequest) =>
    request<PriceHistoryResponse>("/api/price-history", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  parseScenario: (text: string) =>
    request<ParseScenarioResponse>("/api/ai/parse-scenario", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};
