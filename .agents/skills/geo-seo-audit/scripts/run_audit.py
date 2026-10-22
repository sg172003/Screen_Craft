"""Unified GEO audit orchestrator.

Chains the full Phase-1.5 pipeline into a single comprehensive markdown report:
  1. Locale detection
  2. Multi-page sampling (sitemap or internal-link fallback)
  3. Per-page checks: schema (Layer 1+2+3 EEP) and content_health
  4. Site-level checks: crawlers (robots.txt taxonomy)
  5. (Optional) measured RRF across DDG/Brave/Bing if --seed provided
  6. Aggregate + write a comprehensive markdown audit + update info.json

Usage:
    python3 -m scripts.run_audit <url> [--seed q1,q2] [--vs c1,c2] \
        [--max-pages 8] [--per-kind 2] [--engines google,brave] \
        [--lang fr] [--country FR] [--output-lang fr]

Output: site-client/<slug>/audits/<YYYY-MM-DD>-audit.md (and refreshes INDEX)
"""
from __future__ import annotations

import json
import sys
import warnings
from datetime import date
from pathlib import Path

warnings.filterwarnings("ignore")

from scripts.checks import CheckReport, sort_findings
from scripts.checks.schema import audit_url as audit_schema
from scripts.checks.content_health import audit_url as audit_content
from scripts.checks.crawlers import audit_site as audit_crawlers
from scripts.site_crawler import sample_pages
from scripts.site_locale import detect as detect_locale
from scripts.client_paths import ensure as ensure_client


SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "informational": 4}
CONF_ORDER = {"high": 0, "medium-high": 1, "medium": 2, "low": 3, "experimental": 4}

# i18n labels for the report shell. Findings produced by check modules are
# already in English (technical) — we wrap them with localised section
# headings + intro text.
LABELS = {
    "fr": {
        "title": "Audit GEO — {domain}",
        "url_label": "URL auditée",
        "locale_label": "Locale détectée",
        "method_label": "Méthodologie",
        "method_value": "Phase 1.5 — multi-page sampling + modules Python (`scripts/checks/`) + RRF mesuré",
        "date_label": "Date",
        "pages_label": "Pages échantillonnées",
        "exec_summary": "Résumé exécutif",
        "exec_strong": "Points forts",
        "exec_weak": "Marges d'amélioration les plus fortes",
        "h_state": "1. État des lieux par LLM",
        "h_actions": "2. Plan d'action",
        "h_annex": "Annexes techniques",
        "h_rrf": "A. RRF mesuré (détail)",
        "h_crawlers": "B. Politique des crawlers IA (robots.txt)",
        "h_schema": "C. Données structurées (Schema.org + Enhanced Entity Pages)",
        "h_content": "D. Content health",
        "h_priority": "E. Findings — vue agrégée",
        "h_limits": "3. Ce que l'audit ne mesure pas",
        "no_rrf": "Pas de mesure RRF dans cet audit (passer `--seed q1,q2 --vs c1,c2` pour l'activer).",
        "page_kind": "Type",
        "url": "URL",
        "metric": "Métrique",
        "value": "Valeur",
        "target": "Cible",
        "status": "Statut",
        "findings": "Findings",
        "site_avg": "Moyenne site (sur N pages)",
        "severity": "Sévérité",
        "confidence": "Confiance",
        "effort": "Effort",
        "gain": "Gain attendu",
        "limits_text": (
            "- **Pas de mesure réelle des citations LLM.** Le pipeline ne fait pas d'appel "
            "aux APIs OpenAI/Anthropic/Mistral (free, no-setup constraint). Le proxy "
            "RRF est documenté dans `docs/LLM_RETRIEVAL_ARCHITECTURE.md`.\n"
            "- **Pas de mesure d'autorité externe** (backlinks, présence Wikipedia/Wikidata, "
            "âge domaine). Or l'autorité est un facteur fort, surtout pour Google. Couche "
            "diagnostique en backlog.\n"
            "- **Pas de projection de trafic / revenus.** Audit-only philosophie.\n"
            "- **Sample limité** : 8 pages par défaut. Suffisant pour les patterns "
            "de fond, mais pas exhaustif sur un site de 100+ pages.\n"
            "- **Mapping LLM → backend** validé empiriquement le 2026-04-26 (ChatGPT→Google "
            "via deal OpenAI–Google). À re-vérifier tous les 6 mois — les partenariats changent."
        ),
    },
    "en": {
        "title": "GEO Audit — {domain}",
        "url_label": "Audited URL",
        "locale_label": "Detected locale",
        "method_label": "Methodology",
        "method_value": "Phase 1.5 — multi-page sampling + Python check modules (`scripts/checks/`) + measured RRF",
        "date_label": "Date",
        "pages_label": "Pages sampled",
        "exec_summary": "Executive summary",
        "exec_strong": "Strengths",
        "exec_weak": "Strongest improvement levers",
        "h_state": "1. Per-LLM presence assessment",
        "h_actions": "2. Action plan",
        "h_annex": "Technical appendices",
        "h_rrf": "A. Measured RRF (detail)",
        "h_crawlers": "B. AI crawler policy (robots.txt)",
        "h_schema": "C. Structured data (Schema.org + Enhanced Entity Pages)",
        "h_content": "D. Content health",
        "h_priority": "E. Findings — aggregated view",
        "h_limits": "3. What the audit does not measure",
        "no_rrf": "No RRF measurement in this audit (pass `--seed q1,q2 --vs c1,c2` to enable).",
        "page_kind": "Kind",
        "url": "URL",
        "metric": "Metric",
        "value": "Value",
        "target": "Target",
        "status": "Status",
        "findings": "Findings",
        "site_avg": "Site average (across N pages)",
        "severity": "Severity",
        "confidence": "Confidence",
        "effort": "Effort",
        "gain": "Expected gain",
        "limits_text": (
            "- **No actual LLM citation testing.** The pipeline does not call paid "
            "OpenAI/Anthropic/Mistral APIs (free, no-setup constraint). The RRF "
            "proxy mapping is documented in `docs/LLM_RETRIEVAL_ARCHITECTURE.md`.\n"
            "- **No external authority signals** (backlinks, Wikipedia/Wikidata presence, "
            "domain age). These matter — especially for Google-backed LLMs. Diagnostic "
            "layer in backlog.\n"
            "- **No traffic / revenue projections.** Audit-only philosophy.\n"
            "- **Limited sample**: 8 pages by default. Enough for foundational "
            "patterns, not exhaustive on a 100+ page site.\n"
            "- **LLM → backend mapping** validated empirically on 2026-04-26 "
            "(ChatGPT→Google via OpenAI–Google deal). Re-verify every 6 months."
        ),
    },
}


def _L(lang: str) -> dict:
    return LABELS.get((lang or "en").lower()[:2], LABELS["en"])


def _short_url(url: str, base: str) -> str:
    """Strip the base URL prefix for compact display."""
    return url.replace(base.rstrip("/"), "") or "/"


def _aggregate_metric(values: list, default=None):
    if not values:
        return default
    return round(sum(values) / len(values), 1)


def _avg_int(values: list, default=0) -> int:
    if not values:
        return default
    return round(sum(values) / len(values))


def _aggregate_findings_by_code(reports: list[CheckReport], site: str) -> list[tuple]:
    """Group per-page findings by **code** alone (not code+title), since
    metric-bearing titles ('Visible-facts coverage is 49%') differ per page.
    Two findings with the same code but different metric values still belong
    to the same finding type and should appear once.

    Exception: code S1 is grouped by `code + missing-types` (different missing
    type-sets are distinct findings even though both have code S1).

    Returns a list of dicts with: code, severity, confidence, title (a
    representative one), effort, expected_gain, pages (list of (url, finding))."""
    groups: dict[tuple, list] = {}
    order: list[tuple] = []
    for r in reports:
        if r.error:
            continue
        for f in r.findings:
            # S1 carries the missing schema types in the title; treat distinct
            # missing-type-sets as distinct findings.
            if f.code == "S1":
                key = (f.code, f.title)
            else:
                key = (f.code,)
            if key not in groups:
                groups[key] = []
                order.append(key)
            groups[key].append((r.target, f))
    aggregated = []
    for key in order:
        items = groups[key]
        sample = items[0][1]
        # Build a representative title — for metric-bearing findings, summarise
        # with the page count and avg/range rather than a single page's value.
        title = sample.title
        # Take the worst severity/confidence across the group (defensive).
        worst_sev = min(items, key=lambda t: SEV_ORDER.get(t[1].severity, 99))[1].severity
        worst_conf = min(items, key=lambda t: CONF_ORDER.get(t[1].confidence, 99))[1].confidence
        aggregated.append({
            "code": sample.code,
            "severity": worst_sev,
            "confidence": worst_conf,
            "title": title,
            "description": sample.description,
            "effort": sample.effort,
            "expected_gain": sample.expected_gain,
            "pages": [(url, f) for url, f in items],
        })
    aggregated.sort(key=lambda x: (
        SEV_ORDER.get(x["severity"], 99),
        CONF_ORDER.get(x["confidence"], 99),
    ))
    return aggregated


def _rrf_summary(rrf_run, target_norm: str) -> dict:
    """Extract decision-grade signals from an RRFRun:
    - per_engine_present: {engine: queries_present_count}
    - per_engine_total: {engine: queries_total_for_that_engine_that_answered}
    - top_wins: list[(query, engine, rank)] for any rank ≤ 5
    - dominant_serps: list[(query, engine, host)] (target was absent there)
    - high_failrate_engines: list[engine]
    """
    out = {
        "per_engine_present": {},
        "per_engine_answered": {},
        "top_wins": [],
        "dominant_serps_blocking_target": [],
        "high_failrate_engines": [],
        "best_competitor_per_engine": {},
    }
    if rrf_run is None:
        return out
    target_n = target_norm
    for engine_name, score_list in rrf_run.scores.items():
        target_score = next((s for s in score_list if s.domain == target_n), None)
        if not target_score:
            continue
        answered = target_score.queries_total - target_score.queries_failed
        out["per_engine_present"][engine_name] = target_score.queries_present
        out["per_engine_answered"][engine_name] = answered
        if answered and target_score.queries_failed / target_score.queries_total > 0.5:
            out["high_failrate_engines"].append(engine_name)
        for q, rank in target_score.ranks.items():
            if rank <= 5:
                out["top_wins"].append((q, engine_name, rank))
        # Best competitor by RRF score
        comp_scores = [(s.domain, s.rrf_score) for s in score_list if s.domain != target_n]
        if comp_scores:
            best = max(comp_scores, key=lambda kv: kv[1])
            if best[1] > 0:
                out["best_competitor_per_engine"][engine_name] = best
    # Brand-dominated SERPs where the target is absent
    for engine_name, meta in rrf_run.engine_meta.items():
        target_score = next((s for s in rrf_run.scores.get(engine_name, []) if s.domain == target_n), None)
        target_ranks = target_score.ranks if target_score else {}
        for q, host in meta.dominant_per_query.items():
            if q not in target_ranks and host != target_n:
                out["dominant_serps_blocking_target"].append((q, engine_name, host))
    return out


def _per_llm_presence(llm, rrf_run, target_norm: str) -> dict | None:
    """Aggregate presence stats for one LLM across the engines that back it.
    Returns: {
        engines: tuple of engine names that contributed,
        answered: total *unique* queries answered by at least one backing engine,
        present:  unique queries where target appeared on at least one backing engine,
        top_wins: list[(query, engine, rank)] for rank ≤ 5,
        best_comp: (domain, rrf_score) of strongest competitor across this LLM's engines,
        comparative: target's strength vs strongest competitor (0..1) — averaged across engines,
        per_engine: {engine: (present, answered, comparative)} — drill-down,
        verdict: 'absent' | 'partial' | 'present' | 'dominant' | 'unmeasured',
    }
    """
    if rrf_run is None or not llm.engines:
        return None
    answered_per_q: dict[str, bool] = {}
    present_per_q: dict[str, bool] = {}
    top_wins: list[tuple[str, str, int]] = []
    per_engine: dict[str, tuple[int, int, float]] = {}
    best_comp_per_engine: dict[str, tuple[str, float]] = {}
    comp_strengths: list[float] = []
    # Per-engine target RRF + best competitor RRF, used to compute the
    # smallest gap to a competitor when target leads (= "fragile leadership").
    target_rrf_per_engine: dict[str, float] = {}

    for engine in llm.engines:
        scores = rrf_run.scores.get(engine, [])
        target_score = next((s for s in scores if s.domain == target_norm), None)
        if target_score is None:
            continue
        engine_answered = target_score.queries_total - target_score.queries_failed
        engine_present = target_score.queries_present
        target_rrf_per_engine[engine] = target_score.rrf_score

        # Per-query roll-up
        for q in target_score.ranks:
            present_per_q[q] = True
            answered_per_q[q] = True
        for q in target_score.failed_queries:
            answered_per_q[q] = answered_per_q.get(q, False)
        for q in rrf_run.queries:
            if q not in target_score.failed_queries:
                answered_per_q[q] = True

        for q, rank in target_score.ranks.items():
            if rank <= 5:
                top_wins.append((q, engine, rank))

        # Best competitor on this engine
        comp_scores = [(s.domain, s.rrf_score) for s in scores if s.domain != target_norm]
        if comp_scores:
            best = max(comp_scores, key=lambda kv: kv[1])
            if best[1] > 0:
                best_comp_per_engine[engine] = best

        # Per-engine comparative strength = target_rrf / max_rrf on this engine
        if scores:
            max_rrf = max((s.rrf_score for s in scores), default=0.0)
            comp = target_score.rrf_score / max_rrf if max_rrf > 0 else 0.0
            per_engine[engine] = (engine_present, engine_answered, round(comp, 3))
            if engine_answered > 0:
                comp_strengths.append(comp)

    answered = sum(1 for v in answered_per_q.values() if v)
    present = sum(1 for v in present_per_q.values() if v)

    # Cross-engine best competitor: pick the highest RRF among per-engine bests
    best_comp = None
    if best_comp_per_engine:
        d, s = max(best_comp_per_engine.values(), key=lambda kv: kv[1])
        best_comp = (d, round(s, 4))

    comparative_avg = round(sum(comp_strengths) / len(comp_strengths), 3) if comp_strengths else 0.0

    # Sample-size guard: with < 3 answered queries we don't have enough signal
    # to call a verdict. Mark as "low-sample" so the report can warn explicitly.
    LOW_SAMPLE_THRESHOLD = 3
    low_sample = 0 < answered < LOW_SAMPLE_THRESHOLD

    if answered == 0:
        verdict = "unmeasured"
    elif low_sample:
        verdict = "low-sample"
    elif present == 0:
        verdict = "absent"
    else:
        ratio = present / answered
        # Per-engine leadership flag, used to split "présent" into trailing
        # vs leading. Preliminary; refined below once is_leader is computed.
        is_lead_prelim = comparative_avg >= 0.99 and best_comp is not None
        if ratio >= 0.85 and is_lead_prelim:
            verdict = "dominant-leader"     # 🏆 strong + leading = écrasement
        elif ratio >= 0.85:
            verdict = "dominant-trailing"   # 🟢 strong presence but a competitor leads
        elif ratio >= 0.5 and is_lead_prelim:
            verdict = "leader"              # 🏆 leading but on a smaller share of queries
        elif ratio >= 0.5:
            verdict = "trailing"            # 📉 present-ish but not leader
        else:
            verdict = "partial"             # 🟡

    # Is the target the leader (i.e. its RRF is at least as high as every
    # competitor's)? Threshold 0.99 matches the displayed precision (2 dec).
    is_leader = comparative_avg >= 0.99 and best_comp is not None

    # When leader, compute the smallest competitor-to-target ratio across the
    # engines target leads on. Closer to 1.0 = fragile leadership.
    # `min_competitor_ratio` ∈ (0, 1] — 1.0 means tied, 0.5 means competitor
    # at half target's RRF.
    min_competitor_ratio = 0.0
    if is_leader and target_rrf_per_engine:
        ratios = []
        for engine, target_rrf in target_rrf_per_engine.items():
            comp_pair = best_comp_per_engine.get(engine)
            if comp_pair and target_rrf > 0:
                ratios.append(comp_pair[1] / target_rrf)
        if ratios:
            min_competitor_ratio = max(ratios)  # the closest competitor wins
    # Fragile if the closest competitor is within 5% of target's score
    fragile_leader = is_leader and min_competitor_ratio >= 0.95

    return {
        "engines": llm.engines,
        "answered": answered,
        "present": present,
        "top_wins": top_wins,
        "best_comp": best_comp,
        "comparative": comparative_avg,
        "per_engine": per_engine,
        "verdict": verdict,
        "is_leader": is_leader,
        "fragile_leader": fragile_leader,
        "min_competitor_ratio": min_competitor_ratio,
        "low_sample": low_sample,
    }


