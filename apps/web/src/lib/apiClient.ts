import type {
  DiversificationResponse,
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
  MitigationCompareRequest,
  MitigationCompareResponse,
  MoveDriversResponse,
  MovePeriod,
  ParseScenarioResponse,
  PerformanceAttributionResponse,
  Portfolio,
  PortfolioRiskSummary,
  PriceHistoryRequest,
  PriceRange,
  PriceHistoryResponse,
  RiskAttentionResponse,
  RiskBriefRequest,
  RiskBriefResponse,
  RiskDriversResponse,
  RiskFeedResponse,
  RiskRadarItem,
  Scenario,
  ScenarioComparisonRequest,
  ScenarioComparisonResponse,
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
    // no-store: API responses carry no Cache-Control, so browsers were
    // heuristically caching them (stale scenario names, even a 404) across
    // deploys. The backend already caches the expensive calls itself.
    response = await fetch(`${BASE_URL}${path}`, {
      cache: "no-store",
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
  getDiversification: (portfolioId: string) =>
    request<DiversificationResponse>(
      `/api/portfolios/${encodeURIComponent(portfolioId)}/diversification`,
    ),
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
  compareScenarios: (body: ScenarioComparisonRequest) =>
    request<ScenarioComparisonResponse>("/api/scenario-comparison", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getRiskDrivers: (portfolio: Portfolio) =>
    request<RiskDriversResponse>("/api/risk-drivers", {
      method: "POST",
      body: JSON.stringify({ portfolio }),
    }),
  getRiskAttention: (portfolio: Portfolio) =>
    request<RiskAttentionResponse>("/api/risk-attention", {
      method: "POST",
      body: JSON.stringify({ portfolio }),
    }),
  compareMitigation: (body: MitigationCompareRequest) =>
    request<MitigationCompareResponse>("/api/mitigation/compare", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getPerformanceAttribution: (portfolio: Portfolio, range: PriceRange) =>
    request<PerformanceAttributionResponse>("/api/performance-attribution", {
      method: "POST",
      body: JSON.stringify({ portfolio, range }),
    }),
  getRiskBrief: (body: RiskBriefRequest) =>
    request<RiskBriefResponse>("/api/risk-brief", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getRiskSummary: (portfolio: Portfolio) =>
    request<PortfolioRiskSummary>("/api/risk-summary", {
      method: "POST",
      body: JSON.stringify({ portfolio }),
    }),
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
