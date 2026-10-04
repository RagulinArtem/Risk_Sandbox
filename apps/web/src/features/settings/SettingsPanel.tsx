export function SettingsPanel() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-[2rem] border border-line bg-surface-raised p-6 shadow-card sm:p-8">
        <h2 className="text-xl font-bold tracking-tight">A calmer default</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
          The home screen shows the few numbers that help you decide what to inspect next. Detailed
          methodology, evidence, and model assumptions remain available inside each analysis.
        </p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-surface p-5">
            <p className="text-sm font-semibold">Display density</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-tertiary">
              Comfortable spacing is active. Analytical tables retain full precision.
            </p>
            <span className="mt-4 inline-flex rounded-full bg-risk-positive/10 px-3 py-1 text-xs font-semibold text-risk-positive">
              Comfortable
            </span>
          </div>
          <div className="rounded-3xl bg-surface p-5">
            <p className="text-sm font-semibold">Motion</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-tertiary">
              Only short transitions are used. Reduced-motion preferences are respected.
            </p>
            <span className="mt-4 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              Subtle
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-line bg-surface-raised p-6 shadow-card sm:p-8">
        <h2 className="text-xl font-bold tracking-tight">Trust & data</h2>
        <div className="mt-6 divide-y divide-line">
          {[
            ["Live", "Retrieved from an external source with retrieval time."],
            ["Real history", "A documented historical window replayed on today's weights."],
            ["Hypothetical", "An explicit assumption for exploration, not a forecast."],
          ].map(([label, detail]) => (
            <div key={label} className="flex gap-4 py-4 first:pt-0 last:pb-0">
              <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-1 text-sm text-ink-secondary">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
