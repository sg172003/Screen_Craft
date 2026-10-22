# AI Crawler Taxonomy & robots.txt strategy (rev. 2026-04-25)

This document is the canonical reference for AI/LLM crawlers in 2026 and the recommended `robots.txt` strategy. It informs `skills/geo-crawlers/SKILL.md` (the audit module) and the `crawler_access` section of any GEO audit.

> **Source:** Frédéric Jézégou, "Crawlers IA 2026 : GPTBot, ClaudeBot, Google-Agent", Rankit.fr 2026-03-31 — see [`docs/sources/02`](sources/02-rankit-crawlers-ia-2026-03.md).

---

## The 3-category mental model

The biggest methodological mistake in AI-bot policy is treating all bots uniformly. There are **three distinct categories with opposite recommendations**:

| Category | What it does | Value to you | Default action |
|---|---|---|:---:|
| **Training** | Collects pages to train the next generation of LLMs. Multi-year cycle. You are not cited in return. | Unilateral — they take, you don't get cited | **🔴 Block (recommended default)** |
| **RAG / Search** | Indexes the web in real time to answer queries with sourced citations | Bilateral — you can be cited with a link back | **🟢 Allow** |
| **User-request** | Fetches a specific page on behalf of a logged-in user who explicitly asked the LLM to read it | Neutral to positive — the user already chose to engage | **🟢 Allow** |

**The most common confusion in the GEO industry**: allowing GPTBot ≠ appearing in ChatGPT. GPTBot is a **training** bot (its data feeds *future* models, with cycles measured in years). What matters for current ChatGPT visibility is **OAI-SearchBot**, the RAG bot.

---

## Catalogue of known AI crawlers (29, as of 2026)

### 🔴 Training crawlers (recommended: block)

| Crawler | Owner | User-Agent (canonical) | Notes |
|---|---|---|---|
| GPTBot | OpenAI | `Mozilla/5.0 ... GPTBot/1.0; +https://openai.com/gptbot` | OpenAI training |
| ClaudeBot | Anthropic | `ClaudeBot/1.0; +https://www.anthropic.com` | Anthropic training |
| anthropic-ai | Anthropic | `Mozilla/5.0 (compatible; anthropic-ai/1.0)` | Legacy Anthropic training crawler |
| CCBot | Common Crawl | `CCBot/2.0 (+https://commoncrawl.org/bot.html)` | Major training corpus source |
| Bytespider | ByteDance | Token `Bytespider` in standard UA | Doubao / TikTok training |
| Meta-ExternalAgent | Meta | `meta-externalagent/1.1` | Meta training |
| Applebot-Extended | Apple | Token `Applebot-Extended` | Apple AI training (separate from Applebot search) |
| DeepSeekBot | DeepSeek | `Mozilla/5.0 (compatible; DeepseekBot/1.0)` | DeepSeek training |
| Amazonbot | Amazon | `Mozilla/5.0 (compatible; Amazonbot/0.1)` | Alexa / Fire OS, potentially training |
| cohere-ai | Cohere | Token `cohere-training-data-crawler` | Cohere training |
| Google-Extended | Google | Token via Googlebot UA | Controls Gemini / Vertex AI training |
| omgili / Webz.io | Webz.io | `omgili/0.5` | Conversational content for LLM training |

### 🟢 RAG / Search crawlers (recommended: allow)

| Crawler | Owner | User-Agent (canonical) | Powers |
|---|---|---|---|
| OAI-SearchBot | OpenAI | `... OAI-SearchBot/1.0; +https://openai.com/searchbot` | ChatGPT Search |
| PerplexityBot | Perplexity | `Mozilla/5.0 ... PerplexityBot/1.0` | Perplexity answers |
| Claude-SearchBot | Anthropic | `Mozilla/5.0 ... Claude-SearchBot/1.0; +searchbot@anthropic.com` | Claude search |
| YouBot | You.com | `Mozilla/5.0 (compatible; YouBot)` | You.com answers |
| DuckAssistBot | DuckDuckGo | `DuckAssistBot/1.2` | DuckAssist answers |

### 🟢 User-request crawlers (recommended: allow)

| Crawler | Owner | Trigger |
|---|---|---|
| ChatGPT-User | OpenAI | User asks ChatGPT to read a specific URL |
| Claude-User | Anthropic | User asks Claude to read a specific URL |
| Gemini-User | Google | User asks Gemini to read a specific URL |
| **Google-Agent** *(new 2026)* | Google | Agentic flow (price compare, hotel search, automated browsing) |
| Perplexity-User | Perplexity | User clicks a Perplexity source link |
| MistralAI-User | Mistral | Le Chat reads a specific URL |

