"""SERP disk cache. JSON-on-disk, sha1-keyed, TTL-aware."""
from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path

from . import SerpResponse


class SerpCache:
    """Stores SerpResponse JSON on disk under a per-engine sub-directory.

    Layout:
        <root>/<engine>/<sha1(query|locale)[:2]>/<sha1>.json

    The first 2 hex chars are used as a sub-directory to avoid putting thousands of
    files in one folder.
    """

    # Per-engine TTL overrides (seconds). Engines not listed fall back to the
    # default `ttl_seconds` passed to the constructor. Brave is rate-limit-prone
    # and its index changes slowly enough that a longer TTL is a net win.
    _PER_ENGINE_TTL: dict[str, int] = {
        "brave":  72 * 3600,   # 72h — rate-limit prone, stable index
        "google": 24 * 3600,   # 24h — default
        "bing":   24 * 3600,
        "ddg":    24 * 3600,
    }

    def __init__(self, root: Path | str, ttl_seconds: int = 24 * 3600):
        self.root = Path(root)
        self.ttl_seconds = int(ttl_seconds)

    def _key(self, engine: str, query: str, locale: str) -> str:
        h = hashlib.sha1(f"{engine}|{query}|{locale}".encode("utf-8")).hexdigest()
        return h

    def _path(self, engine: str, query: str, locale: str) -> Path:
        h = self._key(engine, query, locale)
        return self.root / engine / h[:2] / f"{h}.json"

    def _ttl_for(self, engine: str) -> int:
        """Resolve the effective TTL for an engine, with per-engine override."""
        return self._PER_ENGINE_TTL.get(engine, self.ttl_seconds)

    def get(self, engine: str, query: str, locale: str) -> SerpResponse | None:
        p = self._path(engine, query, locale)
        if not p.exists():
            return None
        ttl = self._ttl_for(engine)
        if ttl > 0:
            age = time.time() - p.stat().st_mtime
            if age > ttl:
                return None
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            return SerpResponse.from_dict(data)
        except (json.JSONDecodeError, KeyError):
            # Corrupt cache entry — ignore.
            return None

    def set(self, engine: str, query: str, locale: str, response: SerpResponse) -> None:
        p = self._path(engine, query, locale)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(response.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")

    def clear_engine(self, engine: str) -> int:
        """Remove all cached entries for one engine. Returns count removed."""
        engine_dir = self.root / engine
        if not engine_dir.exists():
            return 0
        count = 0
        for f in engine_dir.rglob("*.json"):
            try:
                f.unlink()
                count += 1
            except OSError:
                pass
        return count


def default_cache_root() -> Path:
    """Default cache location — under the repo so it's portable + gitignored.

    Override via env var SERP_CACHE_ROOT if needed.
    """
    if "SERP_CACHE_ROOT" in os.environ:
        return Path(os.environ["SERP_CACHE_ROOT"])
    repo_root = Path(__file__).resolve().parent.parent.parent
    return repo_root / ".serp_cache"
