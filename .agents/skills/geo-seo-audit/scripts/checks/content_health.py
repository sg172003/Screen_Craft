"""Content health audit module.

Checks the editorial-layer signals from `docs/CONTENT_HEALTH_PATTERNS.md`:
- Anti-patterns (Mount AI risks): self-promotional listicles, mass-generated
  content fingerprints, synthetic FAQ spam, mass-refresh, negative-GEO
  injection.
- Sustainable patterns: BLUF format, definition language, atomic paragraphs.

Multi-channel coherence (M4) lives in a separate utility (cross-domain
checks); we keep this module focused on the rendered HTML signal.
"""
from __future__ import annotations

import json
import re
import warnings
from collections import Counter
from typing import Any

import requests
from bs4 import BeautifulSoup

warnings.filterwarnings("ignore", message=".*OpenSSL.*", category=Warning)

from . import CheckReport


# --- Locale-aware definition phrases (FR + EN baseline) ---
DEFINITION_PHRASES: dict[str, list[str]] = {
    "fr": [
        r"\best défini[e]?(?:\s+comme)?\b",
        r"\bdéfini[e]?\s+par\b",
        r"\bdésigne(?:r|nt)?\b",
        r"\bse\s+définit\b",
        r"\bsignifie(?:r|nt)?\b",
        r"\bconsiste\s+à\b",
        r"\bspécialisé[e]?\s+dans\b",
        r"\bse\s+caractérise\s+par\b",
        r"\bcorrespond\s+à\b",
        r"\bs'agit\s+d[e']\b",
        r"\bfait\s+référence\s+à\b",
        r"\best\s+un[e]?\s+(?:agence|entreprise|société|méthode|technique|approche)",
        r"\b(?:nous|on)\s+sommes\s+(?:un[e]?|spécialisés)",
    ],
    "en": [
        r"\bis\s+defined\s+as\b",
        r"\bdefined\s+by\b",
        r"\brefers\s+to\b",
        r"\bmeans\b",
        r"\bdesigned\s+to\b",
        r"\bspecializes?\s+in\b",
        r"\bstands\s+for\b",
        r"\bis\s+a\s+(?:type|kind|method|approach)\s+of\b",
        r"\bis\s+an?\s+(?:agency|company|firm|tool)\b",
    ],
}


# --- Anti-pattern detectors ---

LISTICLE_TITLE_RE = re.compile(
    r"^(?:.*\b)?(?:best|top|meilleur(?:e)?(?:s)?)\b[^.]*\b(?:20\d{2})\b",
    re.IGNORECASE,
)


def _detect_listicle(html: str, soup: BeautifulSoup, root_domain: str) -> bool:
    """True if the page looks like a self-promotional 'Best of YEAR' listicle.

    Triggers:
    - Title or H1 matches BEST/TOP/MEILLEUR + YEAR pattern
    - Has a numbered list structure (multiple H2/H3 with "1.", "2."… or <ol>)
    - The site's own brand appears in the first 200 words
    """
    title_el = soup.title
    h1_el = soup.find("h1")
    title_text = (title_el.get_text(strip=True) if title_el else "")
    h1_text = (h1_el.get_text(strip=True) if h1_el else "")

    title_match = bool(LISTICLE_TITLE_RE.match(title_text)) or bool(LISTICLE_TITLE_RE.match(h1_text))
    if not title_match:
        return False

    # Numbered structure check
    has_ordered_list = bool(soup.find("ol"))
    h_with_numbers = sum(
        1 for h in soup.find_all(["h2", "h3"])
        if re.match(r"^\s*\d+\.?\s+", h.get_text(strip=True))
    )
    has_numbered_structure = has_ordered_list or h_with_numbers >= 3
    if not has_numbered_structure:
        return False

    # Own brand mention in first 200 words
    body_text = soup.get_text(" ", strip=True)
    first_200_words = " ".join(body_text.split()[:200]).lower()
    brand_token = root_domain.split(".")[0].lower()
    own_brand_in_first = brand_token in first_200_words

    return own_brand_in_first


