"""DuckDuckGo HTML SERP engine.

Posts to `html.duckduckgo.com/html/` (the no-JS endpoint) and parses the static
HTML response. DDG returns Bing-derived results, so this engine is the closest
proxy we can get for ChatGPT (Bing-backed) and Bing Copilot rankings without an
API key.

DDG generally tolerates polite scraping — no captcha for low volumes. If captcha
appears, we surface an `error` on the response and let the caller retry later.
"""
from __future__ import annotations

import random
import time
import warnings
from urllib.parse import urlparse, parse_qs, unquote

import requests
from bs4 import BeautifulSoup

# urllib3 v2 warns about LibreSSL on macOS — not actionable for end users.
warnings.filterwarnings("ignore", message=".*OpenSSL.*", category=Warning)

from . import SerpEngine, SerpResult, make_response


# DDG region codes for SERP localisation. Used as the `kl` form param.
# Format: "<lang>-<country>" lowercase. Example: "fr-fr", "en-us", "de-de".
def _kl_for_locale(locale: str) -> str:
    if not locale:
        return "wt-wt"  # no region (worldwide)
    parts = locale.lower().replace("_", "-").split("-")
    if len(parts) == 2:
        lang, country = parts
        return f"{lang}-{country}"
    if len(parts) == 1:
        return f"{parts[0]}-{parts[0]}"  # best-effort
    return "wt-wt"


def _clean_url(href: str) -> str:
    """DDG wraps result URLs in /l/?uddg=... — unwrap to get the real target."""
    if href.startswith("//"):
        href = "https:" + href
    if href.startswith("/l/?"):
        href = "https://duckduckgo.com" + href
    if "duckduckgo.com/l/" in href:
        try:
            qs = parse_qs(urlparse(href).query)
            if "uddg" in qs:
                return unquote(qs["uddg"][0])
        except Exception:
            return href
    return href


class DuckDuckGoEngine(SerpEngine):
    name = "ddg"
    # DDG rate-limits aggressively at low volume; pad the polite delay.
    polite_delay_min = 3.0
    polite_delay_max = 7.0

    def _fetch_raw(self, query: str, locale: str) -> object:
        kl = _kl_for_locale(locale)
        time.sleep(random.uniform(self.polite_delay_min, self.polite_delay_max))

        # Retry once on HTTP 202 (DDG soft rate-limit) with extra delay.
        r = None
        for attempt in range(2):
            try:
                r = requests.post(
                    "https://html.duckduckgo.com/html/",
                    data={"q": query, "kl": kl, "kp": "-2"},  # kp=-2 = strict-off / no safesearch redirect
                    headers={
                        "User-Agent": self.user_agent,
                        "Accept-Language": locale,
                        "Accept-Encoding": "gzip, deflate",
                        "Referer": "https://html.duckduckgo.com/",
                    },
                    timeout=20,
                )
            except requests.RequestException as e:
                return make_response(self.name, query, locale, error=f"network: {e}")

            # 202 = soft block. Wait longer and retry once.
            if r.status_code == 202 and attempt == 0:
                time.sleep(random.uniform(15, 25))
                continue
            break

        if r is None or r.status_code != 200:
            code = r.status_code if r is not None else "no-response"
            return make_response(self.name, query, locale, error=f"http {code}")

        # DDG sometimes serves a captcha-equivalent ("anomaly") page on heavy traffic.
        body = r.text
        if "anomaly" in body.lower() and len(body) < 2000:
            return make_response(self.name, query, locale, error="captcha-or-anomaly")

        soup = BeautifulSoup(body, "lxml")
        results: list[SerpResult] = []
        for i, block in enumerate(soup.select(".result")[:20], start=1):
            title_a = block.select_one("a.result__a")
            if not title_a:
                continue
            title = title_a.get_text(" ", strip=True)
            url = _clean_url(title_a.get("href", ""))
            snippet_el = block.select_one(".result__snippet")
            snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""
            if title and url:
                results.append(SerpResult(rank=len(results) + 1, title=title, url=url, snippet=snippet))
            if len(results) >= 10:
                break

        if not results:
            return make_response(
                self.name, query, locale,
                error="no-results-parsed",
                top_n_measured=10,
            )

        resp = make_response(self.name, query, locale, results=results, top_n_measured=10)
        resp.dominant_domain = resp.compute_dominant_domain()
        return resp


# --- standalone CLI for testing ---
def _main():
    import argparse, json
    p = argparse.ArgumentParser()
    p.add_argument("query")
    p.add_argument("--locale", default="fr-FR")
    args = p.parse_args()
    eng = DuckDuckGoEngine()
    resp = eng.fetch(args.query, args.locale)
    print(json.dumps(resp.to_dict(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _main()
