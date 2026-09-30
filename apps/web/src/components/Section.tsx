import type { ReactNode } from "react";

export function Section({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line pt-6">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          {eyebrow && (
            <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
              {eyebrow}
            </div>
          )}
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
