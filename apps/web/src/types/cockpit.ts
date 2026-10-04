import type { CommitteeVerdict } from "./committee";
import type { Portfolio } from "./portfolio";
import type { PriceRange } from "./priceHistory";
import type { RiskRadarItem } from "./risk";
import type { RiskDriverRef, Scenario, SourceStatus } from "./scenario";
import type { AssetImpact, StressTestResult } from "./stressTest";

export type ExposureLevel = "low" | "medium" | "high" | "very_high";
export type EvidenceCategory =
  | "LIVE"
  | "VERIFIED"
  | "HISTORICAL"
  | "USER INPUT"
  | "AI ESTIMATE"
  | "ILLUSTRATIVE"
  | "DETERMINISTIC";

export interface ScenarioComparisonRequest {
  portfolio: Portfolio;
  scenario_ids?: string[] | null;
}

export interface ScenarioComparisonRow {
  scenario_id: string;
  title: string;
  source_status: SourceStatus;
  horizon: string;
  risk_drivers: RiskDriverRef[];
  impact_value: number;
  impact_pct: number;
  stressed_value: number;
  largest_negative_contributor: AssetImpact | null;
  asset_contributions: AssetImpact[];
}

export interface ScenarioHeadline {
  scenario_id: string;
  title: string;
  impact_pct: number;
  impact_value: number;
}

export interface VulnerableAssetSummary {
  symbol: string;
  total_downside_value: number;
  downside_scenario_count: number;
}

export interface RecurringContributorSummary {
  symbol: string;
  scenario_count: number;
}

export interface ScenarioComparisonResponse {
  portfolio_value: number;
  scenarios: ScenarioComparisonRow[];
  asset_symbols: string[];
  worst_scenario: ScenarioHeadline | null;
  most_vulnerable_asset: VulnerableAssetSummary | null;
  severe_scenario_count: number;
  most_recurring_downside_contributor: RecurringContributorSummary | null;
  severe_threshold_pct: number;
}

export interface DriverScenarioImpact {
  scenario_id: string;
  title: string;
  impact_pct: number;
}

export interface ModeledRiskDriver {
  driver: string;
  label: string;
  level: ExposureLevel;
  scenario_count: number;
  downside_scenario_count: number;
  worst_impact_pct: number;
  average_downside_pct: number;
  affected_symbols: string[];
  scenarios: DriverScenarioImpact[];
}

export interface RiskDriversResponse {
  drivers: ModeledRiskDriver[];
  methodology: string;
}

export interface RiskAttentionPoint {
  signal_id: string;
  event_title: string;
  scenario_id: string;
  scenario_title: string;
  probability_value: number;
  probability_label: string;
  impact_pct: number;
  absolute_impact_pct: number;
  impact_value: number;
  source_name: string;
  source_url: string | null;
  retrieved_at: string | null;
  source_status: SourceStatus;
  scenario_source_status: SourceStatus;
}

export interface RiskWithoutProbability {
  scenario_id: string;
  title: string;
  impact_pct: number;
  source_status: SourceStatus;
}

export interface RiskAttentionResponse {
  points: RiskAttentionPoint[];
  without_probability: RiskWithoutProbability[];
  methodology: string;
}

export interface MitigationScenarioRow {
  scenario_id: string;
  title: string;
  before_impact_pct: number;
  after_impact_pct: number;
  impact_change_pct_points: number;
  before_impact_value: number;
  after_impact_value: number;
}

export interface ConcentrationSnapshot {
  largest_symbol: string;
  largest_weight: number;
  top_three_weight: number;
}

export interface MitigationCompareResponse {
  scenarios: MitigationScenarioRow[];
  worst_before: ScenarioHeadline | null;
  worst_after: ScenarioHeadline | null;
  biggest_downside_reduction: MitigationScenarioRow | null;
  reduced_downside_count: number;
  increased_downside_count: number;
  unchanged_count: number;
  concentration_before: ConcentrationSnapshot;
  concentration_after: ConcentrationSnapshot;
  summary: string;
}

export interface HoldingAttribution {
  symbol: string;
  weight: number;
  return_pct: number;
  approximate_contribution_pct: number;
  approximate_contribution_value: number;
}

export interface PerformanceAttributionResponse {
  range: PriceRange;
  start_date: string;
  end_date: string;
  holdings: HoldingAttribution[];
  total_return_pct: number;
  source_name: string;
  source_url: string;
  retrieved_at: string;
  methodology: string;
}

export interface EvidenceItem {
  component: string;
  category: EvidenceCategory;
  detail: string;
  source_name: string | null;
  source_url: string | null;
  retrieved_at: string | null;
}

export interface RiskBriefRequest {
  portfolio: Portfolio;
  scenario: Scenario;
  committee?: CommitteeVerdict | null;
  probability_signal?: RiskRadarItem | null;
  use_ai?: boolean;
}

export interface RiskBriefResponse {
  result: StressTestResult;
  generated_by: "deterministic" | "ai";
  model: string | null;
  summary: string;
  primary_driver: string;
  primary_driver_share_of_downside: number | null;
  transmission: string;
  model_agreement: string;
  key_assumption: string;
  signals_to_watch: string[];
  evidence: EvidenceItem[];
}

export interface PortfolioRiskSummary {
  worst_scenario: ScenarioHeadline | null;
  largest_concentration: { symbol: string; weight: number };
  most_vulnerable_holding: VulnerableAssetSummary | null;
  dominant_modeled_driver: ModeledRiskDriver | null;
  high_impact_scenario_count: number;
  high_impact_threshold_pct: number;
  live_event_signal_count: number;
  methodology: string;
}

export interface MitigationCompareRequest {
  original_portfolio: Portfolio;
  hypothetical_portfolio: Portfolio;
  scenario_ids?: string[] | null;
}
