# Source #01 — Brave Search & GRAIL: the invisible AI engine

- **URL:** https://www.rankit.fr/brave-search-grail-22-signaux-moteur-ia
- **Author:** Frédéric Jézégou (Rankit.fr)
- **Date:** 2026-04-20
- **Type:** Technical analysis + tool announcement
- **Cited prior work:** David Konitzny ("Inside Ask Brave", LinkedIn, Feb 2026); Resoneo (first French Brave audit tool)

## Triage

🟢 **Universal — verifiable claims that change our architecture**

- Brave Search powers **5 LLMs** (Claude, Le Chat/Mistral, Meta AI, Grok agentic, Perplexity historically).
- The Ask Brave pipeline (TAP — Trusted Answer Pipeline) streams in clear NDJSON: includes the rewritten query, the fan-out sub-queries the LLM generates, and `bo_debug.grail` per result containing 22 ranking signals.
- `BraveBot` uses a standard Chrome user-agent and respects `Googlebot` `robots.txt` directives. No separate Brave rule needed.
- 22 GRAIL signals named publicly: `gte_titles`, `gte_snippets`, `gte_url`, `gte_official`, `gte_rerank`, `qa_model_small`, `trust`, `tree_score`, `fit_for_enhancement` (high/normal/low), `subtype` (faq/qa/article/product/event/location/code), `sketchy_title` (anti-clickbait filter), etc.
- Top signals correlated with final score: `gte_titles` first (>0.90 excellent, <0.60 invisible), `gte_snippets` second.
- Index = Tailcat (37B+ pages, acquired from Cliqz March 2021). Independent of Google/Bing.
- Internal models: Qwen3 (generation) + Claude 3 Haiku (auxiliary classification).
- Web Discovery Project (WDP) — opt-in user navigation data feeds Brave's index uniquely.

🟠 **Hard-mode-gated**

- Web Discovery Project signal — useful but requires actual users opting in via the Brave browser. Not directly actionable from outside.

🔴 **Over-claimed / promotional**

- The article is partly a launch piece for the author's own tool (Rankit Signal). The technical claims about NDJSON + GRAIL appear independently verifiable (Konitzny, Resoneo cited), but the toolkit's actual scoring formulas and weights are partly the author's interpretation.

## What we integrate

- Brave promoted from "tertiary backend" to **primary backend covering 5 LLMs** in `docs/LLM_RETRIEVAL_ARCHITECTURE.md`.
- Empirical validation step (Test #1): curl Ask Brave, capture NDJSON, parse `bo_debug.grail`. **Critical** — if NDJSON is not actually publicly streamed as claimed, the architecture needs adjustment.
- New doc `docs/BRAVE_GRAIL_SIGNALS.md` documents the 22 signals + capture protocol.
- `skills/geo-crawlers/SKILL.md` updated: BraveBot follows Googlebot rules, no separate `User-agent: BraveBot` block needed.

## What we explicitly do NOT integrate

- Specific `tree_score` formula or weights — author hasn't published primary mathematical proof, and the formulas may evolve.
- The Rankit Signal tool branding / methodology adoption — we're building independently. We acknowledge both Resoneo and Rankit Signal as parallel efforts in the open-source release.
