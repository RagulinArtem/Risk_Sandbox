import type { Portfolio } from "./portfolio";

export type PriceRange = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";

export interface PriceSeries {
  symbol: string;
  ticker: string;
  prices: number[];
  change_pct: number;
}

export interface PriceHistoryRequest {
  portfolio: Portfolio;
  range: PriceRange;
}

export interface PriceHistoryResponse {
  range: PriceRange;
  interval: string;
  dates: string[];
  series: PriceSeries[];
  portfolio_values: number[];
  portfolio_change_pct: number;
  source_name: string;
  source_url: string;
  retrieved_at: string;
  price_field: string;
}
