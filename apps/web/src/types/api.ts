import type { Scenario } from "./scenario";
import type { StressTestResult } from "./stressTest";

export interface ParseScenarioResponse {
  recognized: boolean;
  scenario: Scenario | null;
  message: string | null;
}

export interface AIStatusResponse {
  provider: "mock" | "bedrock" | "openrouter" | string;
  is_live: boolean;
}

export interface ExplainRequest {
  result: StressTestResult;
}

export interface ExplainResponse {
  text: string;
  ai_status: "llm" | "template";
}
