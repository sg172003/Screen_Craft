"""Crawler-access audit module.

Parses a site's `robots.txt` and reports crawler-access policy per the
3-category taxonomy from `docs/CRAWLERS_TAXONOMY.md`:
- Training crawlers (default: block)
- RAG / search crawlers (default: allow)
- User-request crawlers (default: allow)

Detects the GPTBot vs OAI-SearchBot confusion, the BraveBot non-issue,
and inverted policy postures.
"""
from __future__ import annotations

import json
import re
import warnings
from dataclasses import dataclass

import requests

warnings.filterwarnings("ignore", message=".*OpenSSL.*", category=Warning)

from . import CheckReport


# --- Crawler catalogue (mirrors docs/CRAWLERS_TAXONOMY.md) ---

TRAINING_CRAWLERS = {
    "GPTBot", "ClaudeBot", "anthropic-ai", "CCBot", "Bytespider",
    "Meta-ExternalAgent", "Applebot-Extended", "DeepSeekBot", "Amazonbot",
    "cohere-ai", "Google-Extended", "omgili",
}

RAG_CRAWLERS = {
    "OAI-SearchBot", "PerplexityBot", "Claude-SearchBot", "YouBot", "DuckAssistBot",
}

USER_REQUEST_CRAWLERS = {
    "ChatGPT-User", "Claude-User", "Gemini-User", "Google-Agent",
    "MistralAI-User", "Perplexity-User",
}


# --- Robots.txt parser ---

@dataclass
class RobotsRule:
    user_agent: str
    allow_paths: list[str]
    disallow_paths: list[str]


def _parse_robots(text: str) -> dict[str, RobotsRule]:
    """Parse robots.txt into a dict {user_agent: RobotsRule}.

    Note: this is a pragmatic parser — it groups directives that follow each
    User-agent line until the next User-agent or end. Doesn't fully implement
    the RFC9309 longest-match logic, but suffices for our audit (we report
    explicit listings + the wildcard).
    """
    rules: dict[str, RobotsRule] = {}
    current: list[str] = []     # current set of UAs sharing the next directives
    for line in text.splitlines():
        # Strip comments and whitespace
        line = re.sub(r"#.*$", "", line).strip()
        if not line:
            current = []  # blank line = directive group break (per RFC)
            continue
        m = re.match(r"^([A-Za-z\-]+)\s*:\s*(.+)$", line)
        if not m:
            continue
        directive, value = m.group(1).lower(), m.group(2).strip()
        if directive == "user-agent":
            current.append(value)
            if value not in rules:
                rules[value] = RobotsRule(user_agent=value, allow_paths=[], disallow_paths=[])
        elif directive == "allow" and current:
            for ua in current:
                rules[ua].allow_paths.append(value)
        elif directive == "disallow" and current:
            for ua in current:
                rules[ua].disallow_paths.append(value)
    return rules


def _is_blocked(rule: RobotsRule) -> bool:
    """A bot is 'blocked' if its rule has Disallow: / and no Allow: / override."""
    has_root_disallow = any(p == "/" for p in rule.disallow_paths)
    has_root_allow = any(p == "/" for p in rule.allow_paths)
    return has_root_disallow and not has_root_allow


def _is_allowed(rule: RobotsRule) -> bool:
    """Has explicit Allow: / OR no disallow."""
    if any(p == "/" for p in rule.allow_paths):
        return True
    return not any(p == "/" for p in rule.disallow_paths)


# --- Main audit ---

