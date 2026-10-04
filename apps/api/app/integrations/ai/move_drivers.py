"""LLM step of "What's moving this asset?".

Input is real data only: the observed price move (and SPY's move over the
same window) plus real headlines, each with a numeric id. The model may
only *interpret* them. Every company/sector/macro driver must cite at
least one headline id; uncited drivers are dropped. "market" drivers may
rest on the SPY comparison alone.
"""

from app.core.config import Settings
from app.integrations.ai.base import AIProviderUnavailableError
from app.integrations.ai.openrouter import PLAIN_LANGUAGE, chat_json
from app.schemas.asset import Asset
from app.schemas.move_drivers import Driver, ObservedMove
from app.schemas.news import NewsItem

_KINDS = ("company", "sector", "macro", "market")

_PROMPT = """You explain recent price moves for a portfolio risk tool. Use ONLY the \
facts and headlines below. Do not use outside knowledge about events.

Asset: {symbol}, {name} ({instrument}, {category})

Observed price move (real data):
- {symbol}: {move:+.1%} from {from_date} to {to_date}
- S&P 500 (SPY) over the same window: {market}

Recent headlines (id. date, publisher, headline):
{headlines}

Rules:
- Separate fact from interpretation. Use cautious language such as \
"may have contributed", "appears consistent with", "possible drivers include". \
Never claim certain causation just because a headline and a move coincide.
- Each driver must cite the ids of the headlines it relies on. A "market" \
driver may instead rely only on the SPY comparison (sources: []).
- If the headlines don't plausibly explain the move, return no drivers and \
set "insufficient": true.
- No investment advice and no predictions.

Respond with ONLY a JSON object:
{{
  "summary": "1-2 sentences",
  "drivers": [{{"text": "one sentence", "kind": "company|sector|macro|market", \
"sources": [1, 3]}}],
  "confidence": "low|medium|high",
  "insufficient": false
}}
At most 3 drivers."""
_PROMPT += "\n\n" + PLAIN_LANGUAGE


def explain_move(
    settings: Settings, asset: Asset, observed: ObservedMove, news: list[NewsItem]
) -> dict:
    if settings.ai_provider != "openrouter":
        raise AIProviderUnavailableError("Explaining moves needs a live AI provider.")
    by_id = {i + 1: item for i, item in enumerate(news)}
    headlines = "\n".join(
        f"{i}. {item.published_at[:10]}, {item.publisher}: {item.headline}"
        for i, item in by_id.items()
    )
    market = (
        f"{observed.market_return_pct:+.1%}"
        if observed.market_return_pct is not None
        else "not available"
    )
    data = chat_json(
        settings,
        settings.openrouter_model,
        _PROMPT.format(
            symbol=asset.symbol,
            name=asset.name,
            instrument=asset.instrument,
            category=asset.category,
            move=observed.return_pct,
            from_date=observed.from_date,
            to_date=observed.to_date,
            market=market,
            headlines=headlines,
        ),
        max_tokens=1500,
    )

    drivers: list[Driver] = []
    for raw in data.get("drivers") or []:
        if not isinstance(raw, dict):
            continue
        text = str(raw.get("text") or "").strip()
        kind = raw.get("kind") if raw.get("kind") in _KINDS else "company"
        ids = raw.get("sources") if isinstance(raw.get("sources"), list) else []
        sources = [by_id[i] for i in ids if isinstance(i, int) and i in by_id]
        if not text:
            continue
        if not sources and not (kind == "market" and observed.market_return_pct is not None):
            continue  # ungrounded interpretation is dropped, not shown
        drivers.append(Driver(text=text[:300], kind=kind, sources=sources))

    confidence = data.get("confidence")
    return {
        "summary": str(data.get("summary") or "").strip()[:500] or None,
        "drivers": drivers[:3],
        "confidence": confidence if confidence in ("low", "medium", "high") else "low",
        "insufficient": bool(data.get("insufficient")) or not drivers,
    }
