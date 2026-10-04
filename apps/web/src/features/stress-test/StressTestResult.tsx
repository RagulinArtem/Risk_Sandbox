import { formatCurrency, formatSignedCurrency, formatSignedPercent } from "../../lib/format";
import type { StressTestResult as StressTestResultType } from "../../types";
import { ContributionChart } from "./ContributionChart";
import { ExplanationNote } from "./ExplanationNote";

export function StressTestResult({
  result,
  scenarioTitle,
}: {
  result: StressTestResultType;
  scenarioTitle?: string;
}) {
  const isLoss = result.estimated_impact_value < 0;

  return (
    <div className="space-y-8">
      <div>
        <div className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
          {scenarioTitle ?? result.scenario_title} · Estimated Stress Impact
        </div>
        <div
          className={`mt-2 font-mono text-5xl font-semibold tabular-nums ${
            isLoss ? "text-risk-negative-strong" : "text-risk-positive"
          }`}
        >
          {formatSignedPercent(result.estimated_impact_pct)}
        </div>
        <div className="mt-1 font-mono text-xl tabular-nums text-ink-secondary">
          {formatSignedCurrency(result.estimated_impact_value)}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-line pt-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
              Initial Value
            </div>
            <div className="mt-1 font-mono text-lg text-ink">
              {formatCurrency(result.initial_value)}
            </div>
          </div>
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
              Stressed Portfolio Value
            </div>
            <div className="mt-1 font-mono text-lg text-ink">
              {formatCurrency(result.stressed_value)}
            </div>
          </div>
          {result.biggest_negative_contributor && (
            <div>
              <div className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
                Largest Downside Contributor
              </div>
              <div className="mt-1 font-mono text-lg text-risk-negative-strong">
                {result.biggest_negative_contributor.symbol}{" "}
                {formatSignedCurrency(result.biggest_negative_contributor.impact_value)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-tertiary">
          Contribution by Holding
        </div>
        <ContributionChart assetImpacts={result.asset_impacts} />
      </div>

      <ExplanationNote result={result} />
    </div>
  );
}
