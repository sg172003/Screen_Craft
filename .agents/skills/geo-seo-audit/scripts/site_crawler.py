"""Multi-page site sampling.

Given a site URL, sample N representative pages from the sitemap (or fall
back to internal-link crawling). Returns a list of (url, page_kind) tuples
with strategic diversity: homepage + service pages + blog posts + product
pages, weighted by detected vertical.

Usage (CLI):
    python3 -m scripts.site_crawler <url> [--max N] [--per-kind 3]
"""
from __future__ import annotations

import json
import random
import re
import warnings
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

warnings.filterwarnings("ignore", message=".*OpenSSL.*", category=Warning)


UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


@dataclass
class SampledPage:
    url: str
    kind: str          # homepage / service / article / product / about / contact / generic
    source: str        # "sitemap" or "internal-link"

    def to_dict(self) -> dict[str, Any]:
        return {"url": self.url, "kind": self.kind, "source": self.source}


def _classify_url(url: str, root: str) -> str:
    """Heuristic page-kind from URL path."""
    path = urlparse(url).path.lower().rstrip("/")
    if not path or path == "":
        return "homepage"

    patterns = [
        (r"/(blog|article|news|actualites?|posts?|press)/", "article"),
        (r"/(product|produits?|catalog|shop|boutique)/", "product"),
        (r"/(service|prestations?|offre)/", "service"),
        (r"/(about|qui-sommes-nous|notre-histoire|agence|equipe|team|a-propos)", "about"),
        (r"/(contact|nous-joindre)", "contact"),
        (r"/(faq|foire-aux-questions)", "faq"),
        (r"/(case-study|cas-clients?|portfolio|productions?|references?)", "case-study"),
        (r"/(jobs?|carrier?es?|recruit)", "career"),
        (r"/(legal|mentions-legales|terms|conditions|cookies|privacy|rgpd)", "legal"),
    ]
    for pat, kind in patterns:
        if re.search(pat, path):
            return kind
    # Detect short top-level pages (likely service landing pages)
    parts = [p for p in path.split("/") if p]
    if len(parts) == 1 and len(parts[0]) > 3:
        return "service"
    return "generic"


def _fetch_sitemap_urls(site_url: str, max_urls: int = 200) -> list[str]:
    """Fetch /sitemap.xml and return URLs (handles sitemap-index)."""
    base = site_url.rstrip("/")
    sitemap_url = base + "/sitemap.xml"
    try:
        r = requests.get(sitemap_url, headers={"User-Agent": UA}, timeout=20)
    except requests.RequestException:
        return []
    if r.status_code != 200:
        return []
    text = r.text

    # Detect sitemap-index
    if "<sitemapindex" in text.lower():
        sub_sitemaps = re.findall(r"<loc>([^<]+)</loc>", text)
        urls: list[str] = []
        for sm in sub_sitemaps[:10]:   # limit sub-sitemaps to keep it light
            try:
                rr = requests.get(sm.strip(), headers={"User-Agent": UA}, timeout=20)
                if rr.status_code == 200:
                    sub_urls = re.findall(r"<loc>([^<]+)</loc>", rr.text)
                    urls.extend(u.strip() for u in sub_urls)
            except requests.RequestException:
                continue
            if len(urls) >= max_urls:
                break
        return urls[:max_urls]

    # Plain sitemap
    urls = re.findall(r"<loc>([^<]+)</loc>", text)
    return [u.strip() for u in urls[:max_urls]]


def _fetch_internal_links(site_url: str) -> list[str]:
    """Fallback: extract internal links from the homepage."""
    try:
        r = requests.get(site_url, headers={"User-Agent": UA}, timeout=20)
    except requests.RequestException:
        return []
    if r.status_code != 200:
        return []
    soup = BeautifulSoup(r.text, "lxml")
    base_host = urlparse(site_url).netloc.lower()
    urls: list[str] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue
        full = urljoin(site_url, href)
        host = urlparse(full).netloc.lower()
        if host != base_host:
            continue
        # Strip fragment
        full = full.split("#")[0]
        if full in seen:
            continue
        seen.add(full)
        urls.append(full)
        if len(urls) >= 100:
            break
    return urls


def _stratified_sample(urls: list[str], root: str, max_total: int = 8, per_kind: int = 2) -> list[SampledPage]:
    """Sample diverse pages: home + N from each kind. Stable ordering for cache."""
    classified: dict[str, list[str]] = {}
    for u in urls:
        k = _classify_url(u, root)
        classified.setdefault(k, []).append(u)

    out: list[SampledPage] = []

    # Always include homepage if present
    homes = classified.get("homepage", [])
    if homes:
        out.append(SampledPage(homes[0], "homepage", "sitemap"))

    # Then N from each high-value kind
    priority_kinds = ["service", "article", "product", "about", "case-study", "faq"]
    for kind in priority_kinds:
        items = classified.get(kind, [])
        # Stable sort by URL length (shorter = more central)
        items_sorted = sorted(set(items), key=lambda u: (len(u), u))
        for u in items_sorted[:per_kind]:
            out.append(SampledPage(u, kind, "sitemap"))
            if len(out) >= max_total:
                return out

    # Fill with generic if room left
    if len(out) < max_total:
        for u in classified.get("generic", [])[:max_total - len(out)]:
            out.append(SampledPage(u, "generic", "sitemap"))

    return out[:max_total]


def sample_pages(
    site_url: str,
    *,
    max_total: int = 8,
    per_kind: int = 2,
) -> list[SampledPage]:
    """Sample up to `max_total` pages from the site, weighted by kind."""
    if not site_url.startswith("http"):
        site_url = "https://" + site_url
    site_url = site_url.rstrip("/") + "/"
    root = urlparse(site_url).netloc.lower().lstrip("www.")

    # Try sitemap first
    urls = _fetch_sitemap_urls(site_url)
    source = "sitemap"
    if not urls:
        urls = _fetch_internal_links(site_url)
        source = "internal-link"

    if not urls:
        # Last resort: just the homepage
        return [SampledPage(site_url, "homepage", "homepage-only")]

    pages = _stratified_sample(urls, root, max_total=max_total, per_kind=per_kind)
    if source == "internal-link":
        for p in pages:
            p.source = "internal-link"
    return pages


def _main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("url")
    p.add_argument("--max", type=int, default=8, help="max total pages to sample")
    p.add_argument("--per-kind", type=int, default=2, help="max pages per kind")
    args = p.parse_args()
    pages = sample_pages(args.url, max_total=args.max, per_kind=args.per_kind)
    print(json.dumps([p.to_dict() for p in pages], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _main()
