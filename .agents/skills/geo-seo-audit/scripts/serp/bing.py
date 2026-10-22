"""Bing Web Search SERP engine — primary proxy for ChatGPT / Bing Copilot.

ChatGPT (with Web Search / SearchGPT) uses Bing as its retrieval backend
(OpenAI-Microsoft partnership, confirmed since 2023). Bing Copilot uses the
same index. So scraping Bing directly is the most accurate **free, no-setup**
proxy we can get for both.

Bing has its own anti-bot but is generally **less aggressive than Google**
in 2026 — it tolerates polite scraping at low volume. When it does block,
we surface the error cleanly (consistent with the rest of `scripts/serp/`).

Design notes:
- Use the regular `bing.com/search?q=...` endpoint, not the API (which would
  require an API key and a credit card — violates the "no setup" rule).
- Honour `setlang=` and `cc=` params for locale targeting.
- Polite delay 3-7 s between requests by default.
- Realistic Chrome desktop UA.
"""
from __future__ import annotations

import random
import re
import time
import warnings
from urllib.parse import urlencode, urlparse, parse_qs, unquote

import requests
from bs4 import BeautifulSoup

warnings.filterwarnings("ignore", message=".*OpenSSL.*", category=Warning)

from . import SerpEngine, SerpResult, make_response


def _setlang_cc(locale: str) -> tuple[str, str]:
    """Map a locale tag (e.g. fr-FR) to Bing's `setlang` and `cc` params."""
    if not locale or "-" not in locale:
        return "en", "us"
    parts = locale.split("-")[:2]
    return parts[0].lower(), parts[1].lower()


def _unwrap_bing_url(href: str) -> str:
    """Bing wraps result URLs in /ck/a?... or sometimes serves them direct.
    For /ck/a links we extract the `u` param which carries the encoded URL.
    """
    if href.startswith("//"):
        href = "https:" + href
    if "/ck/a?" in href or "bing.com/ck/a?" in href:
        try:
            qs = parse_qs(urlparse(href).query)
            if "u" in qs:
                # Bing's u param is base64-padded with a 1-char prefix (e.g. "a1aHR0...")
                # Strip the prefix, b64decode the rest. If decoding fails, return as-is.
                import base64
                raw = qs["u"][0]
                # Bing's URL format: prefix is 1-3 chars depending on encoding scheme; safest
                # to try common offsets.
                for offset in (2, 1, 0, 3):
                    try:
                        s = raw[offset:]
                        # Pad
                        s = s + "=" * (-len(s) % 4)
                        decoded = base64.b64decode(s, altchars=b"-_").decode("utf-8")
                        if decoded.startswith("http"):
                            return decoded
                    except Exception:
                        continue
        except Exception:
            return href
    return href


def _looks_like_block(html: str) -> bool:
    """True if Bing returned a block / JS-stub page (vs a real SERP)."""
    low = html.lower()
    if "/sorry/" in html:
        return True
    if "unusual traffic" in low:
        return True
    # Real SERP always contains b_algo blocks. If absent on a 200 response,
    # it's the JS-stub (Bing's anti-scraper for desktop UAs).
    # We don't check just for "captcha" / "verify" because those words appear
    # in legit SERP scripts too.
    return False


# UA strategy (validated empirically 2026-04-26 — see tasks/lessons.md):
# - **Desktop Firefox** returns the full real SERP (10 `li.b_algo` cards) when
#   accompanied by `mkt=<locale>`. This is the SERP that matches what an
#   un-personalized human user sees, and is the closest free proxy to what
#   ChatGPT's Bing-backed retrieval gets.
# - **Desktop Chrome** triggers Bing's JS-stub anti-scraper (~70KB shell, 0 cards).
# - **Mobile UA** returns a SERP but it's the mobile ranking, which differs
#   significantly from desktop (host-grouping behaves differently, fewer results,
#   different geo bias). Do not use as primary.
DESKTOP_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:122.0) "
    "Gecko/20100101 Firefox/122.0"
)
MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.0 Mobile/15E148 Safari/604.1"
)


class BingEngine(SerpEngine):
    name = "bing"
    polite_delay_min = 3.0
    polite_delay_max = 7.0
    TOP_N = 10  # we only collect/measure the first SERP page; do not lie about depth

    def __init__(self, cache=None, user_agent: str | None = None):
        # Default to desktop Firefox. Caller can override via user_agent.
        super().__init__(cache=cache, user_agent=user_agent or DESKTOP_UA)
        self._session: requests.Session | None = None

    def _ensure_session(self, locale: str) -> requests.Session:
        """Lazy-create a session and seed Bing region cookies by visiting the homepage.
        This bumps SERP quality a notch — Bing ties some ranking signals to the cookie
        bag (e.g. `_EDGE_S`, `MUID`)."""
        if self._session is not None:
            return self._session
        s = requests.Session()
        setlang, cc = _setlang_cc(locale)
        s.headers.update({
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": f"{locale},{setlang};q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate",
        })
        try:
            s.get(f"https://www.bing.com/?cc={cc}&setlang={setlang}", timeout=10)
            time.sleep(0.5)
        except requests.RequestException:
            pass  # not fatal — we can still attempt the search
        self._session = s
        return s

    def _fetch_raw(self, query: str, locale: str) -> object:
        setlang, cc = _setlang_cc(locale)
        time.sleep(random.uniform(self.polite_delay_min, self.polite_delay_max))

        # `mkt=<locale>` is Bing's canonical geo lever. `setlang` and `cc` alone
        # produce a generic francophone SERP that misranks queries (see lessons
        # 2026-04-26 — without `mkt`, "agence powerpoint" returned real-estate brands).
        params = {
            "q": query,
            "mkt": locale,
            "setlang": setlang,
            "cc": cc,
        }
        url = "https://www.bing.com/search?" + urlencode(params)
        sess = self._ensure_session(locale)

        # Retry 429 with backoff
        r = None
        for attempt in range(3):
            try:
                r = sess.get(url, timeout=20)
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
            return make_response(self.name, query, locale, error="blocked-by-anti-bot")

        soup = BeautifulSoup(r.text, "lxml")

        # Bing organic results: `<li class="b_algo">` is the long-standing class.
        cards = soup.select("li.b_algo")
        if not cards:
            cards = soup.select("ol#b_results > li[class*='b_algo']")

        results: list[SerpResult] = []
        seen_urls: set[str] = set()

        for card in cards:
            # Title in <h2><a href="...">title</a></h2>
            link = card.select_one("h2 a") or card.find("a", href=True)
            if not link:
                continue
            href = _unwrap_bing_url(link.get("href", ""))
            if not href.startswith("http") or "bing.com" in urlparse(href).netloc:
                continue
            if href in seen_urls:
                continue

            title = link.get_text(" ", strip=True)
            # Snippet: Bing uses <p> or <div class="b_caption"><p>...</p></div>
            snippet_el = card.select_one("div.b_caption p, p")
            snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""

            if title:
                seen_urls.add(href)
                results.append(SerpResult(rank=len(results) + 1, title=title, url=href, snippet=snippet))
            if len(results) >= self.TOP_N:
                break

        if not results:
            return make_response(
                self.name, query, locale,
                error="no-results-parsed (Bing selectors may have shifted, or page is empty)",
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
    eng = BingEngine()
    resp = eng.fetch(args.query, args.locale)
    print(json.dumps(resp.to_dict(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _main()