def audit_robots(robots_text: str, site_url: str = "") -> CheckReport:
    report = CheckReport(check_name="crawlers", target=site_url)
    rules = _parse_robots(robots_text)

    # Build per-category status
    cat_summary: dict[str, dict[str, list[str]]] = {
        "training": {"allowed": [], "blocked": [], "implicit": []},
        "rag": {"allowed": [], "blocked": [], "implicit": []},
        "user_request": {"allowed": [], "blocked": [], "implicit": []},
    }

    def classify(ua: str) -> str | None:
        if ua in TRAINING_CRAWLERS:
            return "training"
        if ua in RAG_CRAWLERS:
            return "rag"
        if ua in USER_REQUEST_CRAWLERS:
            return "user_request"
        return None

    listed_uas = set(rules.keys())

    # For each known crawler, classify
    all_known = TRAINING_CRAWLERS | RAG_CRAWLERS | USER_REQUEST_CRAWLERS
    for crawler in all_known:
        cat = classify(crawler)
        if cat is None:
            continue
        if crawler in rules:
            rule = rules[crawler]
            if _is_blocked(rule):
                cat_summary[cat]["blocked"].append(crawler)
            else:
                cat_summary[cat]["allowed"].append(crawler)
        else:
            # Falls under wildcard `*` rule
            wildcard_rule = rules.get("*")
            if wildcard_rule and _is_blocked(wildcard_rule):
                cat_summary[cat]["blocked"].append(crawler)
            else:
                cat_summary[cat]["implicit"].append(crawler)

    report.metrics["categories"] = cat_summary
    report.metrics["explicit_uas_count"] = len(listed_uas)
    report.metrics["wildcard_present"] = "*" in rules

    # === Findings ===

    # GPTBot allowed but OAI-SearchBot blocked
    if "GPTBot" in cat_summary["training"]["allowed"] and "OAI-SearchBot" in cat_summary["rag"]["blocked"]:
        report.add(
            code="CR-A1",
            severity="high",
            confidence="high",
            title="GPTBot allowed but OAI-SearchBot blocked — backwards configuration",
            description=(
                "Allowing GPTBot (training, multi-year cycle) but blocking "
                "OAI-SearchBot (the bot that powers ChatGPT live search) is "
                "exactly backwards: you're feeding training corpora but invisible "
                "in current ChatGPT visibility."
            ),
            effort="2 min — flip the rule",
            expected_gain="Direct: ChatGPT live citation reachability",
        )

    # ClaudeBot allowed but Claude-SearchBot blocked
    if "ClaudeBot" in cat_summary["training"]["allowed"] and "Claude-SearchBot" in cat_summary["rag"]["blocked"]:
        report.add(
            code="CR-A2",
            severity="high",
            confidence="high",
            title="ClaudeBot allowed but Claude-SearchBot blocked — backwards",
            description=(
                "Same backwards confusion as GPTBot/OAI-SearchBot: Claude-SearchBot "
                "is what matters for live Claude citations."
            ),
            effort="2 min",
            expected_gain="Direct: Claude live citation reachability",
        )

    # All training allowed AND all RAG blocked → critical inversion
    if (
        len(cat_summary["training"]["allowed"]) >= 3
        and len(cat_summary["rag"]["blocked"]) >= 2
    ):
        report.add(
            code="CR-A3",
            severity="critical",
            confidence="high",
            title="Crawler policy is inverted: training allowed, RAG blocked",
            description=(
                "The site is feeding training corpora (no bilateral value) and "
                "blocking RAG retrievers (which would cite the site live). "
                "Recommend reviewing the policy."
            ),
            effort="15-30 min — rewrite robots.txt per `docs/CRAWLERS_TAXONOMY.md`",
            expected_gain="Critical: directly impacts AI search visibility",
        )

    # User has BraveBot rule (cosmetic — Brave follows Googlebot)
    if "BraveBot" in rules or "bravebot" in rules:
        report.add(
            code="CR-INFO1",
            severity="informational",
            confidence="high",
            title="`User-agent: BraveBot` rule present — cosmetic only",
            description=(
                "BraveBot uses a standard Chrome user-agent and respects whatever "
                "rules apply to Googlebot. A separate rule has no effect."
            ),
            effort="1 min — remove for clarity (optional)",
            expected_gain="None — clarity only",
        )

    # Missing key RAG bots (Claude-SearchBot, OAI-SearchBot, PerplexityBot)
    important_rag = ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"]
    missing_rag = [
        c for c in important_rag
        if c not in rules and c in cat_summary["rag"]["implicit"]
    ]
    if missing_rag and "*" in rules and not _is_blocked(rules["*"]):
        # They're implicitly allowed but not explicitly listed.
        report.add(
            code="CR-INFO2",
            severity="low",
            confidence="medium",
            title=f"Key RAG bots not explicitly listed: {', '.join(missing_rag)}",
            description=(
                "Implicitly allowed via `User-agent: *`. Adding explicit Allow: "
                "rules signals strategic intent and protects against future "
                "changes to the wildcard rule."
            ),
            effort="2 min per bot",
            expected_gain="Low — clarity and future-proofing",
        )

    # Missing user-request bots (Google-Agent new 2026, etc.)
    important_ur = ["ChatGPT-User", "Claude-User", "Google-Agent", "MistralAI-User"]
    missing_ur = [
        c for c in important_ur
        if c not in rules and c in cat_summary["user_request"]["implicit"]
    ]
    if missing_ur:
        report.add(
            code="CR-INFO3",
            severity="low",
            confidence="medium",
            title=f"User-request bots not explicitly listed: {', '.join(missing_ur)}",
            description=(
                "These bots only fetch on explicit user demand (someone in ChatGPT/"
                "Claude/Gemini asks the assistant to read a specific URL). They're "
                "high-intent and should be allowed."
            ),
            effort="2 min per bot",
            expected_gain="Low — polish",
        )

    return report


def audit_site(site_url: str) -> CheckReport:
    """Fetch /robots.txt from the site and audit it."""
    if not site_url.endswith("/"):
        robots_url = site_url.rstrip("/") + "/robots.txt"
    else:
        robots_url = site_url + "robots.txt"
    try:
        r = requests.get(
            robots_url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=15,
        )
        if r.status_code != 200:
            rpt = CheckReport(check_name="crawlers", target=site_url)
            rpt.error = f"robots.txt http {r.status_code}"
            return rpt
    except requests.RequestException as e:
        rpt = CheckReport(check_name="crawlers", target=site_url)
        rpt.error = f"network: {e}"
        return rpt
    return audit_robots(r.text, site_url)


def _main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("url")
    args = p.parse_args()
    rpt = audit_site(args.url)
    print(json.dumps(rpt.to_dict(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _main()
