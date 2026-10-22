"""Audit-text translation layer.

Findings produced by `scripts/checks/*.py` are in English (technical labels).
When `output_lang=fr`, the audit reporter calls `translate()` on every
user-visible finding string (title, effort, expected gain, description) to
emit French.

Two translation strategies:
- **Exact match** (`TRANS_FR_EXACT`): full string lookup
- **Templated** (`TRANS_FR_REGEX`): regex pattern + replacement, used for
  finding titles that embed dynamic values like "Visible-facts coverage is 49%"

When neither matches, the original English is returned — graceful degradation.

A French glossary is also exposed via `glossary(lang)` to be appended to the
audit. It defines BLUF, Schema/JSON-LD, EEP, RAG, RRF and other technical
terms that stay English in the body even after translation (because they are
proper nouns / industry terms).
"""
from __future__ import annotations

import re


# ============================================================================
# Exact-match translations (full-string lookup)
# ============================================================================

TRANS_FR_EXACT: dict[str, str] = {
    # --- Effort strings ---
    "30min-2h per type (use templates from `schema/` if available)": "30min-2h par type (utiliser les templates de `schema/` si disponibles)",
    "1-2h editorial — move key facts into the visible body": "1-2h éditorial — déplacer les faits clés dans le body visible",
    "6-10h editorial — rewrite key H2 lead paragraphs": "6-10h éditorial — réécrire les premiers paragraphes des H2 clés",
    "4-8h editorial — add definitional paragraphs in About / Service pages": "4-8h éditorial — ajouter des paragraphes définitionnels (pages À propos / Services)",
    "2-4h editorial — restructure with first-hand evaluation criteria, "
    "remove rank claims unless backed by data": "2-4h éditorial — restructurer avec des critères d'évaluation de première main, retirer les classements non sourcés",
    "2-3h editorial — rewrite answers with substantive facts": "2-3h éditorial — réécrire les réponses avec des faits substantiels",
    "2 min per bot": "2 min par bot",
    "30 min to add a tailored, entity-specific block": "30 min pour ajouter un bloc personnalisé à l'entité",
    "2 min — flip the rule": "2 min — inverser la règle",
    "1 min — remove for clarity (optional)": "1 min — retirer pour la lisibilité (optionnel)",
    "15-30 min — rewrite robots.txt per `docs/CRAWLERS_TAXONOMY.md`": "15-30 min — réécrire robots.txt selon `docs/CRAWLERS_TAXONOMY.md`",
    "15 min — review and rewrite or remove": "15 min — revoir, réécrire ou retirer",
    "5-10 min — clean the sameAs array": "5-10 min — nettoyer le tableau `sameAs`",
    "30 min — manual verify, fix any genuinely dead links": "30 min — vérifier manuellement, fixer les liens réellement morts",
    "1-2h dev — populate with actual navigation chain": "1-2h dev — remplir avec la vraie chaîne de navigation",
    "2-4h to add baseline schemas (Organization, WebPage, etc.)": "2-4h pour ajouter les schémas baseline (Organization, WebPage, etc.)",
    "Split the schema into separate `<script>` blocks (1-2h)": "Découper le schéma en plusieurs blocs `<script>` (1-2h)",

    # --- Title strings (non-templated) ---
    "GPTBot allowed but OAI-SearchBot blocked — backwards configuration": "GPTBot autorisé mais OAI-SearchBot bloqué — configuration inversée",
    "ClaudeBot allowed but Claude-SearchBot blocked — backwards": "ClaudeBot autorisé mais Claude-SearchBot bloqué — configuration inversée",
    "Crawler policy is inverted: training allowed, RAG blocked": "Politique crawler inversée : training autorisé, RAG bloqué",
    "`User-agent: BraveBot` rule present — cosmetic only": "Règle `User-agent: BraveBot` présente — purement cosmétique",
    "No JSON-LD structured data found": "Aucune donnée structurée JSON-LD trouvée",
    "Self-promotional listicle pattern detected": "Pattern listicle auto-promotionnel détecté",
    "Synthetic FAQ pattern detected": "Pattern FAQ synthétique détecté",
    "Suspicious 'agent-instructions' content (possible negative-GEO injection)": "Contenu `agent-instructions` suspect (possible injection GEO négative)",
    "No `<section class=\"agent-instructions\">` block (emerging pattern)": "Aucun bloc `<section class=\"agent-instructions\">` (pattern émergent)",

    # --- Crawler annex descriptions ---
    "Implicitly allowed via `User-agent: *`. Adding explicit Allow: rules signals strategic intent and protects against future changes to the wildcard rule.":
        "Autorisé implicitement via `User-agent: *`. Une règle `Allow:` explicite affiche l'intention stratégique et protège contre une modification future du wildcard.",
    "These bots only fetch on explicit user demand (someone in ChatGPT/Claude/Gemini asks the assistant to read a specific URL). They're high-intent and should be allowed.":
        "Ces bots ne fetchent que sur demande explicite d'un utilisateur (quelqu'un dans ChatGPT/Claude/Gemini demande à l'assistant de lire une URL précise). Intent fort, à autoriser.",

    # --- Expected gain strings ---
    "Direct: rich-result eligibility, structured-data retrieval": "Direct : éligibilité aux rich results, retrieval RAG",
    "Direct: ChatGPT live citation reachability": "Direct : capacité de citation ChatGPT en direct",
    "Direct: Claude live citation reachability": "Direct : capacité de citation Claude en direct",
    "Critical: directly impacts AI search visibility": "Critique : impact direct sur la visibilité dans les LLMs",
    "Direct on extractibility for ChatGPT / Claude / Mistral": "Direct sur l'extractibilité pour ChatGPT / Claude / Mistral",
    "Medium — single Ahrefs correlation study, not yet replicated": "Moyen — étude Ahrefs unique, non répliquée",
    "Medium-high — Enhanced Entity Page lift on RAG retrieval": "Moyen-fort — lift EEP sur le retrieval RAG",
    "Low — clarity and future-proofing": "Faible — clarté et anticipation",
    "Low — polish": "Faible — polissage",
    "None — clarity only": "Aucun — clarté uniquement",
    "Defensive — avoids Mount AI penalty": "Défensif — évite la pénalité Mount AI",
    "Defensive — preserves rich-result eligibility": "Défensif — préserve l'éligibilité aux rich results",
    "Reputational + future-proof": "Réputationnel + future-proof",
    "Experimental — possible future lift, not a confirmed lever in 2026": "Expérimental — lift futur possible, pas un levier confirmé en 2026",
    "High on rich-result eligibility; medium on RAG pipelines": "Fort sur l'éligibilité aux rich results ; moyen sur le retrieval RAG",
    "Medium — restores trustworthy parsing on truncation-prone indexers": "Moyen — restaure un parsing fiable sur les indexeurs sujets à troncature",
    "Low-medium — restores entity-graph quality": "Faible-moyen — restaure la qualité du graphe d'entités",
    "Low-medium — entity-graph integrity": "Faible-moyen — intégrité du graphe d'entités",
    "Medium — rich-result eligibility, RAG navigation": "Moyen — éligibilité aux rich results, navigation RAG",
}


