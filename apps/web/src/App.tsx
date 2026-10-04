import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorBanner } from "./components/ErrorBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AssetDrawer } from "./features/asset/AssetDrawer";
import { CommitteePanel } from "./features/committee/CommitteePanel";
import { LoadingLine } from "./components/LoadingLine";
import { type TabDef, Tabs } from "./components/Tabs";
import { PortfolioOverview } from "./features/portfolio/PortfolioOverview";
import { usePortfolio } from "./features/portfolio/usePortfolio";
import { RiskFeed } from "./features/risk-feed/RiskFeed";
import { RiskRadar } from "./features/risk-radar/RiskRadar";
import { RiskBriefPanel } from "./features/risk-brief/RiskBriefPanel";
import { ScenarioComparison } from "./features/scenario-comparison/ScenarioComparison";
import { ScenarioWorkspace } from "./features/scenarios/ScenarioWorkspace";
import { useAiStatus } from "./features/scenarios/useAiStatus";
import { StressTestResult } from "./features/stress-test/StressTestResult";
import { MitigationSandbox } from "./features/mitigation/MitigationSandbox";
import { RiskReport } from "./features/report/RiskReport";
import { ApiError, api } from "./lib/apiClient";
import type {
  CommitteeVerdict,
  Scenario,
  StressTestResult as StressTestResultType,
} from "./types";

type View =
  | "portfolio"
  | "feed"
  | "radar"
  | "scenarios"
  | "stress"
  | "mitigation"
  | "report";

const TABS: TabDef<View>[] = [
  { id: "portfolio", label: "Portfolio" },
  { id: "feed", label: "Risk Feed" },
  { id: "radar", label: "Risk Radar" },
  { id: "scenarios", label: "Scenarios" },
  { id: "stress", label: "Stress Test" },
  { id: "mitigation", label: "Mitigation" },
  { id: "report", label: "Report" },
];

function viewFromHash(): View {
  const hash = window.location.hash.replace("#", "");
  return TABS.some((t) => t.id === hash) ? (hash as View) : "portfolio";
}

