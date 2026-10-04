import type { Scenario } from "./scenario";

export interface ParseScenarioResponse {
  recognized: boolean;
  scenario: Scenario | null;
  message: string | null;
}

export interface AIStatusResponse {
  provider: "mock" | "bedrock" | "openrouter" | string;
  is_live: boolean;
}

export interface EstimateShocksResponse {
  scenario: Scenario | null;
  message: string | null;
}
