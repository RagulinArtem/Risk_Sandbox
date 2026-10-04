import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import type { Scenario } from "../../types";
import { CustomScenarioInput } from "./CustomScenarioInput";
import { type AiEstimateControls, ScenarioEditor } from "./ScenarioEditor";
import { ScenarioPicker } from "./ScenarioPicker";

export function ScenarioWorkspace({
  scenario,
  loading,
  error,
  running,
  onSelect,
  onParsed,
  onShockChange,
  onRun,
  holdingCount,
  ai,
}: {
  scenario: Scenario | null;
  loading: boolean;
  error: string | null;
  running: boolean;
  onSelect: (scenarioId: string) => void;
  onParsed: (scenario: Scenario) => void;
  onShockChange: (symbol: string, value: number) => void;
  onRun: () => void;
  holdingCount: number;
  ai?: AiEstimateControls;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-5 border border-line bg-surface-raised/40 p-5">
        <ScenarioPicker selectedId={scenario?.id ?? null} onSelect={onSelect} />
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider text-ink-tertiary">
          <span className="h-px flex-1 bg-line" />
          or describe one
          <span className="h-px flex-1 bg-line" />
        </div>
        <CustomScenarioInput onParsed={onParsed} holdingCount={holdingCount} />
      </div>
      {loading && <LoadingLine label="Loading scenario…" />}
      {error && <ErrorBanner message={error} />}
      {!loading && !error && scenario && (
        <ScenarioEditor
          scenario={scenario}
          onShockChange={onShockChange}
          onRun={onRun}
          running={running}
          ai={ai}
        />
      )}
    </div>
  );
}
