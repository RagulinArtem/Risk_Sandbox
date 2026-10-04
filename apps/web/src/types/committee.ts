import type { Portfolio } from "./portfolio";
import type { Scenario } from "./scenario";
import type { StressTestResult } from "./stressTest";

export type AnalystRole = "macro" | "sector" | "cross_asset";
export type Confidence = "low" | "medium" | "high";

export interface CommitteeMember {
  role: AnalystRole | "chair";
  label: string;
  focus: string;
  model: string;
}

export interface CommitteeRoster {
  analysts: CommitteeMember[];
  chair: CommitteeMember;
}

export interface AnalystRequest {
  scenario: Scenario;
  portfolio: Portfolio;
  role: AnalystRole;
}

export interface AnalystView {
  role: AnalystRole;
  label: string;
  model: string;
  thesis: string;
  key_risk: string;
  confidence: Confidence;
  asset_shocks: Record<string, number>;
  rationale: Record<string, string>;
  latency_ms: number;
}

export interface VerdictRequest {
  scenario: Scenario;
  portfolio: Portfolio;
  views: AnalystView[];
}

export interface ViewImpact {
  label: string;
  model: string;
  estimated_impact_pct: number;
  estimated_impact_value: number;
}

export interface CommitteeVerdict {
  scenario: Scenario;
  chair_model: string;
  verdict: string;
  insights: string[];
  disagreements: string[];
  watch: string[];
  confidence: Confidence;
  shock_ranges: Record<string, { min: number; max: number }>;
  view_impacts: ViewImpact[];
  consensus_result: StressTestResult;
  latency_ms: number;
}
