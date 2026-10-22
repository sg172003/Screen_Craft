# Brave Search GRAIL Signals & Ask Brave NDJSON capture (rev. 2026-04-25)

This document is the technical reference for the Brave-side measurement layer of the toolkit. Brave Search powers 5 of 7 major LLMs (Claude, Le Chat, Meta AI, Grok agentic, Perplexity historically) — see [`LLM_RETRIEVAL_ARCHITECTURE.md`](LLM_RETRIEVAL_ARCHITECTURE.md). Capturing what Brave returns is therefore the single highest-leverage measurement we can do.

> **Primary source:** Frédéric Jézégou, "Le moteur IA invisible: Brave Search alimente Claude, Le Chat et Meta AI", Rankit.fr 2026-04-20 — see [`docs/sources/01`](sources/01-rankit-brave-grail-2026-04.md). Cited prior work: David Konitzny, "Inside Ask Brave: understanding the AI-assisted search source", LinkedIn (Feb 2026); Resoneo (first FR Brave audit tool).
>
> **⚠️ Empirical validation status (updated 2026-04-25):** Test #1 was run and **failed**. See "Test #1 result" section below. Conclusion: the Ask Brave NDJSON capture is **NOT viable** as a primary measurement layer for the toolkit. The fallback architecture (Brave HTML SERP scraping) is what the toolkit actually implements in Phase 1.

---

## Why Brave matters

| LLM | Brave's role | Implication |
|---|---|---|
| Claude (web search) | Confirmed primary backend (subprocessor list Mar 2025; `BraveSearchParams` API param) | Brave SERP rank ≈ Claude citation likelihood |
| Le Chat (Mistral) | Confirmed primary (partnership Feb 2025) | Same |
| Meta AI | API confirmed (Brave AI Grounding announcement, Sep 2025) | Same |
| Grok (xAI) | Partial, agentic flows (OpenClaw framework) | Useful but less authoritative signal |
| Perplexity | Historically primary; now multi-source | Brave SERP is one of 2-3 inputs |

For these 5 LLMs, **the audit's most accurate signal is the data Brave itself returns when its public Ask Brave interface is queried**. Where Google and Bing are opaque from the outside (you can scrape SERPs but you don't see the rank-fusion internals), Brave reportedly streams everything in clear NDJSON.

---

## The Ask Brave pipeline (TAP — Trusted Answer Pipeline)

When a user queries Ask Brave, the pipeline streams events as Newline-Delimited JSON (NDJSON). The events documented in the source article:

| Event type | Content |
|---|---|
| `initial_response.query` | The query as Brave's LLM reformulated it for retrieval |
| (fan-out events) | Each sub-query the LLM decomposed the user query into — these are the queries actually sent to the index |
| (result events) | Each retrieved result, with metadata |
| `augment_with_inline_citation` | Each citation added to the in-progress LLM answer |
| `text_stop` | End of generation |

Each result event embeds `bo_debug.grail`, the full GRAIL ranking object — see below.

The pipeline LLM is reportedly **Qwen3** (Alibaba open-weight) for primary generation, with **Claude 3 Haiku** (`claude-3-haiku-20240307`) referenced in `chatllm.key` for auxiliary tasks (intent classification, citation extraction).

---

## The 22 GRAIL signals

GRAIL (Generative Reasoning And Inference Layer) is Brave's neural ranking engine. Each result returned by the index carries 22 ranking scores in a `bo_debug.grail` object, none of which are documented publicly by Brave but all of which are observable in the NDJSON stream.

### The 7 highest-leverage signals (per source #01)

| Signal | Measures | Notes |
|---|---|---|
| **`gte_titles`** | Cosine similarity between query and page title | **#1 most correlated with final score**. Observed thresholds: >0.90 excellent, <0.60 quasi-invisible. |
| **`gte_snippets`** | Similarity between query and snippet (meta description / extracted text) | #2. The Summarizer extracts citation phrases from snippets. |
| `gte_url` | Semantic similarity URL ↔ query | Justifies clean, descriptive slugs. |
| `gte_official` | "Officialness" of the domain for the query | Stable per-domain, varies by query context. |
| `gte_rerank` | Neural reranker score (after first-pass retrieval) | Heavily content-dependent. |
| `qa_model_small` | Question-answer pertinence (small QA model) | Favours pages with question-form headings (FAQPage etc.). |
| `trust` | Aggregated trust (domain authority, historical signals, editorial coherence) | Slow-moving signal. |

### The aggregate

| Signal | Role |
|---|---|
| **`tree_score`** | Final aggregate combining all signals — produces the rank in the IA response |

### Special classifiers

