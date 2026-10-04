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
  /** factor -> magnitude: pct moves for oil/nasdaq/semis/usd; pp for rates */
  factor_shocks?: Record<string, number> | null;
  scenario_title?: string | null;
  /** market probability 0..1 — enables the weighted-exposure figure */
  probability?: number | null;
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
  factor_shocks?: Record<string, number> | null;
  beta_version?: string | null;
  probability?: number | null;
  weighted_exposure_pct?: number | null;
  warnings?: string[];
}
