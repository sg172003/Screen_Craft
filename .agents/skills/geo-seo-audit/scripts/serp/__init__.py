"""
scripts/serp — SERP fetching layer for the GEO Audit Toolkit.

Provides a uniform interface (`SerpEngine`) over multiple search backends
(DuckDuckGo, Google, Brave). All engines return a `SerpResponse` containing
the parsed organic results, plus optional structured data (PAA, related
searches) when the engine exposes them.

Design constraints:
- No paid APIs. No signup. No API keys.
- Polite scraping only: realistic UA, randomised delays, retry-on-429,
  fail gracefully on captcha.
- Cache-first: `cache.py` stores responses to disk so re-runs are cheap.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any


@dataclass
class SerpResult:
    """One organic result on a SERP."""
    rank: int             # 1-based position
    title: str
    url: str
    snippet: str = ""

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "SerpResult":
        return cls(rank=d["rank"], title=d["title"], url=d["url"], snippet=d.get("snippet", ""))


@dataclass
class SerpResponse:
    """The full SERP for one query on one engine."""
    query: str
    engine: str                     # "ddg" | "google" | "brave"
    locale: str                     # e.g. "fr-FR"
    fetched_at: str                 # ISO datetime
    results: list[SerpResult] = field(default_factory=list)
    paa: list[str] = field(default_factory=list)        # People Also Ask (Google)
    related: list[str] = field(default_factory=list)    # Related Searches (Google)
    error: str | None = None        # captcha / 429 / network — engine failed
    top_n_measured: int = 0         # how deep we actually looked (e.g. 10)
    dominant_domain: str | None = None  # set when one host takes ≥80% of slots

    @property
    def ok(self) -> bool:
        return self.error is None and len(self.results) > 0

    def find_rank(self, domain: str) -> int | None:
        """Return the 1-based rank of the first result whose URL contains `domain`, or None."""
        from urllib.parse import urlparse
        target = domain.lower().lstrip(".")
        for r in self.results:
            host = urlparse(r.url).netloc.lower()
            # Match exact host, host ending with .domain, or host equal to www.domain
            if host == target or host == f"www.{target}" or host.endswith(f".{target}"):
                return r.rank
        return None

    def compute_dominant_domain(self, threshold: float = 0.8) -> str | None:
        """If a single host takes ≥`threshold` share of the results, return its domain. Else None.
        Used to flag SERPs hijacked by host-grouping (1 brand dominates the ranking)."""
        from urllib.parse import urlparse
        if not self.results:
            return None
        counts: dict[str, int] = {}
        for r in self.results:
            host = urlparse(r.url).netloc.lower()
            if host.startswith("www."):
                host = host[4:]
            counts[host] = counts.get(host, 0) + 1
        top_host, top_count = max(counts.items(), key=lambda kv: kv[1])
        return top_host if top_count / len(self.results) >= threshold else None

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "SerpResponse":
        return cls(
            query=d["query"],
            engine=d["engine"],
            locale=d["locale"],
            fetched_at=d["fetched_at"],
            results=[SerpResult.from_dict(r) for r in d.get("results", [])],
            paa=d.get("paa", []),
            related=d.get("related", []),
            error=d.get("error"),
            top_n_measured=d.get("top_n_measured", 0),
            dominant_domain=d.get("dominant_domain"),
        )


class SerpEngine(abc.ABC):
    """Abstract base for SERP engines.

    Concrete engines override `_fetch_raw` to do the network call and return parsed
    `SerpResponse`. The base class wraps caching, polite delays, and error handling.
    """

    name: str = ""               # short id, e.g. "ddg"
    polite_delay_min: float = 2.0   # seconds between consecutive live fetches
    polite_delay_max: float = 5.0

    def __init__(self, cache=None, user_agent: str | None = None):
        self.cache = cache
        self.user_agent = user_agent or self.default_user_agent()

    @staticmethod
    def default_user_agent() -> str:
        # A realistic recent Chrome on macOS UA.
        return (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        )

    @abc.abstractmethod
    def _fetch_raw(self, query: str, locale: str) -> SerpResponse:
        """Subclasses do the actual HTTP fetch + parse here. Must set `engine`, `query`,
        `locale`, `fetched_at`. Should set `error` (and leave results empty) on failure."""
        ...

    def fetch(self, query: str, locale: str = "en-US") -> SerpResponse:
        """Cache-first fetch. Honours the cache if present; otherwise calls _fetch_raw
        and stores the result in the cache."""
        if self.cache is not None:
            cached = self.cache.get(self.name, query, locale)
            if cached is not None:
                return cached

        resp = self._fetch_raw(query, locale)

        if self.cache is not None and resp.ok:
            self.cache.set(self.name, query, locale, resp)

        return resp


def make_response(engine: str, query: str, locale: str, **kwargs) -> SerpResponse:
    """Helper for engines to build a stamped response."""
    return SerpResponse(
        engine=engine,
        query=query,
        locale=locale,
        fetched_at=datetime.utcnow().isoformat(timespec="seconds") + "Z",
        **kwargs,
    )


def make_brave_engine(cache=None, api_key: str | None = None) -> SerpEngine:
    """Return the Brave engine to use, preferring the official API when a key
    is available.

    Selection order:
      1. Explicit `api_key` argument (e.g. from `--brave-api-key` CLI flag)
      2. `BRAVE_SEARCH_API_KEY` env var
      3. `BRAVE_API_KEY` env var (alternative spelling)
      4. Fallback to the HTML scraper (`BraveEngine`)

    Both engines expose `name = "brave"`, so downstream code (cache, RRF
    aggregation, reports) doesn't need to care which one was selected.

    The API engine is ~10× faster (1.1s polite delay vs 8-15s) and far more
    stable — recommended for any user running audits regularly.
    """
    import os

    resolved_key = (
        api_key
        or os.getenv("BRAVE_SEARCH_API_KEY")
        or os.getenv("BRAVE_API_KEY")
    )
    if resolved_key:
        from .brave_api import BraveAPIEngine
        return BraveAPIEngine(api_key=resolved_key, cache=cache)

    from .brave import BraveEngine
    return BraveEngine(cache=cache)
