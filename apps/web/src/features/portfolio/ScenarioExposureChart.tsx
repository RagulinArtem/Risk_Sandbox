import { useState } from "react";
import { StatusBadge } from "../../components/StatusBadge";
import { formatSignedCurrency, formatSignedPercent } from "../../lib/format";
import type { ScenarioExposure } from "./useScenarioExposure";

/** Every library scenario's estimated impact on the portfolio, worst first.
 * Values come straight from POST /api/stress-test. */
export function ScenarioExposureChart({
  exposures,
  onOpen,
}: {
  exposures: ScenarioExposure[];
  onOpen: (scenarioId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(...exposures.map((e) => Math.abs(e.result.estimated_impact_pct)), 0.0001);
  const shown = expanded ? exposures : exposures.slice(0, 8);

  return (
    <div>
    <ul className="divide-y divide-line">
      {shown.map(({ scenario, result }) => {
        const pct = result.estimated_impact_pct;
        const isLoss = pct < 0;
        return (
          <li key={scenario.id}>
            <button
              type="button"
              onClick={() => onOpen(scenario.id)}
              className="group grid w-full grid-cols-1 items-center gap-x-4 gap-y-1.5 py-3 text-left transition-colors hover:bg-surface-raised focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_10rem]"
            >
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm text-ink group-hover:text-accent-strong">
                  {scenario.title}
                </span>
                <StatusBadge status={scenario.source_status} />
              </span>
              <span className="h-2.5 bg-surface-higher">
                <span
                  className={`block h-full ${isLoss ? "bg-risk-negative" : "bg-risk-positive"}`}
                  style={{ width: `${(Math.abs(pct) / max) * 100}%` }}
                />
              </span>
              <span className="text-right font-mono text-sm tabular-nums">
                <span className={isLoss ? "text-risk-negative-strong" : "text-risk-positive"}>
                  {formatSignedPercent(pct)}
                </span>
                <span className="ml-2 text-[11px] text-ink-tertiary">
                  {formatSignedCurrency(result.estimated_impact_value)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
    {exposures.length > 8 && (
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-xs text-ink-tertiary underline decoration-line-strong underline-offset-2 hover:text-ink-secondary"
      >
        {expanded ? "Show the 8 most severe" : `Show all ${exposures.length} scenarios`}
      </button>
    )}
    </div>
  );
}
