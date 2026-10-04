export type FeedKind = "filing" | "policy" | "data" | "news" | "market" | "price";

export interface FeedItem {
  id: string;
  source: string;
  tier: 1 | 2 | 3 | 4;
  kind: FeedKind;
  title: string;
  url: string;
  published_at: string;
  tickers: string[];
  probability: number | null;
  detail: string | null;
}

export interface FeedSourceStatus {
  name: string;
  tier: number;
  ok: boolean;
  items: number;
  error: string | null;
  last_success: string | null;
}

export interface ScenarioLink {
  id: string;
  title: string;
  source_status: string;
  impact_pct: number;
}

export interface AssessedItem {
  item: FeedItem;
  factors: { id: string; label: string }[];
  held_exposure: { symbol: string; weight: number; direction: number }[];
  exposure_weight: number;
  relevance: number;
  relevance_reason: string;
  suggested_scenario: ScenarioLink | null;
  history: ScenarioLink[];
}

export interface RiskFeedResponse {
  portfolio_id: string;
  items: AssessedItem[];
  sources: FeedSourceStatus[];
  refreshed_at: string | null;
  refreshing: boolean;
}
