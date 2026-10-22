"""Fan-out query generation.

Two operating modes:

**Seed mode** (`generate(seed, ...)`): given a seed phrase, expand it via
locale-aware templates (best/comparison/price/etc. variants). Useful when
auditing a generic concept.

**Positioning mode** (`generate_for_positioning(positioning, ...)`): given a
positioning string the user wants to dominate (e.g. "agence powerpoint" for
Slidor), produce an objective-aligned fan-out where **every variant contains
the positioning's key tokens**. Off-objective queries are eliminated by
construction. This is the recommended mode for any real audit — generic seeds
generate noise, positioning-driven seeds generate signal.

Google is often blocked by anti-bot in 2026 (cf. `scripts/serp/google.py`).
PAA/Related Searches scrape is a bonus; templates alone produce a usable set.
"""
from __future__ import annotations

from dataclasses import dataclass

from scripts.serp.google import GoogleEngine


# --- Locale-aware template patterns ---
# Each template is a list of formatted query patterns. `{seed}` is the user's
# seed query. We choose templates per language; country variation barely
# matters at this layer.
TEMPLATES: dict[str, list[str]] = {
    "fr": [
        "{seed}",
        "meilleur {seed}",
        "meilleure {seed}",
        "meilleurs {seed}",
        "top {seed}",
        "comparatif {seed}",
        "{seed} avis",
        "{seed} avis client",
        "comment choisir {seed}",
        "comment trouver {seed}",
        "prix {seed}",
        "tarif {seed}",
        "{seed} pas cher",
        "qu'est-ce que {seed}",
        "{seed} définition",
        "alternatives {seed}",
        "{seed} 2026",
        "{seed} guide",
        "{seed} exemple",
        "agence {seed}",
        "expert {seed}",
        "consultant {seed}",
    ],
    "en": [
        "{seed}",
        "best {seed}",
        "top {seed}",
        "best {seed} 2026",
        "{seed} reviews",
        "{seed} comparison",
        "how to choose {seed}",
        "how to find {seed}",
        "{seed} price",
        "{seed} pricing",
        "what is {seed}",
        "{seed} definition",
        "{seed} alternatives",
        "{seed} 2026",
        "{seed} guide",
        "{seed} example",
        "{seed} agency",
        "{seed} expert",
        "{seed} consultant",
    ],
    "de": [
        "{seed}",
        "beste {seed}",
        "{seed} Vergleich",
        "{seed} Test",
        "{seed} Erfahrungen",
        "{seed} Preis",
        "was ist {seed}",
        "{seed} Alternativen",
        "{seed} 2026",
    ],
    "es": [
        "{seed}",
        "mejor {seed}",
        "comparativa {seed}",
        "{seed} opiniones",
        "{seed} precio",
        "qué es {seed}",
        "{seed} alternativas",
        "{seed} 2026",
    ],
    "it": [
        "{seed}",
        "miglior {seed}",
        "{seed} recensioni",
        "{seed} prezzo",
        "comparativa {seed}",
        "alternative {seed}",
    ],
    "pt": [
        "{seed}",
        "melhor {seed}",
        "{seed} avaliações",
        "{seed} preço",
        "{seed} alternativas",
    ],
}


# Positioning templates: the {positioning} placeholder is guaranteed to
# appear in EVERY generated query. Modifiers go before/after, never replace.
POSITIONING_TEMPLATES: dict[str, list[str]] = {
    "fr": [
        "{positioning}",
        "meilleure {positioning}",
        "meilleur {positioning}",
        "top {positioning}",
        "comparatif {positioning}",
        "{positioning} avis",
        "{positioning} avis client",
        "comment choisir {positioning}",
        "comment trouver une {positioning}",
        "prix {positioning}",
        "tarif {positioning}",
        "{positioning} pas cher",
        "{positioning} freelance",
        "{positioning} française",
        "{positioning} française b2b",
        "{positioning} corporate",
        "{positioning} professionnelle",
        "alternative {positioning}",
        "{positioning} 2026",
    ],
    "en": [
        "{positioning}",
        "best {positioning}",
        "top {positioning}",
        "best {positioning} 2026",
        "{positioning} reviews",
        "{positioning} comparison",
        "how to choose {positioning}",
        "{positioning} pricing",
        "{positioning} freelance",
        "{positioning} alternative",
        "{positioning} agency",
    ],
}


