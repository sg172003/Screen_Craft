"""Per-LLM impact mapping for audit findings.

Maps each finding code (S1, EE1, CHM1, etc.) to its expected impact on each
in-scope LLM. Used by the audit reporter to build per-LLM action plans.

The mapping is **opinion + evidence**, not pure measurement: we don't have
ground-truth data on "fixing CHM1 lifts ChatGPT citation rate by X%". The
impact tags are based on:

- Retrieval mechanism (e.g. Schema helps RAG-heavy LLMs more than chat-only)
- Documented LLM behaviour (e.g. ChatGPT extracts BLUF passages aggressively)
- Cross-LLM common factors (e.g. visible-facts coverage helps every retriever
  that mixes JSON-LD with body content)

When the evidence is thin, the impact is tagged `experimental` or `low` — the
reader can then decide if the effort is worth it.

Per-LLM impact codes:
  high          — strong, well-documented lever for this LLM
  medium-high   — likely meaningful lever, less precise evidence
  medium        — plausible lever, mixed evidence
  low           — minor or speculative
  experimental  — emerging pattern, not validated
  none          — does not apply / no measurable impact

Each LLM is a string slug; the canonical list is `IN_SCOPE_LLMS` below.
The toolkit's measurement scope (per `docs/LLM_RETRIEVAL_ARCHITECTURE.md`) is
5 LLMs: ChatGPT, Gemini, Perplexity, Claude, Le Chat (Mistral).
"""
from __future__ import annotations

from dataclasses import dataclass


# --- LLM definitions ---

@dataclass(frozen=True)
class LLM:
    slug: str            # internal id, e.g. "chatgpt"
    label_fr: str        # display label FR
    label_en: str        # display label EN
    engines: tuple       # which RRF engines back this LLM (subset of {"google","brave"})
    notes_fr: str
    notes_en: str


CHATGPT = LLM(
    slug="chatgpt",
    label_fr="ChatGPT / SearchGPT",
    label_en="ChatGPT / SearchGPT",
    engines=("google",),
    notes_fr="Indexe via Google (deal OpenAI–Google 2025). Extrait agressivement les passages BLUF.",
    notes_en="Indexes via Google (OpenAI–Google deal 2025). Aggressively extracts BLUF passages.",
)
GEMINI = LLM(
    slug="gemini",
    label_fr="Gemini / Google AI Overviews",
    label_en="Gemini / Google AI Overviews",
    engines=("google",),
    notes_fr="Index Google natif. Pondère lourdement E-E-A-T, Schema.org et Wikidata.",
    notes_en="Native Google index. Heavily weights E-E-A-T, Schema.org and Wikidata.",
)
PERPLEXITY = LLM(
    slug="perplexity",
    label_fr="Perplexity",
    label_en="Perplexity",
    engines=("google", "brave"),
    notes_fr="Multi-sources : Google + Brave + crawl propre. Fortement Reddit/Wikipedia.",
    notes_en="Multi-source: Google + Brave + own crawl. Reddit/Wikipedia heavy.",
)
CLAUDE = LLM(
    slug="claude",
    label_fr="Claude",
    label_en="Claude",
    engines=("brave",),
    notes_fr="Index Brave (partenariat Anthropic–Brave). Expansion de requête conservatrice.",
    notes_en="Brave index (Anthropic–Brave partnership). Conservative query expansion.",
)
MISTRAL = LLM(
    slug="mistral",
    label_fr="Le Chat (Mistral)",
    label_en="Le Chat (Mistral)",
    engines=("brave",),
    notes_fr="Index Brave (partenariat Brave–Mistral). Biais favorable au contenu francophone.",
    notes_en="Brave index (Brave–Mistral partnership). French-content bias.",
)

IN_SCOPE_LLMS: tuple[LLM, ...] = (CHATGPT, GEMINI, PERPLEXITY, CLAUDE, MISTRAL)


# --- Finding code → per-LLM impact ---

