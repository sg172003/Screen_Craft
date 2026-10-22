# Source #07 — Ahrefs: How to Rank on ChatGPT (75 000 brands study)

- **Original study URL:** https://ahrefs.com/blog/how-to-rank-on-chatgpt/ (Si Quan Ong + Ryan Law, Ahrefs Blog, March 13 2026)
- **Article URL (synthesis):** https://www.rankit.fr/comment-apparaitre-dans-chatgpt-etude-ahrefs
- **Authors of synthesis:** Frédéric Jézégou (Rankit.fr)
- **Date:** 2026-03-30 (article); 2026-03-13 (study)
- **Type:** Empirical correlation study on n=75 000 brands

## Triage

🟢 **Universal — strongest correlation data we have on ChatGPT visibility**

- **YouTube mentions: corrélation 0.72** (#1 factor). YouTube impressions: 0.68. Two reasons: massive YouTube transcript usage in GPT-4 training (1M+ hours per OpenAI), and LLMs cannot generate video themselves.
- **Brand mentions on web (with or without link): 0.58** — second strongest factor. Backlinks not required; just be named.
- **Branded anchors: 0.52** | **Brand search volume: 0.44**.
- **Top domains cited by ChatGPT** (absolute mention count, in thousands):
  - reddit.com 847 · wikipedia.org 431 · amazon.com 97 · youtube.com 82 · linkedin.com 61 · forbes.com 44
- **Citation extraction pattern**: 53% of citations come from the **middle sentence of a paragraph** (highest "information gain"). That paragraph must be **near top of page**.
- **Definition language**: cited texts contain almost **2× more** "X est défini comme" / "désigne" / "X is Y" formulations (36.2% vs 20.2%).
- BLUF format, atomic paragraphs, freshness, and original quantified data are all corroborated.
- **GPTBot vs OAI-SearchBot distinction** (the author disagrees with Ahrefs on this): GPTBot is training-only, OAI-SearchBot is what matters for current visibility. ✅ We already integrated this from Source #02.

🟡 **Context-specific** — none. The study covers 75 000 brands across many sectors.

🟠 **Hard-mode-gated**

- Reddit presence: brand mentions on Reddit drive citations, but Reddit is allergic to marketing. Authentic community contribution required (see Source #05 for "needs account antiquity").
- Wikipedia / press mentions: high-impact but require external editorial gate-keepers.

🔴 **Over-claimed considerations**

- **Correlation ≠ causation**. The 0.72 YouTube correlation could partly reflect that high-visibility brands ARE just on YouTube more (because they're popular). Posting on YouTube to game the signal won't necessarily produce visibility — the underlying causal mechanism is brand reputation, not the channel itself.
- **Top domains list is absolute counts, not normalised per query**. Reddit being #1 in absolute terms doesn't mean it's the dominant source for *every* niche.

## What we integrate

- `docs/CONTENT_HEALTH_PATTERNS.md` — adds the "information gain" pattern (middle sentence, near top of page) and the "definition language" pattern (target ~36%+ of phrasing using "X est…", "désigne…", "se définit comme…").
- `docs/LLM_RETRIEVAL_ARCHITECTURE.md` — uses these correlations as **anchors** (not as causal proofs) for "brand presence on YouTube / Reddit / Wikipedia matters for ChatGPT".
- `skills/geo-content-health/SKILL.md` (new) — checks for the BLUF pattern, definition-language density, atomic paragraphs.
- **Important refinement of our prior understanding**: Reddit isn't only a Perplexity signal. **Reddit is the #1 absolute source for ChatGPT** (847k mentions vs Wikipedia's 431k). Updates `docs/LLM_RETRIEVAL_ARCHITECTURE.md` accordingly.

## What we explicitly do NOT integrate

- The "post on YouTube to rank on ChatGPT" causal claim. We frame as "brands cited by ChatGPT tend to have YouTube presence" (correlation, not prescription).
- Specific domain mention counts as universal weights — they reflect the Ahrefs sample, not your niche.
