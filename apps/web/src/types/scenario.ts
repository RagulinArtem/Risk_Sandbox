export type SourceStatus = "illustrative" | "verified" | "live";
export type RiskDriverDirection = "negative" | "positive" | "mixed";
export type RiskDriverImportance = "low" | "medium" | "high";
export type AssumptionSource = "scenario" | "historical" | "ai_estimate" | "user_edited";

export interface RiskDriverRef {
  driver: string;
  label: string;
  direction: RiskDriverDirection;
  importance: RiskDriverImportance;
}

export interface Scenario {
  id: string;
  title: string;
  category: string;
  description: string;
  source_status: SourceStatus;
  source_name: string | null;
  source_url: string | null;
  source_date: string | null;
  horizon: string;
  transmission: string[];
  asset_shocks: Record<string, number>;
  /** Per-symbol one-line reasoning, present when an LLM proposed the shocks. */
  shock_rationale?: Record<string, string>;
  /** Historical windows: assets with no market price then (e.g. BTC in 2008). */
  unavailable_assets?: string[];
  references?: { title: string; url: string }[];
  window?: { start: string; end: string } | null;
  risk_drivers: RiskDriverRef[];
  assumption_source: AssumptionSource;
}
