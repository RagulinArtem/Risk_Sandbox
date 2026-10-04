import type { SourceStatus } from "./scenario";

export type MarketDataStatus = "illustrative" | "verified" | "live" | "cached";

export interface PricePoint {
  /** unix seconds */
  t: number;
  /** 0..1 — price of the Yes outcome (market-implied probability) */
  p: number;
}

export interface MappedScenario {
  id: string;
  name: string;
  description: string;
  horizon: string;
  /** factor -> magnitude: pct moves for oil/nasdaq/semis/usd; pp for rates */
  factor_shocks: Record<string, number>;
  transmission: string[];
  shock_sources: string[];
  source_status: SourceStatus;
}

export interface MarketSummary {
  market_id: string;
  token_id: string;
  label: string;
  question: string;
  slug: string | null;
  probability: number | null;
  change_7d_pp: number | null;
  change_30d_pp: number | null;
  repriced: boolean;
  liquidity_usd: number | null;
  volume_usd: number | null;
  end_date: string | null;
  scenario: MappedScenario | null;
  source_status: MarketDataStatus;
  as_of: string | null;
}

export interface MarketContextSignal {
  market_id: string;
  label: string;
  question: string;
  probability: number | null;
  change_7d_pp: number | null;
  change_30d_pp: number | null;
  repriced: boolean;
  source_status: MarketDataStatus;
  source_url: string | null;
  as_of: string | null;
}

export interface MarketHistoryResponse {
  market_id: string;
  token_id: string;
  label: string;
  interval: string;
  points: PricePoint[];
  source_status: MarketDataStatus;
  as_of: string | null;
}
