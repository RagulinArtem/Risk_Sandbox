import type {
  AIStatusResponse,
  AnalystRequest,
  AnalystResponse,
  Asset,
  ExplainRequest,
  ExplainResponse,
  MarketHistoryResponse,
  MarketSummary,
  ParseScenarioResponse,
  Portfolio,
  RiskRadarItem,
  Scenario,
  StressTestRequest,
  StressTestResult,
  VerdictRequest,
  VerdictResponse,
  CommitteeRoster,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API error ${status}: ${body}`);
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
  listAssets: () => request<Asset[]>("/api/assets"),
  getRiskRadar: () => request<RiskRadarItem[]>("/api/risk-radar"),
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
  parseScenario: (text: string) =>
    request<ParseScenarioResponse>("/api/ai/parse-scenario", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};
