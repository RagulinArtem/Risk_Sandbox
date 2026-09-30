import type { Portfolio } from "./portfolio";

export interface AssetImpact {
  symbol: string;
  weight: number;
  position_value: number;
  shock_pct: number;
  impact_value: number;
  impact_pct_of_portfolio: number;
  has_assumption: boolean;
}

export interface StressTestRequest {
  portfolio: Portfolio;
  scenario_id?: string | null;
  custom_shocks?: Record<string, number> | null;
}

export interface StressTestResult {
  scenario_id: string | null;
  scenario_title: string;
  initial_value: number;
  estimated_impact_value: number;
  estimated_impact_pct: number;
  stressed_value: number;
  asset_impacts: AssetImpact[];
  biggest_negative_contributor: AssetImpact | null;
  biggest_positive_contributor: AssetImpact | null;
  concentration_notes: string[];
  explanation: string;
}
