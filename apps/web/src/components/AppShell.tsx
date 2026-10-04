import { type ReactNode, useState } from "react";

export type AppView = "home" | "portfolio" | "risks" | "stress" | "settings" | "report";

type IconName =
  | "home"
  | "pulse"
  | "bell"
  | "wallet"
  | "settings"
  | "shield"
  | "report"
  | "chevron";

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    home: <path d="M3 10.8 12 3l9 7.8v9.7a.5.5 0 0 1-.5.5H15v-7H9v7H3.5a.5.5 0 0 1-.5-.5v-9.7Z" />,
    pulse: <path d="M3 12h4l2.3-6 4.1 12 2.4-6H21" />,
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8Z" />
        <path d="M10 21h4" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 5.5h14a2 2 0 0 1 2 2V19H4a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2Z" />
        <path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z" />
        <path d="m5 5 10-3v3" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1 1.6v.2h-4V21a1.8 1.8 0 0 0-1-1.6 1.8 1.8 0 0 0-2 .4l-.1.1-2.8-2.8.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 3 14H2.8v-4H3a1.8 1.8 0 0 0 1.6-1 1.8 1.8 0 0 0-.4-2l-.1-.1 2.8-2.8.1.1a1.8 1.8 0 0 0 2 .4A1.8 1.8 0 0 0 10 3v-.2h4V3a1.8 1.8 0 0 0 1 1.6 1.8 1.8 0 0 0 2-.4l.1-.1 2.8 2.8-.1.1a1.8 1.8 0 0 0-.4 2A1.8 1.8 0 0 0 21 10h.2v4H21a1.8 1.8 0 0 0-1.6 1Z" />
      </>
    ),
    shield: <path d="M12 2.5 20 6v5.8c0 4.8-3.3 8.2-8 9.7-4.7-1.5-8-4.9-8-9.7V6l8-3.5Zm-3 9.4 2 2 4.5-5" />,
    report: (
      <>
        <path d="M5 3h10l4 4v14H5V3Z" />
        <path d="M15 3v5h4M8 12h8M8 16h8" />
      </>
    ),
    chevron: <path d="m9 6 6 6-6 6" />,
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

