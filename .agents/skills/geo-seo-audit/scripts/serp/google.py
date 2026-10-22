"""Google SERP engine — via Startpage proxy.

**Why a proxy?** Direct `google.com/search` is unscrapeable from a free, no-setup
tool: Google serves a JavaScript-required shell to non-headless clients in 2026,
or redirects EU IPs to a `consent.google.com` gate that requires cookies set
through a real browser flow. Both block any plain HTTP scrape regardless of UA.

**Startpage** (startpage.com) is a long-running privacy search engine that
**proxies Google's index**: it queries Google on the user's behalf and returns
the same ranked results, anonymized. It has no consent gate, no captcha for
moderate volumes, and no JS requirement. The downside is it's a third-party
dependency — if Startpage goes down or rate-limits us, we lose the Google
signal until we add a fallback (Google CSE API would be the obvious one but
it requires a key, which violates the "no setup" rule).

**Engine name remains `google`** in the rest of the codebase because the
*signal* is Google. Startpage is a transport detail, documented in the
RRF report's disclaimer.

This engine is the primary backend for **ChatGPT/SearchGPT, Gemini, and
half of Perplexity** — see `docs/LLM_RETRIEVAL_ARCHITECTURE.md`.
"""
from __future__ import annotations

import random
import time
import warnings
from urllib.parse import urlencode, urlparse

import requests
from bs4 import BeautifulSoup

warnings.filterwarnings("ignore", message=".*OpenSSL.*", category=Warning)

from . import SerpEngine, SerpResult, make_response


_LANG_MAP = {
    "fr": "francais",
    "en": "english",
    "es": "espanol",
    "de": "deutsch",
    "it": "italiano",
    "pt": "portugues",
    "nl": "nederlands",
}


def _startpage_lang(locale: str) -> str:
    """Map a locale tag (e.g. fr-FR) to Startpage's `language` param."""
    if not locale:
        return "english"
    code = locale.split("-")[0].lower()
    return _LANG_MAP.get(code, "english")


def _looks_like_block(html: str) -> bool:
    """Detect Startpage's anti-bot signals."""
    low = html.lower()
    if "captcha" in low and "<form" in low:
        return True
    if "too many requests" in low:
        return True
    if len(html) < 5000:  # legitimate SERP is ~330KB; tiny response is suspect
        return True
    return False


class GoogleEngine(SerpEngine):
    """Google index via Startpage proxy. Engine name is `google` for downstream code."""
    name = "google"
    polite_delay_min = 3.0
    polite_delay_max = 6.0
    TOP_N = 10

    DESKTOP_UA = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:122.0) "
        "Gecko/20100101 Firefox/122.0"
    )

    def __init__(self, cache=None, user_agent: str | None = None):
        super().__init__(cache=cache, user_agent=user_agent or self.DESKTOP_UA)

    def _fetch_raw(self, query: str, locale: str) -> object:
        time.sleep(random.uniform(self.polite_delay_min, self.polite_delay_max))

        params = {
            "q": query,
            "cat": "web",
            "pl": "opensearch",
            "language": _startpage_lang(locale),
        }
        url = "https://www.startpage.com/do/search?" + urlencode(params)

        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": f"{locale},{locale.split('-')[0]};q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate",
        }

        # Retry 429 with exponential backoff
        r = None
        for attempt in range(3):
            try:
                r = requests.get(url, headers=headers, timeout=25)
            except requests.RequestException as e:
                return make_response(self.name, query, locale, error=f"network: {e}")
            if r.status_code != 429:
                break
            time.sleep((2 ** attempt) * 5 + random.uniform(0, 3))

        if r is None:
            return make_response(self.name, query, locale, error="no-response")
        if r.status_code != 200:
            return make_response(self.name, query, locale, error=f"http {r.status_code}")
        if _looks_like_block(r.text):
            return make_response(
                self.name, query, locale,
                error="blocked-by-startpage (rate limit or captcha)",
                top_n_measured=self.TOP_N,
            )

        soup = BeautifulSoup(r.text, "lxml")

        cards = soup.select("div.result")
        results: list[SerpResult] = []
        seen_urls: set[str] = set()

        for card in cards:
            # Title + canonical URL: the `a.result-link` carries both
            link = card.select_one("a.result-link") or card.select_one("h2 a") or card.find("a", href=True)
            if not link:
                continue
            href = link.get("href", "")
            if not href.startswith("http"):
                continue
            host = urlparse(href).netloc
            if "startpage.com" in host:
                continue  # filter Startpage internal links
            if href in seen_urls:
                continue

            title_el = card.select_one("h2.wgl-title") or card.select_one("a.result-link") or link
            title = title_el.get_text(" ", strip=True) if title_el else ""
            snippet_el = card.select_one("p.description")
            snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""

            if title:
                seen_urls.add(href)
                results.append(SerpResult(rank=len(results) + 1, title=title, url=href, snippet=snippet))
            if len(results) >= self.TOP_N:
                break

        if not results:
            return make_response(
                self.name, query, locale,
                error="no-results-parsed (Startpage selectors may have shifted)",
                top_n_measured=self.TOP_N,
            )

        resp = make_response(self.name, query, locale, results=results, top_n_measured=self.TOP_N)
        resp.dominant_domain = resp.compute_dominant_domain()
        return resp


def _main():
    import argparse, json
    p = argparse.ArgumentParser()
    p.add_argument("query")
    p.add_argument("--locale", default="fr-FR")
    args = p.parse_args()
    eng = GoogleEngine()
    resp = eng.fetch(args.query, args.locale)
    print(json.dumps(resp.to_dict(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _main()
