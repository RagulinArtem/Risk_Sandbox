# Frontend Rules

Referenced from `CLAUDE.md` / the `frontend` agent. Applies to anything
under `apps/web/`.

- No business math in the frontend. It renders `StressTestResult` etc. as
  returned by the API — it never re-derives an impact value.
- `apps/web/src/types/*` mirrors `apps/api/app/schemas/*` field-for-field,
  including snake_case names. Don't add a camelCase transformation layer.
- One feature = one folder under `src/features/`. A hook that fetches data
  for a feature lives next to that feature's components, not in a shared
  `hooks/` grab-bag.
- Design system is typography and restraint, not decoration: IBM Plex
  Sans/Serif/Mono, dark neutral surface, one accent color, semantic
  red/amber/green reserved for actual risk meaning. No gradients, no
  pill-everywhere buttons, no card-per-metric, no decorative motion. Match
  `src/components/Section.tsx` and existing feature components rather than
  inventing new patterns.
- Every piece of scenario/signal data shown must carry its
  `StatusBadge` (DEMO/VERIFIED/LIVE) — never present data without
  provenance visible.
- `npm run typecheck && npm run lint && npm run build` must pass before a
  change is done. For anything visual, run it in an actual browser.