export default function App() {
  const {
    portfolios,
    portfolio,
    select: selectPortfolio,
    error: portfolioError,
    loading: portfolioLoading,
  } = usePortfolio();
  const [assetSymbol, setAssetSymbol] = useState<string | null>(null);
  const closeAsset = useCallback(() => setAssetSymbol(null), []);

  const [view, setViewState] = useState<View>(viewFromHash);

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const [result, setResult] = useState<StressTestResultType | null>(null);
  const [committeeVerdict, setCommitteeVerdict] = useState<CommitteeVerdict | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const isLiveAi = useAiStatus();

  const resultRef = useRef<HTMLDivElement>(null);

  const setView = useCallback((next: View) => {
    setViewState(next);
    if (window.location.hash !== `#${next}`) {
      window.history.replaceState(null, "", `#${next}`);
      window.scrollTo({ top: 0 });
    }
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
      setEstimateError(null);
      setResult(null);
      setCommitteeVerdict(null);
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
    setCommitteeVerdict(null);
  }, []);

  const estimateWithAi = useCallback(async () => {
    if (!scenario) return;
    setEstimating(true);
    setEstimateError(null);
    try {
      const response = await api.estimateShocks(scenario);
      if (response.scenario) {
        setScenario(response.scenario);
        setResult(null);
        setCommitteeVerdict(null);
      } else {
        setEstimateError(response.message ?? "The AI couldn't estimate this scenario.");
      }
    } catch {
      setEstimateError("Couldn't reach the AI service. Try again in a moment.");
    } finally {
      setEstimating(false);
    }
  }, [scenario]);

  const draftFromHeadline = useCallback(
    async (headline: string) => {
      setView("stress");
      setScenarioLoading(true);
      setScenarioError(null);
      setResult(null);
      try {
        const res = await api.parseScenario(headline);
        if (res.recognized && res.scenario) setScenario(res.scenario);
        else setScenarioError(res.message ?? "The AI couldn't turn this headline into a scenario.");
      } catch {
        setScenarioError("Couldn't reach the scenario parser.");
      } finally {
        setScenarioLoading(false);
      }
    },
    [setView],
  );

  const applyVerdict = useCallback((verdict: CommitteeVerdict) => {
    setScenario(verdict.scenario);
    setResult(verdict.consensus_result);
    setCommitteeVerdict(verdict);
    setRunError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleShockChange = useCallback((symbol: string, value: number) => {
    setScenario((prev) =>
      prev
        ? {
            ...prev,
            asset_shocks: { ...prev.asset_shocks, [symbol]: value },
            assumption_source: "user_edited",
          }
        : prev,
    );
    setCommitteeVerdict(null);
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
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-8 px-4 pt-4 sm:px-6">
          <div className="pb-3">
            <h1 className="text-base font-semibold tracking-tight text-ink">
              AI Portfolio Risk Copilot
            </h1>
            <p className="text-xs text-ink-tertiary">
              Understand what could hurt your portfolio before it happens.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            {portfolios.length > 1 && portfolio && (
              <label className="flex items-center gap-2 pb-2.5 text-xs text-ink-tertiary">
                <span className="font-mono uppercase tracking-wider">Portfolio</span>
                <select
                  id="portfolio-picker"
                  value={portfolio.id}
                  onChange={(e) => {
                    selectPortfolio(e.target.value);
                    setResult(null);
                    setCommitteeVerdict(null);
                  }}
                  className="border border-line-strong bg-surface-raised px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
                >
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Tabs tabs={TABS} active={view} onChange={setView} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
        {portfolioLoading && <LoadingLine label="Loading portfolio…" />}
        {portfolioError && <ErrorBanner message={portfolioError} />}

        {view === "portfolio" && portfolio && (
          <PortfolioOverview
            key={portfolio.id}
            portfolio={portfolio}
            onOpenScenario={selectScenario}
            onSelectAsset={setAssetSymbol}
          />
        )}

        {view === "feed" && (
          <RiskFeed
            portfolioId={portfolio?.id}
            onStressTest={selectScenario}
            onDraft={isLiveAi ? draftFromHeadline : undefined}
            onAsset={setAssetSymbol}
          />
        )}

        {view === "radar" && <RiskRadar portfolio={portfolio} onStressTest={selectScenario} />}

        {view === "scenarios" && portfolio && (
          <ScenarioComparison portfolio={portfolio} onOpenScenario={selectScenario} />
        )}

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
              ai={
                isLiveAi
                  ? {
                      estimating,
                      error: estimateError,
                      onEstimate: estimateWithAi,
                      // Custom (free-text) scenarios have no library version to restore.
                      onRestore: scenario?.category === "custom"
                        ? undefined
                        : () => scenario && selectScenario(scenario.id),
                    }
                  : undefined
              }
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
            {result && scenario && portfolio && (
              <div className="lg:col-span-2">
                <RiskBriefPanel
                  portfolio={portfolio}
                  scenario={scenario}
                  committee={committeeVerdict}
                />
              </div>
            )}
            {isLiveAi && scenario && portfolio && (
              <div className="lg:col-span-2">
                <CommitteePanel scenario={scenario} portfolio={portfolio} onApply={applyVerdict} />
              </div>
            )}
          </div>
        )}

        {view === "mitigation" && portfolio && <MitigationSandbox portfolio={portfolio} />}

        {view === "report" && portfolio && (
          <RiskReport portfolio={portfolio} selectedScenario={scenario} />
        )}
      </main>

      {assetSymbol && portfolio && (
        <ErrorBoundary resetKey={assetSymbol} fallback={null}>
          <AssetDrawer
            symbol={assetSymbol}
            portfolio={portfolio}
            isLiveAi={isLiveAi}
            onClose={closeAsset}
          />
        </ErrorBoundary>
      )}

      <footer className="border-t border-line print:hidden">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-ink-tertiary sm:px-6">
          Estimates are illustrative scenario assumptions, not forecasts or guaranteed outcomes.
          This tool does not provide investment advice and does not execute trades.
        </div>
      </footer>
    </div>
  );
}