def _unified_action_plan(all_groups: list[dict]) -> tuple[list[dict], list[dict]]:
    """Build a single unified action plan with per-LLM impact tags.

    Same code from different page kinds (e.g. S1 on article + about + faq)
    appears as one action with multiple variants — preserves info without
    flooding the plan.

    Returns (main_plan, experimental_plan):
    - main: actions where at least one LLM has impact ≥ medium
    - experimental: low-confidence / weak-evidence levers (CHM2 single-study,
      EE3 emerging pattern, CR-INFO* cosmetic). Shown in a sub-bucket.
    """
    from scripts.llm_impact import IN_SCOPE_LLMS, impact_for, impact_rank

    # Group all variants by code
    by_code: dict[str, list[dict]] = {}
    code_order: list[str] = []
    for g in all_groups:
        code = g["code"]
        if code not in by_code:
            by_code[code] = []
            code_order.append(code)
        by_code[code].append(g)

    actions: list[dict] = []
    for code in code_order:
        variants = by_code[code]
        # Worst severity / confidence across variants (most pessimistic)
        worst_sev = min(
            (v["severity"] for v in variants if v.get("severity")),
            key=lambda s: SEV_ORDER.get(s, 99),
            default="medium",
        )
        worst_conf = min(
            (v["confidence"] for v in variants if v.get("confidence")),
            key=lambda c: CONF_ORDER.get(c, 99),
            default="medium",
        )
        # Total unique pages affected (a page may appear under multiple variants)
        all_pages: set[str] = set()
        for v in variants:
            for url, _ in v.get("pages") or []:
                all_pages.add(url)
        total_pages = len(all_pages) if all_pages else len(variants)
        # Per-LLM impact (from code, same for all variants)
        impacts = {l.slug: impact_for(code, l.slug) for l in IN_SCOPE_LLMS}
        max_rank = max(impact_rank(i) for i in impacts.values())
        # Effort/gain: keep the first variant's (typically identical anyway)
        actions.append({
            "code": code,
            "variants": variants,
            "severity": worst_sev,
            "confidence": worst_conf,
            "total_pages": total_pages,
            "_impacts": impacts,
            "_max_impact_rank": max_rank,
            "effort": variants[0].get("effort"),
            "expected_gain": variants[0].get("expected_gain"),
        })

    # Split: experimental = max impact rank < 2 (i.e. all LLMs ≤ low/experimental)
    main = [a for a in actions if a["_max_impact_rank"] >= 2]
    experimental = [a for a in actions if a["_max_impact_rank"] < 2]

    main.sort(key=lambda a: (
        -a["_max_impact_rank"],
        SEV_ORDER.get(a["severity"], 99),
        CONF_ORDER.get(a["confidence"], 99),
    ))
    experimental.sort(key=lambda a: (
        SEV_ORDER.get(a["severity"], 99),
        CONF_ORDER.get(a["confidence"], 99),
    ))

    return main, experimental


def _render_unified_action(action: dict, num: int, fr: bool, T) -> list[str]:
    """Render one entry of the unified action plan as a list of markdown lines.
    Multi-variant codes get a header + sub-bullets per variant."""
    from scripts.llm_impact import IN_SCOPE_LLMS, impact_glyph

    code = action["code"]
    variants = action["variants"]
    impacts = action["_impacts"]

    # Group LLMs by impact glyph
    impact_buckets: dict[str, list[str]] = {}
    for llm in IN_SCOPE_LLMS:
        glyph = impact_glyph(impacts[llm.slug])
        impact_buckets.setdefault(glyph, []).append(llm.label_fr if fr else llm.label_en)
    # Order buckets by visual strength
    glyph_order = ["+++", "++", "+", "+/-", "?", "—"]
    impact_parts = []
    for glyph in glyph_order:
        if glyph in impact_buckets:
            llms = ", ".join(impact_buckets[glyph])
            impact_parts.append(f"`{glyph}` {llms}")
    impact_line = " · ".join(impact_parts)

    sev_lbl = "sév." if fr else "sev."
    eff_str = f" · _{T(action['effort'])}_" if action.get("effort") else ""

    out: list[str] = []
    if len(variants) == 1:
        title = T(variants[0]["title"])
        n_pages = action["total_pages"]
        pages_str = (f" · {n_pages} pages" if n_pages > 1 else "")
        out.append(f"{num}. **`{code}`** ({sev_lbl} {action['severity']}{pages_str}) — {title}{eff_str}")
        out.append(f"   - **Impact LLM** : {impact_line}")
    else:
        n_total = action["total_pages"]
        if fr:
            out.append(f"{num}. **`{code}`** ({sev_lbl} {action['severity']} · {len(variants)} variantes · {n_total} pages){eff_str}")
        else:
            out.append(f"{num}. **`{code}`** ({sev_lbl} {action['severity']} · {len(variants)} variants · {n_total} pages){eff_str}")
        for v in variants:
            n_pg = len(v.get("pages") or []) or 1
            out.append(f"   - {T(v['title'])} _({n_pg} page{'s' if n_pg > 1 else ''})_")
        out.append(f"   - **Impact LLM** : {impact_line}")

    # Per-page H2 specificity for CHM1 — list the actual H2 titles that fail
    # BLUF on each page, so the user knows exactly which paragraphs to rewrite.
    if code == "CHM1":
        h2_lines = _render_chm1_per_page_h2s(variants, fr)
        out.extend(h2_lines)

    # Per-page missing-facts breakdown for EE1 — list the actual JSON-LD facts
    # absent from each page's visible body. Makes the "ajoute des faits dans le
    # body" reco concrete.
    if code == "EE1":
        ee1_lines = _render_ee1_per_page_missing_facts(variants, fr)
        out.extend(ee1_lines)

    return out


def _render_ee1_per_page_missing_facts(variants: list[dict], fr: bool) -> list[str]:
    """For EE1 findings, list the actual JSON-LD facts that are missing from
    the visible body of each page. Pulled from the finding's `evidence` list
    (populated by schema.py)."""
    out: list[str] = []
    by_page: list[tuple[str, list[str]]] = []
    for v in variants:
        for url, finding in (v.get("pages") or []):
            ev = list(getattr(finding, "evidence", None) or [])
            if ev:
                by_page.append((url, ev))
    if not by_page:
        return out

    if fr:
        out.append("   - **Faits déclarés en JSON-LD mais absents du body visible** :")
    else:
        out.append("   - **Facts declared in JSON-LD but missing from visible body**:")
    for url, facts in by_page:
        try:
            from urllib.parse import urlparse
            short_url = urlparse(url).path or "/"
        except Exception:
            short_url = url
        # Show top 4 missing facts per page
        sample = facts[:4]
        rest = len(facts) - 4
        more = f" _(+{rest})_" if rest > 0 else ""
        # Backtick the values so they're visually distinct
        facts_str = " · ".join(f"`{f[:40]}`" for f in sample)
        out.append(f"     - `{short_url}` → {facts_str}{more}")
    return out


def _render_chm1_per_page_h2s(variants: list[dict], fr: bool) -> list[str]:
    """For CHM1 findings, list the failing H2 titles per page. Pulled from the
    finding's `evidence` list (populated by `_measure_bluf` in content_health)."""
    out: list[str] = []
    by_page: list[tuple[str, list[str]]] = []  # (url, list of failing H2s)
    for v in variants:
        for url, finding in (v.get("pages") or []):
            ev = list(getattr(finding, "evidence", None) or [])
            if ev:
                by_page.append((url, ev))
    if not by_page:
        return out

    if fr:
        out.append("   - **H2 à réécrire (sous-jacents au finding)** :")
    else:
        out.append("   - **H2 to rewrite (underlying the finding)**:")
    for url, h2s in by_page:
        # Compact URL: strip protocol + host so the path is visible
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            short_url = parsed.path or "/"
        except Exception:
            short_url = url
        # Cap to 3 H2s per page to keep the audit readable
        h2_str = " · ".join(h2s[:3])
        more = f" (+{len(h2s) - 3})" if len(h2s) > 3 else ""
        out.append(f"     - `{short_url}` → {h2_str}{more}")
    return out


def _render_authority_section(
    target_authority,
    competitor_authority: dict | None,
    fr: bool,
) -> list[str]:
    """Render the 'Diagnostic d'autorité' section. Compares the target's
    Wikipedia/Wikidata/Wayback signals against the competitors that were
    benchmarked. Includes a verdict on whether off-page authority differences
    explain the RRF gap.
    """
    if target_authority is None or target_authority.error:
        return []
    out: list[str] = []
    if fr:
        out.append("## Diagnostic d'autorité")
        out.append("")
        out.append(
            "_Mesure les signaux **off-page** — présence Wikipedia/Wikidata, ancienneté du domaine. "
            "Free APIs uniquement (MediaWiki, Wayback Machine). Complète le benchmark on-page : si "
            "ce dernier conclut « parité on-page, gap probable off-page », cette section pointe les "
            "leviers concrets._"
        )
    else:
        out.append("## Authority diagnostic")
        out.append("")
        out.append(
            "_Measures **off-page** signals — Wikipedia/Wikidata presence, domain age. Free APIs only "
            "(MediaWiki, Wayback Machine). Companion to the on-page benchmark: if that section says "
            "'parity on-page, off-page likely', this section points at concrete levers._"
        )
    out.append("")

    # --- Comparison table (target + competitors) ---
    target_metrics = target_authority.metrics
    rows: list[tuple[str, dict, dict, dict, dict]] = []  # (label, wp_fr, wp_en, wd, way)

    def _wp_cell(wp: dict) -> str:
        """Render a Wikipedia status cell with 3 states:
        - ✅ verified (page exists + Wikidata P856 matches domain)
        - ❓ unverified (page exists but homonym candidate or no P856)
        - ❌ no page
        """
        if not wp or not wp.get("exists"):
            return "❌"
        confidence = wp.get("confidence")
        if confidence == "verified":
            return "✅"
        # Article exists but doesn't link to a Q-id whose P856 matches our domain
        title = wp.get("title", "")
        if title:
            return f"❓ _homonyme : « {title[:30]} »_" if fr else f"❓ _homonym: \"{title[:30]}\"_"
        return "❓"

    def _wd_cell(wd: dict) -> str:
        if not wd or not wd.get("found"):
            return "❌ Aucune fiche" if fr else "❌ None"
        confidence = wd.get("confidence")
        qid = wd.get("qid", "")
        desc = wd.get("description") or ""
        if confidence == "verified":
            # P856 official website matches the domain → real Wikidata entry
            return f"✅ `{qid}` — _vérifié via P856_" if fr else f"✅ `{qid}` — _verified via P856_"
        # Unverified — candidates found by label but no P856 match → likely homonyms
        snippet = (desc[:50] + "…") if desc and len(desc) > 50 else (desc or "—")
        if fr:
            return f"❓ `{qid}` (homonyme probable : _{snippet}_)"
        return f"❓ `{qid}` (likely homonym: _{snippet}_)"

    def _way_cell(way: dict) -> str:
        if not way:
            return "—"
        if way.get("error"):
            # Don't dump raw exception strings into the table — keep it clean
            err = way["error"]
            if "Timeout" in err or "timeout" in err:
                return "⚠️ timeout" if fr else "⚠️ timeout"
            return "⚠️ erreur Wayback" if fr else "⚠️ Wayback error"
        age = way.get("age_years")
        snap = way.get("first_snapshot_iso")
        if age is None:
            return "—"
        return f"{age} ans (1er snap : {snap})" if fr else f"{age} y (1st snap: {snap})"

    # Build column structure: target + each competitor with available data
    competitors_data: list[tuple[str, dict]] = []  # (domain, metrics)
    if competitor_authority:
        for d, rpt in competitor_authority.items():
            if rpt and not rpt.error:
                competitors_data.append((d, rpt.metrics))

    target_label = (target_metrics.get("brand_name") or "toi") + " (toi)" if fr else (target_metrics.get("brand_name") or "you") + " (you)"

    if competitors_data:
        # Wide table with target + competitors as columns
        if fr:
            cols_header = "| Signal | **toi** | " + " | ".join(f"`{d}`" for d, _ in competitors_data) + " |"
        else:
            cols_header = "| Signal | **you** | " + " | ".join(f"`{d}`" for d, _ in competitors_data) + " |"
        out.append(cols_header)
        out.append("|" + "---|" * (2 + len(competitors_data)))

        # Rows: 1 per signal
        rows_data = [
            ("🇫🇷 Wikipedia FR" if fr else "🇫🇷 Wikipedia FR", "wikipedia_fr",  _wp_cell),
            ("🇬🇧 Wikipedia EN" if fr else "🇬🇧 Wikipedia EN", "wikipedia_en",  _wp_cell),
            ("🌐 Wikidata",                                       "wikidata",      _wd_cell),
            ("📅 Ancienneté domaine" if fr else "📅 Domain age",  "wayback",       _way_cell),
        ]
        for label, key, formatter in rows_data:
            t_val = target_metrics.get(key) or {}
            row = f"| {label} | {formatter(t_val)} |"
            for _d, m in competitors_data:
                c_val = m.get(key) or {}
                row += f" {formatter(c_val)} |"
            out.append(row)
        out.append("")
    else:
        # Just target (no competitors benchmarked or all failed)
        out.append("| Signal | Statut | Détail |" if fr else "| Signal | Status | Detail |")
        out.append("|---|---|---|")
        wp_fr = target_metrics.get("wikipedia_fr") or {}
        wp_en = target_metrics.get("wikipedia_en") or {}
        wd = target_metrics.get("wikidata") or {}
        way = target_metrics.get("wayback") or {}
        out.append(f"| 🇫🇷 Wikipedia FR | {_wp_cell(wp_fr)} | {wp_fr.get('url', '')} |")
        out.append(f"| 🇬🇧 Wikipedia EN | {_wp_cell(wp_en)} | {wp_en.get('url', '')} |")
        out.append(f"| 🌐 Wikidata | {_wd_cell(wd)} | {wd.get('url', '') if wd.get('found') else '—'} |")
        out.append(f"| 📅 Ancienneté domaine | {_way_cell(way)} | — |")
        out.append("")

    # --- Verdict on authority gap ---
    # Both Wikipedia and Wikidata are only "true" when VERIFIED (i.e. the
    # article/Q-id links to P856 = audited domain). Unverified candidates
    # are likely homonyms and shouldn't count as authority signals.
    def _wp_verified(wp: dict) -> bool:
        return bool(wp and wp.get("exists") and wp.get("confidence") == "verified")

    target_wp_fr = target_metrics.get("wikipedia_fr") or {}
    target_wp_en = target_metrics.get("wikipedia_en") or {}
    target_wp = _wp_verified(target_wp_fr) or _wp_verified(target_wp_en)

    target_wd_full = target_metrics.get("wikidata") or {}
    target_wd = target_wd_full.get("found") and target_wd_full.get("confidence") == "verified"
    target_age = (target_metrics.get("wayback") or {}).get("age_years") or 0

    competitor_wp_count = sum(
        1 for _d, m in competitors_data
        if _wp_verified(m.get("wikipedia_fr") or {}) or _wp_verified(m.get("wikipedia_en") or {})
    )
    competitor_wd_count = sum(
        1 for _d, m in competitors_data
        if (m.get("wikidata") or {}).get("found") and (m.get("wikidata") or {}).get("confidence") == "verified"
    )

    if competitors_data:
        out.append("### Verdict autorité" if fr else "### Authority verdict")
        out.append("")
        if target_wp and not target_wd:
            if fr:
                out.append("🟢 **Solide.** Tu as une présence Wikipedia. Reste à créer la fiche Wikidata pour ancrer l'entité dans le knowledge-graph (1-2h, bar de notabilité bas).")
            else:
                out.append("🟢 **Solid.** You have a Wikipedia presence. Add a Wikidata entry to anchor the entity in the knowledge graph (1-2h, low notability bar).")
        elif target_wp and target_wd:
            if fr:
                out.append("🏆 **Très solide.** Wikipedia + Wikidata présents. C'est l'ancrage d'entité maximum atteignable via Open Web. Si tu as encore un gap RRF, le levier est ailleurs (probablement profondeur thématique du contenu, ou pondération SERP).")
            else:
                out.append("🏆 **Very solid.** Wikipedia + Wikidata both present. This is the maximum entity anchoring achievable through Open Web. If RRF gap remains, the lever is elsewhere (content depth or SERP weighting).")
        elif not target_wp and target_wd:
            if fr:
                out.append("🟡 **Partiel.** Wikidata OK mais pas de Wikipedia. Wikidata seul donne un Q-id pour le `sameAs` mais pas la richesse contextuelle d'un article Wikipedia. Pitch presse + 3-5 mentions indépendantes = chemin vers Wikipedia.")
            else:
                out.append("🟡 **Partial.** Wikidata OK but no Wikipedia. Wikidata alone provides a Q-id for `sameAs` but lacks Wikipedia's contextual richness. Press pitch + 3-5 independent mentions = path to Wikipedia.")
        elif competitor_wp_count > 0 or competitor_wd_count > 0:
            # Concurrents have something we don't
            if fr:
                out.append(
                    f"🔴 **Gap d'autorité confirmé.** Au moins un concurrent benchmarké a une "
                    f"présence Wikipedia/Wikidata que tu n'as pas. Le gap RRF (s'il existe) "
                    f"s'explique probablement par cet écart. **Levier prioritaire long terme : "
                    f"créer une fiche Wikidata** (1-2h, bar de notabilité bas)."
                )
            else:
                out.append(
                    f"🔴 **Authority gap confirmed.** At least one benchmarked competitor has a "
                    f"Wikipedia/Wikidata presence you don't. The RRF gap (if any) likely comes "
                    f"from this. **Priority long-term lever: create a Wikidata entry.**"
                )
        else:
            # Parity at zero — neither has anything
            if fr:
                out.append(
                    "⚪ **Parité à zéro.** Ni toi ni tes concurrents n'avez de présence "
                    "Wikipedia/Wikidata. Le gap RRF, s'il existe, vient de signaux non mesurés "
                    "ici (profondeur thématique du contenu, internal linking, signaux on-page "
                    "non audités, ou caractéristiques propres au SERP de chaque moteur)."
                )
            else:
                out.append(
                    "⚪ **Parity at zero.** Neither you nor competitors have Wikipedia/Wikidata. "
                    "Any RRF gap comes from signals not measured here (content depth, internal "
                    "linking, unaudited on-page signals, or engine-specific SERP weighting)."
                )
        out.append("")

    # --- Long-term action recommendations (when authority is weak) ---
    if not target_wp or not target_wd:
        levers: list[str] = []
        if not target_wd:
            wd_state = target_wd_full.get("confidence")
            if wd_state == "unverified":
                # Homonym candidate exists; need to add P856 or create a proper entry
                if fr:
                    levers.append(
                        "**Vérifier / créer la fiche Wikidata** (~1-2h). Wikidata renvoie des "
                        "candidats sur ton nom mais aucun n'a `P856` (site officiel) qui matche "
                        f"`{target_authority.target}`. Soit ta fiche n'existe pas (à créer), soit "
                        "elle existe mais manque le champ P856 (à compléter). Sans P856, les LLMs "
                        "ne peuvent pas relier ta marque à ton domaine via Wikidata."
                    )
                else:
                    levers.append(
                        "**Verify / create Wikidata entry** (~1-2h). Candidates exist for your "
                        f"name but none has `P856` (official site) matching `{target_authority.target}`. "
                        "Either create the entry or fill in P856."
                    )
            else:
                if fr:
                    levers.append(
                        "**Créer la fiche Wikidata** (~1-2h). Bar de notabilité bas. Renseigner : "
                        "label FR + EN, description, instance of (organisation), country, founder, "
                        "official website (P856 ← critique), profils sociaux. Une fois publiée, "
                        "l'ajouter dans le `sameAs` du JSON-LD `Organization`."
                    )
                else:
                    levers.append(
                        "**Create Wikidata entry** (~1-2h). Low notability bar. Fields: label FR + EN, "
                        "description, instance of, country, founder, official website (P856 critical), "
                        "social profiles. Once live, add to `Organization.sameAs` in JSON-LD."
                    )
        if not target_wp:
            if fr:
                levers.append(
                    "**Pitch presse FR** (Maddyness, FrenchWeb, BFM Tech, JDN, Les Echos, Le Figaro Tech). "
                    "Cible : 3-5 mentions indépendantes en 6-12 mois. Prérequis pour bar de notabilité "
                    "Wikipedia. **Le toolkit ne mesure pas l'effet de ces actions** — corrélé mais "
                    "non garanti."
                )
            else:
                levers.append(
                    "**FR press pitch** (Maddyness, FrenchWeb, BFM Tech, JDN, Les Echos). "
                    "Target: 3-5 independent mentions in 6-12 months. Prerequisite for Wikipedia "
                    "notability bar. **The toolkit doesn't measure these levers' effect.**"
                )
        if levers:
            if fr:
                out.append("### Leviers long terme (autorité)")
                out.append("")
                out.append(
                    "_À considérer en parallèle du plan d'action on-page. Pas mesuré comme "
                    "« urgent » — ce sont des chantiers à plusieurs mois._"
                )
            else:
                out.append("### Long-term levers (authority)")
                out.append("")
                out.append("_Run alongside the on-page action plan. Multi-month projects._")
            out.append("")
            for i, lever in enumerate(levers, 1):
                out.append(f"{i}. {lever}")
            out.append("")

    return out


