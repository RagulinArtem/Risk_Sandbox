import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { Section } from "../../components/Section";
import type { Scenario } from "../../types";
import { CustomScenarioInput } from "./CustomScenarioInput";
import { ScenarioEditor } from "./ScenarioEditor";

export function ScenarioWorkspace({
  scenario,
  loading,
  error,
  running,
  onParsed,
  onShockChange,
  onRun,
}: {
  scenario: Scenario | null;
  loading: boolean;
  error: string | null;
  running: boolean;
  onParsed: (scenario: Scenario) => void;
  onShockChange: (symbol: string, value: number) => void;
  onRun: () => void;
}) {
  return (
    <Section eyebrow="Scenario Builder" title="Scenario Workspace">
      <div className="mb-6">
        <CustomScenarioInput onParsed={onParsed} />
      </div>
      {loading && <LoadingLine label="Loading scenario…" />}
      {error && <ErrorBanner message={error} />}
      {!loading && !error && scenario && (
        <ScenarioEditor
          scenario={scenario}
          onShockChange={onShockChange}
          onRun={onRun}
          running={running}
        />
      )}
      {!loading && !error && !scenario && (
        <p className="text-sm text-ink-tertiary">
          Select a risk from the Risk Radar above, or describe one with "What if…?" to get
          started.
        </p>
      )}
    </Section>
  );
}