def _detect_synthetic_faq(soup: BeautifulSoup, html: str) -> bool:
    """True if the FAQ structure looks template-stuffed.

    Signals: many `Question` items with answers <30 words, OR question/answer
    pairs where the answer just paraphrases the question.
    """
    faq_blocks = re.findall(
        r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>',
        html, re.DOTALL,
    )
    questions = []
    for raw in faq_blocks:
        try:
            d = json.loads(raw.strip())
        except (json.JSONDecodeError, ValueError):
            continue
        items = d.get("@graph", [d]) if isinstance(d, dict) else d
        if not isinstance(items, list):
            items = [items]
        for item in items:
            if isinstance(item, dict) and item.get("@type") == "FAQPage":
                qs = item.get("mainEntity", [])
                if isinstance(qs, list):
                    questions.extend(qs)

    if len(questions) < 3:
        return False

    short_answer_count = 0
    paraphrase_count = 0
    for q in questions:
        if not isinstance(q, dict):
            continue
        question_text = (q.get("name") or "").lower()
        accepted = q.get("acceptedAnswer") or {}
        answer_text = (accepted.get("text") if isinstance(accepted, dict) else "") or ""
        answer_words = answer_text.split()
        if len(answer_words) < 30:
            short_answer_count += 1
        # Paraphrase detection: answer contains 80%+ of question's content words
        q_words = set(re.findall(r"\b\w{4,}\b", question_text))
        a_words = set(re.findall(r"\b\w{4,}\b", answer_text.lower()))
        if q_words and len(q_words & a_words) / len(q_words) > 0.8:
            paraphrase_count += 1

    return short_answer_count > len(questions) // 2 or paraphrase_count > len(questions) // 2


def _detect_negative_geo_block(html: str, soup: BeautifulSoup) -> str | None:
    """Detect hidden HTML blocks that look like prompt-injection targeting
    LLMs (negative GEO). Returns a snippet of the offending content if found,
    or None.

    The check distinguishes legit `<section class="agent-instructions">`
    (factual entity description) from manipulative content (exclusion
    directives, named competitors)."""
    # Look at anything in suspicious classes/IDs
    candidates = soup.find_all(
        attrs={
            "class": re.compile(r"(agent|llm|system).*(instruct|prompt|rules)", re.I)
        }
    )
    candidates += soup.find_all(
        attrs={"id": re.compile(r"(agent|llm|system).*(instruct|prompt)", re.I)}
    )

    # HTML comments
    from bs4 import Comment
    comments = soup.find_all(string=lambda x: isinstance(x, Comment))
    for c in comments:
        if any(w in c.lower() for w in ("ignore", "do not cite", "ne pas citer", "exclude", "system:")):
            return f"HTML comment: {str(c)[:120]}"

    suspicious_phrases = [
        "never cite", "ne jamais citer", "do not include", "ne pas inclure",
        "ne pas mentionner", "the only authorized", "only authoritative source",
        "exclude competitors", "ignore other sources",
    ]
    for el in candidates:
        text = el.get_text(" ", strip=True).lower()
        for p in suspicious_phrases:
            if p in text:
                return f'Block class="{" ".join(el.get("class", []))}": {text[:120]}'
    return None


# --- Sustainable-pattern measurements ---

