"""Schema / structured-data audit module.

Implements Layer 1 (validity), Layer 2 (per-page-kind expected types) and
Layer 3 (Enhanced Entity Pages — visible facts coverage, sameAs deref,
agent-instructions, breadcrumbs) per `docs/STRUCTURED_DATA_BEST_PRACTICES.md`.

Usage (CLI):
    python3 -m scripts.checks.schema <url> [--page-kind homepage]
    # → JSON report on stdout

Usage (Python):
    from scripts.checks.schema import audit_url
    report = audit_url("https://example.com/")
    print(report.to_dict())
"""
from __future__ import annotations

import json
import re
import warnings
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

warnings.filterwarnings("ignore", message=".*OpenSSL.*", category=Warning)

from . import CheckReport, Finding


# --- Helpers ---

def _fetch(url: str, timeout: float = 20.0) -> tuple[str, dict[str, str]] | None:
    """Return (html, headers) or None on error."""
    try:
        r = requests.get(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
            },
            timeout=timeout,
        )
        if r.status_code != 200:
            return None
        return r.text, dict(r.headers)
    except requests.RequestException:
        return None


def _extract_jsonld_blocks(html: str) -> list[dict[str, Any]]:
    """Extract all parseable JSON-LD blocks. Returns a flat list of objects
    (unwrapping `@graph`)."""
    blocks_raw = re.findall(
        r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>',
        html, re.DOTALL,
    )
    out: list[dict[str, Any]] = []
    for raw in blocks_raw:
        try:
            d = json.loads(raw.strip())
        except (json.JSONDecodeError, ValueError):
            continue
        items = d.get("@graph", [d]) if isinstance(d, dict) else d
        if not isinstance(items, list):
            items = [items]
        for item in items:
            if isinstance(item, dict):
                out.append(item)
    return out


def _types_in_blocks(blocks: list[dict[str, Any]]) -> list[str]:
    """Extract @type values declared across all blocks (handles list values)."""
    out: list[str] = []
    for b in blocks:
        t = b.get("@type")
        if isinstance(t, str):
            out.append(t)
        elif isinstance(t, list):
            out.extend(t)
    return out


def _detect_page_kind(url: str, html: str, blocks: list[dict[str, Any]]) -> str:
    """Best-effort heuristic for page kind based on URL pattern + schema types."""
    types = set(_types_in_blocks(blocks))
    path = urlparse(url).path.lower().rstrip("/")

    # Homepage: empty or just "/"
    if not path or path == "":
        return "homepage"

    # Schema-driven detection
    if "Product" in types:
        return "product"
    if any(t in types for t in ("Article", "NewsArticle", "ScholarlyArticle", "BlogPosting")):
        return "article"
    if "FAQPage" in types:
        return "faq"
    if "HowTo" in types:
        return "tutorial"
    if "VideoObject" in types:
        return "video"
    if any(t in types for t in ("LocalBusiness", "Restaurant", "Store")):
        return "local"

    # URL pattern heuristics
    if re.search(r"/(blog|article|news|press)/", path):
        return "article"
    if re.search(r"/(product|produits?|catalog)/", path):
        return "product"
    if re.search(r"/(about|qui-sommes-nous|notre-histoire|agence)", path):
        return "about"
    if re.search(r"/(contact|nous-joindre)", path):
        return "contact"
    if re.search(r"/(faq|foire-aux-questions)", path):
        return "faq"

    return "generic"


def _expected_types_for_kind(kind: str) -> list[str]:
    """Schema types we recommend for each page kind. Used by Layer 2 checks."""
    return {
        "homepage": ["Organization", "WebSite", "BreadcrumbList"],
        "product": ["Product", "AggregateRating", "BreadcrumbList"],
        "article": ["Article", "Person", "BreadcrumbList"],
        "faq": ["FAQPage"],
        "tutorial": ["HowTo"],
        "local": ["LocalBusiness", "PostalAddress"],
        "about": ["Person", "Organization"],
        "video": ["VideoObject"],
    }.get(kind, [])


