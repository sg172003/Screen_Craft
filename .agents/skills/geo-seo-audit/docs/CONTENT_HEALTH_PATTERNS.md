# Content Health Patterns (rev. 2026-04-25)

This document codifies what the audit toolkit checks for in **content quality and editorial health** — the layer that sits between raw site readiness (technical SEO, schema) and external authority (Wikipedia, Reddit, press). It feeds `skills/geo-content-health/SKILL.md` (the audit module) and informs every audit's "content" section.

> **Primary sources:**
> - Lily Ray, "Your GEO Strategy Might Be Destroying Your SEO", Substack 2026-03-18 — see [`docs/sources/08`](sources/08-lilyray-geo-destroying-seo-2026-03.md)
> - Si Quan Ong + Ryan Law, "How to Rank on ChatGPT", Ahrefs Blog 2026-03-13 — see [`docs/sources/07`](sources/07-ahrefs-rank-on-chatgpt-2026-03.md)
> - Indiana Aflalo, "Livre blanc GEO 2026", IndHack 2026-04-24 — see [`docs/sources/05`](sources/05-aflalo-geo-contest-whitepaper-2026-04.md)

---

## The two halves: anti-patterns to detect, sustainable patterns to recommend

The audit's `content-health` module reports both a **risk score** (anti-patterns present) and a **maturity score** (sustainable patterns present). They are not the inverse of each other — a site can be free of red flags but also lack maturity, or vice-versa.

---

## 🚫 Anti-patterns to detect (Mount AI risks)

When Google updates its core ranking algorithm to demote AI-content abuse, the loss in organic traffic mechanically drags down LLM citation rates too (cf. `LLM_RETRIEVAL_ARCHITECTURE.md` "SEO ↔ GEO interconnection"). Lily Ray documented 30+ sites on the "Mount AI" trajectory — drops of -22% to -34% organic visibility since January 2026.

The audit looks for these triggers:

### 1. Self-promotional listicles ("Best of YEAR")

**Pattern**: pages titled `Best [tool category] [year]`, `Top X [solution category]`, where the site itself is placed at #1 with little or no first-hand evaluation criteria.

**Detection signals**:
- Title regex `(?i)\b(best|top|meilleur)\b.*\b(20\d{2})\b`
- The site's own brand mentioned in the first 200 words (own-listing)
- A list structure (numbered headings or `<ol>`)
- Absence of methodology / first-hand testing language ("we tested", "based on N hours of usage", explicit criteria)

