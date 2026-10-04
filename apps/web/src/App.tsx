import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorBanner } from "./components/ErrorBanner";
import { LoadingLine } from "./components/LoadingLine";
import { type TabDef, Tabs } from "./components/Tabs";
import { PortfolioOverview } from "./features/portfolio/PortfolioOverview";
import { usePortfolio } from "./features/portfolio/usePortfolio";
import { RiskRadar } from "./features/risk-radar/RiskRadar";
import { ScenarioWorkspace } from "./features/scenarios/ScenarioWorkspace";
import { StressTestResult } from "./features/stress-test/StressTestResult";
import { ApiError, api } from "./lib/apiClient";
import type { Scenario, StressTestResult as StressTestResultType } from "./types";

type View = "portfolio" | "radar" | "stress";

const TABS: TabDef<View>[] = [
  { id: "portfolio", label: "Portfolio" },
  { id: "radar", label: "Risk Radar" },
  { id: "stress", label: "Stress Test" },
];

function viewFromHash(): View {
  const hash = window.location.hash.replace("#", "");
  return TABS.some((t) => t.id === hash) ? (hash as View) : "portfolio";
}

export default function App() {
  const { portfolio, error: portfolioError, loading: portfolioLoading } = usePortfolio();

  const [view, setViewState] = useState<View>(viewFromHash);

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const [result, setResult] = useState<StressTestResultType | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);

  const setView = useCallback((next: View) => {
    setViewState(next);
    if (window.location.hash !== `#${next}`) {
      window.history.replaceState(null, "", `#${next}`);
    }
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onHashChange = () => setViewState(viewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const selectScenario = useCallback(
    async (scenarioId: string) => {
      setView("stress");
      setScenarioLoading(true);
      setScenarioError(null);
      setResult(null);
      try {
        setScenario(await api.getScenario(scenarioId));
      } catch (err) {
        setScenarioError(err instanceof ApiError ? err.message : "Failed to load scenario.");
      } finally {
        setScenarioLoading(false);
      }
    },
    [setView],
  );

  const handleParsed = useCallback((parsed: Scenario) => {
    setScenario(parsed);
    setScenarioError(null);
    setResult(null);
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
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : "Failed to run stress test.");
    } finally {
      setRunning(false);
    }
  }, [scenario, portfolio]);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-8 px-4 pt-4 sm:px-6">
          <div className="pb-3">
            <h1 className="text-base font-semibold tracking-tight text-ink">
              AI Portfolio Risk Copilot
            </h1>
            <p className="text-xs text-ink-tertiary">
              Understand what could hurt your portfolio before it happens.
            </p>
          </div>
          <Tabs tabs={TABS} active={view} onChange={setView} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {portfolioLoading && <LoadingLine label="Loading portfolio…" />}
        {portfolioError && <ErrorBanner message={portfolioError} />}

        {view === "portfolio" && portfolio && (
          <PortfolioOverview portfolio={portfolio} onOpenScenario={selectScenario} />
        )}

        {view === "radar" && <RiskRadar onStressTest={selectScenario} />}

        {view === "stress" && (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ScenarioWorkspace
              scenario={scenario}
              loading={scenarioLoading}
              error={scenarioError}
              running={running}
              onSelect={selectScenario}
              onParsed={handleParsed}
              onShockChange={handleShockChange}
              onRun={runStressTest}
            />
            <div ref={resultRef} className="min-w-0">
              {runError && <ErrorBanner message={runError} />}
              {result ? (
                <StressTestResult result={result} scenarioTitle={scenario?.title} />
              ) : (
                <div className="border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink-tertiary">
                  {scenario
                    ? "Adjust the assumptions if you like, then run the stress test."
                    : "Pick a scenario or describe one to see its impact on your portfolio here."}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-ink-tertiary sm:px-6">
          Estimates are illustrative scenario assumptions, not forecasts or guaranteed outcomes.
          This tool does not provide investment advice and does not execute trades.
        </div>
      </footer>
    </div>
  );
}