def _effort_minutes(effort: str | None) -> int | None:
    """Parse a French/English effort string into estimated minutes.
    Conservative — returns the LOWER bound when a range is given.

    Examples:
      "5 min" → 5
      "30min-2h par type" → 30
      "1-2h éditorial — déplacer ..." → 60
      "6-10h éditorial" → 360
      "2 min par bot" → 2
      "Long terme" → None (no minute estimate)
    """
    if not effort:
        return None
    s = effort.lower()
    # Handle "X min" or "X-Y min" / "X minutes"
    import re
    m = re.search(r"(\d+)\s*(?:-\s*\d+)?\s*min", s)
    if m:
        return int(m.group(1))
    # Handle "Xh" or "X-Yh"
    m = re.search(r"(\d+)\s*(?:-\s*\d+)?\s*h", s)
    if m:
        return int(m.group(1)) * 60
    # Handle "long terme", "multi-month" etc → unbounded
    if any(kw in s for kw in ["long terme", "multi-month", "long-term", "mois", "month"]):
        return None
    return None


def _render_quick_wins(
    main_plan: list[dict],
    experimental: list[dict],
    fr: bool,
    T,
) -> list[str]:
    """Quick wins = findings where effort ≤ 30 minutes. Pulled from BOTH the
    main plan AND the experimental bucket (because cosmetic CR-INFO* fixes
    might still be worth 5 min of cleanup)."""
    quick: list[dict] = []
    for action in main_plan + experimental:
        eff_min = _effort_minutes(action.get("effort"))
        if eff_min is not None and eff_min <= 30:
            quick.append({**action, "_effort_min": eff_min})

    if not quick:
        return []

    # Sort by effort ascending then code
    quick.sort(key=lambda a: (a["_effort_min"], a["code"]))

    out: list[str] = []
    out.append("### Quick wins (≤ 30 min)" if fr else "### Quick wins (≤ 30 min)")
    out.append("")
    if fr:
        out.append(
            "_Actions courtes, à shipper aujourd'hui ou cette semaine. Ordre = effort croissant._"
        )
    else:
        out.append("_Short actions, ship today or this week. Order: effort ascending._")
    out.append("")

    for q in quick:
        code = q["code"]
        title = T(q["variants"][0]["title"]) if q.get("variants") else code
        eff_min = q["_effort_min"]
        eff_lbl = f"{eff_min} min" if eff_min < 60 else f"{eff_min // 60}h"
        out.append(f"- **`{code}`** ({eff_lbl}) — {title}")
    out.append("")
    return out


def _render_30_day_plan(main_plan: list[dict], fr: bool, T) -> list[str]:
    """Translate the action plan into 4 weekly buckets based on severity ×
    effort. Audit goes from analytical → operational.

    Strategy:
    - Week 1: Quick wins (< 30min) + the highest-impact medium-effort action
    - Week 2: Medium-effort high-impact (1-3h) — typically EE1, S1
    - Week 3: Heavy editorial (6-10h) — typically CHM1
    - Week 4+: Long-term (Wikipedia, press) — listed as "ongoing"
    """
    if not main_plan:
        return []

    # Bucket each main_plan action by effort + impact
    week1, week2, week3, ongoing = [], [], [], []
    for action in main_plan:
        eff_min = _effort_minutes(action.get("effort"))
        if eff_min is None:
            ongoing.append(action)
        elif eff_min <= 30:
            week1.append(action)
        elif eff_min <= 180:  # ≤ 3h
            week2.append(action)
        else:
            week3.append(action)

    # If week 2 is empty but week 3 has multiple, push the lightest of week 3 to week 2
    if not week2 and len(week3) > 1:
        week3.sort(key=lambda a: _effort_minutes(a.get("effort")) or 999)
        week2.append(week3.pop(0))

    out: list[str] = []
    out.append("### Planning 30 jours" if fr else "### 30-day plan")
    out.append("")
    if fr:
        out.append(
            "_Le plan ci-dessus → un planning hebdo. Indicatif (effort estimé du finding, pas de "
            "ton emploi du temps réel)._"
        )
    else:
        out.append(
            "_The plan above → a weekly roadmap. Indicative (finding's estimated effort, "
            "not your actual schedule)._"
        )
    out.append("")

    def _short(action: dict) -> str:
        code = action["code"]
        title = T(action["variants"][0]["title"]) if action.get("variants") else code
        # Keep title short — already in the action plan above with full detail
        if len(title) > 70:
            title = title[:67] + "…"
        return f"`{code}` — {title}"

    weeks = [
        ("**Semaine 1** — Quick wins" if fr else "**Week 1** — Quick wins", week1),
        ("**Semaine 2** — Actions moyennes" if fr else "**Week 2** — Medium effort", week2),
        ("**Semaine 3-4** — Éditorial lourd" if fr else "**Week 3-4** — Heavy editorial", week3),
        ("**En continu** — Long terme" if fr else "**Ongoing** — Long-term", ongoing),
    ]
    for header, actions in weeks:
        if not actions:
            continue
        out.append(f"- {header}")
        for a in actions:
            out.append(f"  - {_short(a)}")
    out.append("")

    return out


def _render_tldr(
    per_llm: dict | None,
    main_plan: list[dict],
    target_authority,
    rrf_summary: dict | None,
    domain: str,
    fr: bool,
) -> list[str]:
    """5-bullet executive summary at the top of the audit. Captures the
    verdict in 30 seconds before the reader hits Section 1.

    Bullets, in order:
    1. Per-LLM verdict (leader / trailing split)
    2. Force comparative vs top competitor (per backend family)
    3. Top 3 actions by impact rank
    4. Authority status (Wikipedia / Wikidata / domain age)
    5. Quick win, when one is detectable (e.g. Wikidata Q-id sans P856)
    """
    if not per_llm:
        return []

    out: list[str] = []
    out.append("## TL;DR" if fr else "## TL;DR")
    out.append("")

    bullets: list[str] = []

    # --- Bullet 1: per-LLM verdict roll-up ---
    from scripts.llm_impact import IN_SCOPE_LLMS
    label_map = {l.slug: (l.label_fr if fr else l.label_en) for l in IN_SCOPE_LLMS}
    leaders = [s for s, a in per_llm.items() if a.get("is_leader") and not a.get("fragile_leader")]
    fragile = [s for s, a in per_llm.items() if a.get("fragile_leader")]
    trailing = [s for s, a in per_llm.items() if a.get("verdict") == "trailing"]
    absent = [s for s, a in per_llm.items() if a.get("verdict") == "absent"]
    partial = [s for s, a in per_llm.items() if a.get("verdict") == "partial"]
    n_total = len(per_llm)

    parts: list[str] = []
    if leaders:
        parts.append(f"🏆 leader sur {len(leaders)}/{n_total} LLMs ({', '.join(label_map[s] for s in leaders)})")
    if fragile:
        parts.append(f"⚠️ leader fragile sur {len(fragile)}/{n_total}")
    if trailing:
        parts.append(f"📉 en retrait sur {len(trailing)}/{n_total} ({', '.join(label_map[s] for s in trailing)})")
    if absent or partial:
        n_low = len(absent) + len(partial)
        parts.append(f"🔴 absent/partiel sur {n_low}/{n_total}")
    if parts:
        bullets.append(" · ".join(parts))

    # --- Bullet 2: comparative strength + best competitor ---
    if rrf_summary and rrf_summary.get("best_competitor_per_engine"):
        engine_strength: list[str] = []
        for engine, (comp, score) in rrf_summary["best_competitor_per_engine"].items():
            target_present = rrf_summary["per_engine_present"].get(engine, 0)
            target_answered = rrf_summary["per_engine_answered"].get(engine, 0)
            if target_answered == 0:
                continue
            # Find target's RRF on this engine to compute comparative
            for s, a in per_llm.items():
                if engine in (a.get("engines") or ()):
                    comp_avg = a.get("comparative", 0)
                    is_lead = a.get("is_leader")
                    arrow = "🏆" if is_lead else "📉"
                    engine_strength.append(f"{arrow} {engine} {comp_avg:.2f}")
                    break
        if engine_strength:
            # Dedup since multiple LLMs might share same engine
            unique = list(dict.fromkeys(engine_strength))
            comp_top = next(iter(rrf_summary["best_competitor_per_engine"].values()))[0]
            bullets.append(
                f"**Force comparative vs `{comp_top}`** : " + " · ".join(unique)
                if fr else
                f"**Comparative strength vs `{comp_top}`** : " + " · ".join(unique)
            )

    # --- Bullet 3: top 3 actions ---
    if main_plan:
        top = main_plan[:3]
        codes = " · ".join(f"`{a['code']}`" for a in top)
        if fr:
            bullets.append(f"**Top 3 actions** : {codes} (voir Plan d'action ci-dessous)")
        else:
            bullets.append(f"**Top 3 actions**: {codes} (see Action plan below)")

    # --- Bullet 4: authority roll-up ---
    if target_authority is not None and not target_authority.error:
        wp_fr = target_authority.metrics.get("wikipedia_fr") or {}
        wp_en = target_authority.metrics.get("wikipedia_en") or {}
        wd = target_authority.metrics.get("wikidata") or {}
        way = target_authority.metrics.get("wayback") or {}
        wp_verified = (wp_fr.get("exists") and wp_fr.get("confidence") == "verified") or \
                      (wp_en.get("exists") and wp_en.get("confidence") == "verified")
        wd_verified = wd.get("found") and wd.get("confidence") == "verified"
        age = way.get("age_years")
        auth_parts: list[str] = []
        auth_parts.append("✅ Wikipedia" if wp_verified else "❌ Wikipedia")
        auth_parts.append("✅ Wikidata" if wd_verified else "❌ Wikidata")
        if age is not None:
            auth_parts.append(f"📅 {age} ans" if fr else f"📅 {age} y")
        bullets.append(
            f"**Autorité off-page** : {' · '.join(auth_parts)}"
            if fr else
            f"**Off-page authority**: {' · '.join(auth_parts)}"
        )

    # --- Bullet 5: quick win detection ---
    quick_win = _detect_quick_win(target_authority, main_plan, fr)
    if quick_win:
        bullets.append(quick_win)

    if not bullets:
        return []

    for b in bullets:
        out.append(f"- {b}")
    out.append("")

    return out


