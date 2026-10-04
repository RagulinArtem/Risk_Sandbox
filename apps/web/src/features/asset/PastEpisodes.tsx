import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import { formatSignedPercent } from "../../lib/format";
import type { Scenario } from "../../types";

let cache: Promise<Scenario[]> | null = null;
function historicalScenarios(): Promise<Scenario[]> {
  cache ??= api
    .listScenarios()
    .then((all) =>
      all
        .filter((s) => s.id.startsWith("historical-") && s.source_status === "verified")
        .sort((a, b) => (a.window?.start ?? "2022").localeCompare(b.window?.start ?? "2022")),
    )
    .catch((err: unknown) => {
      cache = null;
      throw err;
    });
  return cache;
}

/** This asset's real return in each verified historical stress episode.
 * Values are read straight from the verified scenarios (Yahoo total returns). */
export function PastEpisodes({ symbol }: { symbol: string }) {
  const [episodes, setEpisodes] = useState<Scenario[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    historicalScenarios()
      .then((s) => !cancelled && setEpisodes(s))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <p className="text-sm text-ink-tertiary">Historical episodes unavailable.</p>;
  if (!episodes) return null;

  const values = episodes.map((e) => e.asset_shocks[symbol]).filter((v): v is number => v !== undefined);
  const max = Math.max(...values.map(Math.abs), 0.0001);

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {episodes.map((e) => {
          const v = e.asset_shocks[symbol];
          return (
            <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_5rem_3.5rem] items-center gap-3 text-xs">
              <span className="truncate text-ink-secondary" title={e.horizon}>
                {e.title}
              </span>
              <span className="h-1.5 bg-surface-higher">
                {v !== undefined && (
                  <span
                    className={`block h-full ${v < 0 ? "bg-risk-negative" : "bg-risk-positive"}`}
                    style={{ width: `${(Math.abs(v) / max) * 100}%` }}
                  />
                )}
              </span>
              <span className="text-right font-mono tabular-nums">
                {v === undefined ? (
                  <span className="text-ink-tertiary" title="No market price in this window">n/a</span>
                ) : (
                  <span className={v < 0 ? "text-risk-negative-strong" : "text-risk-positive"}>
                    {formatSignedPercent(v, 0)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-ink-tertiary">
        Real total returns over each episode&apos;s window (Yahoo Finance adjusted close). Open any
        episode in the Stress Test tab to see its dated events and sources.
      </p>
    </div>
  );
}
