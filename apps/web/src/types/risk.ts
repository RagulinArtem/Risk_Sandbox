import type { SourceStatus } from "./scenario";

export type PortfolioRelevance = "low" | "medium" | "high";

export interface RiskRadarItem {
  id: string;
  title: string;
  category: string;
  summary: string;
  portfolio_relevance: PortfolioRelevance;
  probability_signal: string | null;
  source_status: SourceStatus;
  source_name: string | null;
  source_url: string | null;
  source_date: string | null;
  retrieved_at: string | null;
  scenario_id: string;
  exposure_symbols: string[];
}