| Signal | Values | Meaning |
|---|---|---|
| **`fit_for_enhancement`** | `high` / `normal` / `low` | A `high` result will be **cited** in the LLM-generated answer; `normal` and `low` are retrieved but not cited. **The real target is `fit=high`**, not just being in the top 10. |
| `subtype` | `generic` / `faq` / `qa` / `article` / `product` / `event` / `location` / `code` | Brave classifies the page type. Influences which queries the page is matched against. |
| `sketchy_title` | boolean | Anti-clickbait filter. A flagged title heavily penalises GRAIL ranking. |

### The remaining signals

The full list of 22 includes additional similarity, freshness, popularity, and Web-Discovery-Project signals that the source article does not enumerate exhaustively. The audit should capture and report whatever the NDJSON stream contains — we don't need an exhaustive a-priori list.

---

## How the audit uses GRAIL

For a target domain `D` and a target query `q`:

1. **Capture the Ask Brave NDJSON stream** for query `q`.
2. **Extract fan-out queries** from `initial_response.query` events.
3. **For each result in the stream**, parse `bo_debug.grail` and `fit_for_enhancement`.
4. **Find `D`'s position(s)**: the rank of any URL on `D` in the result list (across all fan-outs).
5. **Report per page**:
   - GRAIL signal values (gte_titles, gte_snippets, …)
   - Whether the page is `fit_for_enhancement: high` (citable) or not
   - Which fan-outs the page appears on
6. **Diagnostic**: if `gte_titles < 0.60` for the target query, recommend rewriting `<title>` to better match query semantics. If `gte_snippets < 0.60`, recommend rewriting the meta description / first paragraph. Etc.

This is **far richer** than a SERP rank. It tells the user *why* a page does or doesn't rank for a query, in Brave's own terms.

---

## Test #1 result (run 2026-04-25) — FAILED

The empirical probe **invalidates** the claim that Ask Brave's NDJSON stream is publicly accessible without setup. The toolkit therefore does **not** depend on it.

### What we tested
```bash
curl -sIL -A "Mozilla/5.0 ... Chrome/120.0.0.0" \
  "https://search.brave.com/search?q=meilleure+suspension+lyon&summary=1"
# → HTTP 405 on HEAD; HTTP 200 on GET, returns HTML SPA (266 KB).
# Searched for bo_debug, grail, tree_score, fit_for_enhancement: 0 occurrences.

curl -sL ... "https://search.brave.com/ask?q=meilleure+suspension+lyon&source=web"
# → HTTP 200, returns Svelte SPA shell (81 KB).
# Page bootstrap data contains:
#   "paid": false
#   "premiumCookieName": "__Secure-sku#brave-search-premium"
#   "premiumHref": "https://account.brave.com/?intent=checkout&product=search"
# Confirms a paywall: Ask Brave is gated behind Brave Premium subscription.
```

### Findings

1. **Ask Brave is paywalled.** The page boots with `paid: false` for anonymous users and references the Brave Premium checkout URL. At minimum, full Ask Brave functionality requires a paid subscription. Free, no-setup access to the streaming pipeline is not possible.
2. **The stream is invoked from JavaScript, not directly addressable via curl.** Even if Ask Brave were free, the SPA client makes XHR/fetch requests to internal endpoints; capturing those requires a headless browser (Playwright / Puppeteer), not a simple HTTP fetch.
3. **The article (Source #01) was over-claimed** — either describing a window of access that has since been gated, or conflating Brave's Search API (which requires an API key) with what's actually publicly streamed.

### Architectural consequence

The toolkit **does NOT** include `scripts/serp/ask_brave.py` for Phase 1. The Brave-side measurement layer falls back to:

- **Brave HTML SERP scraping** — fetch `search.brave.com/search?q=...` (HTTP 200, no paywall), parse top-10 organic positions for the target domain. Loses the GRAIL signal payload, but recovers the rank-fusion input that 5 LLMs (Claude, Le Chat, Meta AI, Grok agentic, Perplexity historical) use.
- This is what the Phase 1 plan in `tasks/todo.md` actually implements.

### Why this document still exists

The 22 GRAIL signals reference is preserved as **methodological context**: it tells future contributors what Brave's ranking factors look like internally, which helps interpret why a page does or doesn't rank. If/when an open-access path to the NDJSON appears (e.g. via a Brave-released free research API, or by paying for access), this doc remains the spec for parsing it.

It is **not** a feature the toolkit can claim to implement today.

---

## Caveats

- **Rate limits are unknown.** Brave is a small player relative to Google; aggressive querying may trigger rate-limiting or captcha. The toolkit should default to polite spacing (5-10 s between queries) and back off on errors.
- **Stability is unknown.** Brave could change the NDJSON format or hide debug payloads at any time. The audit must handle gracefully missing fields.
- **The 22 signals can be observed but not perfectly interpreted** without Brave's official documentation, which doesn't exist. We report observed values and let the user / Brave's own UI fill in the meaning.
- **`tree_score` formula is not published.** We capture component signals; we do not try to recompose the final score ourselves.

---

*Living document. Update with empirical findings from Test #1, with rate-limit observations, and with any Brave architecture changes.*
