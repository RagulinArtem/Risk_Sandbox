# Multi-Agent Orchestration Hardening & Live Verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI Risk Committee genuinely work end-to-end against live OpenRouter and real Polymarket data — hardened, live-verified, deepened with a debate round and live market context, with docs rewritten to verified reality, the license removed, and the uncommitted tree committed cleanly.

**Architecture:** Backend-only (owner: Devano). LLM calls keep flowing through `apps/api/app/integrations/ai/openrouter.py:complete_json` (now with retries and precise errors). Analysts/chair still only propose *assumptions*; `DirectAssetShockEngine` in `apps/api/app/domain/risk/engine.py` remains the only source of portfolio numbers. New: opt-in server-side rebuttal round (`debate: true`), optional live Polymarket signal when `market_id` is passed, strict validation of client-sent views, a live-correct Polymarket risk source, and a repeatable live smoke script.

**Tech Stack:** FastAPI, Pydantic v2, httpx, pytest, ruff; TypeScript types sync only; OpenRouter `complete_json`; Polymarket Gamma/CLOB.

**Spec:** `docs/prep/MULTI_AGENT_ORCHESTRATION.md` (being rewritten to verified reality), `docs/API_CONTRACT.md`, `AGENTS.md`, `docs/DATA_SOURCES.md`.

## Global Constraints