# Impact strength rubric (used for sorting + display):
_IMPACT_RANK = {
    "high": 4,
    "medium-high": 3,
    "medium": 2,
    "low": 1,
    "experimental": 1,
    "none": 0,
}

_IMPACT_LABEL_FR = {
    "high": "fort",
    "medium-high": "moyen-fort",
    "medium": "moyen",
    "low": "faible",
    "experimental": "expérimental",
    "none": "—",
}
_IMPACT_LABEL_EN = {
    "high": "high",
    "medium-high": "medium-high",
    "medium": "medium",
    "low": "low",
    "experimental": "experimental",
    "none": "—",
}


# Impact mapping. Each entry: code → {llm_slug: impact_code}.
# When a code is missing for an LLM, we treat it as "medium" (a sensible default
# rather than "none", since most levers help all LLMs to some degree).
FINDING_LLM_IMPACT: dict[str, dict[str, str]] = {
    # --- Schema (Layer 2) ---
    # Missing expected schema types for the page kind. Direct impact on RAG
    # retrieval for Google-indexed LLMs (ChatGPT, Gemini, Perplexity); some lift
    # on Brave-indexed (Claude, Mistral).
    "S1": {
        "chatgpt": "medium-high",
        "gemini": "high",
        "perplexity": "high",
        "claude": "medium",
        "mistral": "medium",
    },
    # Schema validity blocker (S0 / S0c) — applies broadly.
    "S0": {
        "chatgpt": "high",
        "gemini": "high",
        "perplexity": "high",
        "claude": "medium-high",
        "mistral": "medium-high",
    },
    "S0c": {
        "chatgpt": "high",
        "gemini": "high",
        "perplexity": "high",
        "claude": "medium-high",
        "mistral": "medium-high",
    },
    # --- Enhanced Entity Pages (Layer 3) ---
    # Visible-facts coverage = match between JSON-LD facts and visible body.
    # Helps all RAG-heavy retrievers; less critical for chat-only.
    "EE1": {
        "chatgpt": "high",
        "gemini": "high",
        "perplexity": "high",
        "claude": "medium-high",
        "mistral": "medium-high",
    },
    # sameAs entity link integrity.
    "EE2": {
        "chatgpt": "medium",
        "gemini": "high",   # Knowledge Graph anchoring
        "perplexity": "medium-high",
        "claude": "medium",
        "mistral": "medium",
    },
    # `<section class="agent-instructions">` block — emerging, no confirmed
    # consumer at this stage.
    "EE3": {
        "chatgpt": "experimental",
        "gemini": "experimental",
        "perplexity": "experimental",
        "claude": "experimental",
        "mistral": "experimental",
    },
    # Breadcrumbs schema.
    "EE4": {
        "chatgpt": "medium",
        "gemini": "medium-high",
        "perplexity": "medium",
        "claude": "low",
        "mistral": "low",
    },

    # --- Content health: anti-patterns (CHA*) ---
    # Listicle / self-promotional (Mount AI). Penalised by all retrievers
    # eventually; Bing-derived signals were strongest, but the signal still
    # holds via Google's E-E-A-T after the 2025 alignment.
    "CHA1": {
        "chatgpt": "medium",
        "gemini": "medium-high",
        "perplexity": "medium",
        "claude": "medium",
        "mistral": "medium",
    },
    "CHA3": {  # synthetic FAQ patterns
        "chatgpt": "medium",
        "gemini": "medium-high",
        "perplexity": "medium",
        "claude": "medium",
        "mistral": "medium",
    },
    "CHA5": {  # negative-GEO / spammy patterns
        "chatgpt": "medium-high",
        "gemini": "high",
        "perplexity": "medium-high",
        "claude": "medium",
        "mistral": "medium",
    },

    # --- Content health: maturity / sustainable (CHM*) ---
    # BLUF compliance — strong direct lever for extractibility on every
    # passage-extracting LLM (ChatGPT, Claude, Mistral).
    "CHM1": {
        "chatgpt": "high",
        "gemini": "medium-high",
        "perplexity": "high",
        "claude": "high",
        "mistral": "high",
    },
    # Definition language density — single Ahrefs correlation study, low
    # confidence. Tagged `low` everywhere to be honest about the evidence.
    "CHM2": {
        "chatgpt": "low",
        "gemini": "low",
        "perplexity": "low",
        "claude": "low",
        "mistral": "low",
    },

    # --- Crawlers (CR*) ---
    # Critical findings: outright block of an in-scope bot.
    "CR1": {
        "chatgpt": "high",     # OAI-SearchBot / ChatGPT-User block
        "gemini": "high",
        "perplexity": "high",
        "claude": "high",
        "mistral": "high",
    },
    "CR2": {  # backwards / contradictory rules
        "chatgpt": "medium-high",
        "gemini": "medium-high",
        "perplexity": "medium-high",
        "claude": "medium-high",
        "mistral": "medium-high",
    },
    # Informational: bot not explicitly listed but allowed via wildcard.
    # Largely cosmetic — the lever is small.
    "CR-INFO2": {
        "chatgpt": "low",
        "gemini": "low",
        "perplexity": "low",
        "claude": "low",
        "mistral": "low",
    },
    "CR-INFO3": {
        "chatgpt": "low",
        "gemini": "low",
        "perplexity": "low",
        "claude": "low",
        "mistral": "low",
    },

    # --- Authority signals (off-page; AUTH*) ---
    # Wikipedia/Wikidata are entity-grounding sources for Google-backed LLMs
    # primarily (knowledge graph anchoring). Brave-backed LLMs benefit
    # indirectly via the `sameAs` JSON-LD link from the brand's site.
    "AUTH1": {  # No Wikipedia entry (FR + EN both missing)
        "chatgpt": "high",
        "gemini": "high",
        "perplexity": "high",
        "claude": "medium",
        "mistral": "medium",
    },
    "AUTH1b": {  # FR Wikipedia missing while EN exists (locale mismatch)
        "chatgpt": "medium",
        "gemini": "medium-high",  # FR Google AIO leans on Wikipedia FR
        "perplexity": "medium-high",
        "claude": "medium",
        "mistral": "medium-high",  # Le Chat is FR-biased
    },
    "AUTH2": {  # No Wikidata entry — easier fix than Wikipedia
        "chatgpt": "medium-high",
        "gemini": "high",  # Google KG relies heavily on Wikidata
        "perplexity": "medium-high",
        "claude": "medium",
        "mistral": "medium",
    },
    "AUTH2u": {  # Wikidata candidates exist but P856 doesn't match — likely homonyms
        "chatgpt": "medium-high",
        "gemini": "high",
        "perplexity": "medium-high",
        "claude": "medium",
        "mistral": "medium",
    },
    "AUTH3": {  # Domain age < 2 years — correlation, not causation
        "chatgpt": "low",
        "gemini": "low",
        "perplexity": "low",
        "claude": "low",
        "mistral": "low",
    },
}

# Findings that are universal-impact (apply equally everywhere) rather than
# LLM-specific. Used to pull them into a "cross-LLM levers" bucket.
UNIVERSAL_LEVERS = {"EE1", "CHM1", "S0", "CR1"}


def impact_for(code: str, llm_slug: str) -> str:
    """Return the impact tag for a finding code on a given LLM. Default to
    'medium' when the code is unknown — most findings help all LLMs at least
    moderately, and being honest about uncertainty is better than 'none'."""
    return FINDING_LLM_IMPACT.get(code, {}).get(llm_slug, "medium")


def impact_rank(impact: str) -> int:
    return _IMPACT_RANK.get(impact, 0)


def impact_label(impact: str, lang: str = "en") -> str:
    table = _IMPACT_LABEL_FR if lang.startswith("fr") else _IMPACT_LABEL_EN
    return table.get(impact, impact)


def impact_glyph(impact: str) -> str:
    """Compact 1–3 char visual cue. Used in tables."""
    return {
        "high": "+++",
        "medium-high": "++",
        "medium": "+",
        "low": "+/-",
        "experimental": "?",
        "none": "—",
    }.get(impact, "·")
