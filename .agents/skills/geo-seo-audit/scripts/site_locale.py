"""Locale detection for an audited site.

Cascade (most accurate first):
  1. <html lang="..."> attribute on the homepage HTML
  2. HTTP `Content-Language` header
  3. URL TLD heuristic
  4. Fallback "en-US"

User can always override via CLI flags `--lang` and `--country`.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


# --- TLD → locale heuristic (kept conservative, only well-known ones) ---
TLD_LOCALE_MAP: dict[str, str] = {
    "fr": "fr-FR",
    "be": "fr-BE",   # ambiguous (BE has FR + NL + DE), default to FR
    "ch": "fr-CH",   # ambiguous, default to FR (Switzerland)
    "lu": "fr-LU",
    "de": "de-DE",
    "at": "de-AT",
    "es": "es-ES",
    "it": "it-IT",
    "pt": "pt-PT",
    "br": "pt-BR",
    "nl": "nl-NL",
    "pl": "pl-PL",
    "cz": "cs-CZ",
    "se": "sv-SE",
    "no": "nb-NO",
    "dk": "da-DK",
    "fi": "fi-FI",
    "ru": "ru-RU",
    "jp": "ja-JP",
    "cn": "zh-CN",
    "tw": "zh-TW",
    "kr": "ko-KR",
    "uk": "en-GB",
    "co.uk": "en-GB",
    "us": "en-US",
    "ca": "en-CA",
    "au": "en-AU",
}


@dataclass
class Locale:
    """A locale with separate language and country components, the way SERP
    backends like to be parameterised (`hl=fr`, `gl=FR`)."""
    lang: str         # ISO 639-1: "fr", "en", ...
    country: str      # ISO 3166-1 alpha-2: "FR", "US", ...
    source: str       # "html-lang" | "content-language-header" | "tld" | "fallback" | "user-override"

    @property
    def tag(self) -> str:
        return f"{self.lang}-{self.country.upper()}"

    def __str__(self) -> str:
        return f"{self.tag} (source: {self.source})"


def parse_locale_string(s: str) -> tuple[str, str] | None:
    """Parse 'fr-FR', 'fr_FR', 'fr', 'en-US', 'pt-BR' into (lang, country)."""
    if not s:
        return None
    parts = re.split(r"[-_]", s.strip())
    if len(parts) >= 2:
        return parts[0].lower(), parts[1].upper()
    if len(parts) == 1 and parts[0]:
        # Just a language; no country. We'll fill country later.
        return parts[0].lower(), ""
    return None


def from_tld(url: str) -> Locale | None:
    host = urlparse(url).netloc.lower()
    if not host:
        return None
    # Strip leading www.
    host = re.sub(r"^www\.", "", host)
    parts = host.split(".")
    if len(parts) < 2:
        return None
    # Try compound TLDs first (.co.uk before .uk)
    for n in (2, 1):
        candidate = ".".join(parts[-n:])
        if candidate in TLD_LOCALE_MAP:
            tag = TLD_LOCALE_MAP[candidate]
            lang, country = tag.split("-")
            return Locale(lang=lang, country=country, source="tld")
    return None


def detect(
    url: str,
    *,
    user_lang: str | None = None,
    user_country: str | None = None,
    timeout: float = 10.0,
    user_agent: str | None = None,
) -> Locale:
    """Detect the audited site's locale. CLI overrides win first."""
    if user_lang:
        return Locale(
            lang=user_lang.lower(),
            country=(user_country or "").upper() or _guess_country(user_lang),
            source="user-override",
        )

    headers = {"User-Agent": user_agent or _default_ua()}
    try:
        resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
    except requests.RequestException:
        # Network failure: fall back to TLD then en-US.
        tld_loc = from_tld(url)
        if tld_loc:
            return tld_loc
        return Locale(lang="en", country="US", source="fallback")

    # 1) <html lang="...">
    try:
        soup = BeautifulSoup(resp.text, "lxml")
        html_tag = soup.find("html")
        if html_tag and html_tag.get("lang"):
            parsed = parse_locale_string(html_tag.get("lang"))
            if parsed:
                lang, country = parsed
                if not country:
                    country = _guess_country(lang)
                return Locale(lang=lang, country=country, source="html-lang")
    except Exception:
        pass

    # 2) Content-Language header
    cl = resp.headers.get("Content-Language", "").strip()
    if cl:
        parsed = parse_locale_string(cl.split(",")[0])
        if parsed:
            lang, country = parsed
            if not country:
                country = _guess_country(lang)
            return Locale(lang=lang, country=country, source="content-language-header")

    # 3) TLD heuristic
    tld_loc = from_tld(url)
    if tld_loc:
        return tld_loc

    # 4) Fallback
    return Locale(lang="en", country="US", source="fallback")


def _guess_country(lang: str) -> str:
    """Best-effort country for a bare language code (when only `lang=` is given)."""
    return {
        "fr": "FR", "en": "US", "de": "DE", "es": "ES", "it": "IT",
        "pt": "PT", "nl": "NL", "ru": "RU", "ja": "JP", "zh": "CN",
        "ko": "KR", "ar": "SA", "pl": "PL", "sv": "SE", "no": "NO",
        "da": "DK", "fi": "FI", "tr": "TR", "cs": "CZ",
    }.get(lang.lower(), "US")


def _default_ua() -> str:
    return (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )


# --- CLI for quick testing ---
def _main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("url")
    p.add_argument("--lang")
    p.add_argument("--country")
    args = p.parse_args()
    loc = detect(args.url, user_lang=args.lang, user_country=args.country)
    print(loc)


if __name__ == "__main__":
    _main()