# ============================================================================
# Templated translations (regex pattern → replacement)
# Order matters: more specific patterns first.
# ============================================================================

TRANS_FR_REGEX: list[tuple[str, str]] = [
    # "Visible-facts coverage is 49% (target ≥70%)"
    (r"^Visible-facts coverage is (\d+)% \(target ≥(\d+)%\)$",
     r"Couverture des faits visibles : \1% (cible ≥\2%)"),

    # "BLUF format compliance: 0% of H2 sections"
    (r"^BLUF format compliance: (\d+)% of H2 sections$",
     r"Conformité BLUF : \1% des sections H2"),

    # "Definition language density: 1.8% (target ≥30%)"
    (r"^Definition language density: ([\d.]+)% \(target ≥(\d+)%\)$",
     r"Densité du langage définitionnel : \1% (cible ≥\2%)"),

    # "Missing expected schema type(s) for `article` page: Article, Person, BreadcrumbList"
    (r"^Missing expected schema type\(s\) for `([\w-]+)` page: (.+)$",
     r"Schéma(s) manquant(s) pour une page `\1` : \2"),

    # "Key RAG bots not explicitly listed: X, Y"
    (r"^Key RAG bots not explicitly listed: (.+)$",
     r"Bots RAG clés non listés explicitement : \1"),

    # "User-request bots not explicitly listed: X, Y"
    (r"^User-request bots not explicitly listed: (.+)$",
     r"Bots user-request non listés explicitement : \1"),

    # "JSON-LD block(s) exceed 20k chars (Vertex AI truncation)"
    (r"^JSON-LD block\(s\) exceed (\d+)k chars \(Vertex AI truncation\)$",
     r"Bloc(s) JSON-LD dépassent \1k caractères (troncature Vertex AI)"),

    # "`sameAs` array contains 3 empty/malformed entries"
    (r"^`sameAs` array contains (\d+) empty/malformed entries$",
     r"Le tableau `sameAs` contient \1 entrées vides/malformées"),

    # "`sameAs` deref: 4/5 return 200 on HEAD"
    (r"^`sameAs` deref: (\d+)/(\d+) return 200 on HEAD$",
     r"Déréférencement `sameAs` : \1/\2 retournent 200 en HEAD"),

    # "`BreadcrumbList` schema has only 1 item(s)"
    (r"^`BreadcrumbList` schema has only (\d+) item\(s\)$",
     r"Le schéma `BreadcrumbList` ne contient que \1 entrée(s)"),
]


