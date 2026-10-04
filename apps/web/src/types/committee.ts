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

export interface AnalogueRef {
  id: string;
  title: string;
  why: string;
  difference: string;
}

/** A verified historical episode the chair picked; impact is the engine's replay. */
export interface HistoricalComparison {
  id: string;
  title: string;
  window: string;
  impact_pct: number;
  impact_value: number;
  why: string;
  difference: string;
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
  analogues: AnalogueRef[];
  latency_ms: number;
}

export interface AnalogueRef {
  id: string;
  title: string;
  why: string;
  difference: string;
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

export interface HistoricalComparison {
  id: string;
  title: string;
  window: string;
  impact_pct: number;
  impact_value: number;
  why: string;
  difference: string;
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
  historical: HistoricalComparison[];
  view_impacts: ViewImpact[];
  consensus_result: StressTestResult;
  latency_ms: number;
}