# Geographic modifiers per country. Used when --geo-cities is enabled to add
# a few city-targeted variants.
GEO_MODIFIERS: dict[str, list[str]] = {
    "FR": ["paris", "lyon", "marseille", "bordeaux", "toulouse"],
    "BE": ["bruxelles", "anvers"],
    "CH": ["geneve", "lausanne", "zurich"],
    "DE": ["berlin", "munich", "hamburg"],
    "ES": ["madrid", "barcelona"],
    "IT": ["milan", "roma"],
    "US": ["new york", "san francisco", "los angeles"],
    "GB": ["london", "manchester"],
}


@dataclass
class FanOutSet:
    seed: str
    locale: str
    queries: list[str]
    templates_used: int          # how many came from templates
    paa_used: int                 # how many came from Google PAA
    related_used: int             # how many came from Google Related Searches
    google_status: str            # "ok", "blocked", or "skipped"


def _templates_for_lang(lang: str) -> list[str]:
    """Pick the template set for the language; fall back to English."""
    return TEMPLATES.get(lang.lower(), TEMPLATES["en"])


def _positioning_templates_for_lang(lang: str) -> list[str]:
    return POSITIONING_TEMPLATES.get(lang.lower(), POSITIONING_TEMPLATES["en"])


def _key_tokens(positioning: str) -> set[str]:
    """Extract the content-bearing tokens of a positioning string for the
    'every variant must contain these tokens' guarantee. Strips trivial words."""
    import re
    stop_fr = {"de", "du", "la", "le", "les", "des", "et", "à", "au", "aux", "un", "une"}
    stop_en = {"a", "an", "the", "of", "for", "and", "in", "on"}
    stops = stop_fr | stop_en
    tokens = re.findall(r"\w+", positioning.lower())
    return {t for t in tokens if t not in stops and len(t) > 2}


def expand_with_templates(seed: str, lang: str) -> list[str]:
    """Pure-template fan-out — works without any network call."""
    out: list[str] = []
    for tmpl in _templates_for_lang(lang):
        q = tmpl.format(seed=seed.strip())
        if q and q not in out:
            out.append(q)
    return out


def generate(
    seed: str,
    locale: str,
    *,
    use_google: bool = True,
    google_engine: GoogleEngine | None = None,
    cap: int = 30,
) -> FanOutSet:
    """Build a deduplicated fan-out set for one seed query.

    `use_google=False` skips the Google PAA/Related fetch — useful for offline
    tests and CI runs.
    """
    seed = seed.strip()
    if not seed:
        return FanOutSet(seed=seed, locale=locale, queries=[], templates_used=0, paa_used=0, related_used=0, google_status="skipped")

    lang = locale.split("-")[0].lower() if locale else "en"

    # 1) Templates first — cheap, always work
    template_queries = expand_with_templates(seed, lang)

    # 2) Try Google PAA + Related (best-effort)
    google_status = "skipped"
    paa_queries: list[str] = []
    related_queries: list[str] = []
    if use_google:
        eng = google_engine or GoogleEngine()
        resp = eng.fetch(seed, locale)
        if resp.ok:
            google_status = "ok"
            # PAA — keep questions, drop trailing "?" duplicates
            for q in resp.paa[:8]:
                qn = q.strip()
                if qn and qn not in paa_queries:
                    paa_queries.append(qn)
            # Related — keep mid-tail variants
            for q in resp.related[:8]:
                qn = q.strip()
                if qn and qn not in related_queries:
                    related_queries.append(qn)
        else:
            google_status = f"blocked ({resp.error})"

    # 3) Merge + dedupe (case-insensitive)
    seen_lower: set[str] = set()
    merged: list[str] = []

    def _add_unique(qs: list[str]) -> int:
        added = 0
        for q in qs:
            key = q.lower()
            if key in seen_lower:
                continue
            seen_lower.add(key)
            merged.append(q)
            added += 1
            if len(merged) >= cap:
                break
        return added

    t_used = _add_unique(template_queries)
    p_used = _add_unique(paa_queries)
    r_used = _add_unique(related_queries)

    return FanOutSet(
        seed=seed,
        locale=locale,
        queries=merged,
        templates_used=t_used,
        paa_used=p_used,
        related_used=r_used,
        google_status=google_status,
    )


