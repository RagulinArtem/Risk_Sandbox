# Contributing

Hackathon-weight process. Optimize for speed and for your teammates being
able to understand your PR in under a minute.

## Workflow

```bash
git checkout main
git pull
git checkout -b feature/my-feature   # or fix/*, data/*, docs/*

# work

make check     # lint + typecheck + test

git add <files>       # not -A — check what you're staging
git commit -m "feat: add thing"
git push -u origin feature/my-feature

# open a PR
```

No long-lived personal branches. Branch, ship, merge, delete.

## Branch naming

- `feature/*` — new functionality
- `fix/*` — bug fixes
- `data/*` — new/changed scenario or portfolio data
- `docs/*` — documentation only

## Commit messages

Conventional-ish, imperative, one logical change per commit:

```
feat: add deterministic stress test engine
feat: add risk radar dashboard
data: add oil supply shock scenario
docs: add architecture diagram
fix: correct portfolio contribution rounding
chore: bootstrap project structure
```

## Before opening a PR

- `make check` passes.
- The change keeps the Community Edition fully functional offline (see
  `docs/BUSINESS_MODEL.md` "Non-goals").
- No secrets in the diff (check `git diff` yourself, not just CI).
- No fabricated data presented as `verified`/`live` (see
  `docs/DATA_SOURCES.md`).
- If you changed an API schema: frontend types and
  `docs/API_CONTRACT.md` are updated in the same PR.
- If you finished a meaningful feature: `docs/CURRENT_STATE.md` and
  `ROADMAP.md` are updated.

## PRs

Keep them small — one feature, one fix, one data addition. Use the PR
template (`.github/pull_request_template.md`). No required approval
process during the hackathon; use judgment, tag whoever owns the area if
you want a second look.
