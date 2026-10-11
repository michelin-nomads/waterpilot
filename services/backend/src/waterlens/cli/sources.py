"""Operator commands for the source catalogue and ingestion (runbook:
``docs/data/ingestion-runbook.md``, ADR 0008).

Local mode only (the Firestore emulator and local object storage); pilot mode is refused
until the live adapters are verified. Nothing here touches the network unless
``--allow-network`` is given, and then only https URLs on a registered source's host.

Usage:  uv run python -m waterlens.cli.sources <command> ...
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from waterlens.adapters.factory import build_local_store, build_object_storage
from waterlens.application.artifacts import ArtifactStore
from waterlens.application.pagination import PageQuery, filter_fingerprint
from waterlens.application.repositories import Store
from waterlens.application.sources.admin import SourceAdmin
from waterlens.application.sources.parsing import ParseRejected, parse_geojson_footprint
from waterlens.config import ConfigError, Settings, get_settings
from waterlens.domain.errors import DomainError
from waterlens.domain.sources import IngestionRun
from waterlens.domain.values import EvidenceQuality

DEMO_DIR = Path("docs") / "domain" / "fixtures" / "demo-sources"
DEMO_SOURCE = "synthetic-utility-supply-demo"


def _now() -> datetime:
    return datetime.now(UTC)


def _repo_root(start: Path) -> Path:
    for parent in [start, *start.parents]:
        if (parent / DEMO_DIR).is_dir():
            return parent
    raise FileNotFoundError(f"could not locate the repository root containing {DEMO_DIR}")


def _emit(data: dict[str, Any]) -> None:
    print(json.dumps(data, indent=2, default=str))


def _admin(settings: Settings, *, allow_network: bool) -> tuple[SourceAdmin, Store]:
    if settings.is_pilot:
        raise SystemExit("source commands are local-only until live adapters are verified")
    if settings.local_store == "memory":
        raise SystemExit("use WL_LOCAL_STORE=firestore: in-memory data ends with this command")
    store = build_local_store(settings)
    fetcher = None
    if allow_network:
        from waterlens.adapters.source_http import HttpSourceFetcher

        fetcher = HttpSourceFetcher()
    artifacts = ArtifactStore(build_object_storage(settings))
    return SourceAdmin(store, artifacts, _now, fetcher), store


def _read_json(path: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads(Path(path).read_text(encoding="utf-8"))
    return data


def _run_summary(run: IngestionRun) -> dict[str, Any]:
    summary: dict[str, Any] = run.model_dump(
        mode="json", include={"id", "source_id", "status", "snapshot_id", "checksum", "problems"}
    )
    return summary


def _list(store: Store) -> dict[str, Any]:
    regs = store.source_registrations.page({}, PageQuery(200, None, filter_fingerprint({})))
    out = []
    for reg in regs.items:
        where = {"source_id": reg.id}
        runs = store.ingestion_runs.page(where, PageQuery(3, None, filter_fingerprint(where)))
        checks = store.connectivity_checks.page(
            where, PageQuery(1, None, filter_fingerprint(where))
        )
        licence = reg.manifest.licence
        out.append(
            {
                "id": reg.id,
                "capability": reg.capability.value,
                "quality": reg.manifest.quality_status.value,
                "licence": {
                    "usageRights": licence.usage_rights.value,
                    "authorization": licence.authorization.status.value,
                },
                "lastConnectivity": checks.items[0].outcome.value if checks.items else None,
                "recentRuns": [_run_summary(r) for r in runs.items],
            }
        )
    return {"sources": out}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="waterlens.cli.sources", description=__doc__)
    parser.add_argument("--allow-network", action="store_true", help="permit https requests")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="registrations with licence, connectivity and recent runs")
    p = sub.add_parser("register", help="register a registered_source manifest")
    p.add_argument("manifest")
    p = sub.add_parser("review-licence", help="record a licence/authorization review")
    p.add_argument("source_id")
    p.add_argument("licence", help="JSON file with the schema's licence object")
    p = sub.add_parser("check", help="record whether the source URL answers")
    p.add_argument("source_id")
    p = sub.add_parser("ingest", help="import a daily CSV file as a snapshot")
    p.add_argument("source_id")
    p.add_argument("--file", required=True)
    p.add_argument("--footprint", help="GeoJSON Polygon narrowing the coverage")
    p = sub.add_parser("fetch", help="download an https file and import it")
    p.add_argument("source_id")
    p.add_argument("url")
    p = sub.add_parser("review-snapshot", help="mark a snapshot validated or quarantined")
    p.add_argument("snapshot_id")
    p.add_argument("--decision", required=True, choices=["validated", "quarantined"])
    p.add_argument("--reviewer", required=True)
    p.add_argument("--evidence", required=True)
    sub.add_parser("demo", help="install the labelled SYNTHETIC demo dataset (local only)")
    args = parser.parse_args(argv)

    try:
        admin, store = _admin(get_settings(), allow_network=args.allow_network)
        if args.command == "list":
            _emit(_list(store))
        elif args.command == "register":
            _emit({"registered": admin.register(_read_json(args.manifest)).id})
        elif args.command == "review-licence":
            reg = admin.review_licence(args.source_id, _read_json(args.licence))
            _emit({"source": reg.id, "version": reg.version})
        elif args.command == "check":
            _emit(admin.check_connectivity(args.source_id).model_dump(mode="json"))
        elif args.command == "ingest":
            footprint = None
            if args.footprint:
                footprint = parse_geojson_footprint(Path(args.footprint).read_bytes())
            run = admin.ingest_file(
                args.source_id,
                Path(args.file).read_bytes(),
                trigger="cli:file",
                footprint=footprint,
            )
            _emit(_run_summary(run))
        elif args.command == "fetch":
            _emit(_run_summary(admin.fetch_and_ingest(args.source_id, args.url)))
        elif args.command == "review-snapshot":
            snap = admin.review_snapshot(
                args.snapshot_id, EvidenceQuality(args.decision), args.reviewer, args.evidence
            )
            _emit({"snapshot": snap.id, "quality": snap.manifest.quality_status.value})
        elif args.command == "demo":
            root = _repo_root(Path(__file__).resolve()) / DEMO_DIR
            if store.source_registrations.get(DEMO_SOURCE) is None:
                admin.register(_read_json(str(root / "synthetic-utility-supply.source.json")))
            run = admin.ingest_file(
                DEMO_SOURCE,
                (root / "synthetic-utility-supply.csv").read_bytes(),
                trigger="cli:demo",
            )
            _emit({"demo": True, **_run_summary(run)})
    except (DomainError, ParseRejected, ConfigError, ValueError) as err:
        print(f"[sources] {type(err).__name__}: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
