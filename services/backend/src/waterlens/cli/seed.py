"""Seed local development state with the SYNTHETIC fixture.

Loads docs/domain/fixtures/*.json into the local object store under ``fixtures/``.
Refuses to run in pilot mode: synthetic data must never be seeded as live evidence.

Usage:  uv run python -m waterlens.cli.seed
"""

from __future__ import annotations

from pathlib import Path

from waterlens.adapters.storage_local import LocalObjectStorage
from waterlens.config import get_settings


def _find_repo_root(start: Path) -> Path:
    for parent in [start, *start.parents]:
        if (parent / "docs" / "domain" / "fixtures").is_dir():
            return parent
    raise FileNotFoundError("could not locate repo root containing docs/domain/fixtures")


def seed() -> int:
    settings = get_settings()
    if settings.is_pilot:
        raise SystemExit("refusing to seed synthetic fixtures in pilot mode")

    repo_root = _find_repo_root(Path(__file__).resolve())
    fixtures_dir = repo_root / "docs" / "domain" / "fixtures"
    storage = LocalObjectStorage(Path(settings.object_storage_dir))

    seeded = 0
    for json_file in sorted(fixtures_dir.glob("*.json")):
        key = f"fixtures/{json_file.name}"
        storage.put(key, json_file.read_bytes())
        print(f"[seed] stored SYNTHETIC {key}")
        seeded += 1
    print(f"[seed] done: {seeded} synthetic fixture file(s) in {settings.object_storage_dir}")
    return seeded


if __name__ == "__main__":
    seed()