def translate(text: str | None, lang: str = "en") -> str | None:
    """Translate a finding/effort/title string to the target language.

    Returns the original string when no translation is found. Returns None
    if the input is None (so callers can `translate(g['effort'], 'fr')` safely)."""
    if text is None or not text:
        return text
    if not lang.lower().startswith("fr"):
        return text
    if text in TRANS_FR_EXACT:
        return TRANS_FR_EXACT[text]
    for pattern, replacement in TRANS_FR_REGEX:
        if re.match(pattern, text):
            return re.sub(pattern, replacement, text)
    return text  # fall back


# ============================================================================
# Glossary
# ============================================================================

_GLOSSARY_FR = """## Glossaire technique

Les termes ci-dessous restent en anglais dans le rapport (jargon industrie /
nom propre) ; voici leur signification.

### Mesure & visibilité

| Terme | Signification |
|---|---|
| **RRF** (_Reciprocal Rank Fusion_) | Algorithme classique d'IR : `Σ 1/(60 + rank_q(D))` agrégé sur N requêtes. Donne un score de visibilité moyen sur un set de fan-out queries. |
| **Fan-out queries** | Variantes lexicales d'une requête racine (ex : « agence powerpoint » → « meilleure agence powerpoint », « tarif agence powerpoint »). Mime le comportement des LLMs qui reformulent avant de chercher. |
| **Top-N mesuré** | Profondeur effectivement collectée par le scraper (typiquement 10 = première page Google/Brave). Une « absence » du top-N ne dit rien au-delà — le domaine peut être en page 2. |
| **Host-grouping** (SERP) | Quand un seul domaine occupe ≥ 80% des slots du SERP. Indique une requête navigationnelle (« montre-moi X » plutôt que « compare les options »). |
| **Force comparative** | Score relatif `RRF(target) / RRF(meilleur_concurrent)` sur un moteur. `1.0` = leader. Quand l'écart est < 5%, le leadership est qualifié de « fragile ». |

### Contenu & extractibilité

| Terme | Signification |
|---|---|
| **BLUF** | _Bottom Line Up Front_. Mettre le fait clé / la conclusion en premier paragraphe sous chaque H2. Critique pour l'extractibilité par les LLMs (ChatGPT, Claude, Mistral) qui scannent les premiers tokens d'une section. Cible ≥ 50%. |
| **Definition language** | Densité de phrases au format définitionnel (« X est un… », « X consiste à… »). Ahrefs (étude unique non répliquée) suggère une corrélation positive avec la citation LLM. À traiter comme `medium` confidence. |
| **Mount AI** | Pattern anti-extractibilité : listicles auto-promotionnels, FAQ synthétiques, contenus mass-générés. Pénalisé par les algos E-E-A-T de Google → impact direct sur les LLMs Google-backed. |

### Données structurées

| Terme | Signification |
|---|---|
| **Schema.org / JSON-LD** | Vocabulaire de balisage structuré (Schema.org) injecté en JSON-LD dans la page. Permet aux moteurs de comprendre l'entité (entreprise, article, produit) et alimente les rich results Google + le retrieval RAG des LLMs. |
| **EEP (Enhanced Entity Pages)** | Méthodologie qui exige que les faits déclarés en JSON-LD soient aussi visibles dans le body de la page. Étude WordLift 2025 : pages où schéma + body alignent → +30% de citations LLM. |
| **Visible-facts coverage** | % des faits déclarés dans le JSON-LD qui apparaissent aussi en clair dans le body visible. Cible ≥ 70%. |
| **sameAs** | Propriété Schema.org qui lie l'entité à ses présences externes (Wikipedia, Wikidata, LinkedIn, etc.). Critique pour la knowledge-graph anchoring. |

### Crawlers & retrieval LLM

| Terme | Signification |
|---|---|
| **RAG** (_Retrieval-Augmented Generation_) | Pattern d'archi LLM : récupérer des documents externes avant de générer la réponse. Utilisé par ChatGPT/Search, Gemini, Perplexity, Claude, Le Chat. |
| **OAI-SearchBot, GPTBot, ClaudeBot, etc.** | User-agents des bots IA. Trois catégories : `training` (alimentation des modèles), `RAG / search` (citation live dans les réponses), `user-request` (fetch ponctuel demandé par l'utilisateur). Voir `docs/CRAWLERS_TAXONOMY.md`. |

### Concepts qualité

| Terme | Signification |
|---|---|
| **E-E-A-T** | _Experience, Expertise, Authoritativeness, Trustworthiness_. Framework qualité Google appliqué aussi aux résultats nourrissant les LLMs. |
| **Sév.** (_severity_) | Sévérité du finding : `critical` > `high` > `medium` > `low` > `informational`. |
| **Confidence** | Niveau de preuve scientifique du levier : `high` (étude reproduite) > `medium-high` (étude unique solide) > `medium` (corrélation observée) > `low` (anecdotique) > `experimental` (pattern émergent non validé). |
"""

