import { useEffect, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { StatusBadge } from "../../components/StatusBadge";
import { ApiError, api } from "../../lib/apiClient";
import { formatCurrency, formatPercent, formatSignedPercent } from "../../lib/format";
import type {
  Portfolio,
  PortfolioRiskSummary,
  RiskBriefResponse,
  RiskDriversResponse,
  Scenario,
  ScenarioComparisonResponse,
} from "../../types";

interface ReportData {
  comparison: ScenarioComparisonResponse;
  drivers: RiskDriversResponse;
  summary: PortfolioRiskSummary;
  scenario: Scenario | null;
  brief: RiskBriefResponse | null;
}

export function RiskReport({
  portfolio,
  selectedScenario,
}: {
  portfolio: Portfolio;
  selectedScenario: Scenario | null;
}) {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    Promise.all([
      api.compareScenarios({ portfolio }),
      api.getRiskDrivers(portfolio),
      api.getRiskSummary(portfolio),
    ])
      .then(async ([comparison, drivers, summary]) => {
        const scenario =
          selectedScenario ??
          (comparison.worst_scenario
            ? await api.getScenario(comparison.worst_scenario.scenario_id)
            : null);
        const brief = scenario
          ? await api.getRiskBrief({ portfolio, scenario, use_ai: false })
          : null;
        if (!cancelled) setData({ comparison, drivers, summary, scenario, brief });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.detail : "Risk report could not be assembled.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [portfolio, selectedScenario]);

  return (
    <div className="print-report mx-auto max-w-5xl space-y-8 bg-surface print:max-w-none print:space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-5 print:pb-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tertiary">
            Shock Lens
          </div>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Portfolio Risk Brief</h2>
          <p className="mt-1 text-sm text-ink-secondary">{portfolio.name}</p>
        </div>
        <div className="text-right">
          <button
            type="button"
            onClick={() => window.print()}
            className="border border-accent px-4 py-2 text-sm text-accent-strong hover:bg-accent/10 print:hidden"
          >
            Print / Save as PDF
          </button>
          <div className="mt-2 font-mono text-[11px] text-ink-tertiary print:mt-0">
            Generated {new Date().toLocaleString()}
          </div>
        </div>
      </header>

      {error && <ErrorBanner message={error} />}
      {!data && !error && <LoadingLine label="Assembling risk report…" />}
      {data && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
            {[
              ["Portfolio value", formatCurrency(portfolio.total_value, portfolio.currency)],
              [
                "Largest holding",
                `${data.summary.largest_concentration.symbol} ${formatPercent(
                  data.summary.largest_concentration.weight,
                  0,
                )}`,
              ],
              [
                "Worst modeled scenario",
                data.summary.worst_scenario
                  ? formatSignedPercent(data.summary.worst_scenario.impact_pct)
                  : "—",
              ],
              ["High-impact scenarios", String(data.summary.high_impact_scenario_count)],
            ].map(([label, value]) => (
              <div key={label} className="border-l border-line-strong pl-3">
                <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                  {label}
                </div>
                <div className="mt-1 font-mono text-lg text-ink">{value}</div>
              </div>
            ))}
          </section>

          <section className="break-inside-avoid border-t border-line pt-5">
            <h3 className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
              Top modeled risks
            </h3>
            <ol className="mt-3 grid gap-3 sm:grid-cols-2 print:grid-cols-2">
              {data.comparison.scenarios.slice(0, 6).map((row, index) => (
                <li key={row.scenario_id} className="flex items-start gap-3 border border-line p-3">
                  <span className="font-mono text-ink-tertiary">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{row.title}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <StatusBadge status={row.source_status} />
                      <span className="font-mono text-sm text-risk-negative-strong">
                        {formatSignedPercent(row.impact_pct)}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="break-inside-avoid border-t border-line pt-5">
            <h3 className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
              Scenario comparison
            </h3>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                  <th className="py-2 text-left">Scenario</th>
                  <th className="py-2 text-right">Impact</th>
                  <th className="py-2 text-right">Largest driver</th>
                </tr>
              </thead>
              <tbody>
                {data.comparison.scenarios.slice(0, 10).map((row) => (
                  <tr key={row.scenario_id} className="border-b border-line">
                    <td className="py-2 text-ink">{row.title}</td>
                    <td className="py-2 text-right font-mono text-risk-negative-strong">
                      {formatSignedPercent(row.impact_pct)}
                    </td>
                    <td className="py-2 text-right font-mono text-ink-secondary">
                      {row.largest_negative_contributor?.symbol ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="break-inside-avoid border-t border-line pt-5">
            <h3 className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
              Main modeled risk drivers
            </h3>
            <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 print:grid-cols-2">
              {data.drivers.drivers.slice(0, 6).map((driver) => (
                <div key={driver.driver} className="flex justify-between gap-4 border-b border-line pb-2">
                  <div>
                    <div className="text-sm text-ink">{driver.label}</div>
                    <div className="text-xs text-ink-tertiary">
                      {driver.affected_symbols.join(" / ")}
                    </div>
                  </div>
                  <div className="text-right font-mono text-sm text-risk-negative-strong">
                    {formatSignedPercent(driver.worst_impact_pct)}
                    <div className="text-[11px] uppercase text-ink-tertiary">
                      {driver.level.replace("_", " ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {data.scenario && data.brief && (
            <section className="break-inside-avoid border-t border-line pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-ink">{data.scenario.title}</h3>
                <StatusBadge status={data.scenario.source_status} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                {data.brief.summary}
              </p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
                <div>
                  <dt className="font-mono text-[11px] uppercase text-ink-tertiary">
                    Primary driver
                  </dt>
                  <dd className="mt-1 text-sm text-ink-secondary">{data.brief.primary_driver}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[11px] uppercase text-ink-tertiary">
                    Key assumption
                  </dt>
                  <dd className="mt-1 text-sm text-ink-secondary">{data.brief.key_assumption}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <div className="font-mono text-[11px] uppercase text-ink-tertiary">
                  Evidence / provenance
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.brief.evidence.map((item) => (
                    <span
                      key={`${item.component}-${item.category}`}
                      className="border border-line-strong px-2 py-1 font-mono text-[11px] text-ink-secondary"
                    >
                      {item.component}: {item.category}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          <footer className="border-t border-line pt-4 text-xs leading-relaxed text-ink-tertiary">
            Scenario estimates are conditional stress-test results, not forecasts, expected loss,
            investment advice or trade recommendations. Historical performance does not guarantee
            future results. All portfolio impacts and contributions are calculated deterministically.
          </footer>
        </>
      )}
    </div>
  );
}
