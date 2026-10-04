import { formatCurrency, formatSignedCurrency, formatSignedPercent } from "../../lib/format";
import type { StressTestResult as StressTestResultType } from "../../types";
import { useCountUp } from "../../lib/useCountUp";
import { AiExplanation } from "./AiExplanation";
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
  // Headline counts from "nothing happened" to the result on every Run.
  const pct = useCountUp(0, result.estimated_impact_pct, result);
  const value = useCountUp(0, result.estimated_impact_value, result);
  const stressed = useCountUp(result.initial_value, result.stressed_value, result);

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
          {formatSignedPercent(pct)}
        </div>
        <div className="mt-1 font-mono text-xl tabular-nums text-ink-secondary">
          {formatSignedCurrency(value)}
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
              {formatCurrency(stressed)}
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
          {result.weighted_exposure_pct != null && (
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
                Risk-Weighted Exposure
                {result.probability != null && ` · p=${(result.probability * 100).toFixed(1)}%`}
              </div>
              <div className="mt-1 font-mono text-lg text-ink">
                {formatSignedPercent(result.weighted_exposure_pct)}
              </div>
            </div>
          )}
        </div>
        {result.weighted_exposure_pct != null && (
          <p className="mt-3 font-mono text-[11px] text-ink-tertiary">
            Risk-weighted exposure = market probability × estimated impact. It scales the
            scenario loss by how likely the market says the event is — not an expected return.
          </p>
        )}
        {result.warnings && result.warnings.length > 0 && (
          <ul className="mt-3 space-y-1 font-mono text-[11px] text-ink-tertiary">
            {result.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-tertiary">
          Contribution by Holding
        </div>
        <ContributionChart assetImpacts={result.asset_impacts} />
      </div>

      <ExplanationNote result={result} />

      <AiExplanation result={result} />
    </div>
  );
}
