# LLM Retrieval Architecture — methodology reference (rev. 2026-04-26)

> **2026-04-26 revision — major correction:** ChatGPT/SearchGPT was previously mapped to **Bing** (default OpenAI–Microsoft partnership). The user empirically validated (manual SERP comparison: 80–90% similarity Google, ~30% Bing) that ChatGPT now retrieves through **Google** following the OpenAI–Google search deal in 2025. The per-LLM map below has been updated. Bing remains the backend for **Bing Copilot specifically** but that product is no longer in the toolkit's measurement scope (user-driven scope reduction, 2026-04-26).

This document explains how the major LLMs retrieve and cite web content as of 2026, and how this audit toolkit translates that into measurable signals. Every claim here is anchored to a source archived in `docs/sources/`.

> **Goal:** every claim in an audit must be traceable to either a verifiable site signal, a public dataset query, or an observable retrieval mechanism. We do not score on conjecture.

---

## SEO and GEO are mechanically interconnected

A foundational point that the toolkit treats as established: **SEO and GEO are not separate disciplines**. Changes in search-engine ranking dynamics directly remodel what LLMs surface. The smoking gun:

> September 2025: Google removes the `num=100` URL parameter. Result, measured by Semrush:
> - Reddit citations in ChatGPT: **60% → 10%** (delta -50pp)
> - Wikipedia: 19% → 21% (+2pp); Medium / LinkedIn / Forbes / arXiv: each +1-2pp
> *(Source: Lily Ray, "Your GEO Strategy Might Be Destroying Your SEO", 2026-03-18 — see [docs/sources/08](sources/08-lilyray-geo-destroying-seo-2026-03.md))*

A purely-Google parameter change shifted ChatGPT citations by 50 percentage points. Implication: a robust GEO strategy starts with solid SEO — domain authority, E-E-A-T, technical foundations. Aggressive GEO tactics that hurt SEO ("Mount AI" pattern, see `CONTENT_HEALTH_PATTERNS.md`) ultimately hurt LLM citation rates too.

---

## Why most LLMs end up looking like search engines

Most "AI search" experiences (ChatGPT web search, Claude with search, Gemini, Perplexity, Mistral Le Chat, Meta AI) follow a generic pipeline:

1. **Query rewriting / decomposition** — the user's natural-language question is expanded into N **fan-out queries**, each formulated to get good search results.
2. **Search backend lookup** — each fan-out query is sent to one or more web search engines.
3. **Result fusion** — top results across all fan-outs are re-ranked, often via Reciprocal Rank Fusion (RRF) or proprietary equivalents.
4. **Page fetch & read** — top-K pages are fetched and their content is loaded into the LLM context.
5. **Synthesis & citation** — the LLM answers the user, citing the sources it used.

Practical consequence: **if you do not rank in the top results of the search backends used by the LLM for the relevant fan-out queries, you will not be cited.** Schema markup, brand authority, and content quality are upstream factors that determine your position in the SERP — which is the gate.

---

## Per-LLM retrieval map (April 2026)

Each LLM has its own retrieval backend(s). Lumping them under a single "AI readiness" score would be misleading. The toolkit reports separate citation-likelihood signals per LLM.

The toolkit's **measurement scope** is the 5 LLMs the user explicitly cares about: ChatGPT, Gemini, Claude, Perplexity, Le Chat (Mistral). Other AI products (Bing Copilot, Meta AI, Grok) are not measured — not because they don't matter in the wider market, but because adding them dilutes effort without changing the user's decisions.

| LLM (in scope) | Backend | Source | Toolkit engine |
|---|---|---|---|
| **ChatGPT / SearchGPT** | **Google** | OpenAI–Google search deal (2025); validated empirically 2026-04-26 (80–90% SERP similarity vs Google, 30% vs Bing) | `google` (Startpage proxy) |
| **Gemini / Google AI Overviews** | **Google** | Google's own index | `google` |
| **Perplexity** | Multi (Google + Brave + own crawl) | Initially Brave-primary; now diversified | `google` + `brave` |
| **Claude (web search)** | **Brave** | Anthropic–Brave partnership (Mar 2025), `BraveSearchParams` API | `brave` |
| **Le Chat (Mistral)** | **Brave** | Brave–Mistral partnership (Feb 2025); `MistralAI-User` UA | `brave` |

