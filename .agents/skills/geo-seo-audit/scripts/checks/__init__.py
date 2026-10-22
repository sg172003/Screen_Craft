"""
scripts/checks — quantitative audit modules.

Each module exposes a `run(html, url, **kwargs)` function that returns a
`CheckReport` (or one of its subclasses). The report is a structured dict-
like object that:
- Lists individual `Finding` objects (severity / confidence / effort / gain
  / evidence)
- Carries the raw measured numbers in a `metrics` dict
- Can be merged across pages for multi-page audits

The skills (geo-schema, geo-content-health, geo-crawlers) call these modules
via `python3 -m scripts.checks.<name>` and parse the JSON output.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Literal


Severity = Literal["critical", "high", "medium", "low", "informational"]
Confidence = Literal["high", "medium", "low", "experimental"]


@dataclass
class Finding:
    """A single audit finding. Severity + confidence + effort + gain + evidence."""
    code: str                       # short id, e.g. "EE1", "S2", "CH1"
    severity: Severity
    confidence: Confidence
    title: str
    description: str
    effort: str = ""                # human-readable, e.g. "30 min", "2-4h dev", "10-30h"
    expected_gain: str = ""         # human-readable, e.g. "+5-8 schema points"
    evidence: list[str] = field(default_factory=list)   # URLs / lines / quoted snippets

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class CheckReport:
    """Output of one check on one input (page / site).

    Subclasses can override `metrics` typing for richer analytics.
    """
    check_name: str
    target: str                     # URL or site
    findings: list[Finding] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    error: str | None = None

    def add(
        self,
        code: str,
        severity: Severity,
        confidence: Confidence,
        title: str,
        description: str,
        effort: str = "",
        expected_gain: str = "",
        evidence: list[str] | None = None,
    ) -> None:
        self.findings.append(Finding(
            code=code,
            severity=severity,
            confidence=confidence,
            title=title,
            description=description,
            effort=effort,
            expected_gain=expected_gain,
            evidence=evidence or [],
        ))

    def to_dict(self) -> dict[str, Any]:
        return {
            "check_name": self.check_name,
            "target": self.target,
            "findings": [f.to_dict() for f in self.findings],
            "metrics": self.metrics,
            "error": self.error,
        }


# --- Aggregation helpers (multi-page) ---

def merge_reports(reports: list[CheckReport]) -> CheckReport:
    """Merge several per-page reports into a site-level report.

    Findings are deduplicated by `code + title`. Metrics are merged with
    page-level lists for inspection (the caller can compute averages).
    """
    if not reports:
        return CheckReport(check_name="merged", target="", findings=[])
    merged = CheckReport(
        check_name=reports[0].check_name + "-merged",
        target=reports[0].target,
    )
    seen_codes: set[str] = set()
    pages_metrics: list[dict[str, Any]] = []
    for r in reports:
        for f in r.findings:
            key = f.code + "|" + f.title
            if key in seen_codes:
                continue
            seen_codes.add(key)
            merged.findings.append(f)
        pages_metrics.append({"page": r.target, **r.metrics})
    merged.metrics["pages"] = pages_metrics
    merged.metrics["pages_audited"] = len(reports)
    return merged


# --- Severity ordering for sorting ---

SEVERITY_ORDER = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
    "informational": 4,
}


def sort_findings(findings: list[Finding]) -> list[Finding]:
    """Sort by severity (critical first), then confidence (high first)."""
    conf_order = {"high": 0, "medium": 1, "low": 2, "experimental": 3}
    return sorted(
        findings,
        key=lambda f: (SEVERITY_ORDER.get(f.severity, 99), conf_order.get(f.confidence, 99)),
    )
