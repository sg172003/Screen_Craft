"""Reciprocal Rank Fusion (RRF) scoring across N queries × M engines.

For a target domain `D` and a set of queries `Q`, on a single engine `e`:

    RRF(D, e) = Σ_{q in Q}  1 / (k + rank_q,e(D))

where `rank_q,e(D)` is the 1-based position of D in engine e's SERP for query
q (or +∞ if D doesn't appear). `k` is a smoothing constant (default 60 — the
classic IR value from Cormack-Clarke-Buettcher 2009).

This module orchestrates fetching the SERPs (using the engines under
`scripts/serp/`), computes per-engine RRF scores, and produces a
**comparative** table when competitor domains are supplied. The comparative
score `RRF(D) / max(RRF(*))` is the most informative single number — it
answers "what fraction of the citation potential do you capture vs the
strongest competitor?".
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from urllib.parse import urlparse

from scripts.serp import SerpEngine, SerpResponse


DEFAULT_K = 60


# --- i18n labels (FR + EN baseline; other locales fall back to EN) ---
LABELS: dict[str, dict[str, str]] = {
    "en": {
        "report_title": "RRF Comparative Audit",
        "locale": "Locale",
        "queries_used": "Queries used",
        "engines": "Engines",
        "competitors": "Competitors compared",
        "h_per_engine": "Per-engine RRF scores",
        "th_domain": "Domain",
        "th_top10": "top10/total",
        "rrf_suffix": "RRF",
        "h_comparative": "Comparative strength (target / max competitor)",
        "comparative_note": "`1.0` = strongest on this engine. `0.0` = absent / weakest.",
        "h_per_llm": "Estimated per-LLM citation likelihood",
        "per_llm_intro": "Per `docs/LLM_RETRIEVAL_ARCHITECTURE.md` (revised 2026-04-26 — ChatGPT now uses Google via the OpenAI–Google search deal):",
        "per_llm_chatgpt": "**ChatGPT / SearchGPT** ← `google` RRF (Startpage proxy)",
        "per_llm_gemini": "**Gemini / Google AI Overviews** ← `google` RRF",
        "per_llm_perplexity": "**Perplexity** ← `google` + `brave` (multi-source fusion)",
        "per_llm_claude": "**Claude** ← `brave` RRF",
        "per_llm_mistral": "**Le Chat (Mistral)** ← `brave` RRF",
        "h_query_detail": "Query-level detail (target only)",
        "query_detail_intro": "Position of the target domain on each query × engine. `—` = engine answered but domain not in the measured top-N (typically 10, see Engine health). `n/a` = engine errored on this query (rate limit / captcha / network).",
        "h_dominant": "Brand-dominated SERPs",
        "dominant_intro": "These queries returned a SERP dominated by a single host (≥80% of slots from one domain). They are typically navigational queries for that brand — competing on them is harder than the rank table suggests, because Bing/Brave is treating the query as 'show me X' rather than 'compare options'.",
        "th_dominant_host": "Dominant host (share)",
        "h_disclaimer": "What this RRF measures",
        "disclaimer_text": (
            "**Scraper-baseline SERP, not personalized.** This run hits each engine without login, "
            "history, or geolocation cookies — so what you see manually in your browser may differ. "
            "The scraper view is, however, the closest free proxy to what ChatGPT/Gemini "
            "(Google-backed via Startpage) and Claude/Le Chat (Brave-backed) get when they "
            "retrieve sources for an answer. Treat the absent/present signal as the "
            "un-personalized baseline."
        ),
        "th_query": "Query",
        "h_engine_health": "Engine health",
        "engine_health_intro": "How reliable each engine was during this run. High failure rates degrade signal quality.",
        "th_engine": "Engine",
        "th_answered": "Queries answered",
        "th_failed": "Failed",
        "th_failure_reason": "Most common failure",
        "data_warning_prefix": "⚠️ **Data quality warning**:",
        "label_failed_short": "n/a",
        "label_absent_short": "—",
    },
    "fr": {
        "report_title": "Audit RRF comparatif",
        "locale": "Locale",
        "queries_used": "Requêtes utilisées",
        "engines": "Moteurs",
        "competitors": "Concurrents comparés",
        "h_per_engine": "Scores RRF par moteur",
        "th_domain": "Domaine",
        "th_top10": "top10/total",
        "rrf_suffix": "RRF",
        "h_comparative": "Force comparative (cible / meilleur concurrent)",
        "comparative_note": "`1.0` = le plus fort sur ce moteur. `0.0` = absent / le plus faible. **Calculé uniquement sur les requêtes où le moteur a effectivement répondu** (les fails ne pénalisent pas le score).",
        "h_per_llm": "Probabilité estimée de citation par LLM",
        "per_llm_intro": "Selon `docs/LLM_RETRIEVAL_ARCHITECTURE.md` (révisé 2026-04-26 — ChatGPT utilise désormais Google via le deal OpenAI–Google search) :",
        "per_llm_chatgpt": "**ChatGPT / SearchGPT** ← RRF `google` (proxy Startpage)",
        "per_llm_gemini": "**Gemini / Google AI Overviews** ← RRF `google`",
        "per_llm_perplexity": "**Perplexity** ← `google` + `brave` (fusion multi-sources)",
        "per_llm_claude": "**Claude** ← RRF `brave`",
        "per_llm_mistral": "**Le Chat (Mistral)** ← RRF `brave`",
        "h_query_detail": "Détail par requête (cible uniquement)",
        "query_detail_intro": "Position du domaine cible sur chaque requête × moteur. `—` = le moteur a répondu mais le domaine n'est pas dans le top-N mesuré (typiquement 10, voir Santé des moteurs). `n/a` = le moteur a échoué sur cette requête (rate limit / captcha / réseau).",
        "h_dominant": "SERPs dominés par une marque",
        "dominant_intro": "Ces requêtes ont renvoyé un SERP où ≥80 % des slots appartiennent à un seul domaine. Ce sont en général des requêtes navigationnelles pour cette marque — y être absent est plus difficile à corriger que le simple rang ne le suggère, parce que Bing/Brave traite la requête comme « montre-moi X » et non « compare-moi les options ».",
        "th_dominant_host": "Hôte dominant (part)",
        "h_disclaimer": "Ce que mesure ce RRF",
        "disclaimer_text": (
            "**SERP scraper-baseline, non personnalisé.** Ce run interroge chaque moteur sans login, "
            "sans historique, sans cookies de géolocalisation — ce que tu vois manuellement dans ton "
            "navigateur peut donc différer. La vue scraper reste néanmoins le proxy gratuit le plus "
            "proche de ce que ChatGPT/Gemini (backend Google via Startpage) et Claude/Le Chat "
            "(backend Brave) reçoivent quand ils récupèrent des sources pour répondre. Traite ce "
            "signal comme la baseline non personnalisée."
        ),
        "th_query": "Requête",
        "h_engine_health": "Santé des moteurs",
        "engine_health_intro": "Fiabilité de chaque moteur pendant ce run. Un fort taux d'échec dégrade la qualité du signal.",
        "th_engine": "Moteur",
        "th_answered": "Requêtes répondues",
        "th_failed": "Échecs",
        "th_failure_reason": "Erreur la plus fréquente",
        "data_warning_prefix": "⚠️ **Avertissement qualité des données** :",
        "label_failed_short": "n/a",
        "label_absent_short": "—",
    },
}


def _labels(lang: str) -> dict[str, str]:
    return LABELS.get((lang or "en").lower()[:2], LABELS["en"])


@dataclass
class DomainEngineScore:
    """Per-domain × per-engine RRF result."""
    domain: str
    engine: str
    rrf_score: float
    queries_present: int           # queries where domain found in SERP
    queries_absent: int            # queries where engine answered but domain not in top
    queries_failed: int            # queries where engine errored (rate limit, captcha…)
    queries_top10: int             # subset of queries_present where rank ≤ 10
    queries_total: int             # total queries fed (== present + absent + failed)
    ranks: dict[str, int] = field(default_factory=dict)            # query → rank when found
    failed_queries: list[str] = field(default_factory=list)         # queries where engine errored
    failure_reason: str = ""        # most common error message for this engine


@dataclass
class EngineRunMeta:
    """Engine-level run metadata (orthogonal to per-domain scores)."""
    engine: str
    top_n_measured: int = 0                         # max depth we collected
    dominant_per_query: dict[str, str] = field(default_factory=dict)
    # ^ query → dominant host, only set when ≥80% of slots are 1 domain


@dataclass
class RRFRun:
    target: str
    competitors: list[str]
    locale: str
    queries: list[str]
    engines: list[str]
    scores: dict[str, list[DomainEngineScore]] = field(default_factory=dict)
    # ^ key = engine name, value = list of DomainEngineScore (target first, then competitors)
    engine_meta: dict[str, EngineRunMeta] = field(default_factory=dict)
    # ^ key = engine name, value = engine-level metadata (top-N, dominant SERPs)

    def comparative_per_engine(self) -> dict[str, dict[str, float]]:
        """For each engine, return {domain: relative_strength} where
        relative_strength = RRF(D) / max(RRF(*)) ∈ [0, 1].

        If the target domain doesn't appear and no competitor scores either,
        returns 0 for everyone."""
        out: dict[str, dict[str, float]] = {}
        for engine, scores in self.scores.items():
            max_score = max((s.rrf_score for s in scores), default=0.0)
            if max_score <= 0:
                out[engine] = {s.domain: 0.0 for s in scores}
            else:
                out[engine] = {s.domain: round(s.rrf_score / max_score, 4) for s in scores}
        return out


def _normalise_domain(d: str) -> str:
    """slug form: drop protocol, drop www., lowercase, drop path."""
    if "://" in d:
        d = urlparse(d).netloc
    d = d.lower().lstrip(".")
    if d.startswith("www."):
        d = d[4:]
    return d.split("/")[0]


def _rank_in_response(resp: SerpResponse, domain: str) -> int | None:
    return resp.find_rank(domain)


def compute(
    target: str,
    competitors: list[str],
    queries: list[str],
    engines: list[SerpEngine],
    locale: str = "en-US",
    k: int = DEFAULT_K,
) -> RRFRun:
    """Run the full RRF computation. One SERP fetch per (engine, query); the
    same SERP serves all domains. The cache (if engines are configured with
    one) makes re-runs cheap."""
    target_n = _normalise_domain(target)
    competitor_ns = [_normalise_domain(c) for c in competitors if c.strip()]
    domains_to_track = [target_n] + competitor_ns

    run = RRFRun(
        target=target_n,
        competitors=competitor_ns,
        locale=locale,
        queries=list(queries),
        engines=[e.name for e in engines],
    )

    # Circuit-breaker: after N consecutive failures on the same engine, skip
    # the rest of the queries for that engine. Prevents 20+ min hangs when an
    # engine is hard rate-limited.
    CIRCUIT_BREAKER_THRESHOLD = 3

    for engine in engines:
        per_domain: dict[str, dict[str, int | None]] = {d: {} for d in domains_to_track}
        failed_queries: list[str] = []
        failure_reasons: list[str] = []
        consecutive_fails = 0
        circuit_open = False
        meta = EngineRunMeta(engine=engine.name)

        for q in queries:
            if circuit_open:
                # Skip remaining queries; mark them as failed for transparency
                failed_queries.append(q)
                failure_reasons.append("circuit-breaker (engine exhausted)")
                for d in domains_to_track:
                    per_domain[d][q] = None
                continue

            resp = engine.fetch(q, locale)
            # Capture engine-level metadata even when ok (top-N, dominant SERP)
            if getattr(resp, "top_n_measured", 0):
                meta.top_n_measured = max(meta.top_n_measured, resp.top_n_measured)
            dom = getattr(resp, "dominant_domain", None)
            if dom:
                meta.dominant_per_query[q] = dom

            if not resp.ok:
                failed_queries.append(q)
                if resp.error:
                    failure_reasons.append(resp.error)
                consecutive_fails += 1
                for d in domains_to_track:
                    per_domain[d][q] = None
                if consecutive_fails >= CIRCUIT_BREAKER_THRESHOLD:
                    circuit_open = True
                continue
            else:
                consecutive_fails = 0
            for d in domains_to_track:
                per_domain[d][q] = _rank_in_response(resp, d)

        # Most common failure reason (for the report)
        from collections import Counter
        most_common = Counter(failure_reasons).most_common(1)
        failure_reason = most_common[0][0] if most_common else ""

        # Compute RRF per domain — skip queries that failed entirely
        engine_scores: list[DomainEngineScore] = []
        for d in domains_to_track:
            ranks = per_domain[d]
            # ranks where domain found = rank is int (not None)
            present = {q: r for q, r in ranks.items() if r is not None and q not in failed_queries}
            # absent = engine answered but domain not in SERP
            absent_count = sum(1 for q, r in ranks.items() if r is None and q not in failed_queries)
            rrf = sum(1.0 / (k + r) for r in present.values())
            engine_scores.append(DomainEngineScore(
                domain=d,
                engine=engine.name,
                rrf_score=round(rrf, 4),
                queries_present=len(present),
                queries_absent=absent_count,
                queries_failed=len(failed_queries),
                queries_top10=sum(1 for r in present.values() if r <= 10),
                queries_total=len(queries),
                ranks=present,
                failed_queries=failed_queries,
                failure_reason=failure_reason,
            ))
        run.scores[engine.name] = engine_scores
        run.engine_meta[engine.name] = meta

    return run


def render_markdown(run: RRFRun, output_lang: str = "en") -> str:
    """Format an RRF run as a Markdown report. `output_lang` selects the label
    set (FR or EN; other locales fall back to EN)."""
    L = _labels(output_lang)
    lines = []
    lines.append(f"# {L['report_title']} — {run.target}")
    lines.append("")
    lines.append(f"**{L['locale']}:** {run.locale}")
    lines.append(f"**{L['queries_used']}:** {len(run.queries)}")
    lines.append(f"**{L['engines']}:** {', '.join(run.engines)}")
    if run.competitors:
        lines.append(f"**{L['competitors']}:** {', '.join(run.competitors)}")
    lines.append("")

    # --- Engine health summary (NEW: distinguishes failed from absent) ---
    # Build per-engine fail rates; warn loudly if any engine had >30% failure.
    engine_health: list[tuple[str, int, int, str]] = []   # (engine, answered, failed, reason)
    for engine_name, score_list in run.scores.items():
        if not score_list:
            engine_health.append((engine_name, 0, len(run.queries), "no-data"))
            continue
        s0 = score_list[0]   # all domains share same engine totals
        answered = s0.queries_total - s0.queries_failed
        engine_health.append((engine_name, answered, s0.queries_failed, s0.failure_reason))

    high_fail_engines = [(e, a, f, r) for (e, a, f, r) in engine_health if f > 0 and (a == 0 or f / max(1, s0.queries_total) > 0.3)]
    if high_fail_engines:
        lines.append(L["data_warning_prefix"])
        for e, a, f, r in high_fail_engines:
            lines.append(f"- `{e}` failed on {f}/{a + f} queries ({r}). RRF score for this engine is computed only on queries it answered.")
        lines.append("")

    lines.append(f"## {L['h_disclaimer']}")
    lines.append("")
    lines.append(L["disclaimer_text"])
    lines.append("")

    lines.append(f"## {L['h_engine_health']}")
    lines.append("")
    lines.append(L["engine_health_intro"])
    lines.append("")
    # Show measured top-N alongside health, so absent labels are interpretable
    th_topn = "Top-N mesuré" if output_lang.lower().startswith("fr") else "Top-N measured"
    lines.append(f"| {L['th_engine']} | {L['th_answered']} | {L['th_failed']} | {th_topn} | {L['th_failure_reason']} |")
    lines.append("|---|:---:|:---:|:---:|---|")
    for e, a, f, r in engine_health:
        topn = run.engine_meta.get(e, EngineRunMeta(engine=e)).top_n_measured or "—"
        lines.append(f"| `{e}` | {a}/{a + f} | {f} | {topn} | {r or '—'} |")
    lines.append("")

    lines.append(f"## {L['h_per_engine']}")
    lines.append("")

    domains = [run.target] + run.competitors
    header = (
        f"| {L['th_domain']} | "
        + " | ".join(f"{e} {L['rrf_suffix']}" for e in run.engines)
        + " | "
        + " | ".join(f"{e} {L['th_top10']}" for e in run.engines)
        + " |"
    )
    lines.append(header)
    lines.append("|" + "---|" * (1 + 2 * len(run.engines)))

    score_index: dict[tuple[str, str], DomainEngineScore] = {}
    for engine_name, score_list in run.scores.items():
        for s in score_list:
            score_index[(engine_name, s.domain)] = s

    for d in domains:
        row = f"| `{d}` |"
        for e in run.engines:
            s = score_index.get((e, d))
            row += f" {s.rrf_score if s else '—'} |"
        for e in run.engines:
            s = score_index.get((e, d))
            if s:
                # Denominator is queries the engine actually answered (excluding failed)
                answered = s.queries_total - s.queries_failed
                row += f" {s.queries_top10}/{answered} |"
            else:
                row += " — |"
        lines.append(row)

    lines.append("")
    lines.append(f"## {L['h_comparative']}")
    lines.append("")
    lines.append(L["comparative_note"])
    lines.append("")
    comp = run.comparative_per_engine()
    lines.append(f"| {L['th_domain']} | " + " | ".join(run.engines) + " |")
    lines.append("|" + "---|" * (1 + len(run.engines)))
    for d in domains:
        row = f"| `{d}` |"
        for e in run.engines:
            v = comp.get(e, {}).get(d, 0.0)
            row += f" {v} |"
        lines.append(row)

    lines.append("")
    lines.append(f"## {L['h_per_llm']}")
    lines.append("")
    lines.append(L["per_llm_intro"])
    lines.append("")
    lines.append(f"- {L['per_llm_chatgpt']}")
    lines.append(f"- {L['per_llm_gemini']}")
    lines.append(f"- {L['per_llm_perplexity']}")
    lines.append(f"- {L['per_llm_claude']}")
    lines.append(f"- {L['per_llm_mistral']}")
    lines.append("")

    lines.append(f"## {L['h_query_detail']}")
    lines.append("")
    lines.append(L["query_detail_intro"])
    lines.append("")
    lines.append(f"| {L['th_query']} | " + " | ".join(run.engines) + " |")
    lines.append("|" + "---|" * (1 + len(run.engines)))
    for q in run.queries:
        row = f"| {q} |"
        for e in run.engines:
            s = score_index.get((e, run.target))
            if s is None:
                row += f" {L['label_absent_short']} |"
            elif q in s.failed_queries:
                row += f" {L['label_failed_short']} |"
            elif q in s.ranks:
                row += f" {s.ranks[q]} |"
            else:
                row += f" {L['label_absent_short']} |"
        lines.append(row)

    # --- Brand-dominated SERPs section (host-grouping detection) ---
    dominant_rows: list[tuple[str, str, str]] = []  # (query, engine, host)
    for engine_name, meta in run.engine_meta.items():
        for q, host in meta.dominant_per_query.items():
            dominant_rows.append((q, engine_name, host))
    if dominant_rows:
        lines.append("")
        lines.append(f"## {L['h_dominant']}")
        lines.append("")
        lines.append(L["dominant_intro"])
        lines.append("")
        lines.append(f"| {L['th_query']} | {L['th_engine']} | {L['th_dominant_host']} |")
        lines.append("|---|---|---|")
        for q, e, host in sorted(dominant_rows):
            lines.append(f"| {q} | `{e}` | `{host}` |")

    return "\n".join(lines) + "\n"


def _main():
    """CLI for ad-hoc testing.
    Usage:  python -m scripts.rrf <target> --queries q1,q2 [--vs c1,c2] [--engines ddg,brave]
    """
    import argparse, json
    from scripts.serp import make_brave_engine
    from scripts.serp.duckduckgo import DuckDuckGoEngine
    from scripts.serp.bing import BingEngine
    from scripts.serp.google import GoogleEngine
    from scripts.serp.cache import SerpCache, default_cache_root

    p = argparse.ArgumentParser()
    p.add_argument("target", help="target domain (e.g. slidor.fr)")
    p.add_argument("--queries", required=True, help="comma-separated queries")
    p.add_argument("--vs", default="", help="comma-separated competitor domains")
    p.add_argument("--engines", default="google,brave",
                   help="comma-separated engine names: google, brave (primary), bing, ddg (legacy). "
                        "Default `google,brave` covers the 5 LLMs we care about: ChatGPT/SearchGPT "
                        "and Gemini route through Google (via Startpage proxy); Claude, Le Chat, "
                        "and Mistral route through Brave. Perplexity uses both. Bing and DDG remain "
                        "available for legacy comparisons but are no longer in the default mix.")
    p.add_argument("--locale", default="fr-FR")
    p.add_argument("--cache-ttl", type=int, default=86400)
    p.add_argument("--brave-api-key", default=None,
                   help="Brave Search API key (free tier at https://brave.com/search/api/). "
                        "When provided, the API replaces the HTML scraper. Also auto-detected "
                        "from env BRAVE_SEARCH_API_KEY or BRAVE_API_KEY.")
    p.add_argument("--output-lang", default=None,
                   help="ISO 639-1 code for the report language (e.g. fr, en). "
                        "Default: derived from --locale. Falls back to en for unsupported langs.")
    p.add_argument("--json", action="store_true", help="output JSON instead of markdown")
    args = p.parse_args()

    cache = SerpCache(default_cache_root(), ttl_seconds=args.cache_ttl)
    engine_map = {
        "bing": BingEngine(cache=cache),
        "brave": make_brave_engine(cache=cache, api_key=args.brave_api_key),
        "ddg": DuckDuckGoEngine(cache=cache),
        "google": GoogleEngine(cache=cache),
    }
    engines = [engine_map[name] for name in args.engines.split(",") if name in engine_map]

    queries = [q.strip() for q in args.queries.split(",") if q.strip()]
    competitors = [c.strip() for c in args.vs.split(",") if c.strip()]

    run = compute(args.target, competitors, queries, engines, locale=args.locale)

    if args.json:
        # Manually serialise to JSON.
        out = {
            "target": run.target,
            "competitors": run.competitors,
            "locale": run.locale,
            "queries": run.queries,
            "engines": run.engines,
            "comparative": run.comparative_per_engine(),
            "scores": {
                e: [
                    {"domain": s.domain, "rrf": s.rrf_score, "top10": s.queries_top10, "total": s.queries_total, "ranks": s.ranks}
                    for s in lst
                ]
                for e, lst in run.scores.items()
            },
        }
        print(json.dumps(out, indent=2, ensure_ascii=False))
    else:
        # Default output language: derived from --locale, with override.
        output_lang = args.output_lang or (args.locale.split("-")[0] if args.locale else "en")
        print(render_markdown(run, output_lang=output_lang))


if __name__ == "__main__":
    _main()
