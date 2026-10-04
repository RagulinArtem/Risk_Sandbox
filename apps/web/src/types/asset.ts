/** Static, hand-written metadata — always available offline. */
export interface Asset {
  symbol: string;
  name: string;
  asset_class: string;
  instrument: string; // "Stock" | "ETF" | "ADR" | "Cryptocurrency"
  category: string;
  region: string;
  description: string;
  portfolio_role: string;
  risk_factors: string[];
}

export type ReturnPeriod = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y";

export interface PeriodReturn {
  period: ReturnPeriod;
  return_pct: number | null;
  from_date: string | null;
}

export interface AssetPriceResponse {
  symbol: string;
  ticker: string;
  range: string;
  interval: string;
  dates: string[];
  prices: number[];
  latest_close: number;
  latest_close_date: string;
  day_change_pct: number | null;
  returns: PeriodReturn[];
  source_name: string;
  source_url: string;
  retrieved_at: string;
  price_field: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  publisher: string;
  url: string;
  published_at: string;
  related_tickers: string[];
}

export interface AssetNewsResponse {
  symbol: string;
  items: NewsItem[];
  source_name: string;
  retrieved_at: string;
}

export type MovePeriod = "1W" | "1M";

export interface ObservedMove {
  period: MovePeriod;
  return_pct: number;
  from_date: string;
  to_date: string;
  market_return_pct: number | null;
}

export interface MoveDriver {
  text: string;
  kind: "company" | "sector" | "macro" | "market";
  sources: NewsItem[];
}

export interface MoveDriversResponse {
  symbol: string;
  available: boolean;
  message: string | null;
  observed: ObservedMove | null;
  summary: string | null;
  drivers: MoveDriver[];
  confidence: "low" | "medium" | "high" | null;
  model: string | null;
  generated_at: string | null;
  label: string;
}