| LLM (out of scope) | Backend | Why excluded |
|---|---|---|
| Bing Copilot | Bing | User decision 2026-04-26 — irrelevant to target audience |
| Meta AI | Brave | Out of scope — toolkit doesn't optimize for social-app surfaces |
| Grok (xAI) | Brave + native | Out of scope |

**Key takeaway:** With ChatGPT now on Google, the **Google** signal carries 3 of the 5 in-scope LLMs (ChatGPT, Gemini, half of Perplexity). **Brave** carries 2.5 (Claude, Le Chat, half of Perplexity). The toolkit therefore defaults to `engines = google,brave`. Bing and DDG remain in the codebase but are not in the default mix.

*Sources: Frédéric Jézégou (2026-04-20) [`sources/01`](sources/01-rankit-brave-grail-2026-04.md) for Brave-rooted LLMs; user empirical validation (2026-04-26) for ChatGPT→Google. Indiana Aflalo's contest data ([sources/05](sources/05-aflalo-geo-contest-whitepaper-2026-04.md)) cross-validates Brave for Mistral (32% of citations) and Claude (27%).*

---

## Domains most cited by LLMs (Ahrefs n=75 000 brands, March 2026)

Absolute mention count in ChatGPT responses (thousands):

| Domain | ChatGPT mentions (k) |
|---|---|
| reddit.com | **847** |
| wikipedia.org | 431 |
| amazon.com | 97 |
| youtube.com | 82 |
| linkedin.com | 61 |
| forbes.com | 44 |

*Source: Si Quan Ong + Ryan Law, "How to Rank on ChatGPT", Ahrefs Blog, 2026-03-13 — see [docs/sources/07](sources/07-ahrefs-rank-on-chatgpt-2026-03.md).*

**Important refinement** of an older intuition: **Reddit is the #1 absolute source for ChatGPT**, not just Perplexity. Toolkit therefore checks Reddit presence as a multi-LLM signal (ChatGPT + Claude + Mistral via Brave + Perplexity).

Caveat: these are absolute counts on the Ahrefs sample, not normalised per niche. Reddit dominance applies to general consumer discourse — niche B2B / regulated domains can have very different distributions.

---

## Correlation factors with ChatGPT visibility (same Ahrefs study)

| Factor | Correlation with ChatGPT visibility |
|---|:---:|
| YouTube mentions | **0.72** |
| YouTube impressions | 0.68 |
| Web mentions (brand, with or without backlink) | 0.58 |
| Branded anchors | 0.52 |
| Brand search volume | 0.44 |

**Critical caveat**: correlation is not causation. The 0.72 YouTube correlation could partly reflect that high-visibility brands are *also* on YouTube because they are popular. Posting on YouTube to game the signal will not necessarily produce visibility — the underlying causal mechanism is brand reputation, not the channel itself. The toolkit reports these as "brands cited tend to have presence", not as "do this to be cited".

---

## How the toolkit measures each LLM

| LLM (in scope) | Primary signal we track | Source (free) |
|---|---|---|
| **ChatGPT / SearchGPT** | Google SERP position on fan-out queries | Startpage proxy (`scripts/serp/google.py`) |
| **Gemini / AIO** | Google SERP + Schema.org + Wikidata | Startpage proxy + Wikidata SPARQL |
| **Perplexity** | Multi: Google SERP + Brave SERP + Reddit / YouTube presence | Startpage + Brave + public Reddit / YouTube checks |
| **Claude** | Brave SERP rank on fan-out queries | Brave HTML scrape (`scripts/serp/brave.py`) |
| **Le Chat (Mistral)** | Same as Claude (Brave) | Same |

Each LLM gets its **own** "citation likelihood" indicator. We do **not** average them into a single composite — that would obscure the per-LLM divergence which is itself a key insight (e.g. for Slidor on 2026-04-26: present on Google → cited by ChatGPT/Gemini/Perplexity; present on Brave → cited by Claude/Le Chat. Single composite would have hidden both).

---

## RRF (Reciprocal Rank Fusion) — the algorithm

For a target domain `D` and a set of fan-out queries `Q = {q_1, ..., q_n}`:

