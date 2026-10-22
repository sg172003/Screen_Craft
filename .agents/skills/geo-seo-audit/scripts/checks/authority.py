"""Authority diagnostic — measures off-page signals that on-page audits miss.

The competitor benchmark (Phase 4.5) tells the user *if* a gap is on-page
or off-page. When it points at off-page, the natural follow-up is "OK,
how am I doing on authority signals then?". This module answers that.

**Hard constraint: free APIs only, no paid keys, no signup.**
- MediaWiki API (Wikipedia FR + EN) — open
- Wikidata `wbsearchentities` API — open
- Wayback Machine CDX API — open

**Signals measured:**
1. Wikipedia FR + EN presence (page exists at /wiki/<BrandName>)
2. Wikidata Q-id (top search result for brand name + description match)
3. Wayback first-snapshot date → domain age in years (proxy for established
   web presence)

**What this is NOT:**
- Not a backlinks count (would need Ahrefs/Majestic, paid)
- Not a press-mention scan (would need news API, paid)
- Not an entity-disambiguation system — a Wikipedia page named "Slidor" might
  be a different entity. The audit reports the *match* with its description
  and lets the human verify.

**Confidence calibration per finding:**
- Wikipedia/Wikidata absence → `high` confidence (well-documented signal that
  LLMs use Wikipedia/Wikidata for entity grounding).
- Domain age → `medium` confidence (correlation, not causation; old domains
  generally outrank young ones, but plenty of counter-examples).
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime
from urllib.parse import quote, urlparse

import requests

from . import CheckReport


_UA = (
    "GEO-Audit-Toolkit/1.0 "
    "(github.com/Ghanyte/geo-seo-audit; "
    "free-no-setup audit tool; "
    "respects rate limits)"
)


# ---------------------------------------------------------------------------
# Brand-name extraction
# ---------------------------------------------------------------------------

def _extract_brand_name(schema_reports: list | None, domain: str) -> str:
    """Best-effort brand name extraction.

    Priority:
    1. `Organization.name` from any schema_report (most reliable)
    2. `WebSite.name`
    3. Domain-derived: `atelier-loupiote.fr` → "Atelier Loupiote"
    """
    if schema_reports:
        for r in schema_reports:
            if r.error:
                continue
            for entity_type in ("Organization", "ProfessionalService", "LocalBusiness", "WebSite"):
                names = r.metrics.get("entity_names", {}).get(entity_type) if isinstance(r.metrics, dict) else None
                if names:
                    if isinstance(names, list) and names:
                        return str(names[0])
                    if isinstance(names, str):
                        return names
    # Fallback: domain-derived
    base = domain.replace("www.", "").split("/")[0].split(".")[0]
    return " ".join(p.capitalize() for p in re.split(r"[-_]", base) if p)


# ---------------------------------------------------------------------------
# Wikipedia (FR + EN)
# ---------------------------------------------------------------------------

def _check_wikipedia(brand_name: str, lang: str, domain: str, timeout: int = 8) -> dict:
    """Check whether a Wikipedia page exists for the brand and IS ABOUT the
    audited entity (not a homonym). Disambiguation via:
    1. Page exists at /wiki/<BrandName> ?
    2. If yes → fetch the page's `pageprops.wikibase_item` (Q-id)
    3. → fetch that Q-id's `P856` (official website)
    4. → match against the audited domain

    Returns:
      {exists: bool,         # page exists at the title
       confidence: str,      # 'verified' | 'unverified' | None
       url, title, extract, qid, official_websites,
       error}
    """
    base = f"https://{lang}.wikipedia.org/w/api.php"
    url = f"https://{lang}.wikipedia.org/wiki/{quote(brand_name.replace(' ', '_'))}"
    try:
        r = requests.get(
            base,
            params={
                "action": "query",
                "format": "json",
                "titles": brand_name,
                "prop": "extracts|pageprops",
                "exintro": "1",
                "explaintext": "1",
                "redirects": "1",
            },
            headers={"User-Agent": _UA},
            timeout=timeout,
        )
        if r.status_code != 200:
            return {"exists": False, "url": url, "error": f"http {r.status_code}"}
        pages = r.json().get("query", {}).get("pages", {})
        for page_id, page in pages.items():
            if page_id == "-1" or "missing" in page:
                return {"exists": False, "url": url, "error": None}
            title = page.get("title", "")
            extract = (page.get("extract") or "")[:240]
            # Disambiguation step: read the Wikidata Q-id linked from this article
            qid = page.get("pageprops", {}).get("wikibase_item")
            confidence = None
            official_websites: list[str] = []
            if qid:
                # Fetch P856 from Wikidata
                try:
                    wd = requests.get(
                        "https://www.wikidata.org/w/api.php",
                        params={
                            "action": "wbgetentities",
                            "ids": qid,
                            "props": "claims",
                            "format": "json",
                        },
                        headers={"User-Agent": _UA},
                        timeout=timeout,
                    )
                    if wd.status_code == 200:
                        for claim in (wd.json().get("entities", {}).get(qid, {}).get("claims", {}).get("P856") or []):
                            try:
                                v = claim["mainsnak"]["datavalue"]["value"]
                                if isinstance(v, str):
                                    official_websites.append(v)
                            except (KeyError, TypeError):
                                continue
                except (requests.RequestException, ValueError):
                    pass
                if any(_domain_matches(domain, w) for w in official_websites):
                    confidence = "verified"
                else:
                    confidence = "unverified"
            else:
                # Article exists but has no Wikidata link — can't disambiguate via P856
                confidence = "unverified"
            return {
                "exists": True,
                "confidence": confidence,
                "url": url,
                "title": title,
                "extract": extract,
                "qid": qid,
                "official_websites": official_websites,
                "error": None,
            }
        return {"exists": False, "url": url, "error": None}
    except (requests.RequestException, ValueError) as e:
        return {"exists": False, "url": url, "error": f"{type(e).__name__}: {e}"}


# ---------------------------------------------------------------------------
# Wikidata
# ---------------------------------------------------------------------------

def _domain_matches(domain: str, candidate_url: str) -> bool:
    """True if the candidate URL's host matches the audited domain (modulo
    www prefix and trailing slashes)."""
    if not candidate_url:
        return False
    try:
        cand_host = urlparse(candidate_url).netloc.lower()
    except Exception:
        return False
    if cand_host.startswith("www."):
        cand_host = cand_host[4:]
    target = domain.lower().replace("https://", "").replace("http://", "").rstrip("/")
    if target.startswith("www."):
        target = target[4:]
    target = target.split("/")[0]
    return cand_host == target


def _check_wikidata(
    brand_name: str,
    domain: str,
    language: str = "fr",
    timeout: int = 8,
) -> dict:
    """Search Wikidata for an entity matching the brand name AND the domain.

    Two-step disambiguation:
    1. `wbsearchentities` finds candidates by label (top 5)
    2. `wbgetentities` for each candidate fetches `P856` (official website).
       If a candidate's P856 host matches the audited domain → confirmed match.

    Returns:
      {found: bool, confidence: 'verified' | 'unverified' | None,
       qid, label, description, official_website, candidates: [...], error}

    `confidence`:
    - 'verified'   = a candidate's P856 official website matches the domain
    - 'unverified' = candidates found by label but none has matching P856
                     (likely homonyms — UI must say "à vérifier")
    - None / not found = no candidate at all
    """
    base = "https://www.wikidata.org/w/api.php"
    try:
        # Step 1: search by label
        r = requests.get(
            base,
            params={
                "action": "wbsearchentities",
                "search": brand_name,
                "language": language,
                "format": "json",
                "limit": 5,
                "type": "item",
            },
            headers={"User-Agent": _UA},
            timeout=timeout,
        )
        if r.status_code != 200:
            return {"found": False, "error": f"http {r.status_code}"}
        results = r.json().get("search", []) or []
        if not results:
            return {"found": False, "error": None}

        # Step 2: fetch full entities to read P856 (official website)
        qids = [c.get("id") for c in results if c.get("id")]
        full_url = base
        full = requests.get(
            full_url,
            params={
                "action": "wbgetentities",
                "ids": "|".join(qids),
                "props": "claims|labels|descriptions",
                "languages": f"{language}|en",
                "format": "json",
            },
            headers={"User-Agent": _UA},
            timeout=timeout,
        )
        full_data = full.json().get("entities", {}) if full.status_code == 200 else {}

        verified_qid = None
        candidates: list[dict] = []
        for c in results:
            qid = c.get("id")
            entity = full_data.get(qid, {}) if qid else {}
            # Extract official website (P856)
            official_websites: list[str] = []
            for claim in (entity.get("claims", {}).get("P856") or []):
                try:
                    val = claim["mainsnak"]["datavalue"]["value"]
                    if isinstance(val, str):
                        official_websites.append(val)
                except (KeyError, TypeError):
                    continue
            domain_match = any(_domain_matches(domain, w) for w in official_websites)

            cand = {
                "qid": qid,
                "label": c.get("label"),
                "description": c.get("description") or "",
                "url": c.get("concepturi") or f"https://www.wikidata.org/wiki/{qid}",
                "official_websites": official_websites,
                "domain_match": domain_match,
            }
            candidates.append(cand)
            if domain_match and verified_qid is None:
                verified_qid = qid

        if verified_qid:
            verified = next(c for c in candidates if c["qid"] == verified_qid)
            return {
                "found": True,
                "confidence": "verified",
                "qid": verified["qid"],
                "label": verified["label"],
                "description": verified["description"],
                "url": verified["url"],
                "official_websites": verified["official_websites"],
                "candidates": candidates,
                "error": None,
            }
        else:
            # Candidates exist but none matches the domain → likely homonyms
            top = candidates[0]
            return {
                "found": True,
                "confidence": "unverified",
                "qid": top["qid"],
                "label": top["label"],
                "description": top["description"],
                "url": top["url"],
                "official_websites": top["official_websites"],
                "candidates": candidates,
                "error": None,
            }
    except (requests.RequestException, ValueError, StopIteration) as e:
        return {"found": False, "error": f"{type(e).__name__}: {e}"}


# ---------------------------------------------------------------------------
# Wayback Machine first snapshot
# ---------------------------------------------------------------------------

def _check_wayback(domain: str, timeout: int = 15) -> dict:
    """Fetch the first Wayback Machine snapshot of the domain.

    Returns {first_snapshot: 'YYYYMMDD', age_years: float, error: str | None}.
    The CDX API is rate-limited and occasionally slow; we retry once on
    timeout before giving up.
    """
    # Strip protocol + www if present
    d = domain.replace("https://", "").replace("http://", "").rstrip("/")
    if d.startswith("www."):
        d = d[4:]
    api = "http://web.archive.org/cdx/search/cdx"
    params = {
        "url": d,
        "from": "1996",
        "to": str(date.today().year),
        "output": "json",
        "limit": "1",
        "filter": "statuscode:200",
    }

    last_err = None
    for attempt in range(2):
        try:
            r = requests.get(api, params=params, headers={"User-Agent": _UA}, timeout=timeout)
            if r.status_code != 200:
                return {"first_snapshot": None, "age_years": None, "error": f"http {r.status_code}"}
            data = r.json()
            if len(data) < 2:
                return {"first_snapshot": None, "age_years": None, "error": None}
            first_row = data[1]
            ts = first_row[1]  # YYYYMMDDHHMMSS
            snap_date = datetime.strptime(ts[:8], "%Y%m%d").date()
            age = (date.today() - snap_date).days / 365.25
            return {
                "first_snapshot": ts[:8],
                "first_snapshot_iso": snap_date.isoformat(),
                "age_years": round(age, 1),
                "error": None,
            }
        except (requests.RequestException, ValueError, IndexError) as e:
            last_err = f"{type(e).__name__}: {e}"
            if attempt == 0:
                time.sleep(2)
                continue
            break
    return {"first_snapshot": None, "age_years": None, "error": last_err}


# ---------------------------------------------------------------------------
# Top-level audit function
# ---------------------------------------------------------------------------

def audit_authority(
    domain: str,
    *,
    brand_name: str | None = None,
    schema_reports: list | None = None,
    target_locale: str = "fr",
) -> CheckReport:
    """Run all 3 authority checks on a domain. Returns a CheckReport with
    findings + metrics. `brand_name` is auto-extracted from schema_reports
    if not provided.
    """
    if brand_name is None:
        brand_name = _extract_brand_name(schema_reports, domain)

    # Polite micro-pauses between API calls (different services, but be nice)
    wp_fr = _check_wikipedia(brand_name, "fr", domain=domain)
    time.sleep(0.3)
    wp_en = _check_wikipedia(brand_name, "en", domain=domain)
    time.sleep(0.3)
    wd = _check_wikidata(
        brand_name,
        domain=domain,
        language=target_locale.split("-")[0] if "-" in target_locale else target_locale,
    )
    time.sleep(0.3)
    way = _check_wayback(domain)

    rpt = CheckReport(check_name="authority", target=domain, metrics={
        "brand_name": brand_name,
        "wikipedia_fr": wp_fr,
        "wikipedia_en": wp_en,
        "wikidata": wd,
        "wayback": way,
    })

    # --- Findings ---
    # Track verified Wikipedia presence (page exists AND P856 matches domain)
    wp_fr_verified = wp_fr.get("exists") and wp_fr.get("confidence") == "verified"
    wp_en_verified = wp_en.get("exists") and wp_en.get("confidence") == "verified"

    # AUTH1: No verified Wikipedia at all (FR + EN both either missing or homonym)
    if not wp_fr_verified and not wp_en_verified:
        rpt.add(
            code="AUTH1",
            severity="medium",
            confidence="high",
            title=f"Aucune entrée Wikipedia vérifiée (FR ou EN) pour « {brand_name} »",
            description=(
                "Wikipedia est l'une des sources d'entité les plus consultées par les LLMs "
                "(ChatGPT, Gemini, Perplexity, Claude). Aucune page Wikipedia FR ou EN ne lie son "
                "Wikidata-Q-id avec un `P856` (site officiel) matchant le domaine audité. Soit la "
                "page n'existe pas, soit elle existe mais désigne une autre entité homonyme, soit "
                "elle existe mais sa fiche Wikidata n'a pas P856."
            ),
            effort="Long terme — bar de notabilité Wikipedia élevé. Demande 3-5 mentions presse "
                   "indépendantes (Les Echos, Maddyness, BFM, JDN, FrenchWeb, Le Figaro Tech…) "
                   "comme prérequis.",
            expected_gain="Fort sur LLMs Google-backed (ChatGPT, Gemini, AIO) — Wikipedia est "
                          "une source canonique pour leur graphe d'entités.",
            evidence=[wp_fr.get("url", ""), wp_en.get("url", "")],
        )
    elif not wp_fr_verified and target_locale.startswith("fr"):
        rpt.add(
            code="AUTH1b",
            severity="low",
            confidence="medium-high",
            title=f"Wikipedia EN existe mais pas Wikipedia FR pour « {brand_name} »",
            description=(
                "Le LLM Le Chat (Mistral) a un biais favorable au contenu francophone, et "
                "Gemini/Google AIO en France privilégie aussi la version FR. L'absence côté FR "
                "alors que l'EN existe est un gap localisé."
            ),
            effort="2-4h éditorial pour traduire la version EN en FR + adaptation locale.",
            expected_gain="Moyen — surtout sur les LLMs francophones (Le Chat, Gemini FR).",
            evidence=[wp_fr.get("url", "")],
        )

    # AUTH2: Wikidata — three states
    #   - Not found at all → AUTH2 (medium severity, high confidence)
    #   - Candidates found but none has matching P856 → AUTH2u (medium, confidence high — likely homonyms)
    #   - Verified (P856 matches) → no finding (it's a strength)
    if not wd.get("found"):
        rpt.add(
            code="AUTH2",
            severity="medium",
            confidence="high",
            title=f"Aucune fiche Wikidata pour « {brand_name} »",
            description=(
                "Wikidata est le graphe de connaissances structuré que tous les LLMs majeurs "
                "consultent pour ancrer une entité. Une fiche Wikidata est plus facile à créer "
                "qu'une page Wikipedia (bar de notabilité plus bas) et constitue un signal d'entité "
                "fort. Permet aussi de lier `sameAs` du JSON-LD à l'entité Wikidata."
            ),
            effort="1-2h — créer la fiche Wikidata avec : label, description, instance of (organisation), "
                   "country, founder, official website (`P856` ← critique pour l'auto-disambiguation), "
                   "social profiles.",
            expected_gain="Moyen-fort — knowledge-graph anchoring sur tous les LLMs Google-backed et "
                          "indirectement sur les LLMs Brave-backed via le `sameAs` JSON-LD.",
            evidence=[],
        )
    elif wd.get("confidence") == "unverified":
        rpt.add(
            code="AUTH2u",
            severity="medium",
            confidence="high",
            title=f"Aucune fiche Wikidata vérifiée pour « {brand_name} » (candidats homonymes uniquement)",
            description=(
                f"Wikidata renvoie des candidats sur le label « {brand_name} » mais **aucun n'a "
                f"`P856` (site web officiel) qui matche le domaine `{domain}`** — ce sont donc "
                "très probablement des homonymes (autres entités portant le même nom). Le toolkit "
                "ne peut PAS confirmer ta présence Wikidata sur cette base. Si tu as bien une fiche, "
                "elle manque le champ P856 et ne sera pas trouvée par les LLMs lors de la "
                "résolution d'entité par domaine."
            ),
            effort="1-2h — créer (ou compléter) une fiche Wikidata avec `P856` = ton URL officielle. "
                   "Sans P856, les LLMs ne peuvent pas lier ta marque à ton domaine.",
            expected_gain="Moyen-fort — sans P856, l'entité Wikidata existe mais n'est pas reliée à ton site.",
            evidence=[c.get("url", "") for c in wd.get("candidates", [])[:3]],
        )

    # AUTH3: Domain age
    age = way.get("age_years")
    if age is not None:
        if age < 2:
            rpt.add(
                code="AUTH3",
                severity="low",
                confidence="medium",
                title=f"Domaine jeune ({age} ans depuis le 1er snapshot Wayback)",
                description=(
                    "Les algorithmes de pondération de SERP (Google, Brave) favorisent en général "
                    "les domaines établis. Un domaine de moins de 2 ans peut souffrir d'un déficit "
                    "de signal de stabilité. Pas de levier direct (le temps fait son œuvre), mais "
                    "à compenser via les autres signaux d'autorité (Wikidata, mentions presse)."
                ),
                effort="Aucun (le temps).",
                expected_gain="Faible — corrélation, pas causation. Surveillé surtout pour le diagnostic.",
                evidence=[f"Premier snapshot Wayback : {way.get('first_snapshot_iso', '?')}"],
            )

    return rpt


# ---------------------------------------------------------------------------
# CLI for ad-hoc testing
# ---------------------------------------------------------------------------

def _main():
    import argparse, json
    p = argparse.ArgumentParser(description="Authority diagnostic for a domain.")
    p.add_argument("domain", help="e.g. atelier-loupiote.fr or https://example.com")
    p.add_argument("--brand-name", default=None, help="Override brand name (default: derived from domain)")
    p.add_argument("--locale", default="fr", help="Wikidata search locale (fr, en, ...)")
    args = p.parse_args()

    rpt = audit_authority(args.domain, brand_name=args.brand_name, target_locale=args.locale)
    print(json.dumps(rpt.to_dict(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _main()