- **AI interprets, code calculates** (AGENTS.md #1). No LLM computes portfolio math. Every committee impact stays `DirectAssetShockEngine` output.
- **Offline MVP must always work** (AGENTS.md #2). `AI_PROVIDER=mock` stays the default in code and `.env.example`; live integrations degrade, never crash.
- **No fake precision** (AGENTS.md #3). AI output is `source_status: "illustrative"`; Polymarket data carries `source_status: live|cached` + provenance; failures skip/raise, never fabricate.
- **Types stay in sync** (AGENTS.md #4): every Pydantic change updates `apps/web/src/types/*` and `docs/API_CONTRACT.md` in the same change. No component/hook work.
- **No secrets committed.** `.env` is gitignored; never echo the key.
- `make check` (ruff + typecheck + pytest) green before every commit.
- Branch `dev-back`, remote `origin https://github.com/RagulinArtem/Risk_Sandbox.git`. **Commit the entire current tree first, then layer work** (user decision).
- **License: delete `LICENSE` and every reference** (README, CONTRIBUTING, BUSINESS_MODEL, ROADMAP, package.json); repo becomes all-rights-reserved (user decision).
- **Live spend allowed:** OpenRouter key valid at plan time (~$56.82 remaining); full committee+debate run ≈ $0.04–0.08. A full run is required in Task 7/9.
- Model ids verified to exist on OpenRouter 2026-10-04: `openai/gpt-6.1-sol`, `~google/gemini-pro-latest`, `moonshotai/kimi-k3`, `anthropic/claude-opus-5.5`.
- Polymarket live behavior verified at plan time: default Gamma order → **0** scenario matches; `order=volume24hr&ascending=false&limit=50` → **3** (Fed 0.45%, Taiwan 2.25%, Hormuz 2.8%). Market `567621` and CLOB history both return live data.

## Execution Note (2026-10-04)

The user has instructed that **no tests or verification commands may be run until
further notice** (no pytest, `make check`/`test`, `make smoke`, `make smoke-live`,
`npm lint/typecheck/build`). Test code is still written as specified, but every
"run the tests" step is deferred. Consequences for this execution session:

- Task 1 commits the baseline tree without re-running `make check` (the tree was
  verified green at plan time: 93 pytest passed, `tsc --noEmit` clean).
- Task 7 gets script + Makefile only; the live smoke is **not** run.
- Task 8 uses only facts verified at plan time; the "Verified live run" section is
  marked pending until the deferred live smoke is run.
- Task 9 is deferred entirely until the user approves testing.

---

## Verified starting state (facts the plan builds on)

- 93 backend tests pass (`PYTHONDONTWRITEBYTECODE=1 .venv/bin/pytest -q`), `tsc -b --noEmit` clean.
- Committee backend (`integrations/ai/committee.py`, `api/routes/committee.py`, `schemas/committee.py`, `tests/test_committee.py`) and panel (`apps/web/src/features/stress-test/CommitteePanel.tsx`) are **untracked**.
- `.env` currently `AI_PROVIDER=mock` (committee hidden); key present and valid. Tests run from `apps/api` so they never load root `.env` → offline.
- `MULTI_AGENT_ORCHESTRATION.md` §11 references `services/committee_service.py` and `features/committee/useCommittee.ts` — neither exists. §7 "Live results (production)" contradicts `CURRENT_STATE.md`/`ROADMAP.md` ("live pending credits"). §6 claims "503 to the UI" — routes actually return HTTP 200 + `message`.
- `PolymarketRiskSource()` (polymarket.py:57) takes no settings → no `https_proxy`; `_fetch_markets` (72-95) uses Gamma default order; `_extract_yes_probability` (138-164) falls back to `prices[0]` for multi-outcome markets (misleading). `market_service._fetch_gamma_market`/`_fetch_points` (192-228) also ignore proxy; `_write_cache` (352-358) writes non-atomically.
- `COMMITTEE_*` settings exist in `config.py:41-44`; `.env.example` documents them. `scripts/snapshot_polymarket.py` establishes the script import pattern (`sys.path.insert(0, REPO_ROOT/"apps"/"api")`).
- Scenario horizons include `"60d"` and `"Full calendar year 2022"` → do **not** restrict horizon to a Literal.

---

## Task 1: Commit the baseline tree; remove the license

**Files:**
- Delete: `LICENSE` (untracked)
- Modify: `README.md` (~127-137), `CONTRIBUTING.md` (6-12), `docs/BUSINESS_MODEL.md` (~143-149), `ROADMAP.md` (107), `apps/web/package.json` (line 5)
- Commit: all modified/untracked files

**Interfaces:**
- Consumes: current working tree (green as a whole).
- Produces: clean git tree on `dev-back` with 3 thematic commits; no LICENSE anywhere.

- [ ] **Step 1: Confirm the baseline is green**

```bash
make check
```
Expected: ruff clean, `tsc -b --noEmit` clean, `93 passed`.

- [ ] **Step 2: Remove the license and every reference**

Delete `LICENSE`. Then apply these exact edits:
- `README.md`: in `## Business model & license`, rename to `## Business model`, and delete the two lines starting `Licensed **AGPL-3.0** ...`.
- `CONTRIBUTING.md`: delete the whole `## License of contributions` paragraph (lines 6-12); keep `## Workflow`.
- `docs/BUSINESS_MODEL.md`: replace the `- [ ] **License:** ...` bullet with:
  `- [x] **License:** none — all rights reserved (decided 2026-10-04; no LICENSE file, no reuse granted).`
- `ROADMAP.md` line 107: change acceptance cell to `` `docker compose up` from a clean clone; no LICENSE by team decision (all rights reserved) ``.
- `apps/web/package.json`: delete the `"license": "AGPL-3.0-only",` line (`"private": true` already present).

Verify no references remain:

```bash
grep -rn "AGPL\|LICENSE" --include="*.md" --include="*.json" --include="*.py" --include="*.toml" . | grep -v node_modules | grep -v .venv
```
Expected: no output (or only unrelated prose — fix any it finds).

- [ ] **Step 3: Commit 1 — backend**

```bash
git add apps/api data scripts .env.example
git commit -m "feat(api): add factor-betas engine, market paths, and the AI Risk Committee"
cd apps/api && .venv/bin/ruff check . && PYTHONDONTWRITEBYTECODE=1 .venv/bin/pytest -q
```
Expected: ruff clean, `93 passed`.

- [ ] **Step 4: Commit 2 — frontend**

```bash
git add apps/web
git commit -m "feat(web): add market paths, editable weights, AI explanation, and committee panel"
cd apps/web && npm run lint && npm run typecheck && npm run build
```
Expected: all clean.

- [ ] **Step 5: Commit 3 — docs and cleanup**

```bash
git add -A
git commit -m "docs: hackathon-day documentation; drop AGPL license by decision"
git status --short
```
Expected: `git status` empty. Confirm `.env` was not committed: `git ls-files | grep -c "^\.env$"` → `0`.

---

## Task 2: Retry transient OpenRouter failures; stop leaking raw errors

**Files:**
- Modify: `apps/api/app/integrations/ai/openrouter.py` (lines ~152-204)
- Test: `apps/api/tests/test_ai_providers.py`

**Interfaces:**
- Consumes: `_friendly_status_error`, `_CODE_FENCE_RE`, `_REQUEST_TIMEOUT_SECONDS` (already in the module).
- Produces: `_post_with_retries(settings: Settings, headers: dict, body: dict) -> httpx.Response`; `complete_json(settings, prompt, *, model=None, max_tokens=600, temperature=0.2, reasoning_effort=None) -> dict` keeps its signature.

- [ ] **Step 1: Write the failing tests** (append to `test_ai_providers.py`)

```python
import httpx


def _status_response(status: int) -> MagicMock:
    response = MagicMock(status_code=status)
    response.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError(
            str(status),
            request=httpx.Request("POST", "https://openrouter.ai"),
            response=response,
        )
    )
    return response


def test_openrouter_retries_429_then_succeeds():
    provider = OpenRouterScenarioProvider(Settings(openrouter_api_key="test-key"))
    body = json.dumps({"NVDA": -0.2})
    with patch("httpx.post", side_effect=[_status_response(429), _openrouter_response(body)]) as mock_post, \
         patch("app.integrations.ai.openrouter.time.sleep") as mock_sleep:
        scenario = provider.parse_scenario("What if chips fall 20%?")
    assert scenario.asset_shocks == {"NVDA": -0.2}
    assert mock_post.call_count == 2
    mock_sleep.assert_called_once_with(0.5)


def test_openrouter_gives_up_after_retries_with_friendly_message():
    provider = OpenRouterScenarioProvider(Settings(openrouter_api_key="test-key"))
    with patch("httpx.post", side_effect=[_status_response(429)] * 3) as mock_post, \
         patch("app.integrations.ai.openrouter.time.sleep"):
        with pytest.raises(AIProviderUnavailableError, match="rate limit"):
            provider.parse_scenario("What if chips fall 20%?")
    assert mock_post.call_count == 3


def test_openrouter_does_not_retry_401():
    provider = OpenRouterScenarioProvider(Settings(openrouter_api_key="test-key"))
    with patch("httpx.post", side_effect=[_status_response(401)]) as mock_post:
        with pytest.raises(AIProviderUnavailableError, match="rejected the API key"):
            provider.parse_scenario("What if chips fall 20%?")
    assert mock_post.call_count == 1


def test_openrouter_timeout_is_friendly_and_not_retried():
    provider = OpenRouterScenarioProvider(Settings(openrouter_api_key="test-key"))
    with patch("httpx.post", side_effect=httpx.TimeoutException("slow")) as mock_post:
        with pytest.raises(AIProviderUnavailableError, match="timed out"):
            provider.parse_scenario("What if chips fall 20%?")
    assert mock_post.call_count == 1


def test_openrouter_malformed_json_is_friendly():
    provider = OpenRouterScenarioProvider(Settings(openrouter_api_key="test-key"))
    with patch("httpx.post", return_value=_openrouter_response("not json at all")):
        with pytest.raises(AIProviderUnavailableError, match="couldn't parse"):
            provider.parse_scenario("What if chips fall 20%?")


def test_openrouter_unexpected_shape_is_friendly():
    provider = OpenRouterScenarioProvider(Settings(openrouter_api_key="test-key"))
    bad = MagicMock(status_code=200, raise_for_status=lambda: None, json=lambda: {"nope": 1})
    with patch("httpx.post", return_value=bad):
        with pytest.raises(AIProviderUnavailableError, match="unexpected response"):
            provider.parse_scenario("What if chips fall 20%?")
```

- [ ] **Step 2: Run to verify failures**

Run: `cd apps/api && .venv/bin/pytest tests/test_ai_providers.py -q`
Expected: failures on retry/parse/timeout tests (current code retries nothing and wraps raw exceptions).

- [ ] **Step 3: Implement**

Add near the top of `openrouter.py` (after imports): `import logging`, `import time`; then `logger = logging.getLogger(__name__)`, and:

```python
_RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})
_RETRY_DELAYS_SECONDS = (0.5, 1.5)  # 3 attempts total; 429/5xx fail fast


def _post_with_retries(settings: Settings, headers: dict, body: dict) -> httpx.Response:
    """POST to OpenRouter, retrying only fast transient failures (429/5xx).
    Timeouts are deliberately not retried — a retry would double a 45 s
    wait; the caller shows a friendly 'try again' message instead."""
    for attempt in range(len(_RETRY_DELAYS_SECONDS) + 1):
        try:
            response = httpx.post(
                _API_URL,
                headers=headers,
                json=body,
                timeout=_REQUEST_TIMEOUT_SECONDS,
                proxy=settings.https_proxy or None,
            )
        except httpx.TimeoutException as exc:
            logger.warning("OpenRouter timed out: %s", exc)
            raise AIProviderUnavailableError(
                f"OpenRouter timed out after {_REQUEST_TIMEOUT_SECONDS:.0f} seconds — "
                "the model may be slow right now. Try again."
            ) from exc
        except httpx.HTTPError as exc:
            logger.warning("OpenRouter connection error: %s", exc)
            raise AIProviderUnavailableError(
                "Could not reach OpenRouter — check your connection (or HTTPS_PROXY) "
                "and try again."
            ) from exc
        if response.status_code in _RETRYABLE_STATUS and attempt < len(_RETRY_DELAYS_SECONDS):
            time.sleep(_RETRY_DELAYS_SECONDS[attempt])
            continue
        return response
    raise AssertionError("unreachable")  # pragma: no cover
```

Replace the body of `complete_json` from `try: response = httpx.post(...)` through the final `return data` with:

```python
    response = _post_with_retries(settings, headers, body)
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise AIProviderUnavailableError(_friendly_status_error(exc.response.status_code)) from exc
    try:
        raw_text = response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        logger.warning("Unexpected OpenRouter response shape: %s", exc)
        raise AIProviderUnavailableError(
            "OpenRouter returned an unexpected response. Try again."
        ) from exc
    try:
        data = json.loads(_CODE_FENCE_RE.sub("", raw_text.strip()).strip())
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("OpenRouter returned non-JSON content: %.200s", raw_text)
        raise AIProviderUnavailableError(
            "OpenRouter returned a response we couldn't parse as JSON. Try again."
        ) from exc
    if not isinstance(data, dict):
        raise AIProviderUnavailableError("OpenRouter did not return a JSON object.")
    return data
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && .venv/bin/pytest tests/test_ai_providers.py tests/test_committee.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/integrations/ai/openrouter.py apps/api/tests/test_ai_providers.py
git commit -m "fix(ai): retry transient OpenRouter failures and stop leaking raw errors"
```

---

## Task 3: Validate client-supplied views; cap prompt inputs

**Files:**
- Modify: `apps/api/app/schemas/committee.py`, `apps/api/app/integrations/ai/committee.py`, `apps/api/app/api/routes/committee.py`
- Test: `apps/api/tests/test_committee.py`

**Interfaces:**
- Consumes: `clean_shocks`, `clean_rationale` (openrouter), `_MAX_TEXT_CHARS`.
- Produces: `sanitize_views(views: list[AnalystView]) -> list[AnalystView]`; `_coerce_confidence(raw: object) -> str`; schema caps `scenario_title ≤ 200`, `scenario_description ≤ 4000`, `transmission ≤ 10 × 500 chars`, `horizon ≤ 40`, `views 1..3`.

- [ ] **Step 1: Write the failing tests**

```python
def test_sanitize_views_drops_unknown_seats_dupes_and_bad_shocks():
    from app.integrations.ai.committee import sanitize_views

    views = [
        {"seat": "macro", "label": "M", "model": "m1", "asset_shocks": {"NVDA": -0.2, "ZZZ": 9, "SPY": -5}},
        {"seat": "macro", "label": "M", "model": "m1", "asset_shocks": {"NVDA": -0.1}},   # dupe
        {"seat": "chair", "label": "C", "model": "m2", "asset_shocks": {"NVDA": -0.1}},    # bad seat
        {"seat": "sector", "label": "S", "model": "m3", "asset_shocks": {"XTRA": -0.2}},   # no usable
    ]
    cleaned = sanitize_views([AnalystView.model_validate(v) for v in views])
    assert [v.seat for v in cleaned] == ["macro"]
    assert cleaned[0].asset_shocks == {"NVDA": -0.2}  # ZZZ dropped, SPY -500% clamped away


def test_verdict_rejects_views_with_no_usable_shocks(client):
    request = {
        "scenario_title": "X",
        "portfolio": _portfolio().model_dump(),
        "views": [{"seat": "macro", "label": "M", "model": "m", "asset_shocks": {"ZZZ": 1}}],
    }
    response = client.post("/api/ai/committee/verdict", json=request)
    assert response.status_code == 422


def test_verdict_context_rejects_oversized_prompt_inputs(client):
    base = {"scenario_title": "X", "portfolio": _portfolio().model_dump(),
            "views": [{"seat": "macro", "label": "M", "model": "m", "asset_shocks": {"NVDA": -0.2}}]}
    assert client.post("/api/ai/committee/verdict", json={**base, "scenario_description": "x" * 4001}).status_code == 422
    assert client.post("/api/ai/committee/verdict", json={**base, "transmission": ["s"] * 11}).status_code == 422
```

- [ ] **Step 2: Run to verify failures**

Run: `cd apps/api && .venv/bin/pytest tests/test_committee.py -q`
Expected: `sanitize_views` import error; oversized requests pass (200/patched error path) instead of 422.

- [ ] **Step 3: Implement**

`schemas/committee.py`: add `Annotated, StringConstraints` imports and caps; change `CommitteeContext`:

```python
TransmissionStep = Annotated[str, StringConstraints(max_length=500)]


class CommitteeContext(BaseModel):
    scenario_title: str = Field(max_length=200)
    scenario_description: str = Field(default="", max_length=4000)
    horizon: str = Field(default="30d", max_length=40)
    transmission: list[TransmissionStep] = Field(default=[], max_length=10)
    portfolio: Portfolio


class VerdictRequest(CommitteeContext):
    views: list[AnalystView] = Field(min_length=1, max_length=3)
```

`integrations/ai/committee.py`: add `_coerce_confidence` and `sanitize_views`, and refactor `run_analyst`/`run_chair` to call `_coerce_confidence` instead of duplicating the enum check:

```python
_ALLOWED_SEATS = ("macro", "sector", "cross_asset")


def _coerce_confidence(raw: object) -> str:
    confidence = str(raw or "medium").strip().lower()
    return confidence if confidence in ("low", "medium", "high") else "medium"


def sanitize_views(views: list[AnalystView]) -> list[AnalystView]:
    """Apply the same guard rails to client-supplied views that we apply to
    model output: known seats only, no duplicates, supported symbols, shocks
    clamped to -95%..+200%, rationale only for kept symbols, texts capped."""
    cleaned: list[AnalystView] = []
    seen: set[str] = set()
    for view in views:
        if view.seat not in _ALLOWED_SEATS or view.seat in seen:
            logger.warning("Dropping committee view with seat %r", view.seat)
            continue
        shocks = clean_shocks(view.asset_shocks)
        if not shocks:
            logger.warning("Dropping committee view %r with no usable shocks", view.seat)
            continue
        seen.add(view.seat)
        cleaned.append(
            view.model_copy(
                update={
                    "asset_shocks": shocks,
                    "rationale": clean_rationale(view.rationale, shocks),
                    "thesis": view.thesis[:_MAX_TEXT_CHARS],
                    "key_risk": view.key_risk[:_MAX_TEXT_CHARS],
                    "confidence": _coerce_confidence(view.confidence),
                }
            )
        )
    return cleaned
```

`api/routes/committee.py`, at the top of `committee_verdict` before calling the chair:

```python
    views = sanitize_views(request.views)
    if not views:
        raise HTTPException(status_code=422, detail="No usable analyst views in the request.")
    request = request.model_copy(update={"views": views})
```
(Add `sanitize_views` to the existing import from `app.integrations.ai.committee`.)

- [ ] **Step 4: Run tests**

Run: `cd apps/api && .venv/bin/pytest tests/test_committee.py -q`
Expected: PASS (existing tests included).

- [ ] **Step 5: Update `docs/API_CONTRACT.md`** (verdict section ~341): note `views` is capped at 3 unique seats, shocks are filtered to the 6 symbols and clamped to −95%…+200%, garbage views are dropped, and a request whose views are all unusable returns `422`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/schemas/committee.py apps/api/app/integrations/ai/committee.py apps/api/app/api/routes/committee.py apps/api/tests/test_committee.py docs/API_CONTRACT.md
git commit -m "fix(committee): validate client-supplied views and cap prompt inputs"
```

---

## Task 4: Live Polymarket context for committee runs (`market_id`)

**Files:**
- Modify: `apps/api/app/schemas/market.py`, `apps/api/app/services/market_service.py`, `apps/api/app/schemas/committee.py`, `apps/api/app/integrations/ai/committee.py`, `apps/api/app/api/routes/committee.py`, `apps/web/src/types/market.ts`, `apps/web/src/types/committee.ts`
- Test: `apps/api/tests/test_market_service.py`, `apps/api/tests/test_committee.py`, `docs/API_CONTRACT.md`

**Interfaces:**
- Consumes: `MarketSummary` (schemas/market.py), `get_market_service()` (services/market_service.py), `_context_block` (committee.py).
- Produces:
  - `MarketContextSignal` schema (schemas/market.py): `market_id: str, label: str, question: str, probability: float | None, change_7d_pp: float | None, change_30d_pp: float | None, repriced: bool, source_status: MarketDataStatus, source_url: str | None, as_of: str | None`.
  - `MarketService.get_context_signal(market_id: str | None) -> MarketContextSignal | None`.
  - `CommitteeContext.market_id: str | None = None`; `AnalystView.market_context: MarketContextSignal | None = None`; `CommitteeVerdict.market_context: MarketContextSignal | None = None`.
  - `run_analyst(..., market_signal: MarketContextSignal | None = None)` and `run_chair(..., market_signal: MarketContextSignal | None = None)`.

- [ ] **Step 1: Write the failing tests**

In `test_market_service.py`:

```python
def test_context_signal_none_without_market_id():
    assert MarketService(Settings()).get_context_signal(None) is None


def test_context_signal_shapes_a_cached_snapshot(tmp_path):
    (tmp_path / "markets_snapshot.json").write_text(json.dumps({
        "saved_at": datetime.now(UTC).isoformat(),
        "markets": [{
            "market_id": "567621", "token_id": "t", "label": "China invades Taiwan (2026)",
            "question": "Will China invade Taiwan by end of 2026?",
            "slug": "will-china-invade-taiwan-before-2027", "probability": 0.0225,
            "change_7d_pp": -0.4, "change_30d_pp": -1.2, "repriced": False,
        }],
    }))
    signal = MarketService(Settings(enable_polymarket=False, cache_dir=tmp_path)).get_context_signal("567621")
    assert signal.probability == 0.0225
    assert signal.source_status == "cached"
    assert signal.source_url.endswith("will-china-invade-taiwan-before-2027")
```

In `test_committee.py`:

```python
def test_analyst_prompt_includes_live_market_signal():
    from app.integrations.ai.committee import run_analyst
    from app.schemas.market import MarketContextSignal

    signal = MarketContextSignal(
        market_id="567621", label="China invades Taiwan (2026)",
        question="Will China invade Taiwan by end of 2026?", probability=0.0225,
        change_7d_pp=-0.4, change_30d_pp=-1.2, source_status="live",
        as_of="2026-10-04T00:00:00+00:00",
    )
    with patch(
        "app.integrations.ai.committee.complete_json", return_value=json.loads(_analyst_body())
    ) as mock_complete:
        view = run_analyst("macro", _context(), _settings(), market_signal=signal)

    prompt = mock_complete.call_args.args[1]
    assert "Polymarket" in prompt and "2.2%" in prompt
    assert view.market_context is signal


def test_analyst_without_market_signal_has_no_context():
    from app.integrations.ai.committee import run_analyst

    with patch("app.integrations.ai.committee.complete_json", return_value=json.loads(_analyst_body())):
        view = run_analyst("macro", _context(), _settings())
    assert view.market_context is None
```

- [ ] **Step 2: Run to verify failures**

Run: `cd apps/api && .venv/bin/pytest tests/test_market_service.py tests/test_committee.py -q`
Expected: `get_context_signal` / `market_signal` do-not-exist failures.

- [ ] **Step 3: Implement**

`schemas/market.py` — add:

```python
class MarketContextSignal(BaseModel):
    """A live Polymarket signal attached to a committee run: the tracked
    market's current implied probability and recent move, with provenance.
    The LLM may reference it; this probability is market data, never an
    LLM estimate."""

    market_id: str
    label: str
    question: str
    probability: float | None = None
    change_7d_pp: float | None = None
    change_30d_pp: float | None = None
    repriced: bool = False
    source_status: MarketDataStatus = "illustrative"
    source_url: str | None = None
    as_of: str | None = None
```

`services/market_service.py` — add method after `get_market_history`:

```python
    def get_context_signal(self, market_id: str | None) -> MarketContextSignal | None:
        """The live probability signal for one tracked market, shaped for the
        committee prompts/responses. Returns None when no market_id was asked
        for, the id isn't tracked, there is no probability yet, or upstream is
        unreachable — never fabricates."""
        if not market_id:
            return None
        try:
            for summary in self.get_tracked_markets():
                if str(summary.market_id) != str(market_id) or summary.probability is None:
                    continue
                return MarketContextSignal(
                    market_id=summary.market_id,
                    label=summary.label,
                    question=summary.question,
                    probability=summary.probability,
                    change_7d_pp=summary.change_7d_pp,
                    change_30d_pp=summary.change_30d_pp,
                    repriced=summary.repriced,
                    source_status=summary.source_status,
                    source_url=(
                        f"https://polymarket.com/event/{summary.slug}" if summary.slug else None
                    ),
                    as_of=summary.as_of,
                )
        except Exception as exc:
            logger.warning("Committee market context unavailable: %s", exc)
        return None
```
(Import `MarketContextSignal` in the existing `app.schemas.market` import.)

`schemas/committee.py` — import `MarketContextSignal` from `app.schemas.market`; add `market_id: str | None = None` to `CommitteeContext`; add `market_context: MarketContextSignal | None = None` to `AnalystView` and `CommitteeVerdict`.

`integrations/ai/committee.py`:
- Import `MarketContextSignal`.
- `_context_block(context, market_signal=None)` appends, before returning:

```python
    if market_signal is not None:
        change = (
            f"{market_signal.change_7d_pp:+.1f} pp over 7d"
            if market_signal.change_7d_pp is not None
            else "no 7d history"
        )
        change_30d = (
            f", {market_signal.change_30d_pp:+.1f} pp over 30d"
            if market_signal.change_30d_pp is not None
            else ""
        )
        block += (
            f"\n\nLive prediction-market signal (Polymarket, {market_signal.source_status}): "
            f"\"{market_signal.question}\" — market-implied probability "
            f"{market_signal.probability:.1%} ({change}{change_30d}, as of "
            f"{market_signal.as_of or 'unknown'}). This is a market-implied probability, "
            "not a forecast; use it as context only."
        )
    return block
```
- `run_analyst(seat_key, context, settings, market_signal=None)`: pass `market_signal` to `_context_block`; set `market_context=market_signal` on `AnalystView`.
- `run_chair(request, settings, market_signal=None)`: same; set `market_context=market_signal` on `chair_view`.

`api/routes/committee.py`:
- Import `get_market_service`; in `committee_analyst`: `market_signal = get_market_service().get_context_signal(request.market_id)` then pass `market_signal=market_signal` to `run_analyst`.
- In `committee_verdict`: fetch once the same way; pass to `run_chair`; set `market_context=chair_view.market_context` on `CommitteeVerdict`.

`apps/web/src/types/market.ts`: add `MarketContextSignal` (mirror above, `source_status` matches the file's existing market status type). `apps/web/src/types/committee.ts`: import it; add `market_id?: string | null` to `CommitteeContextRequest`, `market_context: MarketContextSignal | null` to `AnalystView` and `CommitteeVerdict`.

- [ ] **Step 4: Run tests + typecheck**

Run: `cd apps/api && .venv/bin/pytest tests/test_market_service.py tests/test_committee.py -q && cd ../.. && make typecheck`
Expected: PASS + clean.

- [ ] **Step 5: Update `docs/API_CONTRACT.md`** committee section: document `market_id` on requests and `market_context` on responses (including `source_status: live|cached`); note the signal is omitted silently when unavailable so the committee works offline.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/schemas/market.py apps/api/app/services/market_service.py apps/api/app/schemas/committee.py apps/api/app/integrations/ai/committee.py apps/api/app/api/routes/committee.py apps/api/tests/test_market_service.py apps/api/tests/test_committee.py apps/web/src/types/market.ts apps/web/src/types/committee.ts docs/API_CONTRACT.md
git commit -m "feat(committee): attach the live Polymarket probability to analyst runs"
```

---

## Task 5: Opt-in debate round (analysts revise, chair reconciles)

**Files:**
- Modify: `apps/api/app/schemas/committee.py`, `apps/api/app/integrations/ai/committee.py`, `apps/api/app/api/routes/committee.py`, `apps/web/src/types/committee.ts`
- Test: `apps/api/tests/test_committee.py`, `docs/API_CONTRACT.md`

**Interfaces:**
- Consumes: `run_analyst` output (`AnalystView`), `_seat_specs`, `_complete`, `clean_shocks`, `clean_rationale`, `_impact`, `_shock_ranges`.
- Produces:
  - `RevisionView` schema: `seat, label, model, asset_shocks, rationale={}, change="" , confidence="medium", revised=True`.
  - `VerdictRequest.debate: bool = False`; `CommitteeVerdict.revisions: list[RevisionView] = []`, `revision_impacts: list[ViewImpact] = []`.
  - `run_debate(views, context, settings, market_signal=None) -> list[RevisionView]` (parallel; per-seat fallback).
  - `run_chair(request, settings, *, revisions=None, market_signal=None)`.

- [ ] **Step 1: Write the failing tests**

```python
def _prompt_aware_complete(settings, prompt, **kwargs):
    if "first-round view" in prompt:  # rebuttal prompt
        return {
            "asset_shocks": {"NVDA": -0.28, "QQQ": -0.11},
            "rationale": {"NVDA": "Peer argument on supply."},
            "change": "Lowered NVDA after the peer case.",
            "confidence": "high",
        }
    return json.loads(_chair_body())  # chair


def test_verdict_debate_returns_revisions_and_impacts(client):
    request = {
        "scenario_title": "Semiconductor supply shock",
        "portfolio": _portfolio().model_dump(),
        "views": [
            {"seat": "macro", "label": "Macro", "model": "m1", "asset_shocks": {"NVDA": -0.15, "QQQ": -0.08}},
            {"seat": "sector", "label": "Sector", "model": "m2", "asset_shocks": {"NVDA": -0.35, "QQQ": -0.12}},
        ],
        "debate": True,
    }
    with patch("app.integrations.ai.committee.complete_json", side_effect=_prompt_aware_complete):
        body = client.post("/api/ai/committee/verdict", json=request).json()

    verdict = body["verdict"]
    assert verdict is not None
    assert len(verdict["revisions"]) == 2 and all(r["revised"] for r in verdict["revisions"])
    assert len(verdict["revision_impacts"]) == 2
    assert len(verdict["view_impacts"]) == 2
    assert verdict["revisions"][0]["asset_shocks"] == {"NVDA": -0.28, "QQQ": -0.11}
    assert verdict["shock_ranges"]["NVDA"] == {"min": -0.28, "max": -0.28}  # final positions


def test_debate_falls_back_when_rebuttal_fails(client):
    def flaky(settings, prompt, **kwargs):
        if "first-round view" in prompt:
            raise AIProviderUnavailableError("provider down")
        return json.loads(_chair_body())

    request = {  # same context as above
        "scenario_title": "X", "portfolio": _portfolio().model_dump(),
        "views": [
            {"seat": "macro", "label": "M", "model": "m1", "asset_shocks": {"NVDA": -0.15}},
            {"seat": "sector", "label": "S", "model": "m2", "asset_shocks": {"NVDA": -0.35}},
        ],
        "debate": True,
    }
    with patch("app.integrations.ai.committee.complete_json", side_effect=flaky):
        verdict = client.post("/api/ai/committee/verdict", json=request).json()["verdict"]
    assert [r["revised"] for r in verdict["revisions"]] == [False, False]
    assert verdict["view_impacts"]  # original views still drive the numbers


def test_verdict_without_debate_has_no_revisions(client):
    request = {
        "scenario_title": "X", "portfolio": _portfolio().model_dump(),
        "views": [{"seat": "macro", "label": "M", "model": "m1", "asset_shocks": {"NVDA": -0.15}}],
    }
    with patch("app.integrations.ai.committee.complete_json", return_value=json.loads(_chair_body())):
        verdict = client.post("/api/ai/committee/verdict", json=request).json()["verdict"]
    assert verdict["revisions"] == [] and verdict["revision_impacts"] == []
```

- [ ] **Step 2: Run to verify failures**

Run: `cd apps/api && .venv/bin/pytest tests/test_committee.py -q`
Expected: failures (no `debate` field; no revisions in verdict).

- [ ] **Step 3: Implement**

`schemas/committee.py`:

```python
class RevisionView(BaseModel):
    """One analyst's second-round view. revised=False means the rebuttal
    call failed and the first-round view stands unchanged."""

    seat: str
    label: str
    model: str
    asset_shocks: dict[str, float]
    rationale: dict[str, str] = {}
    change: str = ""
    confidence: Confidence = "medium"
    revised: bool = True
```
Add to `VerdictRequest`: `debate: bool = False`. Add to `CommitteeVerdict`: `revisions: list[RevisionView] = []` and `revision_impacts: list[ViewImpact] = []`.

`integrations/ai/committee.py` — add `from concurrent.futures import ThreadPoolExecutor`, then:

```python
_REBUTTAL_PROMPT = """You are the {label} on a portfolio risk committee. Your lens: {lens}.

{context}

Your own first-round view:
{own_view}

Two other analysts — whose identities and models you do NOT know — reviewed the same scenario independently:
{peers}

Reconsider your first-round assumptions. Keep them if you still believe them, or revise them if the peers surfaced something you missed. Do not average: stay in your lens. Describe risk only — never recommend buying, selling or hedging.

Respond with ONLY a JSON object, no markdown:
{{
  "asset_shocks": {{"NVDA": -0.22, ...}},
  "rationale": {{"NVDA": "one short sentence", ...}},
  "change": "one sentence: what you changed and why, or 'unchanged'",
  "confidence": "low | medium | high"
}}
asset_shocks: signed decimal price move over the horizon, one per asset, 0 if unaffected."""


def _payload(view: AnalystView) -> dict:
    return {
        "seat": view.seat, "label": view.label, "model": view.model,
        "asset_shocks": view.asset_shocks, "rationale": view.rationale,
        "thesis": view.thesis, "key_risk": view.key_risk, "confidence": view.confidence,
    }


def _anonymized(view: AnalystView) -> dict:
    return {
        "asset_shocks": view.asset_shocks, "rationale": view.rationale,
        "thesis": view.thesis, "key_risk": view.key_risk,
    }


def _fallback_revision(view: AnalystView) -> RevisionView:
    return RevisionView(
        seat=view.seat, label=view.label, model=view.model,
        asset_shocks=view.asset_shocks, rationale=view.rationale,
        change="", confidence=view.confidence, revised=False,
    )


def run_debate(
    views: list[AnalystView],
    context: CommitteeContext,
    settings: Settings,
    market_signal: MarketContextSignal | None = None,
) -> list[RevisionView]:
    """One rebuttal round, in parallel. A seat whose rebuttal call fails
    keeps its first-round view — the debate degrades, it never fails the
    committee. Fewer than two views means there is nothing to debate."""
    if len(views) < 2:
        return []
    context_text = _context_block(context, market_signal)
    specs = {spec["seat"]: spec for spec in _seat_specs(settings)}

    def revise(view: AnalystView) -> RevisionView:
        spec = specs[view.seat]
        peers = [_anonymized(other) for other in views if other.seat != view.seat]
        prompt = _REBUTTAL_PROMPT.format(
            label=spec["label"], lens=spec["lens"], context=context_text,
            own_view=json.dumps(_payload(view), indent=2), peers=json.dumps(peers, indent=2),
        )
        try:
            data = _complete(settings, spec["model"], prompt)
        except AIProviderUnavailableError as exc:
            logger.warning("Rebuttal for %s failed: %s", view.seat, exc)
            return _fallback_revision(view)
        shocks = clean_shocks(data.get("asset_shocks"))
        if not shocks:
            return _fallback_revision(view)
        return RevisionView(
            seat=view.seat, label=view.label, model=view.model,
            asset_shocks=shocks,
            rationale=clean_rationale(data.get("rationale"), shocks),
            change=str(data.get("change") or "").strip()[:_MAX_TEXT_CHARS],
            confidence=_coerce_confidence(data.get("confidence")),
            revised=True,
        )

    with ThreadPoolExecutor(max_workers=len(views)) as pool:
        return list(pool.map(revise, views))
```

Change `run_chair` to `def run_chair(request, settings, *, revisions=None, market_signal=None)` and build the views JSON as:

```python
    revisions = revisions or []
    views_json = json.dumps(
        [
            {
                **_payload(view),
                "revision": next(
                    (
                        {
                            "asset_shocks": r.asset_shocks,
                            "rationale": r.rationale,
                            "change": r.change,
                            "revised": r.revised,
                        }
                        for r in revisions
                        if r.seat == view.seat
                    ),
                    None,
                ),
            }
            for view in request.views
        ],
        indent=2,
    )
```
and pass `market_signal` into `_context_block`. Add one sentence to `_CHAIR_PROMPT` after the first paragraph: `Some analysts may also show a "revision": their second-round view after seeing anonymized peers. Weigh the revision where present, but keep the stronger argument if it is the first-round one.`

`api/routes/committee.py` — in `committee_verdict`, after sanitizing:

```python
    market_signal = get_market_service().get_context_signal(request.market_id)
    try:
        revisions = run_debate(request.views, request, settings, market_signal=market_signal) if request.debate else []
        final_by_seat = {r.seat: r for r in revisions if r.revised}
        final_views = [
            view.model_copy(
                update={
                    "asset_shocks": final_by_seat[view.seat].asset_shocks,
                    "rationale": final_by_seat[view.seat].rationale,
                    "confidence": final_by_seat[view.seat].confidence,
                }
            )
            if view.seat in final_by_seat
            else view
            for view in request.views
        ]
        chair_view, chair_raw = run_chair(
            request, settings, revisions=revisions or None, market_signal=market_signal
        )
    except AIProviderUnavailableError as exc:
        return VerdictResponse(verdict=None, message=str(exc))
```
Then compute `view_impacts` **from `final_views`**, add `revision_impacts` from `revisions` (each with its own `seat/label/model/asset_shocks`), pass `shock_ranges=_shock_ranges(final_views)`, and construct `CommitteeVerdict(..., revisions=revisions, revision_impacts=revision_impacts, market_context=chair_view.market_context, ...)`.

`apps/web/src/types/committee.ts`: add `RevisionView`, `revisions: RevisionView[]`, `revision_impacts: ViewImpact[]` to `CommitteeVerdict`, `debate?: boolean` to `VerdictRequest`.

- [ ] **Step 4: Run tests + typecheck**

Run: `cd apps/api && .venv/bin/pytest tests/test_committee.py -q && cd ../.. && make typecheck`
Expected: PASS + clean.

- [ ] **Step 5: Update `docs/API_CONTRACT.md`**: `debate` on the verdict request; `revisions`/`revision_impacts` on the response; explain `view_impacts`/`shock_ranges` now reflect final (post-debate) positions; note rebuttals run in parallel and failures keep first-round views.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/schemas/committee.py apps/api/app/integrations/ai/committee.py apps/api/app/api/routes/committee.py apps/api/tests/test_committee.py apps/web/src/types/committee.ts docs/API_CONTRACT.md
git commit -m "feat(committee): add an opt-in rebuttal round before the chair"
```

---

## Task 6: Fix the live Polymarket paths (ordering, proxy, ambiguity, atomic cache)

**Files:**
- Modify: `apps/api/app/integrations/risk_sources/polymarket.py`, `apps/api/app/services/risk_radar_service.py`, `apps/api/app/services/market_service.py`
- Test: `apps/api/tests/test_polymarket_source.py`, `apps/api/tests/test_market_service.py`

**Interfaces:**
- Consumes: `Settings.https_proxy`, `Settings.enable_polymarket`, `Settings.demo_mode`.
- Produces: `PolymarketRiskSource(settings: Settings | None = None)`; Gamma requests with `order=volume24hr&ascending=false&limit=100`; explicit-Yes-only probability extraction; proxy on all market fetches; atomic `_write_cache`.

- [ ] **Step 1: Write the failing tests**

```python
def test_fetch_uses_volume_ordering_and_proxy():
    settings = Settings(enable_polymarket=True, https_proxy="http://proxy:8888")
    source = PolymarketRiskSource(settings)
    with patch("httpx.get", return_value=_mock_response([])) as mock_get:
        source.get_risk_signals()
    params = mock_get.call_args.kwargs["params"]
    assert params["order"] == "volume24hr"
    assert params["ascending"] == "false"
    assert params["limit"] == 100
    assert mock_get.call_args.kwargs["proxy"] == "http://proxy:8888"


def test_multi_outcome_market_without_an_explicit_yes_is_skipped():
    market = _market("Will oil spike this quarter?")
    market["outcomes"] = json.dumps(["High", "Low"])
    market["outcomePrices"] = json.dumps(["0.7", "0.3"])
    with patch("httpx.get", return_value=_mock_response([market])):
        assert PolymarketRiskSource().get_risk_signals() == []
```

Add to `test_market_service.py`:

```python
def test_market_fetch_uses_proxy(tmp_path):
    settings = Settings(enable_polymarket=True, demo_mode=False, cache_dir=tmp_path,
                        https_proxy="http://proxy:8888")
    gamma = MagicMock()
    gamma.raise_for_status = lambda: None
    gamma.json = lambda: [{"question": "Q", "outcomes": '["Yes","No"]', "outcomePrices": '["0.5","0.5"]'}]
    clob = MagicMock()
    clob.raise_for_status = lambda: None
    clob.json = lambda: {"history": [{"t": 1, "p": 0.5}, {"t": 2, "p": 0.5}]}
    with patch("httpx.get", side_effect=[gamma, clob]) as mock_get:
        MarketService(settings).get_tracked_markets()
    assert all(call.kwargs["proxy"] == "http://proxy:8888" for call in mock_get.call_args_list)
```

- [ ] **Step 2: Run to verify failures**

Run: `cd apps/api && .venv/bin/pytest tests/test_polymarket_source.py tests/test_market_service.py -q`
Expected: failures (no `order` param, fallback returns 0.7, no proxy kwargs).

- [ ] **Step 3: Implement**

`polymarket.py`:
- `MARKET_FETCH_LIMIT = 100`.
- Import `Settings, get_settings`; add constructor:

```python
    def __init__(self, settings: Settings | None = None):
        self._settings = settings or get_settings()
```
- `_fetch_markets` params become:

```python
                params={
                    "active": "true",
                    "closed": "false",
                    "limit": MARKET_FETCH_LIMIT,
                    "order": "volume24hr",
                    "ascending": "false",
                },
                timeout=REQUEST_TIMEOUT_SECONDS,
                proxy=self._settings.https_proxy or None,
```
- In `_extract_yes_probability`, delete the fallback block after the loop and `return None` instead (only an explicit "Yes" outcome is a probability we can attribute to the question).
- Update the module docstring's "NOTE ON VERIFICATION" to state live-verified 2026-10-04 with the volume-ordering rationale.

`risk_radar_service.py:120` → `sources.append(PolymarketRiskSource(settings))`.

`market_service.py`:
- `_fetch_gamma_market` and `_fetch_points`: add `proxy=self._settings.https_proxy or None` to `httpx.get`.
- `_write_cache`: write to a sibling temp file, then `tmp_path.replace(path)`:

```python
    def _write_cache(self, name: str, payload: dict[str, Any]) -> None:
        path = self._cache_path(name)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = path.with_name(f".{path.name}.tmp")
            tmp_path.write_text(json.dumps(payload, indent=2))
            tmp_path.replace(path)
        except OSError as exc:
            logger.warning("Could not write cache file %s: %s", path, exc)
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && .venv/bin/pytest tests/test_polymarket_source.py tests/test_market_service.py tests/test_risk_radar_service.py -q`
Expected: PASS. Note: if Gamma rejects `limit=100`, keep 50 (verified working) — the live smoke still asserts ≥1 signal either way.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/integrations/risk_sources/polymarket.py apps/api/app/services/risk_radar_service.py apps/api/app/services/market_service.py apps/api/tests/test_polymarket_source.py apps/api/tests/test_market_service.py
git commit -m "fix(polymarket): find live markets by volume and honor the proxy"
```

---

## Task 7: Repeatable live smoke script (`make smoke-live`)

**Files:**
- Create: `scripts/live_smoke.py`
- Modify: `Makefile`

**Interfaces:**
- Consumes: `/api/ai/committee{,/analyst,/verdict}`, `/api/portfolio/demo`, `/api/scenarios/{id}`, `/api/markets/tracked`, `/api/markets/{id}/history`, `DirectAssetShockEngine`, `PolymarketRiskSource`, `get_settings`.
- Produces: `make smoke-live` — gated real-call end-to-end verification with PASS/FAIL lines and non-zero exit on failure.

- [ ] **Step 1: Write the script**

```python
#!/usr/bin/env python3
"""Live end-to-end smoke: AI Risk Committee + Polymarket with real calls.

Spends real OpenRouter credits (roughly $0.04-0.08 per run; the figure is an
estimate, not a metered bill) and hits the public Polymarket Gamma/CLOB APIs.
Gated behind --yes on purpose.

Run from the repo root:
    apps/api/.venv/bin/python scripts/live_smoke.py --yes
    make smoke-live
"""

import argparse
import asyncio
import os
import re
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "apps" / "api"))

# Force live paths before importing the app: environment variables win over
# .env, and app.main caches get_settings() at import time.
os.environ["AI_PROVIDER"] = "openrouter"
os.environ["ENABLE_POLYMARKET"] = "true"
os.environ["DEMO_MODE"] = "false"

import httpx  # noqa: E402
from httpx import ASGITransport  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.domain.risk.engine import DirectAssetShockEngine  # noqa: E402
from app.integrations.risk_sources.polymarket import PolymarketRiskSource  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.portfolio import Portfolio  # noqa: E402

TRACKED_MARKET_ID = "567621"  # China invades Taiwan — data/mapping.json
SCENARIO_ID = "semiconductor-supply-shock"
ALLOWED_SYMBOLS = {"NVDA", "QQQ", "SPY", "BTC", "GLD", "TLT"}

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""))
    if not ok:
        failures.append(name)


def report() -> int:
    if failures:
        print(f"\n{len(failures)} check(s) failed: {', '.join(failures)}")
        return 1
    print("\nLive smoke passed.")
    return 0


async def main() -> int:
    settings = get_settings()
    if not settings.openrouter_api_key:
        print("OPENROUTER_API_KEY is not set — run from the repo root with .env present.")
        return 2
    print(
        f"Seats: macro={settings.committee_macro_model} "
        f"sector={settings.committee_sector_model} "
        f"cross_asset={settings.committee_cross_asset_model} "
        f"chair={settings.committee_chair_model}"
    )
    print("This run spends roughly $0.04-0.08 of OpenRouter credits.\n")
    started = time.monotonic()

    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://smoke", timeout=180
    ) as client:
        roster = (await client.get("/api/ai/committee")).json()
        check("roster enabled", roster["enabled"] is True)
        check("three analyst seats", len(roster["seats"]) == 3)

        portfolio = (await client.get("/api/portfolio/demo")).json()
        scenario = (await client.get(f"/api/scenarios/{SCENARIO_ID}")).json()
        context = {
            "scenario_title": scenario["title"],
            "scenario_description": scenario["description"],
            "horizon": scenario["horizon"],
            "transmission": scenario["transmission"],
            "portfolio": portfolio,
            "market_id": TRACKED_MARKET_ID,
        }

        async def run_seat(seat: str) -> dict:
            response = await client.post(
                "/api/ai/committee/analyst", json={**context, "seat": seat}
            )
            return response.json()

        t0 = time.monotonic()
        views = await asyncio.gather(*(run_seat(s["seat"]) for s in roster["seats"]))
        analysts_seconds = time.monotonic() - t0
        usable = [
            v["view"]
            for v in views
            if v["view"] and set(v["view"]["asset_shocks"]) & ALLOWED_SYMBOLS
        ]
        check("three analyst views", len(usable) == 3, f"{analysts_seconds:.1f}s")
        check(
            "views carry the live market signal",
            all(v["market_context"] and v["market_context"]["probability"] is not None for v in usable),
        )
        for v in usable:
            mc = v["market_context"]
            print(
                f"      {v['label']}: {mc['probability']:.1%} on \"{mc['question']}\" "
                f"({mc['source_status']}, as of {mc['as_of']})"
            )

        t1 = time.monotonic()
        response = await client.post(
            "/api/ai/committee/verdict", json={**context, "views": usable, "debate": True}
        )
        verdict_seconds = time.monotonic() - t1
        body = response.json()
        verdict = body["verdict"]
        check("chair verdict returned", verdict is not None, body.get("message") or "")
        if verdict is None:
            return report()
        check("consensus shocks present", bool(set(verdict["consensus"]) & ALLOWED_SYMBOLS))
        check(
            "debate revisions returned",
            len(verdict["revisions"]) == len(usable),
            f"verdict {verdict_seconds:.1f}s",
        )
        check("revision impacts computed", len(verdict["revision_impacts"]) == len(usable))
        check("impact per final view", len(verdict["view_impacts"]) == len(usable))
        check("shock ranges present", bool(verdict["shock_ranges"]))

        expected = DirectAssetShockEngine().run(
            portfolio=Portfolio(**portfolio),
            asset_shocks=verdict["consensus"],
            scenario_id=None,
            scenario_title="live smoke cross-check",
        )
        check(
            "consensus impact matches the engine",
            abs(expected.estimated_impact_pct - verdict["consensus_impact"]["impact_pct"]) < 1e-9,
            f"{verdict['consensus_impact']['impact_pct']:+.2%}",
        )

        markets = (await client.get("/api/markets/tracked")).json()
        check(
            "tracked markets live",
            len(markets) >= 1 and markets[0]["source_status"] in {"live", "cached"},
        )
        if markets:
            summary = markets[0]
            check(
                "market probability is real",
                summary["probability"] is not None and 0 <= summary["probability"] <= 1,
                f"{summary['label']}: {(summary['probability'] or 0):.1%} ({summary['source_status']})",
            )
            history = (await client.get(f"/api/markets/{summary['market_id']}/history")).json()
            check(
                "market history has points",
                len(history["points"]) >= 2,
                f"{len(history['points'])} points, {history['source_status']}",
            )

    signals = PolymarketRiskSource(get_settings()).get_risk_signals()
    check("risk source finds live markets", len(signals) >= 1, f"{len(signals)} signals")
    for signal in signals:
        ok = (
            signal.source_status == "live"
            and bool(re.fullmatch(r"\d+% \(Polymarket\)", signal.probability_signal or ""))
            and signal.scenario_id is not None
        )
        check(f"signal: {signal.title[:60]}", ok, f"{signal.probability_signal} → {signal.scenario_id}")

    print(f"\nTotal: {time.monotonic() - started:.1f}s")
    return report()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--yes", action="store_true", help="confirm real OpenRouter spend")
    args = parser.parse_args()
    if not args.yes:
        print("Refusing to spend OpenRouter credits without --yes.")
        raise SystemExit(2)
    raise SystemExit(asyncio.run(main()))
```

- [ ] **Step 2: Add the Makefile target**

Change the first line to include `smoke-live`, and append:

```make
smoke-live:
	apps/api/.venv/bin/python scripts/live_smoke.py --yes
```

- [ ] **Step 3: Run the live smoke (spends ~$0.05)**

Run: `make smoke-live`
Expected: all `PASS`, exit 0, total ~30–70 s. **Save the terminal output** — it is the source for the verified numbers in Task 8. If the risk source finds 0 markets, inspect the `order=volume24hr` response and adjust keywords/ordering (do not weaken the assertion; fix the data path).

- [ ] **Step 4: Confirm the offline suite is untouched**

Run: `make check`
Expected: ruff + typecheck + `93+ passed` (new unit tests included), no network calls.

- [ ] **Step 5: Commit**

```bash
git add scripts/live_smoke.py Makefile
git commit -m "test: add a repeatable live committee + Polymarket smoke"
```

---

## Task 8: Rewrite docs to verified reality

**Files:**
- Modify: `docs/prep/MULTI_AGENT_ORCHESTRATION.md`, `docs/CURRENT_STATE.md`, `ROADMAP.md`, `docs/DATA_SOURCES.md`

**Interfaces:**
- Consumes: Task 7's captured terminal output; Task 4/5 `docs/API_CONTRACT.md` updates.
- Produces: docs that contain only reproduced claims plus explicitly-labeled estimates.

- [ ] **Step 1: Fix the `MULTI_AGENT_ORCHESTRATION.md` code map (§11)** to exactly:

```
apps/api/app/
  integrations/ai/openrouter.py   complete_json helper (retries, friendly errors),
                                  prompts, clean_shocks/clean_rationale, single-model provider
  integrations/ai/committee.py    seats, lenses, analyst/rebuttal/chair prompts,
                                  run_analyst/run_debate/run_chair/sanitize_views
  services/market_service.py      get_context_signal(): live Polymarket signal for committee runs
  api/routes/committee.py         endpoints, sanitize_views, engine-computed impacts/ranges
  schemas/committee.py            CommitteeRoster, AnalystView, RevisionView, CommitteeVerdict, ...
  tests/test_committee.py         cleaning, validation, prompts, debate, engine numbers

apps/web/src/features/stress-test/CommitteePanel.tsx   panel (fan-out, cards, spread)
apps/web/src/types/committee.ts                        wire types
```

- [ ] **Step 2: Replace §7 entirely.** Delete the benchmark table and the "Live results (production, 2026-10-04)" subsection. Replace with:
  - "Seat selection" — the four configured model ids from `.env.example`, chosen for lab diversity; note that per-run cost figures are estimates.
  - "Verified live run — 2026-10-04 (this environment)" — paste the exact PASS lines from `make smoke-live` in Task 7: analyst latency, chair latency, the live Taiwan probability, consensus impact, engine cross-check, and the live risk-source signals (question + probability + mapped scenario). Do not invent the numbers.

- [ ] **Step 3: Correct the rest of the document**
  - §3 design: add the opt-in debate round (analysts see anonymized peers, chair weighs revisions) and the optional live market signal (`market_id`).
  - §6 guard rails table: replace the "503 to the UI" row with "Provider failures return HTTP 200 with a friendly `message`; the committee is hidden under mock"; add rows for retries (429/5xx fast-retry, timeouts not retried), view validation/clamping, and the live-signal provenance (`live|cached`, never fabricated).
  - §10 API surface: add `debate` / `market_id` / `revisions` / `market_context` notes pointing at `docs/API_CONTRACT.md`.

- [ ] **Step 4: Update state docs**
  - `docs/CURRENT_STATE.md` committee bullet: live-verified 2026-10-04 (OpenRouter, real run), debate round, live Polymarket context, hardened (retries/validation), and remove "requires your OpenRouter credits to run live".
  - `docs/CURRENT_STATE.md` Polymarket risk-source bullet: replace "Not yet verified against the live API" with the verified result (volume-ordered, 3 real matches on 2026-10-04; explicit-Yes only).
  - `ROADMAP.md` committee row (~90) → `DONE` (live-verified 2026-10-04); Oct 2 Polymarket integration row → `DONE` (live-verified); phase-1 license acceptance cell → all-rights-reserved note.
  - `docs/DATA_SOURCES.md` Polymarket section: add the volume-ordering rule and the explicit-Yes-only extraction rule (no first-outcome fallback).

- [ ] **Step 5: Verify no unverifiable claims remain**

```bash
grep -n "production\|503\|benchmark" docs/prep/MULTI_AGENT_ORCHESTRATION.md
```
Expected: only claims that Task 7 reproduced (or none).

- [ ] **Step 6: Commit**

```bash
git add docs ROADMAP.md
git commit -m "docs: replace committee and Polymarket claims with verified live results"
```

---

## Task 9: Flip the local `.env` and run the full live verification

**Files:** `.env` (gitignored — never committed)

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a locally configured live demo + final evidence.

- [ ] **Step 1: Edit `.env`** (root) to:

```
AI_PROVIDER=openrouter
ENABLE_POLYMARKET=true
DEMO_MODE=false
```
Leave `OPENROUTER_API_KEY`, `COMMITTEE_*_MODEL`, `HTTPS_PROXY` as-is (`HTTPS_PROXY=` empty; no proxy needed from this network).

- [ ] **Step 2: Offline suite still green**

`make check` → expected: ruff/typecheck/pytest clean.

- [ ] **Step 3: Endpoint smoke and live smoke**

```bash
make smoke        # boots the API; radar/markets now hit live Polymarket (real data), committee GET is roster-only
make smoke-live   # full real committee + debate + Polymarket run
```
Expected: both pass.

- [ ] **Step 4: Confirm repo state**

```bash
git status --short   # expected: empty (.env ignored)
git log --oneline -8 # expected: Task 1 baseline commits + one commit per task
```

- [ ] **Step 5: Note the rollback** (no commit): to return to an offline demo, set `AI_PROVIDER=mock` and `DEMO_MODE=true` in `.env`; `make dev` then works with zero credentials.

---

## Handoff notes (explicitly out of scope — backend-only)

- **UI does not yet render** `revisions`, `revision_impacts`, or `market_context`, and does not send `market_id`/`debate`. A frontend task for Artem: add `debate: true` to the verdict call and a `market_id` prop when the active scenario maps to a tracked market (`data/mapping.json`); render `market_context` as a labeled "Polymarket, live" line. The API is contract-complete for this.
- Browser-side stale-run guard before issuing the verdict call is a frontend concern (noted, not changed here).
- Verdict call with `debate: true` costs +3 LLM calls and ~10 s extra.

## Self-review (run before calling this plan done)

1. **Spec coverage:** hardening (T2/T3/T6), debate (T5), live context (T4), live verify (T7/T9), Polymarket both paths (T6/T7), docs truth (T4/T5/T8), license deletion (T1), clean commits (T1 + per-task), types sync (T4/T5). No gaps.
2. **Placeholders:** none — every step has code or an exact command; Task 8's live numbers come from a concrete artifact (Task 7 output), not invented.
3. **Type consistency:** `MarketContextSignal`, `get_context_signal`, `sanitize_views`, `RevisionView`, `revisions`, `revision_impacts`, `debate`, `market_id`, `market_context`, `_post_with_retries`, `_coerce_confidence` are used with the same names/signatures in every task.
4. **Flagged uncertainty:** `MARKET_FETCH_LIMIT=100` live acceptance (fallback 50 verified working); per-run cost is an estimate; model availability verified only as of 2026-10-04.