def expand_with_positioning_templates(positioning: str, lang: str) -> list[str]:
    """Pure-template fan-out for positioning mode. Every variant guaranteed
    to contain the positioning string."""
    out: list[str] = []
    p = positioning.strip()
    for tmpl in _positioning_templates_for_lang(lang):
        q = tmpl.format(positioning=p)
        if q and q not in out:
            out.append(q)
    return out


def generate_for_positioning(
    positioning: str,
    locale: str,
    *,
    cities: list[str] | None = None,
    extra_modifiers: list[str] | None = None,
    cap: int = 25,
) -> FanOutSet:
    """Build an objective-aligned fan-out set.

    `positioning` is the phrase the user wants to dominate (e.g. "agence
    powerpoint" for Slidor). All output queries contain the key tokens of
    this phrase by construction — off-objective queries are filtered.

    `cities` (optional): list of cities to add as geographic suffixes. If
    None, no geo expansion. Pass an empty list to explicitly disable.

    `extra_modifiers` (optional): additional positioning-specific modifiers
    the caller wants to add (e.g. ["b2b", "saas", "startup"]).

    No Google call (positioning mode is fully deterministic; the user has
    already specified the intent).
    """
    positioning = positioning.strip()
    if not positioning:
        return FanOutSet(
            seed=positioning, locale=locale, queries=[],
            templates_used=0, paa_used=0, related_used=0,
            google_status="skipped",
        )

    lang = locale.split("-")[0].lower() if locale else "en"
    key_tokens = _key_tokens(positioning)

    # 1. Base templates
    base = expand_with_positioning_templates(positioning, lang)

    # 2. Geographic variants (only if cities passed)
    if cities is None:
        cities = []
    geo_variants = [f"{positioning} {c}" for c in cities]
    geo_variants += [f"meilleure {positioning} {c}" for c in cities[:2]]

    # 3. Extra modifiers (caller-supplied)
    extra_variants: list[str] = []
    if extra_modifiers:
        for m in extra_modifiers:
            m = m.strip().lower()
            if m:
                extra_variants.append(f"{positioning} {m}")
                extra_variants.append(f"{m} {positioning}")

    # Merge + dedupe (case-insensitive), enforce key-token containment
    seen_lower: set[str] = set()
    merged: list[str] = []
    for batch in (base, geo_variants, extra_variants):
        for q in batch:
            q = q.strip()
            if not q or q.lower() in seen_lower:
                continue
            # Defensive: guarantee key tokens are still in the query
            q_low = q.lower()
            if not all(t in q_low for t in key_tokens):
                continue
            seen_lower.add(q.lower())
            merged.append(q)
            if len(merged) >= cap:
                break
        if len(merged) >= cap:
            break

    return FanOutSet(
        seed=positioning,
        locale=locale,
        queries=merged,
        templates_used=len([q for q in merged if q in base]),
        paa_used=0,
        related_used=0,
        google_status="not-applicable (positioning mode)",
    )


def _main():
    import argparse, json
    p = argparse.ArgumentParser()
    p.add_argument("seed_or_positioning")
    p.add_argument("--locale", default="fr-FR")
    p.add_argument("--positioning", action="store_true",
                   help="Treat input as positioning (every variant guaranteed to contain the key tokens)")
    p.add_argument("--cities", default="", help="comma-separated city names for geo variants")
    p.add_argument("--extras", default="", help="comma-separated extra modifiers (e.g. b2b,saas)")
    p.add_argument("--no-google", action="store_true", help="Seed mode only: skip Google PAA/Related")
    p.add_argument("--cap", type=int, default=30)
    args = p.parse_args()

    if args.positioning:
        cities = [c.strip() for c in args.cities.split(",") if c.strip()]
        extras = [e.strip() for e in args.extras.split(",") if e.strip()]
        out = generate_for_positioning(
            args.seed_or_positioning, args.locale,
            cities=cities, extra_modifiers=extras, cap=args.cap,
        )
    else:
        out = generate(
            args.seed_or_positioning, args.locale,
            use_google=not args.no_google, cap=args.cap,
        )

    print(json.dumps({
        "input": out.seed,
        "locale": out.locale,
        "google_status": out.google_status,
        "templates_used": out.templates_used,
        "paa_used": out.paa_used,
        "related_used": out.related_used,
        "queries_count": len(out.queries),
        "queries": out.queries,
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _main()
