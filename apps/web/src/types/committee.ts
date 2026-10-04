import type { MarketContextSignal } from "./market";
import type { SourceStatus } from "./scenario";

export type Confidence = "low" | "medium" | "high";

export interface CommitteeSeatInfo {
  seat: string;
  label: string;
  lens: string;
  model: string;
}

export interface CommitteeRoster {
  enabled: boolean;
  provider: string;
  seats: CommitteeSeatInfo[];
  chair: CommitteeSeatInfo;
  note: string | null;
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
  seat: string;
  label: string;
  model: string;
  asset_shocks: Record<string, number>;
  rationale: Record<string, string>;
  thesis: string;
  key_risk: string;
  confidence: Confidence;
  analogues: AnalogueRef[];
  source_status: SourceStatus;
  market_context: MarketContextSignal | null;
}

export interface ViewImpact {
  seat: string;
  label: string;
  model: string;
  impact_pct: number;
  impact_value: number;
  stressed_value: number;
}

export interface RevisionView {
  seat: string;
  label: string;
  model: string;
  asset_shocks: Record<string, number>;
  rationale: Record<string, string>;
  change: string;
  confidence: Confidence;
  revised: boolean;
}

export interface CommitteeVerdict {
  consensus: Record<string, number>;
  consensus_rationale: Record<string, string>;
  verdict: string;
  insights: string[];
  disagreements: string[];
  watch: string[];
  confidence: string;
  consensus_impact: ViewImpact;
  view_impacts: ViewImpact[];
  revisions: RevisionView[];
  revision_impacts: ViewImpact[];
  shock_ranges: Record<string, { min: number; max: number }>;
  historical: HistoricalComparison[];
  source_status: SourceStatus;
  market_context: MarketContextSignal | null;
}

export interface CommitteeContextRequest {
  scenario_title: string;
  scenario_description: string;
  horizon: string;
  transmission: string[];
  portfolio: import("./portfolio").Portfolio;
  market_id?: string | null;
}

export interface AnalystRequest extends CommitteeContextRequest {
  seat: string;
}

export interface AnalystResponse {
  view: AnalystView | null;
  message: string | null;
}

export interface VerdictRequest extends CommitteeContextRequest {
  views: AnalystView[];
  debate?: boolean;
}

export interface VerdictResponse {
  verdict: CommitteeVerdict | null;
  message: string | null;
}
