"""Brave Search API engine — official endpoint, much more stable than the
HTML scraper.

The free tier (https://brave.com/search/api/) gives 2 000 requests/month at
1 request/second, which is enough for ~50 audits/month at the default fan-out
size. No credit card required.

This engine is auto-selected when `BRAVE_SEARCH_API_KEY` (or `BRAVE_API_KEY`)
is set in the environment, or when `--brave-api-key <key>` is passed on the
CLI. Without a key, the toolkit falls back to the HTML scraper in `brave.py`.

Why we still keep the scraper: the project's design constraint is "no setup
required to run a first audit". The scraper preserves that — the API is the
recommended upgrade for anyone running audits regularly.

Engine `name` is "brave" (same as the scraper) so the cache, the RRF logic,
and the report code don't need to know which path was used.
"""
from __future__ import annotations

import time
from urllib.parse import urlencode

import requests

from . import SerpEngine, SerpResult, make_response


_API_URL = "https://api.search.brave.com/res/v1/web/search"


def _country_for_locale(locale: str) -> str:
    """Brave API expects an ISO 3166-1 alpha-2 country code (uppercase, e.g.
    'FR', 'US'). Defaults to 'ALL' for unknown locales."""
    if not locale or "-" not in locale:
        return "ALL"
    parts = locale.split("-")
    if len(parts) >= 2 and len(parts[1]) == 2:
        return parts[1].upper()
    return "ALL"


def _search_lang_for_locale(locale: str) -> str:
    """Brave API `search_lang` expects ISO 639-1 (e.g. 'fr', 'en')."""
    if not locale:
        return "en"
    return locale.split("-")[0].lower()


class BraveAPIEngine(SerpEngine):
    """Official Brave Search API engine.

    Free tier: 1 req/sec, 2 000 req/month. No retries needed at this rate —
    a single 1.1s polite delay keeps us safely under the limit.

    Returns up to 20 organic results per query (the free tier max). Downstream
    code typically only inspects the top 10, so the extra ranks are bonus
    coverage for fragile-leadership detection and competitor benchmarks.
    """

    name = "brave"
    # Free tier rate limit is 1 req/sec. 1.1s adds a safety margin that
    # absorbs scheduler jitter without burning the budget.
    polite_delay_min = 1.1
    polite_delay_max = 1.4

    def __init__(self, api_key: str, cache=None, user_agent: str | None = None,
                 result_count: int = 20):
        super().__init__(cache=cache, user_agent=user_agent)
        if not api_key:
            raise ValueError("BraveAPIEngine requires an api_key")
        self.api_key = api_key
        self.result_count = max(1, min(20, int(result_count)))  # clamp to API limit

    def _fetch_raw(self, query: str, locale: str):
        country = _country_for_locale(locale)
        search_lang = _search_lang_for_locale(locale)
        time.sleep(self.polite_delay_min)

        params = {
            "q": query,
            "country": country,
            "search_lang": search_lang,
            "count": self.result_count,
            "safesearch": "moderate",
        }
        url = _API_URL + "?" + urlencode(params)
        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": self.api_key,
            "User-Agent": self.user_agent,
        }

        try:
            r = requests.get(url, headers=headers, timeout=15)
        except requests.RequestException as e:
            return make_response(self.name, query, locale, error=f"network: {e}")

        if r.status_code == 401 or r.status_code == 403:
            return make_response(
                self.name, query, locale,
                error=f"auth-failed (http {r.status_code} — check BRAVE_SEARCH_API_KEY)",
            )
        if r.status_code == 429:
            # Rate limited — return a clear error so the orchestrator can decide
            # what to do. With a 1.1s delay this should be rare on the free tier.
            return make_response(self.name, query, locale, error="rate-limited (http 429)")
        if r.status_code != 200:
            return make_response(self.name, query, locale, error=f"http {r.status_code}")

        try:
            data = r.json()
        except ValueError:
            return make_response(self.name, query, locale, error="invalid-json")

        web = data.get("web") or {}
        raw_results = web.get("results") or []

        results: list[SerpResult] = []
        seen_urls: set[str] = set()
        for item in raw_results:
            href = (item.get("url") or "").strip()
            if not href.startswith("http") or href in seen_urls:
                continue
            title = (item.get("title") or "").strip()
            snippet = (item.get("description") or "").strip()
            if not title:
                continue
            seen_urls.add(href)
            results.append(SerpResult(
                rank=len(results) + 1,
                title=title,
                url=href,
                snippet=snippet,
            ))
            if len(results) >= self.result_count:
                break

        if not results:
            return make_response(
                self.name, query, locale,
                error="no-results (API returned 0 organic items)",
                top_n_measured=self.result_count,
            )

        resp = make_response(
            self.name, query, locale,
            results=results,
            top_n_measured=len(results),
        )
        resp.dominant_domain = resp.compute_dominant_domain()
        return resp


def _main():
    import argparse, json, os
    p = argparse.ArgumentParser()
    p.add_argument("query")
    p.add_argument("--locale", default="fr-FR")
    p.add_argument("--api-key", default=None,
                   help="Brave Search API key. Defaults to env BRAVE_SEARCH_API_KEY.")
    args = p.parse_args()
    api_key = args.api_key or os.getenv("BRAVE_SEARCH_API_KEY") or os.getenv("BRAVE_API_KEY")
    if not api_key:
        raise SystemExit("Set BRAVE_SEARCH_API_KEY or pass --api-key.")
    eng = BraveAPIEngine(api_key=api_key)
    resp = eng.fetch(args.query, args.locale)
    print(json.dumps(resp.to_dict(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _main()
