# Source #02 — AI Crawlers 2026: GPTBot, ClaudeBot, Google-Agent

- **URL:** https://www.rankit.fr/crawlers-ia-robots-seo
- **Author:** Frédéric Jézégou (Rankit.fr)
- **Date:** 2026-03-31
- **Type:** Reference (29 crawlers catalogued + recommended robots.txt)

## Triage

🟢 **Universal — taxonomy reframes the methodology**

- Three categories with **opposite recommendations**:
  1. **Training crawlers** (unilateral value — they take, you're not cited): GPTBot, ClaudeBot, Meta-ExternalAgent, CCBot, Bytespider, anthropic-ai, DeepSeekBot, Applebot-Extended, omgili → **block**.
  2. **RAG / search crawlers** (bilateral value — you can be cited with source): OAI-SearchBot, PerplexityBot, Claude-SearchBot, YouBot, DuckAssistBot → **allow**.
  3. **User-request crawlers** (neutral to positive — fetched on user demand): ChatGPT-User, Claude-User, Gemini-User, **Google-Agent (new 2026)**, MistralAI-User, Perplexity-User → **allow**.
- **Critical confusion to avoid**: allowing GPTBot ≠ appearing in ChatGPT. GPTBot is the training crawler (multi-year cycle); it's **OAI-SearchBot** that matters for current visibility.
- **Google-Agent (new 2026)** = agentic crawler for Gemini agentic flows (price comparisons, hotel booking via natural language). Block it = exclude from Gemini agentic discovery.

🟠 **Hard-mode-gated** — none in this article.

🔴 **Over-claimed** — none. The taxonomy is well-sourced (links to OpenAI, Anthropic, Apple, Meta official docs).

## What we integrate

- `docs/CRAWLERS_TAXONOMY.md` (new) — full catalogue + GEO-optimised robots.txt template.
- `skills/geo-crawlers/SKILL.md` rewritten around the 3-category taxonomy with opposite recommendations per category.
- Slidor and Atelier Loupiote audits should be **revisited** with this taxonomy when we re-run them — earlier reports treated all AI bots as equivalent.

## What we explicitly do NOT integrate

- The specific recommended robots.txt block-list — we copy the principle ("block training, allow RAG, allow user-request") but each audit should produce its own list based on the site's strategic posture (some sites *want* to be in training corpora for long-term entity recognition, e.g. via HuggingFace dataset publication separately).
