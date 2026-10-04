import { useEffect, useState } from "react";
import { ApiError, api } from "../../lib/apiClient";
import { formatShortDate, formatSignedPercent } from "../../lib/format";
import type { MovePeriod, MoveDriversResponse } from "../../types";

const KIND_LABEL: Record<string, string> = {
  company: "Company",
  sector: "Sector",
  macro: "Macro",
  market: "Market",
};

/** "What may be driving the recent move?" — an AI interpretation grounded in
 * real prices and real headlines. Runs only when the user asks (it costs an
 * LLM call) and labels itself as interpretation, not fact. */
export function MoveDrivers({ symbol }: { symbol: string }) {
  const [period, setPeriod] = useState<MovePeriod>("1W");
  const [result, setResult] = useState<MoveDriversResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [symbol, period]);

  async function explain() {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.getMoveDrivers(symbol, period));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Couldn't reach the AI service.");
    } finally {
      setLoading(false);
    }
  }

  const observed = result?.observed;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Period" className="inline-flex border border-line-strong">
          {(["1W", "1M"] as MovePeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === period}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 font-mono text-[11px] ${
                p === period ? "bg-accent/15 text-accent-strong" : "text-ink-tertiary hover:text-ink-secondary"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={explain}
          disabled={loading}
          className="border border-accent/60 px-3 py-1 text-xs font-medium text-accent-strong transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Reading prices and headlines…" : result ? "Explain again" : "Explain the recent move"}
        </button>
      </div>

      {error && <p className="text-xs text-risk-warning">{error}</p>}

      {observed && (
        <p className="font-mono text-xs text-ink-secondary">
          <span className="text-ink-tertiary">Observed: </span>
          <span className={observed.return_pct >= 0 ? "text-risk-positive" : "text-risk-negative-strong"}>
            {symbol} {formatSignedPercent(observed.return_pct)}
          </span>{" "}
          {formatShortDate(observed.from_date)} → {formatShortDate(observed.to_date)}
          {observed.market_return_pct !== null && symbol !== "SPY" && (
            <> · S&amp;P 500 (SPY) {formatSignedPercent(observed.market_return_pct)}</>
          )}
        </p>
      )}

      {result && !result.available && (
        <p className="text-sm text-ink-tertiary">{result.message}</p>
      )}

      {result?.available && (
        <div className="space-y-3 border-l-2 border-accent/40 pl-3">
          {result.summary && <p className="text-sm leading-relaxed text-ink">{result.summary}</p>}
          <ul className="space-y-2.5">
            {result.drivers.map((d, i) => (
              <li key={i} className="text-sm leading-relaxed text-ink-secondary">
                <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                  {KIND_LABEL[d.kind] ?? d.kind}
                </span>
                {d.text}
                {d.sources.length > 0 ? (
                  <span className="mt-1 block text-[11px] text-ink-tertiary">
                    Sources:{" "}
                    {d.sources.map((s, j) => (
                      <span key={s.id}>
                        {j > 0 && " · "}
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-strong underline decoration-accent/40 underline-offset-2"
                        >
                          {s.publisher}
                        </a>
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="mt-1 block text-[11px] text-ink-tertiary">
                    Based on the observed price comparison above.
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result?.model && (
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
          {result.label} · {result.model.replace(/^~/, "")}
          {result.confidence ? ` · ${result.confidence} confidence` : ""} · not investment advice
        </p>
      )}
      {!result && !loading && (
        <p className="text-[11px] text-ink-tertiary">
          An AI model reads the real price move and the latest headlines and suggests possible
          drivers, citing its sources. It is interpretation, not established fact.
        </p>
      )}
    </div>
  );
}
