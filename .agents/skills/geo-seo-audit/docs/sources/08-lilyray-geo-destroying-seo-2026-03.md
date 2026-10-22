# Source #08 — Lily Ray: "Your GEO Strategy Might Be Destroying Your SEO"

- **Original URL:** https://lilyraynyc.substack.com/p/your-geo-strategy-might-be-destroying
- **Synthesis URL:** https://www.rankit.fr/geo-strategie-detruit-seo-lily-ray
- **Author of original:** Lily Ray (VP SEO Strategy, Amsive)
- **Date:** 2026-03-18 (original); 2026-03-30 (synthesis)
- **Type:** Industry analysis based on Ahrefs traffic data on 30+ sites

## Triage

🟢 **Universal — settles the SEO/GEO interconnection question**

- **SEO and GEO are not separate disciplines.** When Google's ranking dynamics change, what LLMs surface changes too.
- **The smoking gun**: in September 2025, Google removed the `num=100` parameter. Result, measured by Semrush:
  - Reddit citations in ChatGPT: **60% → 10%** (delta -50pp)
  - Wikipedia: +2pp (19→21%) | Medium / LinkedIn / Forbes / arXiv: +1-2pp each
- **"Mount AI" pattern** (Glenn Gabe): rapid organic growth via aggressive AI tactics → core update → crash often steeper than the rise. Recovery takes months/years.
- **30+ sites documented** with this pattern, drops -22% to -34% organic visibility since January 2026.
- **Penalty triggers identified**:
  - Self-promotional listicles ("Best of 2026" placing yourself #1)
  - AI-generated content at scale without first-hand expertise
  - Mass FAQ refresh / synthetic templates
  - Rapid traffic growth without substance
- **Extreme case**: 10 listicles out of 1 700 articles (0.6% of content) → -29% organic visibility. Contamination triggerable with very low volume.

🟡 **Context-specific** — none.

🟠 **Hard-mode-gated** — none.

🔴 **Over-claimed considerations**

- The traffic-drop estimates are from third-party Ahrefs estimates, not Google's own data. Order of magnitude solid; specific numbers are estimates.
- Lily Ray is a single (well-respected) voice. Cross-validates with Glenn Gabe and the Ahrefs / Semrush studies, but no independent academic replication yet.

## What we integrate

- `docs/LLM_RETRIEVAL_ARCHITECTURE.md` — adds an explicit section on **SEO ↔ GEO interconnection**, citing the num=100 case as evidence. The toolkit's audit treats them as inseparable.
- `docs/CONTENT_HEALTH_PATTERNS.md` (new) — formalises the "Mount AI" anti-patterns as an audit dimension:
  - Listicle auto-promotion detection (do you place yourself #1 on "Best of" pages?)
  - Mass-generated content fingerprints
  - Synthetic FAQ patterns
  - Content health: mix of original vs AI-generated, freshness without substance
- `skills/geo-content-health/SKILL.md` (new) — implements these checks.
- The 5 sustainable levers (original content with first-hand expertise, third-party presence, Wikipedia/LinkedIn/Reddit, press relations, original data) become the **constructive part** of `geo-content-health` — not just "what to avoid" but "what to invest in".

## What we explicitly do NOT integrate

- Any negative-list of specific sites or domains. The toolkit reports patterns, not blacklists.
- The recommendation "always block GPTBot" — the right framing is the 3-category crawler taxonomy from Source #02, not absolute blocking.
