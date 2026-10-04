import { type FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import type { Scenario } from "../../types";
import { useAiStatus } from "./useAiStatus";

const MINIMUM_BUILD_TIME_MS = 1500;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function CustomScenarioInput({
  onParsed,
  holdingCount,
}: {
  onParsed: (scenario: Scenario) => void;
  holdingCount: number;
}) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const isLiveAi = useAiStatus();

  const stages = [
    "Reading the event and its context",
    `Mapping exposure${holdingCount > 0 ? ` across ${holdingCount} holdings` : " across the portfolio"}`,
    "Preparing transparent, editable assumptions",
  ];

  useEffect(() => {
    if (!loading) {
      setStage(0);
      return;
    }
    const timer = window.setInterval(() => {
      setStage((current) => Math.min(current + 1, stages.length - 1));
    }, 500);
    return () => window.clearInterval(timer);
  }, [loading, stages.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setLoading(true);
    setMessage(null);
    try {
      // Keep the analysis state visible long enough to be understood during a
      // demo, even when the canonical scenario or local parser responds at once.
      const [response] = await Promise.all([
        api.parseScenario(trimmed),
        wait(MINIMUM_BUILD_TIME_MS),
      ]);
      if (response.recognized && response.scenario) {
        onParsed(response.scenario);
      } else {
        setMessage(response.message ?? "Couldn't parse that scenario.");
      }
    } catch {
      setMessage(
        "Couldn't reach the scenario parser. Try again, or pick a scenario from the Risk Radar.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="what-if" className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">
        What if…?
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="what-if"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
          placeholder="What if oil rises 40% and Nasdaq falls 15%?"
          className="flex-1 border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="border border-line-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent-strong disabled:cursor-not-allowed disabled:opacity-50 sm:shrink-0"
        >
          {loading ? "Building…" : "Build Scenario"}
        </button>
      </div>
      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/10 via-surface-raised to-risk-negative/5 p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="relative mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-white">
              <span className="text-sm">✦</span>
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">
                Shock Lens is studying your event
                <span className="inline-flex w-5 justify-start">
                  <span className="animate-pulse">…</span>
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-tertiary">
                The scenario layer interprets the event. The deterministic engine will calculate
                every portfolio number.
              </p>
            </div>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {stages.map((label, index) => {
              const complete = index < stage;
              const active = index === stage;
              return (
                <li
                  key={label}
                  className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all duration-300 ${
                    active
                      ? "border-accent/40 bg-white text-ink shadow-sm"
                      : complete
                        ? "border-risk-positive/20 bg-white/70 text-ink-secondary"
                        : "border-line/70 bg-white/40 text-ink-tertiary"
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                      active
                        ? "animate-pulse bg-accent text-white"
                        : complete
                          ? "bg-risk-positive text-white"
                          : "bg-surface-higher text-ink-tertiary"
                    }`}
                  >
                    {complete ? "✓" : index + 1}
                  </span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <p className="text-xs text-ink-tertiary">
        {isLiveAi
          ? "Parsed by a live LLM — review the generated assumptions before running."
          : "Rule-based parsing (not live AI) — recognizes oil, Nasdaq/tech, interest rates, " +
            "Bitcoin, and broad-market moves stated with a percentage."}
      </p>
      {message && <p className="text-xs text-risk-warning">{message}</p>}
    </form>
  );
}