def _detect_quick_win(target_authority, main_plan: list[dict], fr: bool) -> str | None:
    """Detect a single high-ROI low-effort action to surface in the TLDR.
    Returns None if no obvious quick win exists.

    Priority order:
    1. Wikidata candidate exists but P856 missing → ~5min add P856 (highest ROI)
    2. CR-INFO bots not listed (cosmetic but trivial)
    3. Single S1 finding with simple type (e.g. BreadcrumbList only)
    """
    # 1. Wikidata: if a candidate Q-id exists (just unverified P856), surface it
    if target_authority and not target_authority.error:
        wd = target_authority.metrics.get("wikidata") or {}
        if wd.get("found") and wd.get("confidence") == "unverified" and wd.get("qid"):
            qid = wd.get("qid")
            domain = target_authority.target
            if fr:
                return (f"💡 **Quick win 5 min** — Wikidata `{qid}` existe sans `P856`. "
                        f"Si c'est ta fiche : ajoute `P856 = https://{domain}/` → ancrage knowledge-graph immédiat.")
            return (f"💡 **5-min quick win** — Wikidata `{qid}` exists without `P856`. "
                    f"If it's your entry: add `P856 = https://{domain}/` → instant knowledge-graph anchor.")

    # 2. Single S1 with simple type → 30 min fix
    s1_actions = [a for a in main_plan if a["code"] == "S1"]
    if len(s1_actions) == 1 and s1_actions[0].get("variants"):
        v = s1_actions[0]["variants"][0]
        n_pages = len(v.get("pages") or [])
        if n_pages == 1:
            if fr:
                return f"💡 **Quick win 30 min** — un seul finding `S1` sur 1 page : {v.get('title', '')[:80]}"
            return f"💡 **30-min quick win** — single `S1` on 1 page: {v.get('title', '')[:80]}"

    return None


def _normalize_competitor_url(comp: str) -> str:
    """Turn 'bolum.fr' or 'https://www.bolum.fr' into 'https://www.bolum.fr/'.
    `requests` will follow redirects, so we don't need to be exact."""
    comp = comp.strip()
    if comp.startswith(("http://", "https://")):
        return comp.rstrip("/") + "/"
    return f"https://{comp.rstrip('/')}/"


def _competitor_summary(bench: dict) -> dict:
    """Extract the few comparable metrics from a competitor's homepage audit.
    Returns a flat dict suitable for table rendering."""
    if not bench or "schema" not in bench or "content" not in bench:
        return {"available": False}
    sr = bench["schema"]
    cr = bench["content"]
    if sr.error or cr.error:
        return {"available": False, "error": sr.error or cr.error}
    return {
        "available": True,
        "schema_types": sr.metrics.get("types_declared", []),
        "visible_facts": sr.metrics.get("visible_facts_coverage_pct"),
        "bluf": cr.metrics.get("bluf_compliance_pct") if cr.metrics.get("h2_count", 0) > 0 else None,
        "def_lang": cr.metrics.get("definition_density_pct"),
        "n_findings": len(sr.findings) + len(cr.findings),
    }


def _render_competitor_benchmark(
    target_homepage_schema,
    target_homepage_content,
    competitor_benchmarks: dict,
    fr: bool,
) -> list[str]:
    """Render the 'Benchmark concurrent on-page' section: side-by-side table
    on key on-page metrics + a diagnostic verdict on whether the gap is
    rattrapable on-page or requires off-page (authority) work."""
    if not competitor_benchmarks:
        return []

    # Build target summary from its own homepage report (the first page in sampled[]
    # is always the homepage by site_crawler's contract).
    if not target_homepage_schema or target_homepage_schema.error:
        return []
    target_summary = {
        "available": True,
        "schema_types": target_homepage_schema.metrics.get("types_declared", []),
        "visible_facts": target_homepage_schema.metrics.get("visible_facts_coverage_pct"),
        "bluf": target_homepage_content.metrics.get("bluf_compliance_pct")
                if target_homepage_content and target_homepage_content.metrics.get("h2_count", 0) > 0
                else None,
        "def_lang": target_homepage_content.metrics.get("definition_density_pct") if target_homepage_content else None,
        "n_findings": (len(target_homepage_schema.findings)
                       + (len(target_homepage_content.findings) if target_homepage_content else 0)),
    }

    # Competitor summaries
    comp_summaries: dict[str, dict] = {
        domain: _competitor_summary(bench)
        for domain, bench in competitor_benchmarks.items()
    }
    available_comps = [d for d, s in comp_summaries.items() if s.get("available")]

    out: list[str] = []
    if fr:
        out.append("## Benchmark concurrent on-page")
        out.append("")
        out.append(
            "_Comparaison sur les **homepages uniquement** (1 page par concurrent — "
            "léger par design). Donne une photo headline, pas un audit complet. "
            "Permet de répondre à : « le gap est-il rattrapable on-page, ou nécessite-t-il "
            "du off-page (autorité) ? »_"
        )
    else:
        out.append("## Competitor on-page benchmark")
        out.append("")
        out.append(
            "_Comparison on **homepages only** (1 page per competitor — light by design). "
            "Headline snapshot, not an exhaustive audit. Answers: 'is the gap on-page "
            "(closeable by the action plan) or off-page (authority work)?'_"
        )
    out.append("")

    if not available_comps:
        if fr:
            out.append("_Aucun concurrent n'a pu être benchmarké (erreur réseau / page inaccessible)._")
        else:
            out.append("_No competitor could be benchmarked (network / fetch error)._")
        # List the errors for transparency
        for d, s in comp_summaries.items():
            if not s.get("available"):
                err = s.get("error", "fetch failed")
                out.append(f"- `{d}` : {err}")
        out.append("")
        return out

    # --- Comparison table ---
    label_target = "toi" if fr else "you"
    cols = [label_target] + available_comps
    headers = {
        "schema_types":  "Schémas déclarés"          if fr else "Schemas declared",
        "visible_facts": "Visible-facts coverage",
        "bluf":          "Conformité BLUF"           if fr else "BLUF compliance",
        "def_lang":      "Densité def-language"      if fr else "Def-language density",
        "n_findings":    "Findings homepage"         if fr else "Homepage findings",
    }

    def _fmt_value(metric, summary):
        v = summary.get(metric)
        if metric == "schema_types":
            types = v or []
            if not types:
                return "—"
            short = ", ".join(types[:3]) + (f" (+{len(types)-3})" if len(types) > 3 else "")
            return short
        if v is None:
            return "—"
        if metric in ("visible_facts", "bluf", "def_lang"):
            return f"{v}%"
        return str(v)

    out.append("| Métrique | " + " | ".join(f"**{c}**" if c == label_target else f"`{c}`" for c in cols) + " |")
    out.append("|---" + "|---" * len(cols) + "|")
    for metric_key, metric_label in headers.items():
        row = f"| {metric_label} |"
        for col in cols:
            summary = target_summary if col == label_target else comp_summaries[col]
            row += f" {_fmt_value(metric_key, summary)} |"
        out.append(row)
    out.append("")

    # --- Diagnostic du gap ---
    # 5-case verdict logic. For each metric (visible_facts, bluf, def_lang),
    # we detect both directions:
    #   - competitor_advantage : competitor beats target by ≥ 10 pts
    #   - target_advantage     : target beats competitor by ≥ 10 pts
    # Plus a meta-flag for "target is strong on-page in absolute terms"
    # (≥ 50% visible_facts AND ≥ 40% BLUF on its own homepage).
    GAP_THRESHOLD = 10  # pts — under this, treat as parity (within measurement noise)
    competitor_advantages: dict[str, list[tuple[str, int, int]]] = {}
    target_advantages: dict[str, list[tuple[str, int, int]]] = {}
    for d in available_comps:
        cs = comp_summaries[d]
        c_adv, t_adv = [], []
        for m in ("visible_facts", "bluf", "def_lang"):
            t_val = target_summary.get(m)
            c_val = cs.get(m)
            if t_val is None or c_val is None:
                continue
            if c_val - t_val >= GAP_THRESHOLD:
                c_adv.append((m, t_val, c_val))
            elif t_val - c_val >= GAP_THRESHOLD:
                t_adv.append((m, c_val, t_val))
        competitor_advantages[d] = c_adv
        target_advantages[d] = t_adv

    has_competitor_advantage = any(advs for advs in competitor_advantages.values())
    has_target_advantage = any(advs for advs in target_advantages.values())
    target_strong_on_page = (
        (target_summary.get("visible_facts") or 0) >= 50
        and (target_summary.get("bluf") or 0) >= 40
    )

    metric_lbl_fr = {
        "visible_facts": "visible-facts coverage",
        "bluf":          "conformité BLUF",
        "def_lang":      "densité def-language",
    }
    metric_lbl_en = {
        "visible_facts": "visible-facts coverage",
        "bluf":          "BLUF compliance",
        "def_lang":      "def-language density",
    }
    metric_lbl = metric_lbl_fr if fr else metric_lbl_en

    out.append("### Diagnostic du gap" if fr else "### Gap diagnostic")
    out.append("")

    # Case selection (mutually exclusive, ordered by specificity):
    if has_competitor_advantage and has_target_advantage:
        # Mixed: target leads on some metrics, trails on others
        if fr:
            out.append(
                "🟡 **Mixte — partage de leviers.** Tu fais mieux que tes concurrents sur "
                "certaines métriques, ils te devancent sur d'autres. Le plan d'action ferme "
                "les écarts où tu retraites ; les leviers où tu mènes sont à conserver "
                "(voir section *Forces*)."
            )
        else:
            out.append(
                "🟡 **Mixed — split levers.** You beat competitors on some metrics, "
                "they beat you on others. The action plan closes gaps where you trail; "
                "your leading levers are in the *Strengths* section."
            )
    elif has_competitor_advantage:
        if fr:
            out.append(
                "🔴 **Gap on-page rattrapable.** Au moins un concurrent fait mieux sur des "
                "métriques on-page **mesurables**. Le plan d'action ci-dessous (S1, EE1, CHM1) "
                "ferme précisément ces écarts. Pas besoin de stratégie off-page (PR, backlinks, "
                "mentions presse) pour rattraper sur ces leviers."
            )
        else:
            out.append(
                "🔴 **Gap is on-page, closeable.** At least one competitor scores better on "
                "measurable on-page metrics. The action plan below (S1, EE1, CHM1) directly "
                "closes those gaps. No need for off-page work."
            )
    elif has_target_advantage and not target_strong_on_page:
        # Target leads on some metrics but is still weak in absolute terms
        if fr:
            out.append(
                "🟢 **Avantage on-page modeste, métriques absolues encore basses.** Tu fais "
                "mieux que tes concurrents sur certaines métriques, mais en absolu tes scores "
                "sont sous les cibles (BLUF < 50%, visible-facts < 70%). Tes concurrents sont "
                "juste plus faibles. Le plan d'action te fait passer du « moins pire » au « bon »."
            )
        else:
            out.append(
                "🟢 **Modest on-page advantage, absolute metrics still low.** You beat competitors "
                "on some metrics, but in absolute terms your scores are below targets (BLUF < 50%, "
                "visible-facts < 70%). Your competitors are simply weaker. The action plan moves "
                "you from \"least bad\" to \"actually good\"."
            )
    elif has_target_advantage and target_strong_on_page:
        if fr:
            out.append(
                "🏆 **Avantage on-page solide.** Tu mènes sur des métriques mesurables ET tes "
                "scores absolus sont au-dessus des cibles. Si tu trailes quand même sur certains "
                "LLMs (voir Section 1), le gap est probablement off-page : autorité externe "
                "(backlinks, mentions presse, Wikipedia/Wikidata, ancienneté du domaine, "
                "spécialisation thématique perçue). **Le toolkit ne mesure pas encore ces signaux** "
                "— c'est dans le backlog (couche diagnostique d'autorité)."
            )
        else:
            out.append(
                "🏆 **Solid on-page advantage.** You lead on measurable metrics AND your absolute "
                "scores beat targets. If you still trail on some LLMs (Section 1), the gap is "
                "likely off-page: external authority (backlinks, press, Wikipedia/Wikidata, "
                "domain age, perceived specialization). **The toolkit doesn't measure these yet.**"
            )
    elif target_strong_on_page:
        if fr:
            out.append(
                "🟡 **Parité haute — gap probable off-page.** Tes métriques on-page sont au "
                "niveau des concurrents ET au-dessus des cibles absolues. Si tu trailes "
                "quand même sur certains LLMs (voir Section 1), le levier est ailleurs : "
                "autorité externe (backlinks, mentions presse, Wikipedia/Wikidata, ancienneté "
                "du domaine, spécialisation thématique perçue). **Le toolkit ne mesure pas "
                "encore ces signaux** — c'est dans le backlog."
            )
        else:
            out.append(
                "🟡 **High-level parity — likely off-page gap.** Your on-page metrics match "
                "competitors AND beat absolute targets. If you still trail on some LLMs, the "
                "lever is elsewhere (external authority). **The toolkit doesn't measure these yet.**"
            )
    else:
        # Parity at low levels — neither side is good
        if fr:
            out.append(
                "⚪ **Parité au niveau bas.** Tes métriques sont au niveau de tes concurrents, "
                "mais toutes (toi inclus) sont **sous les cibles absolues** (BLUF < 50%, "
                "visible-facts < 70%). Deux lectures possibles :"
            )
            out.append("")
            out.append(
                "1. **Si tu trailes en RRF** (voir Section 1), le gap vient probablement de "
                "signaux non mesurés ici : autorité externe (backlinks, mentions presse, "
                "Wikipedia/Wikidata, ancienneté), spécialisation thématique perçue, ou signaux "
                "on-page non audités (profondeur de contenu, freshness, internal linking)."
            )
            out.append(
                "2. **Si tu mènes en RRF** malgré ces métriques basses, ton avantage repose "
                "essentiellement sur l'autorité externe et tu peux **encore creuser l'écart** "
                "en attaquant le plan d'action."
            )
        else:
            out.append(
                "⚪ **Low-level parity.** Your metrics match competitors, but all of you "
                "(including you) are **below absolute targets**. Two readings:"
            )
            out.append("")
            out.append(
                "1. **If you trail in RRF** (Section 1), the gap likely comes from signals "
                "not measured here: external authority (backlinks, press, Wikipedia/Wikidata, "
                "domain age), perceived specialization, or unaudited on-page signals (content "
                "depth, freshness, internal linking)."
            )
            out.append(
                "2. **If you lead in RRF** despite low metrics, your advantage rests on external "
                "authority and you can **widen the gap** further by tackling the action plan."
            )
    out.append("")

    # Detail bullets — list which competitor beats target on which metric
    if has_competitor_advantage:
        for comp, advs in competitor_advantages.items():
            if not advs:
                continue
            bullets = ", ".join(
                f"{metric_lbl[m]} {t}% → **{c}%** (+{c-t} pts)"
                for m, t, c in advs
            )
            verb = "te devance sur" if fr else "beats you on"
            out.append(f"- `{comp}` {verb} : {bullets}")
        out.append("")

    if has_target_advantage:
        for comp, advs in target_advantages.items():
            if not advs:
                continue
            bullets = ", ".join(
                f"{metric_lbl[m]} {c}% → **{t}%** (+{t-c} pts)"
                for m, c, t in advs
            )
            verb = "tu devances" if fr else "you beat"
            out.append(f"- `{comp}` : {verb} sur — {bullets}")
        out.append("")

    return out


def _build_audit_snapshot(
    domain: str,
    positioning: str | None,
    competitors: list[str],
    rrf_run,
    per_llm: dict | None,
    schema_groups: list[dict],
    content_groups: list[dict],
    crawler_rpt,
    bluf_avg, def_avg, vf_avg,
) -> dict:
    """Compact JSON-serializable snapshot of the audit's key metrics.
    Written to `<audits_dir>/<date>-audit-data.json` for delta tracking
    by the next run.
    """
    snap: dict = {
        "version": 1,
        "date": date.today().isoformat(),
        "domain": domain,
        "positioning": positioning,
        "competitors": list(competitors or []),
        "metrics": {
            "bluf_avg": bluf_avg,
            "def_lang_avg": def_avg,
            "visible_facts_avg": vf_avg,
        },
        "findings_count": {},
    }
    # Findings count by code
    fc: dict[str, int] = {}
    for g in schema_groups + content_groups:
        fc[g["code"]] = fc.get(g["code"], 0) + 1
    for f in (crawler_rpt.findings if crawler_rpt else []):
        fc[f.code] = fc.get(f.code, 0) + 1
    snap["findings_count"] = fc

    if rrf_run:
        snap["engines"] = list(rrf_run.engines)
        snap["engine_health"] = {}
        for engine_name, score_list in rrf_run.scores.items():
            if not score_list:
                continue
            s0 = score_list[0]
            snap["engine_health"][engine_name] = {
                "answered": s0.queries_total - s0.queries_failed,
                "failed": s0.queries_failed,
                "top_n_measured": rrf_run.engine_meta.get(engine_name).top_n_measured if engine_name in rrf_run.engine_meta else 0,
            }
        # RRF target + best competitor per engine
        snap["rrf_per_engine"] = {}
        target_n = rrf_run.target
        for engine_name, score_list in rrf_run.scores.items():
            target_score = next((s for s in score_list if s.domain == target_n), None)
            comp_scores = [(s.domain, s.rrf_score) for s in score_list if s.domain != target_n]
            best_comp = max(comp_scores, key=lambda kv: kv[1]) if comp_scores else None
            snap["rrf_per_engine"][engine_name] = {
                "target": round(target_score.rrf_score, 4) if target_score else 0.0,
                "best_competitor": [best_comp[0], round(best_comp[1], 4)] if best_comp else None,
            }
    if per_llm:
        snap["per_llm"] = {
            slug: {
                "present": a["present"],
                "answered": a["answered"],
                "comparative": a["comparative"],
                "verdict": a["verdict"],
                "is_leader": bool(a.get("is_leader")),
                "fragile_leader": bool(a.get("fragile_leader")),
            }
            for slug, a in per_llm.items()
        }
    return snap


