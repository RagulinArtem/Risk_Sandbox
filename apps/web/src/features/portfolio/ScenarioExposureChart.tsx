import { useState } from "react";
import { StatusBadge } from "../../components/StatusBadge";
import { formatSignedCurrency, formatSignedPercent } from "../../lib/format";
import type { ScenarioExposure } from "./useScenarioExposure";

/** Every library scenario's estimated impact on the portfolio, worst first.
 * Values come straight from the backend batch comparison. */
export function ScenarioExposureChart({
  exposures,
  onOpen,
}: {
  exposures: ScenarioExposure[];
  onOpen: (scenarioId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(...exposures.map((e) => Math.abs(e.impact_pct)), 0.0001);
  const shown = expanded ? exposures : exposures.slice(0, 8);

  return (
    <div>
      <ul className="space-y-2">
        {shown.map((scenario) => {
          const pct = scenario.impact_pct;
          const isLoss = pct < 0;
          return (
            <li key={scenario.scenario_id}>
              <button
                type="button"
                onClick={() => onOpen(scenario.scenario_id)}
                className="group grid w-full grid-cols-1 items-center gap-x-4 gap-y-2 rounded-2xl bg-surface px-4 py-3 text-left transition hover:bg-surface-higher focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_10rem]"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm text-ink group-hover:text-accent-strong">
                    {scenario.title}
                  </span>
                  <StatusBadge status={scenario.source_status} />
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-white">
                  <span
                    className={`block h-full rounded-full ${isLoss ? "bg-risk-negative" : "bg-risk-positive"}`}
                    style={{ width: `${(Math.abs(pct) / max) * 100}%` }}
                  />
                </span>
                <span className="text-right text-sm font-semibold tabular-nums">
                  <span className={isLoss ? "text-risk-negative-strong" : "text-risk-positive"}>
                    {formatSignedPercent(pct)}
                  </span>
                  <span className="ml-2 text-xs text-ink-tertiary">
                    {formatSignedCurrency(scenario.impact_value)}
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
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-xs text-ink-tertiary underline decoration-line-strong underline-offset-2 hover:text-ink-secondary"
        >
          {expanded ? "Show the 8 most severe" : `Show all ${exposures.length} scenarios`}
        </button>
      )}
    </div>
  );
}
