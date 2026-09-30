import type { Scenario } from "./scenario";

export interface ParseScenarioResponse {
  recognized: boolean;
  scenario: Scenario | null;
  message: string | null;
}