def _load_previous_snapshot(client_dir, today: str) -> dict | None:
    """Find the most recent `*-audit-data.json` that's not today's. Returns the
    parsed snapshot or None if none / corrupt / today's is the only one.
    """
    audits_dir = client_dir / "audits"
    if not audits_dir.exists():
        return None
    candidates = sorted(
        p for p in audits_dir.glob("*-audit-data.json")
        if p.stem != f"{today}-audit-data"
    )
    if not candidates:
        return None
    try:
        return json.loads(candidates[-1].read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _render_delta_section(prev: dict | None, current: dict, fr: bool) -> list[str]:
    """Compare current snapshot against the previous one. Renders a 'Depuis
    l'audit précédent' section showing what changed in metrics that matter.
    """
    if not prev:
        return []

    out: list[str] = []
    prev_date = prev.get("date", "?")
    if fr:
        out.append(f"## Depuis l'audit précédent ({prev_date})")
        out.append("")
        out.append(
            "_Diff entre le snapshot précédent et celui-ci. Les valeurs en flèche `↑` / `↓` "
            "sont signées (vert = mieux pour toi, rouge = moins bien)._"
        )
    else:
        out.append(f"## Since the previous audit ({prev_date})")
        out.append("")
        out.append(
            "_Diff between the previous snapshot and this one. `↑` / `↓` arrows are signed "
            "(green = better for you, red = worse)._"
        )
    out.append("")

    rows: list[tuple[str, str, str, str]] = []  # (metric, before, now, delta_visual)

    # --- Engine health (reliability) ---
    prev_eh = prev.get("engine_health", {})
    curr_eh = current.get("engine_health", {})
    for engine in sorted(set(prev_eh) | set(curr_eh)):
        p_ans = prev_eh.get(engine, {}).get("answered", 0)
        p_fail = prev_eh.get(engine, {}).get("failed", 0)
        c_ans = curr_eh.get(engine, {}).get("answered", 0)
        c_fail = curr_eh.get(engine, {}).get("failed", 0)
        if (p_ans, p_fail) != (c_ans, c_fail):
            delta = c_ans - p_ans
            arrow = "✅" if delta > 0 else ("⚠️" if delta < 0 else "=")
            sign = "+" if delta > 0 else ""
            rows.append((
                f"`{engine}` — réponses" if fr else f"`{engine}` — answered",
                f"{p_ans}/{p_ans + p_fail}",
                f"{c_ans}/{c_ans + c_fail}",
                f"{sign}{delta} {arrow}" if delta != 0 else "=",
            ))

    # --- Per-LLM presence + comparative ---
    prev_pl = prev.get("per_llm", {})
    curr_pl = current.get("per_llm", {})
    from scripts.llm_impact import IN_SCOPE_LLMS
    label_map = {l.slug: (l.label_fr if fr else l.label_en) for l in IN_SCOPE_LLMS}
    for slug in [l.slug for l in IN_SCOPE_LLMS]:
        if slug not in prev_pl or slug not in curr_pl:
            continue
        p = prev_pl[slug]
        c = curr_pl[slug]
        # Presence change
        if (p.get("present"), p.get("answered")) != (c.get("present"), c.get("answered")):
            d = c.get("present", 0) - p.get("present", 0)
            arrow = "↑" if d > 0 else ("↓" if d < 0 else "=")
            sign = "+" if d > 0 else ""
            rows.append((
                f"Présence {label_map.get(slug, slug)}" if fr else f"Presence {label_map.get(slug, slug)}",
                f"{p.get('present', 0)}/{p.get('answered', 0)}",
                f"{c.get('present', 0)}/{c.get('answered', 0)}",
                f"{sign}{d} {arrow}" if d != 0 else "=",
            ))
        # Comparative change (only show if meaningful — > 0.05)
        d_comp = c.get("comparative", 0) - p.get("comparative", 0)
        if abs(d_comp) >= 0.05:
            arrow = "↑" if d_comp > 0 else "↓"
            sign = "+" if d_comp > 0 else ""
            rows.append((
                f"Force comp. {label_map.get(slug, slug)}" if fr else f"Comp. strength {label_map.get(slug, slug)}",
                f"{p.get('comparative', 0):.2f}",
                f"{c.get('comparative', 0):.2f}",
                f"{sign}{d_comp:+.2f} {arrow}",
            ))

    # --- On-page metrics ---
    prev_m = prev.get("metrics", {})
    curr_m = current.get("metrics", {})
    metric_labels = {
        "bluf_avg": ("BLUF moyen", "BLUF average"),
        "def_lang_avg": ("Densité def-language", "Def-language density"),
        "visible_facts_avg": ("Couverture faits visibles", "Visible-facts coverage"),
    }
    for key, (lab_fr, lab_en) in metric_labels.items():
        p = prev_m.get(key)
        c = curr_m.get(key)
        if p is None or c is None:
            continue
        if p == c:
            continue
        d = (c or 0) - (p or 0)
        arrow = "↑" if d > 0 else "↓"
        sign = "+" if d > 0 else ""
        rows.append((
            (lab_fr if fr else lab_en),
            f"{p}%",
            f"{c}%",
            f"{sign}{d}% {arrow}",
        ))

    # --- Findings count diff ---
    prev_fc = prev.get("findings_count", {})
    curr_fc = current.get("findings_count", {})
    for code in sorted(set(prev_fc) | set(curr_fc)):
        p = prev_fc.get(code, 0)
        c = curr_fc.get(code, 0)
        if p == c:
            continue
        d = c - p
        arrow = "✅" if d < 0 else "⚠️"  # fewer findings = good
        sign = "+" if d > 0 else ""
        rows.append((
            f"Findings `{code}`",
            str(p),
            str(c),
            f"{sign}{d} {arrow}",
        ))

    if not rows:
        if fr:
            out.append("_Aucun changement notable depuis le précédent audit (mêmes données)._")
        else:
            out.append("_No meaningful change since the previous audit (same data)._")
        out.append("")
        return out

    if fr:
        out.append("| Métrique | Avant | Maintenant | Delta |")
    else:
        out.append("| Metric | Before | Now | Delta |")
    out.append("|---|---:|---:|---:|")
    for r in rows:
        out.append(f"| {r[0]} | {r[1]} | {r[2]} | {r[3]} |")
    out.append("")

    return out


def _collect_strengths(
    per_llm: dict | None,
    rrf_summary: dict | None,
    schema_groups: list[dict],
    content_reports: list,
    crawler_rpt,
    bluf_avg: int,
    def_avg,
    vf_avg: int,
) -> list[str]:
    """Find audit signals that are already at or above target. Used to render
    the 'Forces — à conserver' section so the audit isn't all-bad-news.

    Tighter than 'absence of failure' — only positive signals are listed,
    each with a number (% met, count of LLMs leader, etc.) so the reader can
    tell if the strength is solid or borderline.
    """
    strengths: list[str] = []

    # --- LLM leadership ---
    if per_llm:
        leader_llms = [slug for slug, a in per_llm.items() if a and a.get("is_leader") and not a.get("fragile_leader")]
        fragile_leader_llms = [slug for slug, a in per_llm.items() if a and a.get("fragile_leader")]
        if leader_llms:
            from scripts.llm_impact import IN_SCOPE_LLMS
            slug_to_label = {l.slug: l.label_fr for l in IN_SCOPE_LLMS}
            names = ", ".join(slug_to_label.get(s, s) for s in leader_llms)
            strengths.append(f"🏆 **Leader solide sur {len(leader_llms)}/5 LLMs** ({names}) — un concurrent te suit mais l'écart est confortable")
        if fragile_leader_llms:
            from scripts.llm_impact import IN_SCOPE_LLMS
            slug_to_label = {l.slug: l.label_fr for l in IN_SCOPE_LLMS}
            names = ", ".join(slug_to_label.get(s, s) for s in fragile_leader_llms)
            strengths.append(f"🟢 **Leader fragile sur {len(fragile_leader_llms)} LLM(s)** ({names}) — en tête mais à surveiller")

    # --- Top wins (any rank ≤ 3) ---
    if rrf_summary and rrf_summary.get("top_wins"):
        # Count #1 wins specifically
        ones = [(q, e) for q, e, r in rrf_summary["top_wins"] if r == 1]
        if ones:
            n_ones = len(ones)
            sample = ones[0]
            strengths.append(
                f"🥇 **#1 sur {n_ones} requête{'s' if n_ones > 1 else ''}** — "
                f"ex : « {sample[0]} » sur `{sample[1]}`"
            )

    # --- Schema validity ---
    has_s0 = any(g["code"] in ("S0", "S0c") for g in schema_groups)
    if not has_s0 and schema_groups is not None:
        strengths.append("📐 **JSON-LD valide partout** — aucune erreur de parsing détectée sur les pages échantillonnées")

    # --- Visible-facts above target on some pages ---
    if vf_avg is not None and vf_avg >= 70:
        strengths.append(f"📊 **Couverture des faits visibles {vf_avg}%** — au-dessus de la cible 70%")
    elif vf_avg is not None and vf_avg >= 50:
        # Borderline — count individual pages above 70
        good_pages = sum(
            1 for r in content_reports
            if r.metrics.get("visible_facts_coverage_pct", 0) >= 70
        ) if content_reports else 0
        if good_pages >= 3:
            strengths.append(
                f"📊 **{good_pages} pages au-dessus de 70% de couverture des faits visibles** — "
                f"même si la moyenne site reste à {vf_avg}%, plusieurs pages tirent vers le haut"
            )

    # --- BLUF above target on some pages ---
    if bluf_avg is not None and bluf_avg >= 50:
        strengths.append(f"🪧 **Conformité BLUF {bluf_avg}%** — au-dessus de la cible 50%")
    elif bluf_avg is not None and content_reports:
        good = sum(
            1 for r in content_reports
            if r.metrics.get("bluf_compliance_pct", 0) >= 50
            and r.metrics.get("h2_count", 0) > 0
        )
        if good >= 2:
            strengths.append(
                f"🪧 **{good} pages déjà conformes BLUF** ≥50% — "
                f"modèle utile pour les autres pages quand tu attaques `CHM1`"
            )

    # --- Crawler policy is clean (no CR1/CR2) ---
    has_critical_crawler = any(f.code in ("CR1", "CR2") for f in (crawler_rpt.findings if crawler_rpt else []))
    if not has_critical_crawler:
        strengths.append(
            "🤖 **Politique crawler IA cohérente** — pas de blocage critique, pas de configuration "
            "inversée détectée dans `robots.txt`"
        )

    return strengths


def _render_howto_section(main_plan: list[dict], fr: bool, T) -> list[str]:
    """Build the 'Comment appliquer' / 'How to apply' section that turns
    abstract findings into concrete paste-ready content.

    Sub-sections fire conditionally based on which codes are in the main plan:
    - CHM1 → BLUF formula + before/after example
    - S1   → JSON-LD templates embedded from `schema/*.json`
    - EE1  → visible-facts coverage explainer + how-to
    """
    import re

    codes_in_plan = {a["code"] for a in main_plan}
    relevant = codes_in_plan & {"CHM1", "S1", "EE1"}
    if not relevant:
        return []

    lines: list[str] = []
    if fr:
        lines.append("## Comment appliquer les actions")
        lines.append("")
        lines.append(
            "_Cette section donne le format concret pour appliquer les actions principales du "
            "plan, plus les commandes de vérification post-fix. À lire **après** la section 2._"
        )
    else:
        lines.append("## How to apply the actions")
        lines.append("")
        lines.append(
            "_Concrete formats for the main plan actions, plus post-fix validation commands. "
            "Read **after** section 2._"
        )
    lines.append("")

    # ---- CHM1 — BLUF ----
    if "CHM1" in codes_in_plan:
        if fr:
            lines += [
                "### Format BLUF — réécriture des H2",
                "",
                "Le format BLUF (Bottom Line Up Front) consiste à mettre **le fait clé / la "
                "conclusion** en première phrase sous chaque H2. Les LLMs scannent les premiers "
                "tokens d'une section pour décider si la passage est citable. Un teaser narratif "
                "perd l'opportunité.",
                "",
                "**❌ Avant** (conversationnel, faible extractibilité)",
                "",
                "> ## Notre approche",
                "> Chez nous, nous croyons que chaque projet est unique. Notre équipe d'experts "
                "vous accompagne pas à pas pour transformer votre vision en réalité…",
                "",
                "**✅ Après** (BLUF, forte extractibilité)",
                "",
                "> ## Notre approche",
                "> [Marque] conçoit [N] [unités d'œuvre] par an avec une équipe de [N] [profil], "
                "en s'appuyant sur [N années] d'expérience pour des clients comme "
                "[3 noms notables].",
                "",
                "Remplace les `[...]` par tes vrais chiffres. Le rapport ne génère pas de réécriture "
                "automatique pour éviter d'inventer des données.",
                "",
                "**Vérification post-fix :** ouvre la page en navigation privée, scroll au H2. Le "
                "1er paragraphe doit commencer par un **fait concret** (chiffre, nom propre, date, "
                "résultat), pas une généralité.",
                "",
            ]
        else:
            lines += [
                "### BLUF format — H2 rewrite",
                "",
                "BLUF (Bottom Line Up Front) means putting **the key fact / conclusion** in the "
                "first sentence under each H2. LLMs scan the first tokens of a section to decide "
                "if the passage is quotable — narrative teasers lose the opportunity.",
                "",
                "**❌ Before** (conversational, weak extractibility)",
                "",
                "> ## Our approach",
                "> At [Brand], we believe every project is unique. Our team of experts walks you "
                "through every step…",
                "",
                "**✅ After** (BLUF, strong extractibility)",
                "",
                "> ## Our approach",
                "> [Brand] delivers [N] [work-units] per year with a team of [N] [profile], "
                "drawing on [N years] of experience for clients including [3 notable names].",
                "",
                "Replace `[...]` with your real numbers. The report deliberately doesn't generate "
                "rewrites automatically to avoid fabricating data.",
                "",
                "**Post-fix check:** open the page in a private window, scroll to the H2. The "
                "first paragraph should start with a **concrete fact** (number, proper noun, "
                "date, result), not a generality.",
                "",
            ]

    # ---- S1 — JSON-LD templates ----
    if "S1" in codes_in_plan:
        from pathlib import Path
        repo_root = Path(__file__).resolve().parent.parent
        schema_dir = repo_root / "schema"

        type_to_file = {
            "Article":         "article.json",
            "Person":          "person.json",
            "BreadcrumbList":  "breadcrumb.json",
            "Organization":    "organization.json",
            "LocalBusiness":   "local-business.json",
            "Product":         "product.json",
            "WebSite":         "website.json",
            "FAQPage":         "faqpage.json",
        }

        # Parse missing types from S1 variant titles
        missing_types: set[str] = set()
        for action in main_plan:
            if action["code"] != "S1":
                continue
            for variant in action.get("variants", []):
                title = variant.get("title", "")
                # Title format: "Missing expected schema type(s) for `<kind>` page: <comma list>"
                m = re.search(r"page:\s*([\w,\s]+)$", title)
                if m:
                    for t in m.group(1).split(","):
                        missing_types.add(t.strip())

        if fr:
            lines += [
                "### Templates JSON-LD prêts à coller",
                "",
                "Les schémas suivants manquent sur tes pages. Copie le bloc dans un "
                "`<script type=\"application/ld+json\">` au sein du `<head>` de la page concernée, "
                "puis remplace les valeurs placeholder par tes vraies données.",
                "",
            ]
        else:
            lines += [
                "### JSON-LD templates ready to paste",
                "",
                "The schemas below are missing on your pages. Copy the block into a "
                "`<script type=\"application/ld+json\">` in the page's `<head>`, then replace "
                "the placeholders with your real data.",
                "",
            ]

        embedded_count = 0
        for type_name in sorted(missing_types):
            template_file = type_to_file.get(type_name)
            if not template_file:
                continue
            template_path = schema_dir / template_file
            if not template_path.exists():
                continue
            content = template_path.read_text(encoding="utf-8").rstrip()
            lines.append(f"#### `{type_name}`")
            lines.append("")
            lines.append("```json")
            lines.append(content)
            lines.append("```")
            lines.append("")
            embedded_count += 1

        if embedded_count == 0:
            if fr:
                lines.append("_Aucun template embarquable pour les types détectés. Voir le "
                             "dossier `schema/` du repo._")
            else:
                lines.append("_No embeddable template for the detected types. See the `schema/` "
                             "directory in the repo._")
            lines.append("")
        else:
            type_alt = "|".join(sorted(t for t in missing_types if t in type_to_file))
            grep_pattern = '"@type":\\s*"(' + type_alt + ')"'
            if fr:
                lines += [
                    "**Vérification post-fix** (remplace `<URL>` par une page modifiée) :",
                    "",
                    "```bash",
                    f"curl -sS '<URL>' | grep -Eo '{grep_pattern}'",
                    "```",
                    "",
                    "Le `curl` doit ressortir au moins une ligne par type ajouté.",
                    "",
                ]
            else:
                lines += [
                    "**Post-fix validation** (replace `<URL>` with a modified page):",
                    "",
                    "```bash",
                    f"curl -sS '<URL>' | grep -Eo '{grep_pattern}'",
                    "```",
                    "",
                    "The `curl` should return at least one line per added type.",
                    "",
                ]

    # ---- EE1 — Visible-facts coverage ----
    if "EE1" in codes_in_plan:
        if fr:
            lines += [
                "### EE1 — couverture des faits visibles",
                "",
                "Les faits déclarés dans ton JSON-LD doivent **aussi apparaître en clair dans le "
                "body** de la page. Si ton schéma dit `priceRange: \"€€\"` mais qu'aucun visiteur "
                "humain ne lit « €€ » sur la page, les LLMs détectent l'incohérence et déclassent "
                "(méthodologie EEP, étude WordLift 2025).",
                "",
                "**Comment fixer (par page audité avec EE1) :**",
                "",
                "1. Ouvre le JSON-LD de la page (Chrome → DevTools → Elements → cherche `<script "
                "type=\"application/ld+json\">`)",
                "2. Liste les **valeurs** (chiffres, dates, noms, prix, fondateurs, lieux, "
                "certifications, dimensions, matériaux…)",
                "3. Pour chaque valeur, vérifie qu'elle apparaît dans le **body visible** (pas dans "
                "une `<meta>` cachée, pas en attribut `alt`)",
                "4. Si absente, ajoute une phrase dans la section pertinente — exemples :",
                "   - « Tarifs : à partir de 200 € » (au lieu d'un `priceRange` caché)",
                "   - « Fondé en 2013 » (au lieu d'un `foundingDate` invisible)",
                "   - « Atelier basé à Paris » (au lieu d'une `PostalAddress` enfouie)",
                "",
                "**Vérification post-fix :** re-run l'audit. Le finding `EE1` doit montrer une "
                "couverture ≥ 70%.",
                "",
            ]
        else:
            lines += [
                "### EE1 — visible-facts coverage",
                "",
                "Facts declared in your JSON-LD should **also appear plainly in the page body**. "
                "If your schema says `priceRange: \"€€\"` but no human reader sees \"€€\" on the "
                "page, LLMs spot the mismatch and demote (EEP methodology, WordLift 2025).",
                "",
                "**How to fix (per page with EE1):**",
                "",
                "1. Open the page's JSON-LD (Chrome → DevTools → Elements → find `<script "
                "type=\"application/ld+json\">`)",
                "2. List the **values** (numbers, dates, names, prices, founders, locations, "
                "certifications, dimensions, materials…)",
                "3. For each value, check it appears in the **visible body** (not in a hidden "
                "`<meta>`, not in an `alt` attribute)",
                "4. If missing, add a sentence in the relevant section — examples:",
                "   - \"Pricing: from €200\" (instead of a hidden `priceRange`)",
                "   - \"Founded in 2013\" (instead of an invisible `foundingDate`)",
                "   - \"Studio based in Paris\" (instead of a buried `PostalAddress`)",
                "",
                "**Post-fix check:** re-run the audit. The `EE1` finding should report ≥ 70% "
                "coverage.",
                "",
            ]

    return lines


def _per_llm_action_plan(llm, all_groups: list[dict], top_n: int = 5) -> list[dict]:
    """Sort `all_groups` by impact-on-this-LLM (desc), then severity, then
    confidence. Returns top N entries augmented with `_impact` field.

    De-duplicates by code: when the same code appears multiple times (e.g. S1
    triggered on 3 pages with different missing-type lists), we keep the
    worst-severity entry and aggregate the page list. Otherwise the action
    plan would be flooded by per-page variants of the same finding.
    """
    from scripts.llm_impact import impact_for, impact_rank
    enriched = []
    for g in all_groups:
        impact = impact_for(g["code"], llm.slug)
        if impact == "none":
            continue
        enriched.append({**g, "_impact": impact})

    # Collapse by code, keeping the worst-severity entry, merging page counts.
    by_code: dict[str, dict] = {}
    code_page_count: dict[str, int] = {}
    for g in enriched:
        code = g["code"]
        n_pages = len(g.get("pages") or [])
        code_page_count[code] = code_page_count.get(code, 0) + n_pages
        prev = by_code.get(code)
        if prev is None or SEV_ORDER.get(g["severity"], 99) < SEV_ORDER.get(prev["severity"], 99):
            by_code[code] = g
    # Re-attach the merged page count
    for code, g in by_code.items():
        g = {**g, "_total_pages": code_page_count[code]}
        by_code[code] = g

    deduped = list(by_code.values())
    deduped.sort(key=lambda g: (
        -impact_rank(g["_impact"]),
        SEV_ORDER.get(g["severity"], 99),
        CONF_ORDER.get(g["confidence"], 99),
    ))
    return deduped[:top_n]


_VERDICT_LABELS = {
    "fr": {
        "absent":            ("🔴 ABSENT",          "tu n'apparais sur aucune requête cible"),
        "partial":           ("🟡 PARTIEL",          "tu apparais sur une minorité des requêtes"),
        "trailing":          ("📉 EN RETRAIT",       "présent sur la majorité, mais un concurrent te devance"),
        "leader":            ("🏆 LEADER",           "présent sur la majorité ET en tête vs concurrents"),
        "dominant-trailing": ("🟢 PRÉSENCE FORTE",   "présent sur quasi toutes les requêtes mais pas leader"),
        "dominant-leader":   ("🏆 LEADER DOMINANT",  "présent sur quasi toutes les requêtes ET leader"),
        "low-sample":        ("⚠️ SIGNAL FAIBLE",    "trop peu de requêtes répondues pour conclure"),
        "unmeasured":        ("⚪ NON MESURÉ",       "moteur(s) sous-jacent(s) en échec"),
    },
    "en": {
        "absent":            ("🔴 ABSENT",            "you appear on no target queries"),
        "partial":           ("🟡 PARTIAL",           "you appear on a minority of queries"),
        "trailing":          ("📉 TRAILING",          "majority presence, but a competitor leads"),
        "leader":            ("🏆 LEADER",            "majority presence AND leading vs competitors"),
        "dominant-trailing": ("🟢 STRONG PRESENCE",   "near-full presence but not leading"),
        "dominant-leader":   ("🏆 DOMINANT LEADER",   "near-full presence AND leading"),
        "low-sample":        ("⚠️ WEAK SIGNAL",       "too few answered queries to conclude"),
        "unmeasured":        ("⚪ NOT MEASURED",      "underlying engine(s) failed"),
    },
}


def _verdict_label(verdict: str, lang: str) -> tuple[str, str]:
    table = _VERDICT_LABELS["fr"] if lang.startswith("fr") else _VERDICT_LABELS["en"]
    return table.get(verdict, table["unmeasured"])


def render_report(
    site: str,
    locale_obj,
    sampled,
    crawler_rpt: CheckReport,
    schema_reports: list[CheckReport],
    content_reports: list[CheckReport],
    rrf_md: str | None,
    *,
    rrf_run=None,
    positioning: str | None = None,
    output_lang: str = "en",
    previous_snapshot: dict | None = None,
    competitors: list[str] | None = None,
    competitor_benchmarks: dict | None = None,
    target_authority=None,
    competitor_authority: dict | None = None,
    minimal: bool = False,
) -> tuple[str, dict]:
    L = _L(output_lang)
    from scripts.i18n import translate as _t, glossary as _glossary
    def T(s):
        """Shortcut: translate to output_lang (returns original if no translation)."""
        return _t(s, output_lang)
    today = date.today().isoformat()
    domain = site.replace("https://", "").replace("http://", "").rstrip("/")
    if domain.startswith("www."):
        domain = domain[4:]
    domain = domain.split("/")[0]  # path-strip

    lines: list[str] = []
    lines.append(f"# {L['title'].format(domain=domain)}")
    lines.append("")
    lines.append(f"**{L['url_label']} :** {site}")
    lines.append(f"**{L['locale_label']} :** {locale_obj.tag} (source: {locale_obj.source})")
    if positioning:
        if output_lang.startswith("fr"):
            lines.append(f"**Objectif (positionnement) :** « {positioning} »")
        else:
            lines.append(f"**Objective (positioning):** \"{positioning}\"")
    lines.append(f"**{L['method_label']} :** {L['method_value']}")
    lines.append(f"**{L['date_label']} :** {today}")
    lines.append(f"**{L['pages_label']} :** {len(sampled)}")
    lines.append("")

    # === Executive summary ===
    schema_ok_reports = [r for r in schema_reports if not r.error]
    content_ok_reports = [r for r in content_reports if not r.error]

    bluf_pcts = [
        r.metrics.get("bluf_compliance_pct", 0)
        for r in content_ok_reports
        if r.metrics.get("h2_count", 0) > 0
    ]
    def_pcts = [r.metrics.get("definition_density_pct", 0) for r in content_ok_reports]
    visible_facts = [
        r.metrics.get("visible_facts_coverage_pct")
        for r in schema_ok_reports
        if "visible_facts_coverage_pct" in r.metrics
    ]

    bluf_avg = _avg_int(bluf_pcts)
    def_avg = _aggregate_metric(def_pcts, default=0)
    vf_avg = _avg_int(visible_facts)

    n_schema_findings = sum(len(r.findings) for r in schema_ok_reports)
    n_content_findings = sum(len(r.findings) for r in content_ok_reports)
    n_crawler_findings = len(crawler_rpt.findings)

    # === Pre-aggregate findings (dedup by code+title) for priority list & sections ===
    schema_groups = _aggregate_findings_by_code(schema_ok_reports, site)
    content_groups = _aggregate_findings_by_code(content_ok_reports, site)
    # Crawler findings are site-level (not per-page), so already non-redundant.

    n_schema_unique = len(schema_groups)
    n_content_unique = len(content_groups)

    rrf_summary = _rrf_summary(rrf_run, domain) if rrf_run else None
    fr = output_lang.startswith("fr")

    # Pre-compute the per-LLM assessment so it can be reused by the strengths
    # collector AND the snapshot builder (DRY).
    from scripts.llm_impact import IN_SCOPE_LLMS, impact_for, impact_glyph, impact_label
    per_llm_for_snapshot: dict = {}
    if rrf_run is not None:
        for llm in IN_SCOPE_LLMS:
            assessment = _per_llm_presence(llm, rrf_run, domain)
            if assessment is not None:
                per_llm_for_snapshot[llm.slug] = assessment

    # Pre-compute the action plan groups so the TLDR (top of audit) can
    # reference the top actions before Section 2 actually renders them.
    crawler_as_groups_pre = [{
        "code": f.code, "severity": f.severity, "confidence": f.confidence,
        "title": f.title, "description": f.description,
        "effort": f.effort, "expected_gain": f.expected_gain,
        "pages": [(crawler_rpt.target, f)],
    } for f in crawler_rpt.findings]
    authority_as_groups_pre = []
    if target_authority is not None:
        for f in target_authority.findings:
            authority_as_groups_pre.append({
                "code": f.code, "severity": f.severity, "confidence": f.confidence,
                "title": f.title, "description": f.description,
                "effort": f.effort, "expected_gain": f.expected_gain,
                "pages": [(target_authority.target, f)],
            })
    all_groups_pre = (list(schema_groups) + list(content_groups)
                      + crawler_as_groups_pre + authority_as_groups_pre)
    main_plan_pre, experimental_pre = _unified_action_plan(all_groups_pre) if all_groups_pre else ([], [])

    # === TLDR — résumé exécutif (top of audit) ===
    tldr_lines = _render_tldr(
        per_llm=per_llm_for_snapshot if rrf_run else None,
        main_plan=main_plan_pre,
        target_authority=target_authority,
        rrf_summary=rrf_summary,
        domain=domain,
        fr=fr,
    )
    if tldr_lines:
        lines.extend(tldr_lines)

    # === SECTION 1: État des lieux par LLM ===

    lines.append(f"## {L['h_state']}")
    lines.append("")
    if rrf_run is None:
        lines.append(
            "_Pas de mesure RRF dans cet audit. Passer `--positioning <objectif>` ou "
            "`--seed q1,q2 --vs c1,c2` pour activer la mesure de présence._"
            if fr else
            "_No RRF measurement in this audit. Pass `--positioning <objective>` or "
            "`--seed q1,q2 --vs c1,c2` to enable presence measurement._"
        )
        lines.append("")
    else:
        if fr:
            lines.append(
                "Présence mesurée par LLM, dérivée du RRF sur les moteurs qui les alimentent "
                "(voir Annexe A pour le détail brut)."
            )
        else:
            lines.append(
                "Per-LLM presence, derived from RRF on each LLM's backing engine(s) "
                "(see Appendix A for raw detail)."
            )
        lines.append("")

        # Reuse the per-LLM assessment computed at the top of render_report
        per_llm = per_llm_for_snapshot

        # Compact summary table
        if fr:
            lines.append("| LLM | Verdict | Présence | Force vs leader | Top win |")
        else:
            lines.append("| LLM | Verdict | Presence | Strength vs leader | Top win |")
        lines.append("|---|---|---|---|---|")
        for llm in IN_SCOPE_LLMS:
            a = per_llm.get(llm.slug)
            if a is None:
                continue
            label = llm.label_fr if fr else llm.label_en
            verdict_label_str, _ = _verdict_label(a["verdict"], output_lang)
            presence_cell = f"{a['present']}/{a['answered']}"
            comp_cell = f"{a['comparative']:.2f}" if a["comparative"] else "—"
            if a["top_wins"]:
                # pick the best (lowest rank)
                q, e, r = min(a["top_wins"], key=lambda x: x[2])
                top_cell = f"#{r} `{e}` — « {q} »" if fr else f"#{r} `{e}` — \"{q}\""
            else:
                top_cell = "—"
            lines.append(f"| **{label}** | {verdict_label_str} | {presence_cell} | {comp_cell} | {top_cell} |")
        lines.append("")

        # Detail blocks GROUPED BY BACKEND FAMILY.
        # ChatGPT + Gemini share `(google,)` → identical RRF data → one block.
        # Claude + Le Chat share `(brave,)` → one block.
        # Perplexity has `(google, brave)` → standalone block.
        # The top table above already shows 5 rows for individual scan; this
        # collapses redundant detail prose to 3 blocks max.
        from collections import OrderedDict
        backend_groups: OrderedDict = OrderedDict()
        for llm in IN_SCOPE_LLMS:
            if llm.slug not in per_llm:
                continue
            backend_groups.setdefault(llm.engines, []).append(llm)

        for engines_key, group_llms in backend_groups.items():
            # All LLMs in the group share the same per_llm assessment by definition
            # (same backend(s) ⇒ same data).
            canonical = group_llms[0]
            a = per_llm[canonical.slug]
            verdict_label_str, verdict_desc = _verdict_label(a["verdict"], output_lang)
            engines_str = " + ".join(f"`{e}`" for e in a["engines"])

            # Header
            if len(group_llms) > 1:
                names = " + ".join(llm.label_fr if fr else llm.label_en for llm in group_llms)
                lines.append(f"### {names} — {verdict_label_str}")
            else:
                lines.append(f"### {canonical.label_fr if fr else canonical.label_en} — {verdict_label_str}")
            lines.append("")

            # Per-LLM notes (one bullet per LLM in the group, since each has
            # its own optimization character even though stats are shared)
            for llm in group_llms:
                notes = llm.notes_fr if fr else llm.notes_en
                if len(group_llms) > 1:
                    sub_label = llm.label_fr if fr else llm.label_en
                    lines.append(f"_**{sub_label}** — {notes}_")
                else:
                    lines.append(f"_{notes}_")
            lines.append("")

            # Stats body
            if fr:
                lines.append(f"- **Backend(s) mesuré(s)** : {engines_str}")
                lines.append(f"- **Présence** : {a['present']}/{a['answered']} requêtes répondues — {verdict_desc}")
                if a.get("is_leader") and a["best_comp"]:
                    lead_line = f"- **🏆 Leader** · meilleur concurrent `{a['best_comp'][0]}` (RRF {a['best_comp'][1]})"
                    if a.get("fragile_leader"):
                        gap_pct = (1.0 - a["min_competitor_ratio"]) * 100
                        lead_line += f" — ⚠️ **leadership fragile** (écart {gap_pct:.1f}%)"
                    lines.append(lead_line)
                elif a["best_comp"]:
                    lines.append(f"- **Concurrent leader** : `{a['best_comp'][0]}` (RRF {a['best_comp'][1]}) — toi à **{a['comparative']:.0%}** de sa force")
                if a.get("low_sample"):
                    lines.append(f"- ⚠️ **Échantillon trop faible** ({a['answered']} requêtes répondues) — re-lancer plus tard quand le moteur cooldown")
                if a["top_wins"]:
                    wins = ", ".join(f"#{r} sur `{e}` (« {q} »)" for q, e, r in sorted(a["top_wins"], key=lambda x: x[2])[:3])
                    lines.append(f"- **Top wins** : {wins}")
            else:
                lines.append(f"- **Measured backend(s)**: {engines_str}")
                lines.append(f"- **Presence**: {a['present']}/{a['answered']} answered queries — {verdict_desc}")
                if a.get("is_leader") and a["best_comp"]:
                    lead_line = f"- **🏆 Leader** · top competitor `{a['best_comp'][0]}` (RRF {a['best_comp'][1]})"
                    if a.get("fragile_leader"):
                        gap_pct = (1.0 - a["min_competitor_ratio"]) * 100
                        lead_line += f" — ⚠️ **fragile leadership** ({gap_pct:.1f}% gap)"
                    lines.append(lead_line)
                elif a["best_comp"]:
                    lines.append(f"- **Top competitor**: `{a['best_comp'][0]}` (RRF {a['best_comp'][1]}) — you at **{a['comparative']:.0%}** of their strength")
                if a.get("low_sample"):
                    lines.append(f"- ⚠️ **Sample too small** ({a['answered']} answered queries) — re-run later when the engine cools down")
                if a["top_wins"]:
                    wins = ", ".join(f"#{r} on `{e}` (\"{q}\")" for q, e, r in sorted(a["top_wins"], key=lambda x: x[2])[:3])
                    lines.append(f"- **Top wins**: {wins}")
            lines.append("")

        # SERP-level warnings (host-grouping, fail-rates) once at the end of section 1
        warnings_block = []
        if rrf_summary and rrf_summary["dominant_serps_blocking_target"]:
            n = len(rrf_summary["dominant_serps_blocking_target"])
            warnings_block.append(
                f"⚠️ **{n} requêtes** ont renvoyé un SERP dominé par une marque (host-grouping). "
                f"Signal navigationnel — voir Annexe A."
                if fr else
                f"⚠️ **{n} queries** returned a brand-dominated SERP (host-grouping). "
                f"Navigational signal — see Appendix A."
            )
        if rrf_summary and rrf_summary["high_failrate_engines"]:
            engs = ", ".join(rrf_summary["high_failrate_engines"])
            warnings_block.append(
                f"⚠️ Moteur(s) à fort taux d'échec : `{engs}` (>50%). Signaux provisoires."
                if fr else
                f"⚠️ High-failure-rate engine(s): `{engs}` (>50%). Signals are provisional."
            )
        if warnings_block:
            for w in warnings_block:
                lines.append(f"> {w}")
            lines.append("")

    # === SECTION 1.5: Forces / À conserver ===
    # Counterweight to the action plan: highlight what's already working,
    # so the reader doesn't walk away thinking "tout va mal".
    strengths = _collect_strengths(
        per_llm if rrf_run else None,
        rrf_summary,
        schema_groups,
        content_ok_reports,
        crawler_rpt,
        bluf_avg, def_avg, vf_avg,
    )
    if strengths:
        lines.append("## Forces — à conserver" if fr else "## Strengths — keep these")
        lines.append("")
        if fr:
            lines.append(
                "_Ce que l'audit a relevé de positif. Pas de complaisance : ces points sont "
                "déjà solides, **garde-les** quand tu travailles sur le plan d'action._"
            )
        else:
            lines.append(
                "_What the audit found working. No flattery — these are solid baselines, "
                "**don't break them** while working on the action plan._"
            )
        lines.append("")
        for s in strengths:
            lines.append(f"- {s}")
        lines.append("")

    # === SECTION 1.7: Benchmark concurrent on-page ===
    # Compares the target's homepage against each competitor's homepage on the
    # same on-page metrics. The diagnostic verdict tells the reader whether the
    # gap is on-page (closeable by the action plan) or off-page (authority).
    if competitor_benchmarks:
        target_homepage_schema = schema_ok_reports[0] if schema_ok_reports else None
        target_homepage_content = content_ok_reports[0] if content_ok_reports else None
        bench_lines = _render_competitor_benchmark(
            target_homepage_schema,
            target_homepage_content,
            competitor_benchmarks,
            fr,
        )
        if bench_lines:
            lines.extend(bench_lines)

    # === SECTION 1.8: Diagnostic d'autorité ===
    # Companion to the on-page benchmark: when that section concludes
    # "off-page gap likely", this one quantifies it on Wikipedia / Wikidata /
    # Wayback. Stays in section 1 territory (état des lieux), then the Plan
    # d'action below stays focused on on-page actions.
    if target_authority is not None:
        auth_lines = _render_authority_section(target_authority, competitor_authority, fr)
        if auth_lines:
            lines.extend(auth_lines)

    # === SECTION 2: Unified action plan ===

    # Reuse the action plan groups computed at the top of render_report
    # (they fed the TLDR). Aliases preserve downstream code compatibility.
    crawler_as_groups = crawler_as_groups_pre
    authority_as_groups = authority_as_groups_pre
    all_groups = all_groups_pre

    lines.append(f"## {L['h_actions']}")
    lines.append("")
    if not all_groups:
        lines.append(
            "_Aucune action nécessaire — l'audit n'a pas relevé de finding actionnable._"
            if fr else
            "_No actions needed — the audit found nothing actionable._"
        )
        lines.append("")
    else:
        if fr:
            lines.append(
                "Une action = un type de finding consolidé. Le tag **Impact LLM** indique "
                "l'impact estimé de la correction sur chaque LLM en scope (`+++` fort, "
                "`++` moyen-fort, `+` moyen, `+/-` faible/incertain, `?` expérimental). "
                "Les leviers à faible évidence sont déplacés en bas dans **Pistes "
                "expérimentales**."
            )
        else:
            lines.append(
                "One action = one consolidated finding type. The **LLM impact** tag shows "
                "the estimated impact of fixing it on each in-scope LLM (`+++` high, "
                "`++` medium-high, `+` medium, `+/-` low/uncertain, `?` experimental). "
                "Low-evidence levers are moved to **Experimental tracks** at the bottom."
            )
        lines.append("")

        main_plan, experimental = main_plan_pre, experimental_pre

        for i, action in enumerate(main_plan, 1):
            for ln in _render_unified_action(action, i, fr, T):
                lines.append(ln)
            lines.append("")

        # --- Quick wins sub-section (effort < 30min) ---
        # Surface findings whose effort is small enough to ship today, regardless
        # of impact rank. Useful when the user wants "ce que je peux faire maintenant".
        quick_wins_lines = _render_quick_wins(main_plan, experimental, fr, T)
        if quick_wins_lines:
            lines.extend(quick_wins_lines)

        # --- 30-day planning sub-section ---
        # Translates the action plan into a week-by-week roadmap based on
        # severity × effort. Audit goes from analytical to operational.
        planning_lines = _render_30_day_plan(main_plan, fr, T)
        if planning_lines:
            lines.extend(planning_lines)

        # Dedup: codes already listed in Quick wins shouldn't reappear in
        # Pistes expérimentales (same code, same title, just shown for a
        # different reason). Keep them in Quick wins (effort-driven) and
        # drop from experimental (confidence-driven).
        quick_codes = {
            a["code"] for a in (main_plan + experimental)
            if (_effort_minutes(a.get("effort")) or 999) <= 30
        }
        experimental_dedup = [a for a in experimental if a["code"] not in quick_codes]

        if experimental_dedup:
            lines.append("### " + ("Pistes expérimentales" if fr else "Experimental tracks"))
            lines.append("")
            if fr:
                lines.append(
                    "_Leviers à faible confidence ou non confirmés en 2026 — à considérer en "
                    "bonus, pas comme priorité._"
                )
            else:
                lines.append(
                    "_Low-confidence or unconfirmed levers — bonus tracks, not priorities._"
                )
            lines.append("")
            for action in experimental_dedup:
                code = action["code"]
                title = T(action["variants"][0]["title"]) if action["variants"] else code
                eff = action.get("effort")
                eff_str = f" · _{T(eff)}_" if eff else ""
                lines.append(f"- **`{code}`** — {title}{eff_str}")
            lines.append("")

        # === SECTION 2.5: How to apply the actions ===
        # Conditionally renders concrete formats (BLUF formula, JSON-LD templates,
        # visible-facts how-to) based on which codes are in the main plan.
        # Skipped when --minimal (the user already knows the methodology).
        if not minimal:
            howto_lines = _render_howto_section(main_plan, fr, T)
            if howto_lines:
                lines.extend(howto_lines)

    # === Annexes header ===
    lines.append(f"## {L['h_annex']}")
    lines.append("")
    if fr:
        lines.append(
            "_Détails techniques bruts par module. Les sections 1 et 2 ci-dessus sont la lecture "
            "principale ; les annexes servent à creuser un finding spécifique._"
        )
    else:
        lines.append(
            "_Raw per-module technical detail. Sections 1 and 2 above are the primary read; "
            "the appendices are for digging into a specific finding._"
        )
    lines.append("")

    # === RRF ===
    lines.append(f"## {L['h_rrf']}")
    lines.append("")
    if rrf_md:
        # Embed the RRF report content (skip its top-level title since we have ours)
        rrf_body = "\n".join(rrf_md.split("\n")[1:]).lstrip("\n")
        lines.append(rrf_body)
    else:
        lines.append(L["no_rrf"])
    lines.append("")

    # === Crawlers ===
    lines.append(f"## {L['h_crawlers']}")
    lines.append("")
    if crawler_rpt.error:
        lines.append(f"_Audit failed: {crawler_rpt.error}_")
    else:
        cats = crawler_rpt.metrics.get("categories", {})
        if output_lang.startswith("fr"):
            lines.append("| Catégorie | Allow explicite | Block explicite | Implicite (via *) |")
        else:
            lines.append("| Category | Explicit allow | Explicit block | Implicit (via *) |")
        lines.append("|---|---|---|---|")
        for cat_key, cat_label_fr, cat_label_en in [
            ("training", "🔴 Training", "🔴 Training"),
            ("rag", "🟢 RAG / search", "🟢 RAG / search"),
            ("user_request", "🟢 User-request", "🟢 User-request"),
        ]:
            cat = cats.get(cat_key, {})
            label = cat_label_fr if output_lang.startswith("fr") else cat_label_en
            allowed = cat.get('allowed', []) or []
            blocked = cat.get('blocked', []) or []
            implicit = cat.get('implicit', []) or []
            allowed_names = f" ({', '.join(allowed[:4])})" if allowed else ""
            blocked_names = f" ({', '.join(blocked[:4])})" if blocked else ""
            lines.append(
                f"| {label} | {len(allowed)}{allowed_names} | {len(blocked)}{blocked_names} | {len(implicit)} |"
            )
        lines.append("")
        if crawler_rpt.findings:
            lines.append(f"### {L['findings']}")
            lines.append("")
            for f in sort_findings(crawler_rpt.findings):
                lines.append(f"- **[{f.severity}/{f.confidence}]** `{f.code}` — {T(f.title)}")
                if f.description:
                    lines.append(f"  - {T(f.description)}")
                if f.effort:
                    lines.append(f"  - {L['effort']}: {T(f.effort)}")
            lines.append("")

    # === Schema (multi-page) ===
    lines.append(f"## {L['h_schema']}")
    lines.append("")
    if schema_ok_reports:
        if output_lang.startswith("fr"):
            lines.append("| URL | Type | Schemas | Visible-facts | Findings |")
        else:
            lines.append("| URL | Kind | Schemas | Visible-facts | Findings |")
        lines.append("|---|---|---|---:|---:|")
        for r, s in zip(schema_ok_reports, sampled[:len(schema_ok_reports)]):
            types = ", ".join(r.metrics.get("types_declared", [])[:4])
            vf = r.metrics.get("visible_facts_coverage_pct", "—")
            short_u = _short_url(r.target, site)
            lines.append(f"| `{short_u}` | {s.kind} | {types} | {vf}% | {len(r.findings)} |")
        lines.append("")

        # Site-level metrics
        if visible_facts:
            lines.append(f"**{L['site_avg']}** ({len(visible_facts)}) — visible-facts: **{vf_avg}%** (target ≥70%)")
            lines.append("")

        # Findings — aggregated by type with affected-pages list
        if schema_groups:
            lines.append(f"### {L['findings']}")
            lines.append("")
            for g in schema_groups[:10]:
                affected = [_short_url(u, site) for u, _ in g["pages"]]
                if len(affected) == 1:
                    page_str = affected[0]
                else:
                    page_str = f"{len(affected)} pages : " + ", ".join(f"`{u}`" for u in affected[:5])
                    if len(affected) > 5:
                        page_str += f" (+{len(affected)-5})"
                lines.append(
                    f"- **[{g['severity']}/{g['confidence']}]** `{g['code']}` ({page_str}) — {T(g['title'])}"
                )
                if g["expected_gain"]:
                    lines.append(f"  - {L['gain']}: {T(g['expected_gain'])}")
            lines.append("")

    # === Content health (multi-page) ===
    lines.append(f"## {L['h_content']}")
    lines.append("")
    if content_ok_reports:
        if output_lang.startswith("fr"):
            lines.append("| URL | Type | BLUF | DefLang | Avg paragraph | Findings |")
        else:
            lines.append("| URL | Kind | BLUF | DefLang | Avg paragraph | Findings |")
        lines.append("|---|---|---:|---:|---:|---:|")
        for r, s in zip(content_ok_reports, sampled[:len(content_ok_reports)]):
            bluf = r.metrics.get("bluf_compliance_pct", "—")
            deflang = r.metrics.get("definition_density_pct", "—")
            avg_p = r.metrics.get("avg_paragraph_words", "—")
            short_u = _short_url(r.target, site)
            lines.append(f"| `{short_u}` | {s.kind} | {bluf}% | {deflang}% | {avg_p}w | {len(r.findings)} |")
        lines.append("")

        if output_lang.startswith("fr"):
            lines.append(f"**Moyennes site** :")
            lines.append(f"- BLUF compliance : **{bluf_avg}%** (cible ≥50%)")
            lines.append(f"- Densité langage de définition : **{def_avg}%** (cible ≥30%)")
            lines.append(f"- Couverture des faits visibles : **{vf_avg}%** (cible ≥70%)")
        else:
            lines.append(f"**Site averages**:")
            lines.append(f"- BLUF compliance: **{bluf_avg}%** (target ≥50%)")
            lines.append(f"- Definition language density: **{def_avg}%** (target ≥30%)")
            lines.append(f"- Visible-facts coverage: **{vf_avg}%** (target ≥70%)")
        lines.append("")

        if content_groups:
            lines.append(f"### {L['findings']}")
            lines.append("")
            for g in content_groups[:10]:
                affected = [_short_url(u, site) for u, _ in g["pages"]]
                if len(affected) == 1:
                    page_str = affected[0]
                else:
                    page_str = f"{len(affected)} pages : " + ", ".join(f"`{u}`" for u in affected[:5])
                    if len(affected) > 5:
                        page_str += f" (+{len(affected)-5})"
                lines.append(
                    f"- **[{g['severity']}/{g['confidence']}]** `{g['code']}` ({page_str}) — {T(g['title'])}"
                )
                if g["expected_gain"]:
                    lines.append(f"  - {L['gain']}: {T(g['expected_gain'])}")
            lines.append("")

    # === Aggregated finding view (Annexe E) ===
    # Same data as the per-LLM action plans, but sorted purely by sev × confidence
    # and showing the universal-priority view. Useful for engineers who want the
    # raw checklist without per-LLM weighting.
    lines.append(f"## {L['h_priority']}")
    lines.append("")
    sorted_groups = sorted(all_groups, key=lambda g: (
        SEV_ORDER.get(g["severity"], 99),
        CONF_ORDER.get(g["confidence"], 99),
    ))

    if output_lang.startswith("fr"):
        lines.append("Triés par sévérité × confiance. Une ligne = un type de finding (les pages affectées sont listées).")
    else:
        lines.append("Sorted by severity × confidence. One row per finding type (affected pages listed).")
    lines.append("")
    for i, g in enumerate(sorted_groups[:12], 1):
        n_pages = len(g["pages"])
        if n_pages == 1 and g["pages"][0][0] == site:
            page_info = ""
        elif n_pages == 1:
            page_info = f" ({_short_url(g['pages'][0][0], site)})"
        else:
            page_info = f" ({n_pages} pages)"
        bits = [f"**{T(g['title'])}**"]
        if g["effort"]:
            bits.append(f"_{L['effort']}: {T(g['effort'])}_")
        if g["expected_gain"]:
            bits.append(f"_{L['gain']}: {T(g['expected_gain'])}_")
        lines.append(f"{i}. **[{g['severity']}/{g['confidence']}]** `{g['code']}`{page_info} — " + " · ".join(bits))
    lines.append("")

    # === Glossary (technical term reference; skipped when --minimal) ===
    if not minimal:
        lines.append(_glossary(output_lang))
        lines.append("")

    # === Limits ===
    lines.append(f"## {L['h_limits']}")
    lines.append("")
    lines.append(L["limits_text"])
    lines.append("")
    lines.append("---")
    lines.append("")
    if output_lang.startswith("fr"):
        lines.append(f"_Généré par `scripts/run_audit.py` (Phase 1.5). Données brutes par module : `python3 -m scripts.checks.{{schema,content_health,crawlers}} <url>` et `python3 -m scripts.rrf <domain>`._")
    else:
        lines.append(f"_Generated by `scripts/run_audit.py` (Phase 1.5). Raw per-module data: `python3 -m scripts.checks.{{schema,content_health,crawlers}} <url>` and `python3 -m scripts.rrf <domain>`._")

    # Build the snapshot for delta tracking by the next run.
    snapshot = _build_audit_snapshot(
        domain=domain,
        positioning=positioning,
        competitors=competitors or [],
        rrf_run=rrf_run,
        per_llm=per_llm_for_snapshot if rrf_run else None,
        schema_groups=schema_groups,
        content_groups=content_groups,
        crawler_rpt=crawler_rpt,
        bluf_avg=bluf_avg,
        def_avg=def_avg,
        vf_avg=vf_avg,
    )

    # If a previous snapshot exists, inject a delta section just before
    # Section 1. We rebuild the report with the delta at the right spot.
    if previous_snapshot:
        delta_lines = _render_delta_section(previous_snapshot, snapshot, fr)
        if delta_lines:
            # Find the index of "## {h_state}" and insert delta lines BEFORE it
            try:
                anchor = next(
                    i for i, ln in enumerate(lines)
                    if ln.startswith(f"## {L['h_state']}")
                )
                lines = lines[:anchor] + delta_lines + lines[anchor:]
            except StopIteration:
                # No section 1 header found (unlikely) → append at top after preamble
                pass

    return "\n".join(lines) + "\n", snapshot


def run(
    url: str,
    *,
    seed: list[str] | None = None,
    positioning: str | None = None,
    cities: list[str] | None = None,
    extras: list[str] | None = None,
    competitors: list[str] | None = None,
    max_pages: int = 8,
    per_kind: int = 2,
    engines: list[str] | None = None,
    user_lang: str | None = None,
    user_country: str | None = None,
    output_lang: str | None = None,
    cache_ttl: int = 86400,
    minimal: bool = False,
    brave_api_key: str | None = None,
) -> Path:
    """Run the unified audit. Returns the path to the generated markdown."""
    print(f"[1/5] Detecting locale for {url}…", file=sys.stderr)
    locale = detect_locale(url, user_lang=user_lang, user_country=user_country)
    print(f"      → {locale}", file=sys.stderr)
    out_lang = output_lang or locale.lang

    print(f"[2/5] Sampling pages (max {max_pages})…", file=sys.stderr)
    sampled = sample_pages(url, max_total=max_pages, per_kind=per_kind)
    print(f"      → {len(sampled)} pages", file=sys.stderr)
    for p in sampled:
        print(f"         · {p.kind:12s} {p.url}", file=sys.stderr)

    print(f"[3/5] Running crawler audit (site-level)…", file=sys.stderr)
    crawler_rpt = audit_crawlers(url)
    print(f"      → {len(crawler_rpt.findings)} findings", file=sys.stderr)

    print(f"[4/5] Running per-page schema + content_health audits ({len(sampled)} pages)…", file=sys.stderr)
    schema_reports: list[CheckReport] = []
    content_reports: list[CheckReport] = []
    for i, p in enumerate(sampled, 1):
        print(f"      [{i}/{len(sampled)}] {p.url}", file=sys.stderr)
        sr = audit_schema(p.url, page_kind=p.kind, check_sameas=False)
        schema_reports.append(sr)
        cr = audit_content(p.url, lang=locale.lang)
        content_reports.append(cr)

    # === Phase 4.5: competitor on-page benchmark (homepage only) ===
    # Light by design: 1 page per competitor (homepage). Goal is to answer
    # "is the gap on-page (closeable by the action plan) or off-page
    # (authority work needed)?", not to do an exhaustive competitor audit.
    competitor_benchmarks: dict[str, dict] = {}
    if competitors:
        print(f"[4.5/5] Benchmarking {len(competitors)} competitor homepage(s)…", file=sys.stderr)
        for comp in competitors:
            comp_url = _normalize_competitor_url(comp)
            print(f"      ⤷ {comp_url}", file=sys.stderr)
            try:
                sr = audit_schema(comp_url, page_kind="homepage", check_sameas=False)
                cr = audit_content(comp_url, lang=locale.lang)
                competitor_benchmarks[comp] = {"schema": sr, "content": cr, "url": comp_url}
            except Exception as e:
                print(f"        ⚠ skipped ({type(e).__name__}: {e})", file=sys.stderr)
                competitor_benchmarks[comp] = {"error": str(e), "url": comp_url}

    # === Phase 4.6: Authority diagnostic (target + competitors) ===
    # Free APIs only: MediaWiki (Wikipedia FR + EN), Wikidata wbsearchentities,
    # Wayback CDX. Measures off-page signals — Wikipedia/Wikidata presence
    # and domain age. Fills the gap that the on-page benchmark points at when
    # parity is detected.
    print(f"[4.6/5] Authority diagnostic (Wikipedia + Wikidata + Wayback)…", file=sys.stderr)
    from scripts.checks.authority import audit_authority
    target_authority = audit_authority(
        domain=url.replace("https://", "").replace("http://", "").rstrip("/").lstrip("www."),
        schema_reports=schema_reports,
        target_locale=locale.lang,
    )
    competitor_authority: dict[str, "CheckReport"] = {}
    if competitors:
        for comp in competitors:
            print(f"      ⤷ {comp}", file=sys.stderr)
            try:
                competitor_authority[comp] = audit_authority(
                    domain=comp,
                    target_locale=locale.lang,
                )
            except Exception as e:
                print(f"        ⚠ skipped ({type(e).__name__}: {e})", file=sys.stderr)

    rrf_md: str | None = None
    run_obj = None
    if seed or positioning:
        print(f"[5/5] Running measured RRF (engines: {engines or 'default'})…", file=sys.stderr)
        from scripts.rrf import compute, render_markdown
        from scripts.serp import make_brave_engine
        from scripts.serp.duckduckgo import DuckDuckGoEngine
        from scripts.serp.bing import BingEngine
        from scripts.serp.google import GoogleEngine
        from scripts.serp.cache import SerpCache, default_cache_root
        from scripts.fanout import generate as gen_fanout
        from scripts.fanout import generate_for_positioning

        engine_names = engines or ["google", "brave"]
        cache = SerpCache(default_cache_root(), ttl_seconds=cache_ttl)
        brave_engine = make_brave_engine(cache=cache, api_key=brave_api_key)
        if brave_engine.__class__.__name__ == "BraveAPIEngine":
            print("      ⚡ Brave: using official API (fast, stable)", file=sys.stderr)
        else:
            print("      🐢 Brave: using HTML scraper (slow; set BRAVE_SEARCH_API_KEY for the API)", file=sys.stderr)
        engine_map = {
            "bing": BingEngine(cache=cache),
            "brave": brave_engine,
            "ddg": DuckDuckGoEngine(cache=cache),
            "google": GoogleEngine(cache=cache),
        }
        engine_objs = [engine_map[name] for name in engine_names if name in engine_map]

        # --- Build the fan-out queries ---
        all_queries: list[str] = []
        if positioning:
            # Objective-driven: every variant guaranteed to contain the
            # positioning's key tokens. No off-objective noise.
            fan = generate_for_positioning(
                positioning, locale.tag,
                cities=cities,
                extra_modifiers=extras,
                cap=10,
            )
            all_queries = list(fan.queries)
            print(f"      Positioning: '{positioning}' → {len(all_queries)} on-objective queries", file=sys.stderr)
        else:
            # Seed mode (legacy): each seed expanded with generic templates
            for s in seed or []:
                fan = gen_fanout(s, locale.tag, use_google=False, cap=10)
                all_queries.extend(fan.queries)
            # Dedupe
            seen = set()
            all_queries = [q for q in all_queries if not (q.lower() in seen or seen.add(q.lower()))]
            all_queries = all_queries[:10]
            print(f"      Seed mode: {len(all_queries)} queries (mixed objectives)", file=sys.stderr)

        domain_slug = url.replace("https://", "").replace("http://", "").rstrip("/").lstrip("www.")
        run_obj = compute(
            target=domain_slug,
            competitors=competitors or [],
            queries=all_queries,
            engines=engine_objs,
            locale=locale.tag,
        )
        rrf_md = render_markdown(run_obj, output_lang=out_lang)
        print(f"      → {len(all_queries)} queries × {len(engine_objs)} engines", file=sys.stderr)
    else:
        print(f"[5/5] No --seed or --positioning provided; skipping RRF.", file=sys.stderr)

    # Resolve client dir + load previous snapshot for delta tracking
    client_dir = ensure_client(url)
    today = date.today().isoformat()
    previous_snapshot = _load_previous_snapshot(client_dir, today)
    if previous_snapshot:
        print(f"      Found previous snapshot from {previous_snapshot.get('date', '?')} — delta enabled", file=sys.stderr)

    # Build the comprehensive markdown
    print(f"      Rendering report (lang={out_lang})…", file=sys.stderr)
    report_md, snapshot = render_report(
        site=url,
        locale_obj=locale,
        sampled=sampled,
        crawler_rpt=crawler_rpt,
        schema_reports=schema_reports,
        content_reports=content_reports,
        rrf_md=rrf_md,
        rrf_run=run_obj,
        positioning=positioning,
        output_lang=out_lang,
        previous_snapshot=previous_snapshot,
        competitors=competitors,
        competitor_benchmarks=competitor_benchmarks,
        target_authority=target_authority,
        competitor_authority=competitor_authority,
        minimal=minimal,
    )

    # Write markdown + snapshot
    out_path = client_dir / "audits" / f"{today}-audit.md"
    out_path.write_text(report_md, encoding="utf-8")
    snapshot_path = client_dir / "audits" / f"{today}-audit-data.json"
    snapshot_path.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"      → {out_path}", file=sys.stderr)

    # Update info.json
    info_path = client_dir / "info.json"
    info = json.loads(info_path.read_text())
    info["last_audit_date"] = today
    info["audit_count"] = info.get("audit_count", 0) + 1
    info["updated_at"] = today
    info_path.write_text(json.dumps(info, indent=2, ensure_ascii=False) + "\n")

    # Refresh INDEX
    from scripts import client_paths
    import argparse
    client_paths.cmd_index(argparse.Namespace())

    return out_path


