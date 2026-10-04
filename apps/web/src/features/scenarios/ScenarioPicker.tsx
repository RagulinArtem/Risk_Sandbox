import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import type { Scenario } from "../../types";

export function ScenarioPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (scenarioId: string) => void;
}) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .listScenarios()
      .then((data) => {
        if (!cancelled) setScenarios(data);
      })
      .catch(() => {
        // The Risk Radar and "What if…?" input remain available if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isLibraryScenario = scenarios.some((s) => s.id === selectedId);
  const byStart = (a: Scenario, b: Scenario) =>
    (a.window?.start ?? "2022").localeCompare(b.window?.start ?? "2022");
  const verified = scenarios.filter((s) => s.source_status === "verified").sort(byStart);
  const illustrative = scenarios
    .filter((s) => s.source_status !== "verified")
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="scenario-picker"
        className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary"
      >
        Start from a scenario
      </label>
      <select
        id="scenario-picker"
        value={isLibraryScenario ? (selectedId ?? "") : ""}
        onChange={(e) => e.target.value && onSelect(e.target.value)}
        className="border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
      >
        <option value="">Choose a scenario…</option>
        {[
          { label: "Verified history (real market data)", items: verified },
          { label: "Illustrative (assumptions)", items: illustrative },
        ].map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
