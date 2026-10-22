#!/usr/bin/env python3
"""
client_paths.py — per-site folder management for the GEO Audit Toolkit.

Folder convention (inside the repo, next to `skills/` and `agents/`):
    <repo>/site-client/
    ├── INDEX.md
    ├── <slug>/
    │   ├── info.json
    │   ├── audits/      ← /geo audit, /geo report, /geo report-pdf outputs
    │   ├── reports/     ← /geo compare deltas
    │   └── assets/      ← screenshots, generated schema JSON, notes

ROOT is resolved from this script's location so the repo can be cloned
anywhere. The `SITE_CLIENT_ROOT` env var overrides it if set.

Slug rules: strip protocol, strip leading `www.`, keep subdomains, lowercase,
drop path/query/fragment. Examples:
    https://www.slidor.fr/      → slidor.fr
    https://blog.example.co.uk  → blog.example.co.uk
    Example.com/path            → example.com

CLI:
    client_paths.py slug <url>                 → print slug
    client_paths.py init <url> [--name NAME]   → create folder + info.json
    client_paths.py paths <url>                → print shell-eval-able paths
    client_paths.py list                       → print table of all sites
    client_paths.py show <url>                 → print info + artefact tree
    client_paths.py index                      → rebuild <repo>/site-client/INDEX.md
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent  # <repo>/scripts/..
ROOT = Path(os.environ.get("SITE_CLIENT_ROOT") or (REPO_ROOT / "site-client"))
SUBFOLDERS = ("audits", "reports", "assets")


def slug(url_or_domain: str) -> str:
    s = url_or_domain.strip().lower()
    s = re.sub(r"^https?://", "", s)
    s = re.sub(r"^www\.", "", s)
    s = s.split("/")[0].split("?")[0].split("#")[0]
    return s.strip(".")


def client_dir(url_or_domain: str) -> Path:
    return ROOT / slug(url_or_domain)


def ensure(url_or_domain: str, name: str | None = None) -> Path:
    """Create the folder structure and info.json if missing. Idempotent."""
    d = client_dir(url_or_domain)
    for sub in SUBFOLDERS:
        (d / sub).mkdir(parents=True, exist_ok=True)
    info_path = d / "info.json"
    if not info_path.exists():
        info = {
            "domain": slug(url_or_domain),
            "name": name or "",
            "url": url_or_domain if url_or_domain.startswith("http") else f"https://{slug(url_or_domain)}/",
            "country": "",
            "language": "",
            "geo_score": None,
            "last_audit_date": None,
            "audit_count": 0,
            "created_at": date.today().isoformat(),
            "updated_at": date.today().isoformat(),
            "tags": [],
        }
        info_path.write_text(json.dumps(info, indent=2, ensure_ascii=False) + "\n")
    return d


def load_info(d: Path) -> dict:
    p = d / "info.json"
    return json.loads(p.read_text()) if p.exists() else {}


def save_info(d: Path, info: dict) -> None:
    info["updated_at"] = date.today().isoformat()
    (d / "info.json").write_text(json.dumps(info, indent=2, ensure_ascii=False) + "\n")


def list_clients() -> list[Path]:
    if not ROOT.exists():
        return []
    return sorted([p for p in ROOT.iterdir() if p.is_dir() and (p / "info.json").exists()])


# ---------- CLI commands ----------

def cmd_slug(args):
    print(slug(args.url))


def cmd_init(args):
    d = ensure(args.url, company_name=args.name)
    print(f"Client folder ready: {d}")
    print(f"  info.json         : {d / 'info.json'}")
    for sub in SUBFOLDERS:
        print(f"  {sub:<18}: {d / sub}/")


def cmd_paths(args):
    """Print shell-eval-able KEY=VALUE lines for the given URL."""
    d = ensure(args.url)
    today = date.today().isoformat()
    kv = {
        "CLIENT_SLUG": slug(args.url),
        "CLIENT_DIR": str(d),
        "AUDIT_MD": str(d / "audits" / f"{today}-audit.md"),
        "AUDIT_PDF": str(d / "audits" / f"{today}-audit.pdf"),
        "AUDIT_JSON": str(d / "audits" / f"{today}-data.json"),
        "REPORT_MD": str(d / "audits" / f"{today}-report.md"),
        "COMPARE_MD": str(d / "reports" / f"{today[:7]}-delta.md"),
        "INFO_JSON": str(d / "info.json"),
        "ASSETS_DIR": str(d / "assets"),
    }
    for k, v in kv.items():
        print(f'{k}="{v}"')


def cmd_list(args):
    sites = list_clients()
    if not sites:
        print("(no audited sites yet — run `/geo audit <url>` to start)")
        return
    print(f"{'Slug':<32}  {'Name':<24}  {'Score':<8}  {'Audits':<7}  {'Last audit':<12}")
    print("─" * 92)
    for d in sites:
        i = load_info(d)
        score = f"{i.get('geo_score')}/100" if i.get("geo_score") is not None else "—"
        print(
            f"{i.get('domain', d.name):<32}  "
            f"{(i.get('name') or '')[:24]:<24}  "
            f"{score:<8}  "
            f"{str(i.get('audit_count', 0)):<7}  "
            f"{i.get('last_audit_date') or '—':<12}"
        )


def cmd_show(args):
    d = client_dir(args.url)
    if not d.exists():
        print(f"Site folder not found: {d}")
        sys.exit(1)
    i = load_info(d)
    print(f"=== {i.get('name') or i.get('domain')} ({i.get('domain')}) ===")
    for k in ("url", "country", "language", "geo_score", "last_audit_date", "audit_count"):
        print(f"  {k:<18}: {i.get(k) if i.get(k) is not None else '—'}")
    if i.get("tags"):
        print(f"  {'tags':<18}: {', '.join(i['tags'])}")
    print()
    for sub in SUBFOLDERS:
        items = sorted((d / sub).glob("*")) if (d / sub).exists() else []
        print(f"  {sub}/ ({len(items)} item{'s' if len(items) != 1 else ''})")
        for item in items:
            print(f"    {item.name}")


def cmd_index(args):
    ROOT.mkdir(parents=True, exist_ok=True)
    sites = list_clients()
    lines = [
        "# Site index",
        "",
        f"*Auto-generated on {datetime.now().strftime('%Y-%m-%d %H:%M')} — do not edit by hand.*",
        "",
        f"**{len(sites)} site{'s' if len(sites) != 1 else ''} audited**",
        "",
        "| Domain | Name | Score | Audits | Last audit |",
        "|---|---|:---:|:---:|:---:|",
    ]
    for d in sites:
        i = load_info(d)
        score = f"{i.get('geo_score')}/100" if i.get("geo_score") is not None else "—"
        lines.append(
            f"| [{i.get('domain')}]({d.name}/) "
            f"| {i.get('name') or '—'} "
            f"| {score} "
            f"| {i.get('audit_count', 0)} "
            f"| {i.get('last_audit_date') or '—'} |"
        )
    (ROOT / "INDEX.md").write_text("\n".join(lines) + "\n")
    print(f"Index updated: {ROOT / 'INDEX.md'}  ({len(sites)} site(s))")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("slug"); sp.add_argument("url"); sp.set_defaults(func=cmd_slug)

    sp = sub.add_parser("init"); sp.add_argument("url"); sp.add_argument("--name", default=None); sp.set_defaults(func=cmd_init)

    sp = sub.add_parser("paths"); sp.add_argument("url"); sp.set_defaults(func=cmd_paths)

    sp = sub.add_parser("list"); sp.set_defaults(func=cmd_list)

    sp = sub.add_parser("show"); sp.add_argument("url"); sp.set_defaults(func=cmd_show)

    sp = sub.add_parser("index"); sp.set_defaults(func=cmd_index)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