### 🟡 Hybrid / classical (case-by-case)

| Crawler | Owner | Notes |
|---|---|---|
| Googlebot | Google | Classical SEO. Allow. (`Google-Extended` controls Gemini training separately.) |
| Bingbot | Microsoft | Classical Bing + Copilot. Allow. |
| Applebot | Apple | Siri / Spotlight indexing. Allow. (`Applebot-Extended` controls AI training separately.) |
| BraveBot | Brave | **Uses standard Chrome UA, respects Googlebot rules**. No separate `User-agent: BraveBot` block needed. (cf. `BRAVE_GRAIL_SIGNALS.md`.) |
| Diffbot | Diffbot | Page → structured data, used by various LLM publishers |
| FacebookBot | Meta | Open Graph previews + potential AI feed |
| LinkedInBot | LinkedIn / Microsoft | Open Graph + likely Microsoft AI feed |
| GoogleOther | Google | Google R&D, possibly AI |
| IbouBot | Ibou / Babbar | French search engine — not directly AI |

### 🟠 Special / unknown

| Crawler | Notes |
|---|---|
| Grok / xAI | No documented official crawler. Generic / cloaked user-agents (often iPhone UA). Hard to identify. |

---

## Recommended robots.txt template (GEO-optimised)

This is a **strong default** — adjust for sites that intentionally want to be in training corpora (e.g. publishers betting on long-term entity recognition):

```
# --- Classical SEO ---
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# --- Google AI: training BLOCK, agentic ALLOW ---
User-agent: Google-Extended
Disallow: /

User-agent: Google-Agent
Allow: /

# --- OpenAI: training BLOCK, RAG ALLOW ---
User-agent: GPTBot
Disallow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

# --- Anthropic: training BLOCK, RAG ALLOW ---
User-agent: ClaudeBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

# --- Perplexity: RAG ALLOW ---
User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

# --- Mistral / Meta: user-request ALLOW ---
User-agent: MistralAI-User
Allow: /

# --- Apple: search ALLOW, training BLOCK ---
User-agent: Applebot
Allow: /

User-agent: Applebot-Extended
Disallow: /

# --- Other RAG / search ---
User-agent: YouBot
Allow: /

User-agent: DuckAssistBot
Allow: /

# --- Pure training: BLOCK ---
User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Meta-ExternalAgent
Disallow: /

User-agent: DeepSeekBot
Disallow: /

User-agent: Amazonbot
Disallow: /

User-agent: cohere-ai
Disallow: /

User-agent: omgili
Disallow: /

# --- Default for everything else ---
User-agent: *
Allow: /
```

### Notes on this template

- **No separate rule for BraveBot.** It uses a standard Chrome user-agent and respects whatever Googlebot's rules are. This means: as long as Googlebot can crawl, Brave (and therefore Claude / Le Chat / Meta AI / Grok agentic / Perplexity-via-Brave) can also crawl.
- **The "block training, allow RAG/user-request" default** is conservative. It assumes you want to keep your content out of training corpora to preserve negotiation leverage in the future. Some publishers prefer the inverse strategy (push into training to build long-term entity recognition). Both are defensible — the audit reports the *current* policy, doesn't impose one.
- **Rapid-evolving area.** New AI crawlers appear regularly. The audit should fetch and parse `robots.txt` afresh on every run rather than rely on a static catalogue.

---

## How the audit checks crawler access

For each audited site, the toolkit:

1. Fetches `robots.txt` once.
2. For each known crawler in this taxonomy, parses the rule applying to it (longest-match per RFC).
3. Reports per-category status:
   - **Training crawlers** — how many are blocked? (Higher = better, default.) Flag any that are explicitly allowed if the user wants the conservative default.
   - **RAG crawlers** — how many are allowed? (Higher = better.) Flag any that are blocked.
   - **User-request crawlers** — how many are allowed? (Higher = better.) Flag any that are blocked.
4. Reports the **overall consistency** of the policy: a site that blocks GPTBot but allows ClaudeBot has an incoherent stance — either we want training crawlers in or out, but not selectively.
5. Detects the **GPTBot vs OAI-SearchBot confusion**: a site that allows GPTBot for "AI visibility" but blocks OAI-SearchBot has the policy exactly backwards.

The audit output frames each finding with effort × score-gain × confidence per `tasks/lessons.md` rule.

---

*Living document. Update as new crawlers are catalogued or existing crawlers change behaviour.*
