import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingLine } from "../../components/LoadingLine";
import { StatusBadge } from "../../components/StatusBadge";
import {
  formatSignedCurrency,
  formatSignedPercentagePoints,
  formatSignedPercent,
} from "../../lib/format";
import type { Portfolio, ScenarioComparisonRow } from "../../types";
import { useScenarioComparison } from "./useScenarioComparison";

function Stat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="border-l border-line-strong pl-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg text-ink">{value}</div>
      {caption && <div className="mt-0.5 text-xs text-ink-tertiary">{caption}</div>}
    </div>
  );
}

function contribution(row: ScenarioComparisonRow, symbol: string): number | null {
  return (
    row.asset_contributions.find((item) => item.symbol === symbol)?.impact_pct_of_portfolio ?? null
  );
}

function heatStyle(value: number | null, max: number): React.CSSProperties {
  if (value === null || value === 0) return {};
  const alpha = 0.12 + 0.58 * Math.min(Math.abs(value) / max, 1);
  return {
    backgroundColor:
      value < 0 ? `rgba(196,69,63,${alpha})` : `rgba(74,155,110,${alpha})`,
  };
}

export function ScenarioComparison({
  portfolio,
  onOpenScenario,
}: {
  portfolio: Portfolio;
  onOpenScenario: (scenarioId: string) => void;
}) {
  const { data, error, loading } = useScenarioComparison(portfolio);
  const maxContribution = data
    ? Math.max(
        ...data.scenarios.flatMap((row) =>
          row.asset_contributions.map((item) => Math.abs(item.impact_pct_of_portfolio)),
        ),
        0.0001,
      )
    : 0.0001;

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
          Portfolio risk surface
        </div>
        <h2 className="mt-1 text-xl font-semibold text-ink">Scenario Comparison</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          Every row is calculated by the same deterministic stress engine. Cell values are each
          holding&apos;s percentage-point contribution to the portfolio result.
        </p>
      </header>

      {loading && !data && <LoadingLine label="Running scenario matrix…" />}
      {error && <ErrorBanner message={error} />}
      {data && (
        <>
          <section className="grid gap-4 border border-line bg-surface-raised/40 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Worst modeled scenario"
              value={
                data.worst_scenario
                  ? formatSignedPercent(data.worst_scenario.impact_pct)
                  : "—"
              }
              caption={data.worst_scenario?.title}
            />
            <Stat
              label="Most vulnerable holding"
              value={data.most_vulnerable_asset?.symbol ?? "—"}
              caption={
                data.most_vulnerable_asset
                  ? `${data.most_vulnerable_asset.downside_scenario_count} downside scenarios`
                  : undefined
              }
            />
            <Stat
              label="Severe scenarios"
              value={String(data.severe_scenario_count)}
              caption={`Impact ≤ ${formatSignedPercent(data.severe_threshold_pct, 0)}`}
            />
            <Stat
              label="Recurring downside driver"
              value={data.most_recurring_downside_contributor?.symbol ?? "—"}
              caption={
                data.most_recurring_downside_contributor
                  ? `Largest contributor in ${data.most_recurring_downside_contributor.scenario_count}`
                  : undefined
              }
            />
          </section>

          {data.scenarios.length === 0 ? (
            <div className="border border-dashed border-line-strong p-8 text-center text-sm text-ink-tertiary">
              No scenarios were selected for comparison.
            </div>
          ) : (
            <section className="overflow-hidden border border-line" aria-label="Scenario heatmap">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-surface-raised">
                    <tr className="border-b border-line">
                      <th className="sticky left-0 z-[1] min-w-64 bg-surface-raised px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                        Scenario
                      </th>
                      <th className="min-w-28 px-3 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                        Impact
                      </th>
                      {data.asset_symbols.map((symbol) => (
                        <th
                          key={symbol}
                          className="min-w-20 px-3 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-ink-tertiary"
                        >
                          {symbol}
                        </th>
                      ))}
                      <th className="min-w-28 px-3 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                        Largest driver
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.scenarios.map((row) => (
                      <tr
                        key={row.scenario_id}
                        className="border-b border-line last:border-b-0 hover:bg-surface-raised/60"
                      >
                        <td className="sticky left-0 bg-surface px-4 py-3">
                          <button
                            type="button"
                            onClick={() => onOpenScenario(row.scenario_id)}
                            className="text-left text-sm font-medium text-ink hover:text-accent-strong"
                          >
                            {row.title} →
                          </button>
                          <div className="mt-1 flex items-center gap-2">
                            <StatusBadge status={row.source_status} />
                            <span className="font-mono text-[10px] text-ink-tertiary">
                              {row.horizon}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">
                          <div
                            className={
                              row.impact_pct < 0
                                ? "text-risk-negative-strong"
                                : "text-risk-positive"
                            }
                          >
                            {formatSignedPercent(row.impact_pct)}
                          </div>
                          <div className="text-[10px] text-ink-tertiary">
                            {formatSignedCurrency(row.impact_value)}
                          </div>
                        </td>
                        {data.asset_symbols.map((symbol) => {
                          const value = contribution(row, symbol);
                          return (
                            <td
                              key={symbol}
                              style={heatStyle(value, maxContribution)}
                              className="px-3 py-3 text-right font-mono text-xs tabular-nums text-ink"
                              title={`${row.title} · ${symbol}`}
                            >
                              {value === null ? "—" : formatSignedPercentagePoints(value)}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 font-mono text-xs text-ink-secondary">
                          {row.largest_negative_contributor?.symbol ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-line px-4 py-3 text-xs text-ink-tertiary">
                Red denotes downside contribution; green denotes positive contribution. Exact
                values remain visible so color is never the only signal.
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
