# Source #05 — Indiana Aflalo: white paper on the first French GEO contest

- **URL:** https://indhack.com/livre-blanc-geo-2026
- **Author:** Indiana Aflalo (IndHack, Nice)
- **Date:** 2026-04-24
- **Type:** Case study / methodology white paper (12 chapters, ~40 pages)

## Triage

🟢 **Universal — empirically validated patterns from a real contest**

- **Distribution of citations across 5 LLMs** at the contest peak (validated daily over 33 days):
  - ChatGPT 32% (Bing), Claude 27% (Brave), **Mistral 32% peak** (Brave + French bias), Perplexity 6%, Gemini 3%.
  - Confirms Brave's importance for Claude + Mistral. Confirms Gemini hardest to crack without Wikidata + YouTube long videos.
- **BLUF format** (Bottom Line Up Front): each H2 followed by an autonomous 40-word paragraph containing a number, attribution, and citable formulation. Pattern works universally.
- **Multi-channel coherence**: 12+ channels with **identical figures to the decimal**. Variance of 1-2% breaks attribution. Pattern works universally.
- **Rich schemas beyond Article/FAQPage**: ScholarlyArticle, Dataset (CC BY 4.0), SpeakableSpecification, VideoObject with Clip + SeekToAction, Product+Offer+AggregateRating. Plus `data-speakable="true"` on specific blocks. Pattern works for any site with appropriate content.
- **YouTube long videos with timestamped chapters** (10-20 min) are critical for Gemini specifically — 94% of Gemini's YouTube citations are videos with structured chapters.
- **Negative GEO observed** (hidden prompt-injection blocks targeting competitor exclusion). Claude refused explicitly. ChatGPT partially vulnerable. **Pattern in decline** as models patch.
- **Freshness signals** (dateModified, version stamps, IndexNow) work universally — LLMs penalise stale content.

🟡 **Context-specific — DO NOT extrapolate naively**

- **Inventing proprietary entity codes** ("IPV-Indhack©", "Indhack-VLT-MECA-01") — works in the contest because the keyword (`vultifrine`) was a **fictitious term with zero pre-existing competition**. For real businesses with real product/service names, do NOT recommend inventing fake codes. Instead: verify existing entities are coherent across pages.
- **Publishing fabricated clinical study data on HuggingFace** — works in a contest but not for real businesses. The honest version: if the business has *real* original data (industry benchmarks, anonymised usage stats, surveys), publishing it as a HuggingFace dataset CC BY 4.0 is a long-term signal.

🟠 **Hard-mode-gated**

- Wikipedia / Wikidata / Wiktionary entries: theoretically powerful for Gemini, but **modérateurs supprimaient les entrées** dans les jours suivants si pas de source secondaire fiable préalable (presse, publication académique). Bon ordre : presse d'abord, Wikimedia ensuite.
- Reddit channel: needs account antiquity + karma. New accounts are filtered out.

🔴 **Over-claimed**

- "Inventing proprietary codes mechanically forces citation" — works on a fictitious keyword. For real businesses, the same effect is achieved (less dramatically) by ensuring real entity names are unique-enough and coherent across canonical sources.

## What we integrate

- `docs/CONTENT_HEALTH_PATTERNS.md` (new) — includes the 7-pillar methodology, the multi-channel coherence rule, the BLUF format pattern, and the negative GEO detection signal.
- `skills/geo-schema/SKILL.md` updated — adds checks for the rich-schemas list (ScholarlyArticle, Dataset, SpeakableSpecification, VideoObject Clip+SeekToAction).
- Reference to the cited LLM citation distribution in `docs/LLM_RETRIEVAL_ARCHITECTURE.md` as one of multiple converging data points (cross-checked with #7 Ahrefs and #1 Brave article).

## What we explicitly do NOT integrate

- **No "invent proprietary codes" audit module**. Per `lessons.md` 2026-04-25 critical-thinking rule.
- **No "fabricate clinical studies for HuggingFace" suggestion**. We promote *real* original data publication when it exists.
- **No competitive-takedown-via-negative-GEO module**. Detection of negative GEO patterns in audited sites is in scope (defensive); injection is not.
