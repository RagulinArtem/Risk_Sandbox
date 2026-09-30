import { type FormEvent, useState } from "react";
import { api } from "../../lib/apiClient";
import type { Scenario } from "../../types";

export function CustomScenarioInput({ onParsed }: { onParsed: (scenario: Scenario) => void }) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setLoading(true);
    setMessage(null);
    try {
      const response = await api.parseScenario(trimmed);
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
      <label htmlFor="what-if" className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
        What if…?
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="what-if"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What if oil rises 40% and Nasdaq falls 15%?"
          className="flex-1 border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="border border-line-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent-strong disabled:cursor-not-allowed disabled:opacity-50 sm:shrink-0"
        >
          {loading ? "Parsing…" : "Build Scenario"}
        </button>
      </div>
      <p className="text-xs text-ink-tertiary">
        Rule-based parsing (not live AI) — recognizes oil, Nasdaq/tech, interest rates, Bitcoin,
        and broad-market moves stated with a percentage.
      </p>
      {message && <p className="text-xs text-risk-warning">{message}</p>}
    </form>
  );
}