def _flatten_props(obj: Any, depth: int = 0, max_depth: int = 4) -> list[Any]:
    """Walk a JSON-LD object and yield scalar leaves (strings, numbers).
    Used to enumerate facts for Layer 3.1 visibility check."""
    if depth > max_depth:
        return []
    out: list[Any] = []
    if isinstance(obj, (str, int, float)):
        out.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            out.extend(_flatten_props(v, depth + 1, max_depth))
    elif isinstance(obj, list):
        for v in obj:
            out.extend(_flatten_props(v, depth + 1, max_depth))
    return out


def _extract_visible_text(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for el in soup(["script", "style", "noscript"]):
        el.decompose()
    return soup.get_text(" ", strip=True)


def _check_sameas_deref(urls: list[str], timeout: float = 6.0) -> tuple[int, int, list[str]]:
    """HEAD-check each URL. Returns (ok_count, total, dead_urls)."""
    if not urls:
        return 0, 0, []
    ok = 0
    dead: list[str] = []
    for u in urls:
        if not u or not u.startswith("http"):
            dead.append(u)
            continue
        try:
            r = requests.head(
                u,
                timeout=timeout,
                allow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if r.status_code < 400:
                ok += 1
            else:
                # Anti-bot 4xx is common on HEAD; try GET as last resort
                try:
                    r2 = requests.get(
                        u, timeout=timeout, allow_redirects=True,
                        headers={"User-Agent": "Mozilla/5.0"}, stream=True,
                    )
                    if r2.status_code < 400:
                        ok += 1
                    else:
                        dead.append(u)
                    r2.close()
                except requests.RequestException:
                    dead.append(u)
        except requests.RequestException:
            dead.append(u)
    return ok, len(urls), dead


# --- Main audit ---

def audit_html(
    html: str,
    url: str,
    *,
    page_kind: str | None = None,
    check_sameas: bool = True,
) -> CheckReport:
    """Audit a single page's structured data. `html` is the rendered page
    HTML; `url` is the canonical URL. `page_kind` overrides the auto-detect."""
    report = CheckReport(check_name="schema", target=url)
    blocks = _extract_jsonld_blocks(html)
    types = _types_in_blocks(blocks)
    kind = page_kind or _detect_page_kind(url, html, blocks)

    # Metrics
    report.metrics["jsonld_blocks"] = len(blocks)
    report.metrics["types_declared"] = sorted(set(types))
    report.metrics["page_kind"] = kind

    # --- Layer 1: validity ---
    if not blocks:
        report.add(
            code="S0",
            severity="high" if kind in ("homepage", "product", "article") else "medium",
            confidence="high",
            title="No JSON-LD structured data found",
            description=(
                "The page has no parseable JSON-LD `<script>` blocks. Schema markup "
                "is necessary for Google rich-results parsers and is one of the "
                "checked signals for RAG retrieval."
            ),
            effort="2-4h to add baseline schemas (Organization, WebPage, etc.)",
            expected_gain="High on rich-result eligibility; medium on RAG pipelines",
        )
        return report

    # Size warning (Vertex AI 20k char truncation)
    blocks_raw = re.findall(
        r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>',
        html, re.DOTALL,
    )
    oversize_blocks = [i for i, b in enumerate(blocks_raw, 1) if len(b) > 20_000]
    if oversize_blocks:
        report.add(
            code="S0b",
            severity="medium",
            confidence="high",
            title=f"JSON-LD block(s) exceed 20k chars (Vertex AI truncation)",
            description=(
                f"Block(s) #{oversize_blocks} exceed 20 000 characters. Vertex AI "
                "and other RAG indexers may truncate at this threshold, dropping "
                "later schema definitions silently."
            ),
            effort="Split the schema into separate `<script>` blocks (1-2h)",
            expected_gain="Medium — restores trustworthy parsing on truncation-prone indexers",
        )

    # --- Layer 2: expected types per page kind ---
    expected = _expected_types_for_kind(kind)
    missing = [t for t in expected if t not in types]
    if missing:
        # Severity tiering:
        # - high: page-kinds where structured data has documented strong impact
        #         (article, product, local) AND a high-impact type is missing
        # - medium: other cases
        critical_missing = bool(
            (kind == "article" and any(t in missing for t in ("Article", "NewsArticle", "ScholarlyArticle", "BlogPosting", "Person")))
            or (kind == "product" and any(t in missing for t in ("Product", "AggregateRating")))
            or (kind == "local" and any(t in missing for t in ("LocalBusiness", "PostalAddress")))
        )
        sev = "high" if critical_missing else "medium"
        report.add(
            code="S1",
            severity=sev,
            confidence="high",
            title=f"Missing expected schema type(s) for `{kind}` page: {', '.join(missing)}",
            description=(
                f"This page is detected as kind `{kind}`. Recommended types for "
                f"this kind: {', '.join(expected)}. Currently missing: {', '.join(missing)}."
            ),
            effort="30min-2h per type (use templates from `schema/` if available)",
            expected_gain="Direct: rich-result eligibility, structured-data retrieval",
        )

    # --- Layer 3.1: visible-facts coverage ---
    visible_text = _extract_visible_text(html).lower()
    # Track (original, lowercase) so we can both match case-insensitively AND
    # report the original-cased fact in evidence.
    fact_tokens_data: list[tuple[str, str]] = []
    for block in blocks:
        for prop in _flatten_props(block):
            if isinstance(prop, str):
                if prop.startswith("http") or len(prop) < 3:
                    continue
                fact_tokens_data.append((prop, prop.lower()))
            elif isinstance(prop, (int, float)):
                fact_tokens_data.append((str(prop), str(prop)))
    # Dedup by lowercase
    seen: set[str] = set()
    unique: list[tuple[str, str]] = []
    for orig, low in fact_tokens_data:
        if low not in seen:
            seen.add(low)
            unique.append((orig, low))
    fact_tokens_data = unique

    if fact_tokens_data:
        missing_facts = [orig for orig, low in fact_tokens_data if low not in visible_text]
        visible_count = len(fact_tokens_data) - len(missing_facts)
        coverage = round(100 * visible_count / len(fact_tokens_data))
        report.metrics["visible_facts_coverage_pct"] = coverage
        report.metrics["visible_facts_count"] = visible_count
        report.metrics["total_facts"] = len(fact_tokens_data)
        report.metrics["missing_facts_sample"] = missing_facts[:12]
        if coverage < 70:
            # Cap missing facts in evidence — top 8, prioritizing values
            # that look like real facts (longer strings, names, dates) over
            # short tokens.
            sample = sorted(
                missing_facts,
                key=lambda s: (-len(s) if not s.isdigit() else -10, s),
            )[:8]
            report.add(
                code="EE1",
                severity="medium",
                confidence="medium-high",
                title=f"Visible-facts coverage is {coverage}% (target ≥70%)",
                description=(
                    f"Only {visible_count}/{len(fact_tokens_data)} of the structured-data "
                    "facts also appear in the page's visible text. Per the WordLift "
                    "study (arXiv:2603.10700), JSON-LD hidden in `<script>` adds only "
                    "+0.17 pt to RAG precision — the lever is making facts visible."
                ),
                effort="1-2h editorial — move key facts into the visible body",
                expected_gain="Medium-high — Enhanced Entity Page lift on RAG retrieval",
                evidence=sample,
            )

    # --- Layer 3.2: sameAs deref ---
    sameas_urls: list[str] = []
    for block in blocks:
        sa = block.get("sameAs")
        if isinstance(sa, list):
            sameas_urls.extend([s for s in sa if isinstance(s, str)])
        elif isinstance(sa, str):
            sameas_urls.append(sa)
    sameas_urls = [u for u in sameas_urls if u.strip()]
    report.metrics["sameas_count"] = len(sameas_urls)

    if sameas_urls:
        # Detect empty strings and obvious malformed
        broken_in_array = [u for u in sameas_urls if not u or u.strip() == ""]
        if broken_in_array:
            report.add(
                code="S0c",
                severity="medium",
                confidence="high",
                title=f"`sameAs` array contains {len(broken_in_array)} empty/malformed entries",
                description=(
                    "Empty strings or invalid URLs in `sameAs` signal sloppy schema "
                    "and reduce knowledge-graph trust."
                ),
                effort="5-10 min — clean the sameAs array",
                expected_gain="Low-medium — restores entity-graph quality",
            )

        if check_sameas:
            ok, total, dead = _check_sameas_deref(
                [u for u in sameas_urls if u.strip()]
            )
            report.metrics["sameas_deref_ok"] = ok
            report.metrics["sameas_deref_total"] = total
            report.metrics["sameas_dead"] = dead
            if total and ok < total:
                # Note: HEAD-403 on big platforms (X, Crunchbase) is anti-bot, not real death
                report.add(
                    code="EE2",
                    severity="low" if (total - ok) <= 3 else "medium",
                    confidence="medium",
                    title=f"`sameAs` deref: {ok}/{total} return 200 on HEAD",
                    description=(
                        f"{total - ok} URI(s) failed HEAD: {', '.join(dead[:3])}"
                        f"{' (and more)' if len(dead) > 3 else ''}. Note: 403 on HEAD "
                        "is common anti-bot on big platforms (X, Crunchbase) — not "
                        "necessarily broken. Verify manually before flagging."
                    ),
                    effort="30 min — manual verify, fix any genuinely dead links",
                    expected_gain="Low-medium — entity-graph integrity",
                )

    # --- Layer 3.3: agent-instructions block (informational) ---
    has_agent_instructions = bool(re.search(
        r'class\s*=\s*["\']agent-instructions["\']', html, re.IGNORECASE,
    ))
    report.metrics["agent_instructions_block"] = has_agent_instructions
    if not has_agent_instructions and kind in ("homepage", "product", "article", "about"):
        report.add(
            code="EE3",
            severity="informational",
            confidence="low",
            title="No `<section class=\"agent-instructions\">` block (emerging pattern)",
            description=(
                "This is an emerging 2026 pattern (Volpini et al. arXiv:2603.10700) "
                "where a hidden HTML block instructs LLM agents on how to read the "
                "entity. The contribution to RAG precision is part of the +29.6% "
                "Enhanced Entity Page bundle but not isolated by ablation. Optional, "
                "experimental."
            ),
            effort="30 min to add a tailored, entity-specific block",
            expected_gain="Experimental — possible future lift, not a confirmed lever in 2026",
        )

    # --- Layer 3.4: breadcrumbs ---
    bc_blocks = [b for b in blocks if b.get("@type") == "BreadcrumbList"]
    if bc_blocks:
        for b in bc_blocks:
            items = b.get("itemListElement", [])
            n = len(items) if isinstance(items, list) else 1
            report.metrics["breadcrumb_items"] = n
            if n <= 1 and kind != "homepage":
                report.add(
                    code="EE4",
                    severity="medium",
                    confidence="high",
                    title=f"`BreadcrumbList` schema has only {n} item(s)",
                    description=(
                        "BreadcrumbList should reflect the page's place in the site "
                        "hierarchy. A single item (or empty) gives no navigation context "
                        "to AI crawlers."
                    ),
                    effort="1-2h dev — populate with actual navigation chain",
                    expected_gain="Medium — rich-result eligibility, RAG navigation",
                )

    # Visible breadcrumb HTML (informational — homepages don't need this)
    has_visible_bc = bool(re.search(
        r'<nav[^>]*(?:breadcrumb|fil-d-ariane|ariane)[^>]*>', html, re.IGNORECASE,
    ))
    report.metrics["visible_breadcrumb"] = has_visible_bc

    return report


def audit_url(url: str, **kwargs) -> CheckReport:
    """Fetch the URL and audit it. Returns a CheckReport with `error` set on
    network failure."""
    fetched = _fetch(url)
    if fetched is None:
        report = CheckReport(check_name="schema", target=url)
        report.error = "fetch failed (network or non-200)"
        return report
    html, _headers = fetched
    return audit_html(html, url, **kwargs)


# --- CLI ---

def _main():
    import argparse, sys
    p = argparse.ArgumentParser()
    p.add_argument("url")
    p.add_argument("--page-kind", default=None)
    p.add_argument("--no-sameas-deref", action="store_true")
    args = p.parse_args()
    rpt = audit_url(args.url, page_kind=args.page_kind, check_sameas=not args.no_sameas_deref)
    print(json.dumps(rpt.to_dict(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _main()