def _main():
    import argparse
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("url")
    p.add_argument("--positioning", default="",
                   help="The positioning string to dominate (e.g. 'agence powerpoint'). "
                        "Every fan-out query is guaranteed to contain this string's key tokens. "
                        "Recommended for any real audit — replaces --seed.")
    p.add_argument("--cities", default="",
                   help="Comma-separated cities for geographic variants (positioning mode). "
                        "Example: 'paris,lyon,bordeaux'.")
    p.add_argument("--extras", default="",
                   help="Comma-separated extra modifiers (positioning mode). "
                        "Example: 'b2b,saas,startup'.")
    p.add_argument("--seed", default="",
                   help="Comma-separated seed queries (legacy mode). "
                        "Generic templates only — produces noise. Prefer --positioning.")
    p.add_argument("--vs", default="", help="comma-separated competitor domains for RRF")
    p.add_argument("--max-pages", type=int, default=8)
    p.add_argument("--per-kind", type=int, default=2)
    p.add_argument("--engines", default="google,brave")
    p.add_argument("--lang", default=None, help="ISO 639-1 override for site locale")
    p.add_argument("--country", default=None)
    p.add_argument("--output-lang", default=None, help="Report language; default = detected site lang")
    p.add_argument("--cache-ttl", type=int, default=86400)
    p.add_argument(
        "--minimal", action="store_true",
        help="Compact output: skip the 'Comment appliquer' how-to section and the glossary. "
             "Useful for quick scans or when you already know the methodology.",
    )
    p.add_argument(
        "--brave-api-key", default=None,
        help="Brave Search API key (free tier: 2000 req/month at https://brave.com/search/api/). "
             "When provided, replaces the HTML scraper for the Brave portion of RRF — ~10x faster "
             "and far more stable. Also auto-detected from env BRAVE_SEARCH_API_KEY or BRAVE_API_KEY.",
    )
    args = p.parse_args()

    seeds = [s.strip() for s in args.seed.split(",") if s.strip()]
    comps = [c.strip() for c in args.vs.split(",") if c.strip()]
    engines = [e.strip() for e in args.engines.split(",") if e.strip()]
    cities = [c.strip() for c in args.cities.split(",") if c.strip()]
    extras = [e.strip() for e in args.extras.split(",") if e.strip()]

    out = run(
        args.url,
        seed=seeds or None,
        positioning=args.positioning or None,
        cities=cities or None,
        extras=extras or None,
        competitors=comps or None,
        max_pages=args.max_pages,
        per_kind=args.per_kind,
        engines=engines,
        user_lang=args.lang,
        user_country=args.country,
        output_lang=args.output_lang,
        cache_ttl=args.cache_ttl,
        minimal=args.minimal,
        brave_api_key=args.brave_api_key,
    )
    print(f"\n✓ Audit written to: {out}")


if __name__ == "__main__":
    _main()