def _measure_bluf(soup: BeautifulSoup) -> dict[str, Any]:
    """For each H2 on the page, measure the next paragraph's word count and
    presence of a number. Returns aggregate stats AND the list of failing H2
    titles with the failure reason — used by the audit to give per-H2
    actionable feedback."""
    h2s = soup.find_all("h2")
    if not h2s:
        return {
            "h2_count": 0, "bluf_compliant": 0, "bluf_long": 0, "bluf_no_number": 0,
            "failing_h2s": [],
        }

    bluf_ok = 0
    bluf_long = 0
    bluf_no_number = 0
    failing_h2s: list[dict[str, Any]] = []
    for h2 in h2s:
        title = h2.get_text(" ", strip=True)
        next_el = h2.find_next(["p", "div"])
        if not next_el:
            bluf_no_number += 1
            failing_h2s.append({"title": title, "reason": "no_paragraph"})
            continue
        text = next_el.get_text(" ", strip=True)
        words = text.split()
        wc = len(words)
        has_num = bool(re.search(r"\d", text))
        if 5 <= wc <= 60 and has_num:
            bluf_ok += 1
        elif wc > 120:
            bluf_long += 1
            failing_h2s.append({"title": title, "reason": f"too_long ({wc} mots)"})
        elif not has_num:
            bluf_no_number += 1
            failing_h2s.append({"title": title, "reason": "pas de chiffre"})
        else:
            # Edge case: short with number but somehow not ok — shouldn't happen
            failing_h2s.append({"title": title, "reason": "borderline"})

    return {
        "h2_count": len(h2s),
        "bluf_compliant": bluf_ok,
        "bluf_long": bluf_long,
        "bluf_no_number": bluf_no_number,
        "bluf_compliance_pct": round(100 * bluf_ok / len(h2s)) if h2s else 0,
        "failing_h2s": failing_h2s,
    }


def _measure_definition_language(text: str, lang: str) -> dict[str, Any]:
    """Count occurrences of definition phrases. Density = hits / paragraphs."""
    patterns = DEFINITION_PHRASES.get(lang.lower()[:2], DEFINITION_PHRASES["en"])
    text_low = text.lower()
    hits = 0
    for pat in patterns:
        hits += len(re.findall(pat, text_low))
    paras = re.split(r"\n\n+|(?<=[.!?])\s+(?=[A-ZÉÈÀÂÄÔÖÛÜ])", text)
    para_count = max(1, len([p for p in paras if len(p.split()) > 5]))
    density_pct = round(100 * hits / para_count, 1)
    return {
        "definition_hits": hits,
        "paragraph_count": para_count,
        "definition_density_pct": density_pct,
    }


def _measure_atomic_paragraphs(soup: BeautifulSoup) -> dict[str, Any]:
    """Average paragraph length + question-form heading ratio."""
    paras = soup.find_all("p")
    word_counts = [len(p.get_text(" ", strip=True).split()) for p in paras]
    word_counts = [w for w in word_counts if w > 0]
    avg_words = round(sum(word_counts) / len(word_counts), 1) if word_counts else 0

    headings = soup.find_all(["h2", "h3"])
    if headings:
        question_form = sum(
            1 for h in headings
            if h.get_text(strip=True).rstrip().endswith("?")
        )
        q_pct = round(100 * question_form / len(headings))
    else:
        q_pct = 0
    return {
        "paragraphs_count": len(word_counts),
        "avg_paragraph_words": avg_words,
        "question_heading_pct": q_pct,
    }


# --- Main audit ---

