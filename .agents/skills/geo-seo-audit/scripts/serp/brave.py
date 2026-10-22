"""Brave Search HTML SERP engine.

Scrapes `search.brave.com/search?q=...` (the regular SERP, NOT the paywalled
Ask Brave summary endpoint — Test #1 confirmed Ask Brave is gated). We extract
organic ranks only; the GRAIL signal payload is not accessible to a free, no-
setup tool, see `docs/BRAVE_GRAIL_SIGNALS.md`.

Brave's index covers 5 LLMs (Claude, Le Chat, Meta AI, Grok agentic, Perplexity
historical), so even the rank-only signal carries a lot.
"""
from __future__ import annotations

import random
import time
import warnings
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup

warnings.filterwarnings("ignore", message=".*OpenSSL.*", category=Warning)

from . import SerpEngine, SerpResult, make_response


def _country_for_locale(locale: str) -> str:
    """Brave's `country` param expects an ISO 3166-1 alpha-2 (lowercased on the
    URL). Fallback to `all` (worldwide) if the locale is unknown."""
    if not locale or "-" not in locale:
        return "all"
    parts = locale.split("-")
    if len(parts) >= 2 and len(parts[1]) == 2:
        return parts[1].lower()
    return "all"


def _search_lang_for_locale(locale: str) -> str:
    if not locale:
        return "en"
    return locale.split("-")[0].lower()


class BraveEngine(SerpEngine):
    name = "brave"
    # Brave is more sensitive to bursty traffic than Google. Larger delays
    # + jitter spread the request pattern enough to drop the 429 / no-response
    # rate from ~50% to single digits in batch runs of 10+ queries.
    polite_delay_min = 8.0
    polite_delay_max = 15.0

    # Backoff schedule for retries on 429 / transient network failures.
    # 2 retries chained: total worst case = 30 + 60 = 90s extra per query.
    # Combined with the polite delay, that's bounded; we skip the retries
    # entirely on hard errors (5xx, timeout) to fail fast.
    _RETRY_BACKOFF_SECONDS = (30, 60)

    def _fetch_raw(self, query: str, locale: str) -> object:
        country = _country_for_locale(locale)
        search_lang = _search_lang_for_locale(locale)
        time.sleep(random.uniform(self.polite_delay_min, self.polite_delay_max))

        params = {"q": query, "country": country, "search_lang": search_lang, "source": "web"}
        url = "https://search.brave.com/search?" + urlencode(params)

        # Browser-like header set to reduce 429 false-positives.
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": f"{locale},{locale.split('-')[0]};q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate",   # NOT brotli — requests doesn't decompress br by default on stdlib-only installs
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
            "DNT": "1",
        }

        # Retry strategy: 2 retries on 429 only (transient rate-limit), with
        # a 30s + 60s backoff. Network errors and 5xx fail fast — they're
        # usually structural (DNS, host down) rather than transient.
        r = None
        last_status = None
        attempts = 1 + len(self._RETRY_BACKOFF_SECONDS)  # 1 initial + 2 retries
        for attempt in range(attempts):
            try:
                r = requests.get(url, headers=headers, timeout=15)
            except requests.RequestException as e:
                return make_response(self.name, query, locale, error=f"network: {e}")
            last_status = r.status_code
            if r.status_code != 429:
                break
            if attempt < len(self._RETRY_BACKOFF_SECONDS):
                # +/- 20% jitter on backoff to avoid synchronised retries
                base = self._RETRY_BACKOFF_SECONDS[attempt]
                time.sleep(base + random.uniform(-base * 0.2, base * 0.2))

        if r is None or r.status_code != 200:
            return make_response(self.name, query, locale, error=f"http {r.status_code if r else 'no-response'}")

        body = r.text
        # Brave generally doesn't captcha low volumes, but flag anything that
        # looks suspiciously short.
        if len(body) < 5000:
            return make_response(self.name, query, locale, error="short-response (possible block)")

        soup = BeautifulSoup(body, "lxml")

        # 2026 layout: Brave puts each organic result in <div class="snippet" data-type="web">
        # data-pos numbers ALL UI elements (ads, maps), so we re-rank organic only.
        cards = soup.select('div.snippet[data-type="web"]')
        if not cards:
            cards = soup.select('div.snippet')   # fallback

        results: list[SerpResult] = []
        seen_urls: set[str] = set()

        for card in cards:
            # The first anchor with a real http href is the result link.
            link = card.find("a", href=True)
            if not link:
                continue
            href = link.get("href", "")
            if not href.startswith("http") or "search.brave.com" in href:
                continue
            if href in seen_urls:
                continue

            # Title — Brave 2026 uses <div class="title search-snippet-title ...">
            title_el = card.select_one("div.title.search-snippet-title") \
                or card.select_one("div.title") \
                or card.select_one("a.h, a.heading-serpresult")
            title = title_el.get_text(" ", strip=True) if title_el else ""
            if not title:
                # Last-resort: take the link's own text.
                title = link.get_text(" ", strip=True)

            # Snippet description — Brave 2026 uses <div class="generic-snippet ...">
            snippet_el = card.select_one("div.generic-snippet") \
                or card.select_one(".snippet-description, .snippet-content")
            snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""

            if title:
                seen_urls.add(href)
                results.append(SerpResult(rank=len(results) + 1, title=title, url=href, snippet=snippet))
            if len(results) >= 10:
                break

        if not results:
            return make_response(
                self.name, query, locale,
                error="no-results-parsed (selectors may have shifted)",
                top_n_measured=10,
            )

        resp = make_response(self.name, query, locale, results=results, top_n_measured=10)
        resp.dominant_domain = resp.compute_dominant_domain()
        return resp


def _main():
    import argparse, json
    p = argparse.ArgumentParser()
    p.add_argument("query")
    p.add_argument("--locale", default="fr-FR")
    args = p.parse_args()
    eng = BraveEngine()
    resp = eng.fetch(args.query, args.locale)
    print(json.dumps(resp.to_dict(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _main()