```
RRF(D) = Σ_{q in Q}  1 / (k + rank_q(D))
```

where:
- `rank_q(D)` = position of domain D in the SERP for query q (1 = first result)
- `k` = constant (typically 60 — softens the impact of low ranks vs top ranks)
- terms with `rank_q(D) > 100` (or D absent) contribute 0

The formula favours domains that rank **consistently across many queries**, not just very high on one. This matches how LLMs actually fuse results.

The **comparative score** (D vs competitors C_1, C_2…) is the most informative output:

```
relative_strength(D) = RRF(D) / max(RRF(D), RRF(C_1), ...)
```

A relative_strength of 0.4 means D captures 40% of the citation potential of the strongest competitor on these fan-outs.

---

## Generating fan-out queries (no LLM API)

Three sources, ordered by signal quality:

1. **Ask Brave NDJSON capture** — when querying via Ask Brave, the LLM-generated fan-outs are streamed in clear (`initial_response.query` events). For Brave-backed LLMs, we do not need to generate fan-outs — Brave tells us what they are.
2. **Google SERP scrape** — extract "People Also Ask" + "Related Searches" sections. These are Google's own query-expansion outputs based on real user behaviour.
3. **Template patterns (locale-aware, FR/EN)** — fixed list to fill gaps: `meilleur [seed]`, `[seed] avis`, `comment choisir [seed]`, `prix [seed]`, `[seed] vs *`, `qu'est-ce que [seed]`, etc.

Combined output: 20–40 fan-outs per seed query, all empirically grounded, **no LLM API call needed**.

---

## What we do NOT measure (and why)

| Not measured | Why |
|---|---|
| Actual LLM citations live (calling ChatGPT/Claude APIs) | Requires paid LLM APIs (out of scope for a free, no-setup tool) |
| User-side conversion / revenue / traffic uplift | Requires analytics access not part of an audit |
| `llms.txt` as a ranking signal | No empirical evidence that any major LLM consumes it (cf. `sources/04`) |
| Citability scoring of passages | Single Princeton 2024 study, never replicated; scoring model is opinionated. Reported as experimental. |
| "ChatGPT readiness 60/100" composite | Composite scores hide which specific signal is failing — we report per-signal binary checks instead |
| The exact GRAIL `tree_score` formula | Not published as a primary mathematical artefact; we capture the public 22 signals and report them as observed, not as parts of a recomposed score |

---

## References

The full archive of sources, with explicit triage (universal / context-specific / hard-mode-gated / over-claimed), is in [`docs/sources/`](sources/). Each claim above is traceable to one or more sources there.

Major sources:
- **Brave / GRAIL architecture** — Frédéric Jézégou (Rankit, 2026-04-20) [`sources/01`](sources/01-rankit-brave-grail-2026-04.md)
- **AI crawler taxonomy** — Frédéric Jézégou (Rankit, 2026-03-31) [`sources/02`](sources/02-rankit-crawlers-ia-2026-03.md)
- **Enhanced Entity Pages study** — Volpini et al. arXiv:2603.10700 (2026-03) [`sources/03`](sources/03-wordlift-arxiv-2603-10700-2026-03.md)
- **llms.txt empirical analysis** — Frédéric Jézégou (Rankit, 2026-03-27) [`sources/04`](sources/04-rankit-llmstxt-useless-2026-03.md)
- **GEO contest white paper** — Indiana Aflalo (IndHack, 2026-04-24) [`sources/05`](sources/05-aflalo-geo-contest-whitepaper-2026-04.md)
- **Knowledge Graph vs SQL benchmark** — data.world (Nov 2023), interpreted by Frédéric Jézégou [`sources/06`](sources/06-rankit-knowledge-graph-llm-2026-03.md)
- **Ahrefs ChatGPT correlation study** — Si Quan Ong + Ryan Law (2026-03-13) [`sources/07`](sources/07-ahrefs-rank-on-chatgpt-2026-03.md)
- **Mount AI / SEO-GEO interconnection** — Lily Ray (Substack, 2026-03-18) [`sources/08`](sources/08-lilyray-geo-destroying-seo-2026-03.md)

---

*Living document. Update as LLM architectures evolve and new evidence accumulates. Pull requests welcome.*