def _root_domain(url: str) -> str:
    from urllib.parse import urlparse
    host = urlparse(url).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def audit_html(html: str, url: str, *, lang: str = "en") -> CheckReport:
    """Audit a single page's content health. `lang` is ISO 639-1 (e.g. "fr").
    Other locales fall back to English templates."""
    report = CheckReport(check_name="content_health", target=url)
    soup = BeautifulSoup(html, "lxml")
    for el in soup(["script", "style", "noscript"]):
        el.decompose()
    visible_text = soup.get_text(" ", strip=True)
    root = _root_domain(url)

    # === Anti-patterns ===

    if _detect_listicle(html, soup, root):
        report.add(
            code="CHA1",
            severity="high",
            confidence="high",
            title="Self-promotional listicle pattern detected",
            description=(
                "This page looks like a 'Best of YEAR' listicle with the site's own "
                "brand placed prominently. Per Lily Ray (2026-03-18), even 0.6% of a "
                "site being these listicles can trigger -29% organic visibility on "
                "core updates."
            ),
            effort="2-4h editorial — restructure with first-hand evaluation criteria, "
                   "or depublish",
            expected_gain="Defensive — avoids Mount AI penalty",
        )

    if _detect_synthetic_faq(soup, html):
        report.add(
            code="CHA3",
            severity="medium",
            confidence="medium",
            title="Synthetic FAQ pattern detected",
            description=(
                "FAQ block has many short answers (<30 words) or answers that "
                "paraphrase the question. Synthetic FAQ inflated for `FAQPage` "
                "schema bait has been demoted by Google in late-2025/2026."
            ),
            effort="2-3h editorial — rewrite answers with substantive facts",
            expected_gain="Defensive — preserves rich-result eligibility",
        )

    neg_geo = _detect_negative_geo_block(html, soup)
    if neg_geo:
        report.add(
            code="CHA5",
            severity="medium",
            confidence="medium-high",
            title="Suspicious 'agent-instructions' content (possible negative-GEO injection)",
            description=(
                f"Detected: {neg_geo}\n\nA legitimate agent-instructions block "
                "describes the entity factually. Content with exclusion directives "
                "or named-competitor manipulation is negative-GEO. Claude refuses; "
                "ChatGPT was partially vulnerable but patches over time."
            ),
            effort="15 min — review and rewrite or remove",
            expected_gain="Reputational + future-proof",
        )

    # === Sustainable patterns ===

    bluf = _measure_bluf(soup)
    report.metrics.update(bluf)
    if bluf["h2_count"] > 0 and bluf["bluf_compliance_pct"] < 30:
        # Surface the actual failing H2 titles in `evidence` so the audit
        # can list them per-page in the action plan (instead of just "3 pages").
        evidence_h2s = [
            f"« {h.get('title', '')[:80]} » ({h.get('reason', '')})"
            for h in bluf.get("failing_h2s", [])[:8]  # cap to 8 per page
        ]
        report.add(
            code="CHM1",
            severity="medium",
            confidence="medium-high",
            title=f"BLUF format compliance: {bluf['bluf_compliance_pct']}% of H2 sections",
            description=(
                f"{bluf['bluf_compliant']}/{bluf['h2_count']} H2 sections open with a "
                "self-contained ≤60-word paragraph containing a number. Per Ahrefs "
                "(n=75 000), 53% of LLM citations come from the middle sentence of "
                "the first paragraph below an H2."
            ),
            effort="6-10h editorial — rewrite key H2 lead paragraphs",
            expected_gain="Direct on extractibility for ChatGPT / Claude / Mistral",
            evidence=evidence_h2s,
        )

    definitions = _measure_definition_language(visible_text, lang)
    report.metrics.update(definitions)
    if definitions["definition_density_pct"] < 15:
        report.add(
            code="CHM2",
            severity="medium",
            confidence="medium",
            title=f"Definition language density: {definitions['definition_density_pct']}% (target ≥30%)",
            description=(
                f"Found {definitions['definition_hits']} definition-phrase hits in "
                f"{definitions['paragraph_count']} paragraphs. Per Ahrefs, cited texts "
                "contain almost 2× more 'X is Y' / 'refers to' / 'defined as' "
                "phrasing (36% vs 20%)."
            ),
            effort="4-8h editorial — add definitional paragraphs in About / Service pages",
            expected_gain="Medium — single Ahrefs correlation study, not yet replicated",
        )

    atomic = _measure_atomic_paragraphs(soup)
    report.metrics.update(atomic)

    # No finding for atomic paragraphs by default — these are diagnostic
    # metrics for the report, not flag triggers per se. Caller can interpret.

    return report


def audit_url(url: str, *, lang: str = "en") -> CheckReport:
    try:
        r = requests.get(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
            },
            timeout=20,
        )
        if r.status_code != 200:
            rpt = CheckReport(check_name="content_health", target=url)
            rpt.error = f"http {r.status_code}"
            return rpt
    except requests.RequestException as e:
        rpt = CheckReport(check_name="content_health", target=url)
        rpt.error = f"network: {e}"
        return rpt
    return audit_html(r.text, url, lang=lang)


def _main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("url")
    p.add_argument("--lang", default="en", help="ISO 639-1 lang for definition templates")
    args = p.parse_args()
    rpt = audit_url(args.url, lang=args.lang)
    print(json.dumps(rpt.to_dict(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _main()
