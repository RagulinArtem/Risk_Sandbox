import type { SourceStatus } from "./scenario";

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

export interface AnalystView {
  seat: string;
  label: string;
  model: string;
  asset_shocks: Record<string, number>;
  rationale: Record<string, string>;
  thesis: string;
  key_risk: string;
  confidence: "low" | "medium" | "high";
  source_status: SourceStatus;
}

export interface ViewImpact {
  seat: string;
  label: string;
  model: string;
  impact_pct: number;
  impact_value: number;
  stressed_value: number;
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
  shock_ranges: Record<string, { min: number; max: number }>;
  source_status: SourceStatus;
}

export interface CommitteeContextRequest {
  scenario_title: string;
  scenario_description: string;
  horizon: string;
  transmission: string[];
  portfolio: import("./portfolio").Portfolio;
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
}

export interface VerdictResponse {
  verdict: CommitteeVerdict | null;
  message: string | null;
}
