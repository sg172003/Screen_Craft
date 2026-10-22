# Source #06 — Knowledge Graph vs SQL benchmark (data.world, Nov 2023)

- **URL article:** https://www.rankit.fr/knowledge-graph-llm-precision
- **Author of article:** Frédéric Jézégou (Rankit.fr)
- **Author of cited benchmark:** data.world (Nov 2023)
- **Date of article:** 2026-03 (approx)
- **Type:** Article interpreting an empirical benchmark

## Triage

🟢 **Universal — the underlying principle is sound**

- Semantic context matters for LLM accuracy. When the schema is described meaningfully (via OWL ontology with property labels), GPT-4 zero-shot accuracy on data queries jumps from 16.7% to 54.2% (factor 3 improvement, +37.5 absolute points).
- For complex schemas (5+ tables) the gap is even larger: 0% with raw SQL DDL vs. 35-71% with KG.
- Translates to GEO via these analogies (the article's interpretation):
  - Schema.org plays the role of the OWL ontology
  - Semantic H2/H3 (e.g. "How much does an SEO audit cost in 2026" vs "Pricing") play the role of property labels
  - Internal linking declares entity relations
  - Definition pages serve as the business dictionary

🟡 **Context-specific** — none in the original benchmark.

🟠 **Hard-mode-gated** — building a real Knowledge Graph in OWL/SPARQL requires non-trivial infrastructure. The "lighter version" (Schema.org + good editorial structure) is more accessible.

🔴 **Over-claimed in the article**

- **The benchmark measures SQL/SPARQL query generation accuracy, NOT RAG citation likelihood.** The author makes an analogical leap from "ontology helps SQL queries" to "Schema.org helps LLMs cite you". Plausible hypothesis, **not what the benchmark measured**. The factor 3 improvement does NOT mechanically transfer to citation rates.
- The benchmark is from Nov 2023 — predates the WordLift study (Source #03), which is more directly applicable to RAG and gives more conservative numbers.

## What we integrate

- General principle ("semantic context helps") in `docs/STRUCTURED_DATA_BEST_PRACTICES.md`, with **explicit caveat** that this benchmark measured SQL/SPARQL query generation, not citation rates.
- Concrete recommendation patterns:
  - **Semantic H2/H3 audit** — flag opaque titles like "Tarifs", "Services" for contextual rewrite ("How much does X cost in [year]")
  - **Definition pages presence** — for sector-specific technical sites, check if business terms are defined on dedicated pages

## What we explicitly do NOT integrate

- The "factor 3 improvement" as a citation-related claim. We always anchor it to its actual measurement: "structured ontology improved SQL/SPARQL accuracy by 37.5 points (data.world, Nov 2023)" — not "Schema.org triples your AI citation rate".
