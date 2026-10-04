import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import { formatPercent, formatSignedPercent } from "../../lib/format";
import type { DiversificationResponse, Portfolio, RiskRadarItem } from "../../types";
import type { ScenarioExposure } from "./useScenarioExposure";

/** The five-second answer for a first-time viewer: how concentrated the
 * portfolio really is, the worst real crisis replayed on it, and the most
 * relevant live risk. Every number comes from the backend. */
export function HeroSummary({
  portfolio,
  exposures,
  onOpenScenario,
  onSeeRisks,
}: {
  portfolio: Portfolio;
  exposures: ScenarioExposure[];
  onOpenScenario: (scenarioId: string) => void;
  onSeeRisks: () => void;
}) {
  const [div, setDiv] = useState<DiversificationResponse | null>(null);
  const [live, setLive] = useState<RiskRadarItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDiv(null);
    setLive(null);
    api
      .getDiversification(portfolio.id)
      .then((d) => !cancelled && setDiv(d))
      .catch(() => {
        // Price data down: the card simply omits this line.
      });
    api
      .getRiskRadar(portfolio.id)
      .then((items) => !cancelled && setLive(items.filter((i) => i.source_status === "live")))
      .catch(() => {
        // Live markets down: the card simply omits this line.
      });
    return () => {
      cancelled = true;
    };
  }, [portfolio.id]);

  const worstReal = exposures
    .filter((e) => e.source_status === "verified")
    .reduce<ScenarioExposure | null>((w, e) => (!w || e.impact_pct < w.impact_pct ? e : w), null);
  const topDriver = div?.drivers[0];

  // The most damaging scenario that a live prediction market is tracking.
  // The market's probability is shown as context only: it prices the
  // market's own question, not our scenario, so we never multiply the two.
  const impactById = new Map(exposures.map((e) => [e.scenario_id, e]));
  const liveRisk = (Array.isArray(live) ? live : [])
    .map((signal) => ({ signal, scenario: impactById.get(signal.scenario_id) }))
    .filter((x): x is { signal: RiskRadarItem; scenario: ScenarioExposure } => !!x.scenario)
    .sort(
      (a, b) =>
        a.scenario.impact_pct - b.scenario.impact_pct ||
        (b.signal.probability_value ?? 0) - (a.signal.probability_value ?? 0),
    )[0];

  return (
    <section className="border border-accent/40 bg-accent/5 p-6">
      <div className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
        {portfolio.name} · the short version
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-3">
        <div className="min-w-0">
          <div className="font-mono text-4xl tabular-nums text-ink">
            {div ? div.effective_drivers.toFixed(1) : "…"}
            <span className="ml-2 text-base text-ink-tertiary">real bets</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
            {portfolio.positions.length} holdings, but on a year of real daily prices they behave
            like about {div ? Math.round(div.effective_drivers) : "…"} independent bets.
            {topDriver && (
              <>
                {" "}One shared driver ({topDriver.top_holdings.join(", ")}) explains{" "}
                <b className="text-ink">{formatPercent(topDriver.share, 0)}</b> of the swings.
              </>
            )}
          </p>
        </div>

        <div className="min-w-0">
          <div className="font-mono text-4xl tabular-nums text-risk-negative-strong">
            {worstReal ? formatSignedPercent(worstReal.impact_pct) : "…"}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
            {worstReal ? (
              <>
                If <b className="text-ink">{worstReal.title}</b> happened again, using the real
                asset moves from that period.
              </>
            ) : (
              "Worst real crisis replayed on today's weights."
            )}
          </p>
        </div>

        <div className="min-w-0">
          {liveRisk ? (
            <>
              <div className="font-mono text-4xl tabular-nums text-risk-warning">
                {formatSignedPercent(liveRisk.scenario.impact_pct)}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                Worst risk a live market is tracking:{" "}
                <b className="text-ink">{liveRisk.scenario.title}</b>. Polymarket now prices
                &ldquo;{liveRisk.signal.title}&rdquo; at {liveRisk.signal.probability_signal?.split(" ")[0]}.
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-tertiary">
              {live === null ? "Checking live prediction markets…" : "No live market signals right now."}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSeeRisks}
          className="border border-accent bg-accent/15 px-4 py-2 text-sm font-medium text-accent-strong hover:bg-accent/25"
        >
          ② See what could hurt it now →
        </button>
        {worstReal && (
          <button
            type="button"
            onClick={() => onOpenScenario(worstReal.scenario_id)}
            className="border border-line-strong px-4 py-2 text-sm font-medium text-ink hover:border-accent"
          >
            ③ Stress-test the worst case →
          </button>
        )}
      </div>
    </section>
  );
}
