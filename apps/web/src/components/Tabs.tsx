export interface TabDef<T extends string> {
  id: T;
  label: string;
  hint?: string;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto" role="tablist">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent ${
              selected
                ? "border-accent text-ink"
                : "border-transparent text-ink-tertiary hover:text-ink-secondary"
            }`}
          >
            {tab.label}
            {tab.hint && (
              <span className="ml-2 font-mono text-xs text-ink-tertiary">{tab.hint}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