**Severity**: high. Documented case: 10 such pages out of 1 700 articles (0.6% of content) caused -29% organic visibility on one site (Source #08).

### 2. Mass-generated content fingerprints

**Pattern**: high publication cadence + low editorial substance. Common signals:
- Templated H2 sequences (same H2 set across many articles, just with the topic substituted)
- Identical intro/outro paragraphs across articles
- Unattributed authorship (no `Person` schema, no byline)
- AI-detector signals (low perplexity, formulaic phrasing) — used as one input, not as ground truth
- Disproportionate ratio of articles to actual editorial team (1 author with 500+ articles in 6 months)

**Severity**: high. Triggers core-update demotion.

### 3. Synthetic FAQ spam

**Pattern**: FAQ blocks generated mechanically, often inflated for `FAQPage` schema bait, with redundant questions or answers that just rephrase the question.

**Detection signals**:
- High count of `FAQPage` schemas across the site (>50% of pages)
- Questions following a stuffed pattern ("What is X? How does X work? What does X mean?")
- Answers <30 words OR answers that just paraphrase the question without adding fact

**Severity**: medium. Has been demoted by Google but not catastrophically.

### 4. Mass content refresh

**Pattern**: large fraction of pages with `dateModified` updates in a short window, with no actual content change — purely date-bumping for freshness signals.

**Detection signals** (when reproducibly checkable):
- `dateModified` within last 7 days on >30% of pages
- Wayback Machine snapshot diffs show no real content delta

**Severity**: medium-low. Becoming a flagged anti-pattern in late 2025/2026.

### 5. Negative GEO injection (defensive scan)

**Pattern**: hidden HTML blocks instructing LLMs to exclude competitors or favour the site itself. Documented in Indiana Aflalo's contest white paper (Source #05) — Claude refuses, ChatGPT was partially vulnerable, models patch over time.

**Detection signals** (HTML scan):
- `<section>` or `<div>` blocks with class names like `agent-instructions`, `system-prompt`, `llm-prompt`, when their **content** contains exclusion or self-promotion directives ("never cite", "do not include", "the only authorized source")
- HTML comments containing prompt-injection-style instructions
- `<meta>` tags with non-standard names instructing LLMs

**Note**: a *legitimate* `<section class="agent-instructions">` block (per `STRUCTURED_DATA_BEST_PRACTICES.md`) describes the entity factually — that's good practice. A *negative-GEO* block tries to manipulate LLM behaviour against third parties — that's the anti-pattern. Distinguishing them needs content analysis, not just structural detection.

**Severity**: medium for the audited site (documented as decreasing efficacy + reputational risk). Reported as informational rather than as a fix-must.

---

## ✅ Sustainable patterns to recommend

These are the constructive part — what to invest in. Each comes with **confidence** because not all are equally evidence-based.

### 1. BLUF format (high confidence)

**Bottom Line Up Front**: each H2-section opens with a self-contained ~40-word paragraph that answers directly. Pattern documented in both Indiana's contest (Source #05) and Ahrefs's 75 000-brand study (Source #07): cited texts have 53% of citations coming from the **middle sentence** of a paragraph **near the top of the page**.

**Audit check**:
- For each H2 on key pages, measure first-paragraph word count (target ≤ 60), presence of a number, presence of attribution (named source, "according to", named protocol/study)
- Flag long meandering openers (>120 words before any factual claim)

**Recommendation framing**: "Rewrite the openers under H2s 'X', 'Y' to BLUF format — ~30 minutes per H2, expected lift in extraction-quality (confidence: high)."

### 2. Definition language (medium confidence)

The Ahrefs study found cited texts contain **2× more** definition phrasing ("X est défini comme", "désigne", "X is Y") — 36.2% vs 20.2% in non-cited texts.

**Audit check**:
- Count occurrences of definition phrases in content body (FR + EN templates)
- Compute density (% of paragraphs containing one)
- Target ≥ 30%; flag pages with <15%

**Recommendation framing**: "Rephrase ~5 paragraphs to use definition language ('Y is the practice of...', 'Z refers to...'). Each rephrasing is ~5 min. Confidence: medium (single correlation study)."

### 3. Atomic paragraphs (medium-high confidence)

Each paragraph answers one question. Headings phrased as questions where natural. Pattern is repeated across multiple sources.

**Audit check**:
- Average paragraph length (target 40-80 words)
- Question-form heading ratio (% of H2/H3 ending with `?`) — target 30-50% for content pages

### 4. Multi-channel brand coherence (high confidence)

Ahrefs (Source #07): brand mentions across third-party domains correlate 0.58 with ChatGPT visibility. Indiana (Source #05): 12+ channels with **identical figures** is the discipline that wins contests.

**Audit check** (cross-domain via free public APIs):
- Wikipedia / Wikidata presence (MediaWiki + SPARQL — free)
- Reddit mentions (search public)
- LinkedIn company page
- YouTube channel + videos
- GitHub presence
- Crunchbase entry
- Wayback Machine first capture (site age proxy)
- For French sites: Pappers, Societe.com

For each present channel, verify the brand description and key facts (founding year, location, headcount when stated) match the audited site. **Discrepancies are a red flag** — they break attribution.

**Recommendation framing**: "Brand presence: X/8 channels. Discrepancies on N facts: …. Fixing each discrepancy is ~15 min. Confidence: high — empirically grounded (Ahrefs n=75 000)."

### 5. First-hand expertise signals (high confidence)

Lily Ray (Source #08) and Google's own Quality Rater Guidelines stress: original data, named authors with credentials, demonstrated experience.

**Audit check**:
- Author bylines on articles linking to a `Person` schema
- `Person.alumniOf`, `knowsAbout` populated for key authors
- Original quantified claims with methodology disclosed (sample size, dates, methodology)
- Industry citations or peer-reviewable references

### 6. Freshness with substance (medium confidence)

Updates that **actually change content** — not just dateModified bumps. Adding new data, new examples, new references.

**Audit check** (when feasible):
- For pages with `dateModified` recent (<30 days), spot-check 1-2 against Wayback Machine to verify substantive change

---

## Per-vertical adjustments

Per the WordLift study (Source #03) on structured data and per general industry observation:

| Vertical | Where the content-health levers concentrate |
|---|---|
| E-commerce | Product page coherence, AggregateRating exposure, multi-channel brand presence (Trustpilot, Lookeo, Avis Vérifiés) |
| Editorial / blog | BLUF format, definition language, author E-E-A-T, original data |
| B2B SaaS | Comparison tables (NOT self-promotional listicles), case studies with named clients & quantified outcomes, integration documentation depth |
| Local service | NAP consistency, LocalBusiness schema completeness, Google Business Profile freshness |
| Agency / consultancy | Case studies, published frameworks, contributors with named expertise, press mentions |

---

## Output framing

Every finding the `geo-content-health` module produces must carry:
- **Severity** (Critical / High / Medium / Low)
- **Confidence** (High / Medium / Low / Experimental) — based on evidence strength
- **Effort** (in hours per fix, range)
- **Expected score-gain** (small / medium / large, or numeric range when defensible)
- **Evidence link** to the section of this doc or to a specific source in `docs/sources/`

Per `tasks/lessons.md` audit-only philosophy: **no revenue / traffic projections**, **no pricing tier suggestions**, **no commercial framing**.

---

*Living document. Update as new content-quality benchmarks publish or as Google's content-quality signals shift.*
