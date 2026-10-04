import { StatusBadge } from "../../components/StatusBadge";
import type { Scenario, SourceStatus } from "../../types";

function round1(n: number): number {
  return Math.round(n * 1000) / 10;
}

const ASSUMPTIONS_CAPTION: Record<SourceStatus, string> = {
  illustrative: "illustrative, not a forecast",
  verified: "historical, not a forecast",
  live: "live-informed, not a forecast",
};

export interface AiEstimateControls {
  estimating: boolean;
  error: string | null;
  onEstimate: () => void;
  /** Reload the library version, shown once the AI has replaced the numbers. */
  onRestore?: () => void;
}

export function ScenarioEditor({
  scenario,
  onShockChange,
  onRun,
  running,
  ai,
}: {
  scenario: Scenario;
  onShockChange: (symbol: string, value: number) => void;
  onRun: () => void;
  running: boolean;
  /** Present only when a live LLM is configured. */
  ai?: AiEstimateControls;
}) {
  const symbols = Object.keys(scenario.asset_shocks);
  const rationale = scenario.shock_rationale ?? {};
  const hasRationale = Object.keys(rationale).length > 0;
  const assumptionCaption =
    scenario.assumption_source === "user_edited"
      ? "user-edited assumptions"
      : scenario.assumption_source === "ai_estimate"
        ? "AI-estimated, not a forecast"
        : scenario.assumption_source === "historical"
          ? "historical market window"
          : ASSUMPTIONS_CAPTION[scenario.source_status];

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-base font-semibold text-ink">{scenario.title}</h3>
            <StatusBadge status={scenario.source_status} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">{scenario.description}</p>
          {scenario.source_name && (
            <p className="mt-2 font-mono text-[11px] text-ink-tertiary">
              Source:{" "}
              {scenario.source_url ? (
                <a
                  href={scenario.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-strong underline decoration-accent/40 underline-offset-2 hover:text-accent"
                >
                  {scenario.source_name} ↗
                </a>
              ) : (
                scenario.source_name
              )}
              {scenario.source_date && ` · ${scenario.source_date}`}
            </p>
          )}
        </div>
        <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
          Horizon {scenario.horizon}
        </div>
      </div>

      {(scenario.references?.length || scenario.unavailable_assets?.length) ? (
        <div className="space-y-2 border-b border-line px-5 py-3 text-[11px] text-ink-tertiary">
          {scenario.unavailable_assets && scenario.unavailable_assets.length > 0 && (
            <p>
              No market price in this window for {scenario.unavailable_assets.join(", ")}: shown as
              &ldquo;no assumption&rdquo;, not as 0%.
            </p>
          )}
          {scenario.references && scenario.references.length > 0 && (
            <ol className="list-decimal space-y-0.5 pl-4">
              {scenario.references.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-accent-strong underline decoration-accent/40 underline-offset-2">
                    {r.title}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}

      <div className="border-b border-line px-5 py-4">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
          Transmission
        </div>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-ink-secondary">
          {scenario.transmission.map((step, i) => (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-ink-tertiary">→</span>}
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {scenario.risk_drivers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {scenario.risk_drivers.map((driver) => (
              <span
                key={driver.driver}
                className="border border-accent/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-accent-strong"
                title={`${driver.direction} direction · ${driver.importance} scenario importance`}
              >
                {driver.label} · {driver.importance}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
            Scenario Assumptions (editable)
          </div>
          <div className="font-mono text-[11px] text-ink-tertiary">
            {assumptionCaption}
          </div>
        </div>

        {ai && (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={ai.onEstimate}
              disabled={ai.estimating}
              className="border border-accent/60 px-3 py-1.5 text-xs font-medium text-accent-strong transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ai.estimating
                ? "AI is estimating…"
                : hasRationale
                  ? "Re-estimate with AI"
                  : "Estimate shocks with AI"}
            </button>
            {hasRationale && ai.onRestore && (
              <button
                type="button"
                onClick={ai.onRestore}
                className="text-xs text-ink-tertiary underline decoration-line-strong underline-offset-2 hover:text-ink-secondary"
              >
                Restore original numbers
              </button>
            )}
            {ai.error && <span className="text-xs text-risk-warning">{ai.error}</span>}
          </div>
        )}
        <table className="w-full text-sm">
          <tbody>
            {symbols.map((symbol) => {
              const value = scenario.asset_shocks[symbol];
              return (
                <tr key={symbol} className="border-t border-line first:border-t-0">
                  <td className="py-2 pr-4 align-top">
                    <div className="font-mono text-ink">{symbol}</div>
                    {rationale[symbol] && (
                      <div className="mt-0.5 text-xs text-ink-tertiary">{rationale[symbol]}</div>
                    )}
                  </td>
                  <td className="py-2 text-right align-top">
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="number"
                        step="1"
                        value={round1(value)}
                        onChange={(e) => onShockChange(symbol, Number(e.target.value) / 100)}
                        className={`w-16 border border-line-strong bg-surface-raised px-2 py-1 text-right font-mono focus:border-accent focus:outline-none ${
                          value < 0 ? "text-risk-negative-strong" : value > 0 ? "text-risk-positive" : "text-ink"
                        }`}
                      />
                      <span className="font-mono text-xs text-ink-tertiary">%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="mt-4 w-full border border-accent bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent-strong transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {running ? "Running Stress Test…" : "Run Stress Test"}
        </button>
      </div>
    </div>
  );
}
