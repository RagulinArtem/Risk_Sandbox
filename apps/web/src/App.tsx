import { useCallback, useRef, useState } from "react";
import { ErrorBanner } from "./components/ErrorBanner";
import { LoadingLine } from "./components/LoadingLine";
import { Section } from "./components/Section";
import { PortfolioSummary } from "./features/portfolio/PortfolioSummary";
import { usePortfolio } from "./features/portfolio/usePortfolio";
import { RiskRadar } from "./features/risk-radar/RiskRadar";
import { ScenarioWorkspace } from "./features/scenarios/ScenarioWorkspace";
import { StressTestResult } from "./features/stress-test/StressTestResult";
import { ApiError, api } from "./lib/apiClient";
import type { Scenario, StressTestResult as StressTestResultType } from "./types";

export default function App() {
  const { portfolio, error: portfolioError, loading: portfolioLoading } = usePortfolio();

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const [result, setResult] = useState<StressTestResultType | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const selectScenario = useCallback(async (scenarioId: string) => {
    setScenarioLoading(true);
    setScenarioError(null);
    setResult(null);
    try {
      const data = await api.getScenario(scenarioId);
      setScenario(data);
      requestAnimationFrame(() => {
        workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      setScenarioError(err instanceof ApiError ? err.message : "Failed to load scenario.");
    } finally {
      setScenarioLoading(false);
    }
  }, []);

  const handleParsed = useCallback((parsed: Scenario) => {
    setScenario(parsed);
    setScenarioError(null);
    setResult(null);
    requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleShockChange = useCallback((symbol: string, value: number) => {
    setScenario((prev) =>
      prev ? { ...prev, asset_shocks: { ...prev.asset_shocks, [symbol]: value } } : prev,
    );
  }, []);

  const runStressTest = useCallback(async () => {
    if (!scenario || !portfolio) return;
    setRunning(true);
    setRunError(null);
    try {
      // Always send the current (possibly hand-edited, or AI-parsed) shocks
      // rather than scenario_id — the workspace is the source of truth for
      // what's about to be tested, not the library the scenario came from.
      const data = await api.runStressTest({
        portfolio,
        custom_shocks: scenario.asset_shocks,
      });
      setResult(data);
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : "Failed to run stress test.");
    } finally {
      setRunning(false);
    }
  }, [scenario, portfolio]);

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-ink">
                AI Portfolio Risk Copilot
              </h1>
              <p className="mt-0.5 text-sm text-ink-secondary">
                Understand what could hurt your portfolio before it happens.
              </p>
            </div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
              iFX Hack Hong Kong 2026
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-6 py-8">
        {portfolioLoading && <LoadingLine label="Loading portfolio…" />}
        {portfolioError && <ErrorBanner message={portfolioError} />}
        {portfolio && <PortfolioSummary portfolio={portfolio} />}

        <RiskRadar onStressTest={selectScenario} />

        <div ref={workspaceRef}>
          <ScenarioWorkspace
            scenario={scenario}
            loading={scenarioLoading}
            error={scenarioError}
            running={running}
            onParsed={handleParsed}
            onShockChange={handleShockChange}
            onRun={runStressTest}
          />
        </div>

        {runError && <ErrorBanner message={runError} />}

        {result && (
          <div ref={resultRef}>
            <Section eyebrow="Impact Decomposition" title="Stress Test Result">
              <StressTestResult result={result} scenarioTitle={scenario?.title} />
            </Section>
          </div>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-6 py-5 text-xs text-ink-tertiary">
          Estimates are illustrative scenario assumptions, not forecasts or guaranteed outcomes.
          This tool does not provide investment advice and does not execute trades.
        </div>
      </footer>
    </div>
  );
}
