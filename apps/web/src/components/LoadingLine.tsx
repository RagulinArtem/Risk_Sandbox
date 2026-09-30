export function LoadingLine({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="font-mono text-xs uppercase tracking-wider text-ink-tertiary">{label}</div>
  );
}
