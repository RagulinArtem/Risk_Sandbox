import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell, type AppView } from "./components/AppShell";
import { ErrorBanner } from "./components/ErrorBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AssetDrawer } from "./features/asset/AssetDrawer";
import { LoadingLine } from "./components/LoadingLine";
import { RiskDashboard } from "./features/dashboard/RiskDashboard";
import { PortfolioOverview } from "./features/portfolio/PortfolioOverview";
import { usePortfolio } from "./features/portfolio/usePortfolio";
import { RiskFeed } from "./features/risk-feed/RiskFeed";
import { RiskRadar } from "./features/risk-radar/RiskRadar";
import { RiskBriefPanel } from "./features/risk-brief/RiskBriefPanel";
import { ScenarioComparison } from "./features/scenario-comparison/ScenarioComparison";
import { ScenarioWorkspace } from "./features/scenarios/ScenarioWorkspace";
import { SettingsPanel } from "./features/settings/SettingsPanel";
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

type View = AppView;
type RisksView = "feed" | "library" | "radar";

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
  return ["home", "portfolio", "risks", "stress", "settings", "report"].includes(hash)
    ? (hash as View)
    : "home";
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

  const handleQuickWhatIf = useCallback(
    (quickResult: StressTestResultType, rates: number, marketFall: number) => {
      const assetShocks = Object.fromEntries(
        quickResult.asset_impacts.map((impact) => [impact.symbol, impact.shock_pct]),
      );
      setMarket(null);
      setScenario({
        id: "custom-quick-what-if",
        title: "Rates up + markets down",
        category: "custom",
        description: `Illustrative combination: interest rates rise ${rates.toFixed(2)} percentage points and stock markets fall ${marketFall}%.`,
        source_status: "illustrative",
        source_name: "Interactive What If",
        source_url: null,
        source_date: null,
        horizon: "30d",
        transmission: [
          `Interest rates rise ${rates.toFixed(2)} percentage points`,
          `Stock markets fall ${marketFall}%`,
          "Factor sensitivities translate those assumptions into asset-level shocks",
          "The deterministic engine applies the asset shocks to current portfolio weights",
        ],
        asset_shocks: assetShocks,
        risk_drivers: [],
        assumption_source: "user_edited",
      });
      setResult(quickResult);
      setCommitteeVerdict(null);
      setRunError(null);
      setView("stress");
    },
    [setView],
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

  const runStressTest = useCallback(async () => {
    if (!scenario || !activePortfolio) return;
    if (weightSumMessage) {
      setRunError(weightSumMessage);
      return;
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
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : "Failed to run stress test.");
    } finally {
      setRunning(false);
    }
  }, [scenario, activePortfolio, weightSumMessage]);

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
    <>
      <AppShell
        activeView={view}
        onNavigate={setView}
        portfolios={portfolios}
        portfolioId={portfolio?.id}
        onPortfolioChange={(id) => {
          selectPortfolio(id);
          setEditedPortfolio(null);
          setResult(null);
          setCommitteeVerdict(null);
        }}
      >
        {portfolioLoading && <LoadingLine label="Loading portfolio…" />}
        {portfolioError && <ErrorBanner message={portfolioError} />}

        {view === "home" && activePortfolio && (
          <RiskDashboard
            portfolio={activePortfolio}
            onOpenScenario={selectScenario}
            onOpenRisks={() => {
              setRisksView("feed");
              setView("risks");
            }}
            onOpenPortfolio={() => setView("portfolio")}
            onOpenStress={() => setView("stress")}
            onUseWhatIf={handleQuickWhatIf}
          />
        )}

        {view === "portfolio" && activePortfolio && (
          <PortfolioOverview
            key={portfolio?.id}
            portfolio={activePortfolio}
            showHero={false}
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
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-line bg-surface-raised p-2 shadow-sm">
              <div role="tablist" aria-label="Risk views" className="flex flex-wrap gap-1">
                {RISKS_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={risksView === t.id}
                    onClick={() => setRisksView(t.id)}
                    className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                      risksView === t.id
                        ? "bg-ink text-white shadow-sm"
                        : "text-ink-tertiary hover:bg-surface hover:text-ink-secondary"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="px-3 text-xs text-ink-tertiary">
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
              <details className="group border border-line bg-surface-raised lg:col-span-2 shadow-card">
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

        {view === "settings" && <SettingsPanel />}
      </AppShell>

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
    </>
  );
}