const NAV_ITEMS: Array<{ id: AppView; label: string; icon: IconName }> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "stress", label: "Stress analytics", icon: "pulse" },
  { id: "risks", label: "Alerts & signals", icon: "bell" },
  { id: "portfolio", label: "Portfolio", icon: "wallet" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const VIEW_COPY: Record<AppView, { title: string; eyebrow: string }> = {
  home: { title: "Shock Lens", eyebrow: "Portfolio intelligence" },
  portfolio: { title: "Your portfolio", eyebrow: "Holdings & performance" },
  risks: { title: "Alerts & signals", eyebrow: "What could affect you" },
  stress: { title: "Stress analytics", eyebrow: "Explore a what-if" },
  settings: { title: "Settings", eyebrow: "Your experience" },
  report: { title: "Risk report", eyebrow: "Printable overview" },
};

function Navigation({
  active,
  collapsed,
  onNavigate,
}: {
  active: AppView;
  collapsed: boolean;
  onNavigate: (view: AppView) => void;
}) {
  return (
    <nav aria-label="Main navigation" className="space-y-1.5">
      {NAV_ITEMS.map((item) => {
        const selected = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            title={collapsed ? item.label : undefined}
            aria-current={selected ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              selected
                ? "bg-ink text-white shadow-sm"
                : "text-ink-secondary hover:bg-surface-higher hover:text-ink"
            }`}
          >
            <Icon name={item.icon} className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}

export function AppShell({
  activeView,
  onNavigate,
  portfolios,
  portfolioId,
  onPortfolioChange,
  children,
}: {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  portfolios: Array<{ id: string; name: string }>;
  portfolioId?: string;
  onPortfolioChange: (id: string) => void;
  children: ReactNode;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return (
        window.localStorage.getItem("shock-lens.sidebar-collapsed") ??
        window.localStorage.getItem("risk-copilot.sidebar-collapsed")
      ) === "true";
    } catch {
      return false;
    }
  });
  const copy = VIEW_COPY[activeView];

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        window.localStorage.setItem("shock-lens.sidebar-collapsed", String(next));
      } catch {
        // The preference is optional when storage is unavailable.
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-surface text-ink">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-surface-raised py-5 transition-[width,padding] duration-300 ease-out lg:flex lg:flex-col print:hidden ${
          sidebarCollapsed ? "w-20 px-3" : "w-64 px-5"
        }`}
      >
        <div className={`mb-8 flex items-center ${sidebarCollapsed ? "flex-col gap-3" : "justify-between gap-3"}`}>
          <button
            type="button"
            onClick={() => onNavigate("home")}
            aria-label="Shock Lens home"
            className="flex min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-white shadow-sm">
              <Icon name="shield" className="h-5 w-5" />
            </span>
            {!sidebarCollapsed && (
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-sm font-bold tracking-tight">Shock Lens</span>
                <span className="block whitespace-nowrap text-xs text-ink-tertiary">Portfolio intelligence</span>
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-ink-tertiary transition hover:border-line-strong hover:bg-surface hover:text-ink"
          >
            <Icon name="chevron" className={`h-3.5 w-3.5 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`} />
          </button>
        </div>
        {!sidebarCollapsed && portfolios.length > 0 && portfolioId && (
          <label className="mb-6 block border-b border-line pb-5">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-ink-tertiary">Active portfolio</span>
            <select
              value={portfolioId}
              onChange={(event) => onPortfolioChange(event.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-xs font-semibold text-ink outline-none transition focus:border-accent"
            >
              {portfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
              ))}
            </select>
          </label>
        )}

        <Navigation active={activeView} collapsed={sidebarCollapsed} onNavigate={onNavigate} />

        <div className={`mt-auto bg-gradient-to-br from-indigo-50 via-violet-50 to-blue-50 ${sidebarCollapsed ? "rounded-xl p-2.5" : "rounded-2xl p-4"}`}>
          <div className={`${sidebarCollapsed ? "mx-auto" : "mb-3"} grid h-9 w-9 place-items-center rounded-xl bg-white text-accent shadow-sm`}>
            <Icon name="shield" className="h-4 w-4" />
          </div>
          {!sidebarCollapsed && (
            <>
              <p className="text-sm font-semibold text-ink">Your numbers stay explainable</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                AI explains assumptions. Portfolio impact is calculated by the risk engine.
              </p>
            </>
          )}
        </div>
      </aside>

      <div className={`min-h-screen transition-[padding] duration-300 ease-out ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"} print:pl-0`}>
        <header className="sticky top-0 z-20 border-b border-line/80 bg-surface/90 backdrop-blur-xl print:hidden">
          <div className="mx-auto flex max-w-[92rem] items-center justify-between gap-4 px-4 py-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-ink text-white lg:hidden">
                <Icon name="shield" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-tertiary">{copy.eyebrow}</p>
                <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">{copy.title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {portfolios.length > 0 && portfolioId && (
                <label className="hidden sm:block">
                  <span className="sr-only">Portfolio</span>
                  <select
                    value={portfolioId}
                    onChange={(event) => onPortfolioChange(event.target.value)}
                    className="max-w-64 rounded-2xl border border-line bg-surface-raised px-3.5 py-2.5 text-sm font-medium text-ink shadow-sm outline-none transition focus:border-accent"
                  >
                    {portfolios.map((portfolio) => (
                      <option key={portfolio.id} value={portfolio.id}>
                        {portfolio.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                type="button"
                onClick={() => onNavigate("report")}
                aria-label="Open risk report"
                className={`grid h-10 w-10 place-items-center rounded-2xl border transition ${
                  activeView === "report"
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-surface-raised text-ink-secondary hover:border-line-strong hover:text-ink"
                }`}
              >
                <Icon name="report" className="h-[1.125rem] w-[1.125rem]" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-2xl border border-line bg-surface-raised p-1.5 pr-2.5 shadow-sm transition hover:border-line-strong"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 text-xs font-bold text-white">
                    AR
                  </span>
                  <Icon
                    name="chevron"
                    className={`hidden h-3.5 w-3.5 text-ink-tertiary transition-transform sm:block ${profileOpen ? "rotate-90" : ""}`}
                  />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-line bg-surface-raised p-2 shadow-xl">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold">Demo workspace</p>
                      <p className="mt-0.5 text-xs text-ink-tertiary">No trades or advice</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        onNavigate("settings");
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-secondary hover:bg-surface-higher hover:text-ink"
                    >
                      <Icon name="settings" className="h-4 w-4" /> Settings
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="app-content mx-auto w-full max-w-[92rem] px-4 py-6 pb-28 sm:px-8 sm:py-8 lg:pb-10 print:max-w-none print:px-0 print:py-0">
          {children}
        </main>

        <footer className="border-t border-line px-4 py-5 text-xs leading-relaxed text-ink-tertiary sm:px-8 lg:px-10 print:hidden">
          Estimates are scenario-based, not forecasts. Shock Lens does not provide investment
          advice and does not execute trades.
        </footer>
      </div>

      <div className="fixed inset-x-3 bottom-3 z-30 rounded-[1.4rem] border border-line bg-surface-raised/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden print:hidden">
        <div className="grid grid-cols-5 gap-1">
          {NAV_ITEMS.map((item) => {
            const selected = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-current={selected ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-medium transition ${
                  selected ? "bg-ink text-white" : "text-ink-tertiary"
                }`}
              >
                <Icon name={item.icon} className="h-[1.125rem] w-[1.125rem]" />
                <span className="w-full truncate">{item.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
