import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorBanner } from "./components/ErrorBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AssetDrawer } from "./features/asset/AssetDrawer";
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
import { CommitteePanel } from "./features/stress-test/CommitteePanel";
import { MarketStressPanel } from "./features/stress-test/MarketStressPanel";
import { StressTestResult } from "./features/stress-test/StressTestResult";
import { MitigationSandbox } from "./features/mitigation/MitigationSandbox";
import { RiskReport } from "./features/report/RiskReport";
import { ApiError, api } from "./lib/apiClient";
import type {
  CommitteeVerdict,
  MarketSummary,
  Portfolio,
  Scenario,
  StressTestResult as StressTestResultType,
} from "./types";

// Three steps a first-time viewer can follow, plus a printable report.
type View = "portfolio" | "risks" | "stress" | "report";
type RisksView = "feed" | "library" | "radar";

const TABS: TabDef<View>[] = [
  { id: "portfolio", label: "① Overview" },
  { id: "risks", label: "② What could hurt it" },
  { id: "stress", label: "③ Stress test" },
];

const RISKS_TABS: { id: RisksView; label: string; hint: string }[] = [
  { id: "feed", label: "Live signals", hint: "official sources, filings, news, prediction markets" },
  { id: "library", label: "Scenario library", hint: "real past crises and hypothetical shocks, ranked" },
  { id: "radar", label: "Risk radar", hint: "likelihood vs impact" },
];

// Old deep links (#feed, #radar, #scenarios, #mitigation) still land somewhere sensible.
const LEGACY: Record<string, [View, RisksView?]> = {
  feed: ["risks", "feed"],
  radar: ["risks", "radar"],
  scenarios: ["risks", "library"],
  mitigation: ["stress"],
};

function viewFromHash(): View {
  const hash = window.location.hash.replace("#", "");
  if (hash in LEGACY) return LEGACY[hash][0];
  return ["portfolio", "risks", "stress", "report"].includes(hash) ? (hash as View) : "portfolio";
}