_GLOSSARY_EN = """## Technical glossary

| Term | Meaning |
|---|---|
| **BLUF** | "Bottom Line Up Front" — editorial practice of putting the key fact / conclusion in the first paragraph under each H2. Critical for LLM extractibility. Target ≥ 50%. |
| **Schema.org / JSON-LD** | Structured-data vocabulary injected as JSON-LD. Powers Google rich results and LLM RAG retrieval. |
| **EEP (Enhanced Entity Pages)** | Methodology requiring JSON-LD facts to also appear in the visible body. WordLift 2025: aligned pages get +30% LLM citations. |
| **Visible-facts coverage** | % of JSON-LD declared facts that also appear in the visible body text. Target ≥ 70%. |
| **RAG** | _Retrieval-Augmented Generation_. LLM architecture pattern that retrieves external docs before answering. |
| **RRF** | _Reciprocal Rank Fusion_. Classic IR algorithm: `Σ 1/(60 + rank_q(D))` over N queries. |
| **Fan-out queries** | Lexical variants of a root query. Mimics LLMs that reformulate before searching. |
| **Top-N measured** | Depth actually collected by the scraper. An "absence" from top-N says nothing beyond. |
| **Host-grouping** (SERP) | When a single domain takes ≥ 80% of SERP slots — navigational signal. |
| **Severity** | `critical` > `high` > `medium` > `low` > `informational`. |
| **Confidence** | Evidence strength of the lever. |
| **Definition language** | Density of definitional phrasing. Single-study (Ahrefs) — `medium` confidence. |
| **Mount AI** | Anti-extractibility pattern: self-promotional listicles, synthetic FAQs, mass-gen content. |
| **E-E-A-T** | Experience, Expertise, Authoritativeness, Trustworthiness — Google's quality framework. |
| **sameAs** | Schema.org property linking the entity to external presences (Wikipedia, Wikidata, LinkedIn). |
"""


def glossary(lang: str = "en") -> str:
    return _GLOSSARY_FR if lang.lower().startswith("fr") else _GLOSSARY_EN