function risksViewFromHash(): RisksView {
  return LEGACY[window.location.hash.replace("#", "")]?.[1] ?? "feed";
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

  // FR3: the demo portfolio's weights are editable. `editedPortfolio` is
  // null until the user changes something, so "Reset demo portfolio" just
  // clears it. Every stress run uses the edited version.
  const [editedPortfolio, setEditedPortfolio] = useState<Portfolio | null>(null);
  const activePortfolio = editedPortfolio ?? portfolio;

  const [view, setViewState] = useState<View>(viewFromHash);
  const [risksView, setRisksView] = useState<RisksView>(risksViewFromHash);

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  // A tracked market selected from the Risk Radar opens the Stress Test tab
  // in "market mode": probability path + mapped factor scenario.
  const [market, setMarket] = useState<MarketSummary | null>(null);

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
      setMarket(null);
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

  const openMarket = useCallback(
    (selected: MarketSummary) => {
      setMarket(selected);
      setView("stress");
      setResult(null);
      setRunError(null);
      setScenario(null);
      setCommitteeVerdict(null);
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
      setCommitteeVerdict(null);
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

  const handleCommitteeVerdict = useCallback((verdict: CommitteeVerdict) => {
    setCommitteeVerdict(verdict);
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

  const handleWeightChange = useCallback(
    (symbol: string, weight: number) => {
      setEditedPortfolio((prev) => {
        const base = prev ?? portfolio;
        if (!base) return prev;
        return {
          ...base,
          positions: base.positions.map((p) =>
            p.symbol === symbol ? { ...p, weight } : p,
          ),
        };
      });
    },
    [portfolio],
  );

  const handleResetPortfolio = useCallback(() => setEditedPortfolio(null), []);

  const handleUseConsensus = useCallback(
    (shocks: Record<string, number>, rationale: Record<string, string>) => {
      setMarket(null);
      setScenario((prev) =>
        prev
          ? {
              ...prev,
              asset_shocks: shocks,
              shock_rationale: rationale,
              assumption_source: "ai_estimate",
            }
          : prev,
      );
      setResult(null);
    },
    [],
  );

  const portfolioWeightsValid = useMemo(() => {
    if (!activePortfolio) return false;
    const total = activePortfolio.positions.reduce((sum, p) => sum + p.weight, 0);
    return Math.abs(total - 1) <= 0.01; // mirrors Portfolio._weights_sum_to_one
  }, [activePortfolio]);

  const weightSumMessage = useMemo(() => {
    if (!activePortfolio || portfolioWeightsValid) return null;
    const total = activePortfolio.positions.reduce((sum, p) => sum + p.weight, 0);
    return `Portfolio weights must sum to 100% (currently ${(total * 100).toFixed(1)}%). Adjust them in the Portfolio tab or reset to the demo portfolio.`;
  }, [activePortfolio, portfolioWeightsValid]);

  const runStressTest = useCallback(async (): Promise<boolean> => {
    if (!scenario || !activePortfolio) return false;
    if (weightSumMessage) {
      setRunError(weightSumMessage);
      return false;
    }
    setRunning(true);
    setRunError(null);
    try {
      // Always send the current (possibly hand-edited, or AI-parsed) shocks
      // rather than scenario_id — the workspace is the source of truth for
      // what's about to be tested, not the library the scenario came from.
      const data = await api.runStressTest({
        portfolio: activePortfolio,
        custom_shocks: scenario.asset_shocks,
      });
      setResult(data);
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      return true;
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : "Failed to run stress test.");
      return false;
    } finally {
      setRunning(false);
    }
  }, [scenario, activePortfolio, weightSumMessage]);

  // The one button: impact first (instant, deterministic), then the AI
  // committee explains it. Progress is shown step by step in the panel.
  const [committeeToken, setCommitteeToken] = useState(0);
  const [engineState, setEngineState] = useState<"idle" | "running" | "done" | "error">("idle");
  useEffect(() => {
    setEngineState("idle");
  }, [scenario?.id, scenario?.title]);

  const analyze = useCallback(async () => {
    setEngineState("running");
    const ok = await runStressTest();
    setEngineState(ok ? "done" : "error");
    if (ok && isLiveAi) setCommitteeToken((t) => t + 1);
  }, [runStressTest, isLiveAi]);

  const runMarketStress = useCallback(
    async (
      factorShocks: Record<string, number>,
      probability: number | null,
      title: string,
    ) => {
      if (!activePortfolio) return;
      if (weightSumMessage) {
        setRunError(weightSumMessage);
        return;
      }
      setRunning(true);
      setRunError(null);
      try {
        const data = await api.runStressTest({
          portfolio: activePortfolio,
          factor_shocks: factorShocks,
          probability,
          scenario_title: title,
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
    },
    [activePortfolio, weightSumMessage],
  );

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
            <button
              type="button"
              onClick={() => setView("report")}
              className={`mb-2 border px-3 py-1.5 text-xs font-medium ${
                view === "report"
                  ? "border-accent text-accent-strong"
                  : "border-line-strong text-ink-secondary hover:border-accent hover:text-ink"
              }`}
            >
              Report
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
        {portfolioLoading && <LoadingLine label="Loading portfolio…" />}
        {portfolioError && <ErrorBanner message={portfolioError} />}

        {view === "portfolio" && activePortfolio && (
          <PortfolioOverview
            key={portfolio?.id}
            portfolio={activePortfolio}
            onOpenScenario={selectScenario}
            onSelectAsset={setAssetSymbol}
            onSeeRisks={() => {
              setRisksView("feed");
              setView("risks");
            }}
            onWeightChange={handleWeightChange}
            onResetPortfolio={handleResetPortfolio}
          />
        )}

        {view === "risks" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line">
              <div role="tablist" aria-label="Risk views" className="-mb-px flex flex-wrap gap-1">
                {RISKS_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={risksView === t.id}
                    onClick={() => setRisksView(t.id)}
                    className={`border-b-2 px-3 py-2 text-sm font-medium ${
                      risksView === t.id
                        ? "border-accent text-ink"
                        : "border-transparent text-ink-tertiary hover:text-ink-secondary"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="pb-2 text-xs text-ink-tertiary">
                {RISKS_TABS.find((t) => t.id === risksView)?.hint}
              </p>
            </div>

            {risksView === "feed" && (
              <RiskFeed
                portfolioId={portfolio?.id}
                onStressTest={selectScenario}
                onDraft={isLiveAi ? draftFromHeadline : undefined}
                onAsset={setAssetSymbol}
              />
            )}
            {risksView === "library" && portfolio && (
              <ScenarioComparison portfolio={portfolio} onOpenScenario={selectScenario} />
            )}
            {risksView === "radar" && (
              <RiskRadar
                portfolio={activePortfolio}
                onStressTest={selectScenario}
                onOpenMarket={openMarket}
              />
            )}
          </div>
        )}

        {view === "stress" && (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {market ? (
              <MarketStressPanel
                market={market}
                running={running}
                onRun={runMarketStress}
                onClear={() => setMarket(null)}
              />
            ) : (
              <ScenarioWorkspace
                scenario={scenario}
                loading={scenarioLoading}
                error={scenarioError}
                running={running}
                onSelect={selectScenario}
                onParsed={handleParsed}
                onShockChange={handleShockChange}
                onRun={analyze}
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
            )}
            <div ref={resultRef} className="min-w-0">
              {runError && <ErrorBanner message={runError} />}
              {result ? (
                <StressTestResult
                  result={result}
                  scenarioTitle={market?.scenario?.name ?? scenario?.title}
                />
              ) : (
                <div className="border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink-tertiary">
                  {market
                    ? "Run the stress test to see this market's mapped scenario applied to your portfolio."
                    : scenario
                      ? "Adjust the assumptions if you like, then run the stress test."
                      : "Pick a scenario or describe one to see its impact on your portfolio here."}
                </div>
              )}
              {!market && (
                <CommitteePanel
                  scenario={scenario}
                  portfolio={activePortfolio}
                  onUseConsensus={handleUseConsensus}
                  onVerdict={handleCommitteeVerdict}
                  autoRunToken={committeeToken}
                  engine={engineState}
                />
              )}
            </div>
            {result && scenario && activePortfolio && (
              <div className="lg:col-span-2">
                <RiskBriefPanel
                  portfolio={activePortfolio}
                  scenario={scenario}
                  committee={committeeVerdict}
                />
              </div>
            )}
            {activePortfolio && (
              <details className="group border border-line bg-surface-raised/20 lg:col-span-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm hover:text-ink">
                  <span>
                    <span className="font-medium text-ink">What if I change the allocation?</span>
                    <span className="ml-2 text-ink-tertiary">
                      compare a hypothetical allocation across every scenario
                    </span>
                  </span>
                  <span className="font-mono text-ink-tertiary transition-transform group-open:rotate-90">›</span>
                </summary>
                <div className="border-t border-line p-5">
                  <MitigationSandbox portfolio={activePortfolio} />
                </div>
              </details>
            )}
          </div>
        )}

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
