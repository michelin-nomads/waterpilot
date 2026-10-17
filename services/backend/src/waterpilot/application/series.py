"""Reading a snapshot's normalized daily series (``waterpilot.series/1`` NDJSON).

Snapshots are immutable, so a parsed series is cached by snapshot id. The reader checks
the header against the snapshot before trusting any value: a series that does not match
its snapshot, or that carries a non-decimal value, is refused rather than repaired.
"""

from __future__ import annotations

import json
from collections import OrderedDict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from fractions import Fraction
from threading import Lock
from typing import Any, Protocol

from waterpilot.application.artifacts import (
    NDJSON,
    SYSTEM_OWNER,
    ArtifactKey,
    ArtifactKind,
    ArtifactStore,
)
from waterpilot.domain.baseline import DailySeries
from waterpilot.domain.sources import SourceSnapshot

SCHEMA = "waterpilot.series/1"


class SeriesUnreadable(Exception):
    """The stored series is missing or does not match its snapshot."""


@dataclass(frozen=True, slots=True)
class SeriesColumn:
    name: str
    unit: str
    normalized: bool
    series: DailySeries


@dataclass(frozen=True, slots=True)
class SnapshotSeries:
    snapshot_id: str
    timezone: str
    columns: dict[str, SeriesColumn]


class SeriesReader(Protocol):
    def read(self, snapshot: SourceSnapshot) -> SnapshotSeries: ...


def series_key(snapshot_id: str) -> ArtifactKey:
    return ArtifactKey(ArtifactKind.SOURCE, SYSTEM_OWNER, snapshot_id, "series.ndjson")


def _fraction(value: Any, where: str) -> Fraction | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise SeriesUnreadable(f"{where}: values must be decimal strings")
    try:
        number = Decimal(value)
    except InvalidOperation:
        raise SeriesUnreadable(f"{where}: {value!r} is not a decimal") from None
    if not number.is_finite():
        raise SeriesUnreadable(f"{where}: {value!r} is not finite")
    return Fraction(number)


def parse_series(data: bytes, snapshot: SourceSnapshot) -> SnapshotSeries:
    lines = [line for line in data.decode("utf-8").splitlines() if line.strip()]
    if not lines:
        raise SeriesUnreadable("the series file is empty")
    try:
        header = json.loads(lines[0])
        rows = [json.loads(line) for line in lines[1:]]
    except json.JSONDecodeError:
        raise SeriesUnreadable("the series file is not valid NDJSON") from None
    if header.get("schema") != SCHEMA:
        raise SeriesUnreadable("unknown series schema")
    if header.get("snapshotId") != snapshot.id:
        raise SeriesUnreadable("the series belongs to another snapshot")
    timezone = header.get("timezone")
    if timezone != snapshot.manifest.temporal_coverage.timezone:
        raise SeriesUnreadable("the series timezone does not match its snapshot")
    declared = {v.name for v in snapshot.manifest.variables}
    variables = header.get("variables") or []
    names = [v.get("name") for v in variables]
    if set(names) != declared or len(names) != len(declared):
        raise SeriesUnreadable("the series variables do not match the snapshot")

    dated: list[tuple[date, dict[str, Any]]] = []
    for n, row in enumerate(rows, start=2):
        try:
            day = date.fromisoformat(row["date"])
        except (KeyError, TypeError, ValueError):
            raise SeriesUnreadable(f"line {n}: missing or malformed date") from None
        if dated and day <= dated[-1][0]:
            raise SeriesUnreadable(f"line {n}: dates must increase")
        row_values = row.get("values")
        if not isinstance(row_values, dict):
            raise SeriesUnreadable(f"line {n}: missing values")
        dated.append((day, row_values))
    if not dated:
        raise SeriesUnreadable("the series has no rows")
    coverage = snapshot.manifest.temporal_coverage
    if dated[0][0] < coverage.start or dated[-1][0] >= coverage.end_exclusive:
        raise SeriesUnreadable("the series has dates outside its snapshot's coverage")

    # The series spans the declared coverage: a covered date without a row is missing.
    start = coverage.start
    length = (coverage.end_exclusive - start).days
    columns: dict[str, SeriesColumn] = {}
    for spec in variables:
        name = spec["name"]
        cells: list[Fraction | None] = [None] * length  # dates without a row are missing
        for day, cell_values in dated:
            cells[(day - start).days] = _fraction(cell_values.get(name), f"{day} {name}")
        columns[name] = SeriesColumn(
            name=name,
            unit=str(spec.get("unit")),
            normalized=bool(spec.get("normalized")),
            series=DailySeries(start, tuple(cells)),
        )
    return SnapshotSeries(snapshot.id, timezone, columns)


class ArtifactSeriesReader:
    """Reads ``sources/system/<snapshot>/series.ndjson`` and caches parsed series."""

    def __init__(self, artifacts: ArtifactStore, *, cache_size: int = 32) -> None:
        self._artifacts = artifacts
        self._cache: OrderedDict[str, SnapshotSeries] = OrderedDict()
        self._size = cache_size
        self._lock = Lock()

    def read(self, snapshot: SourceSnapshot) -> SnapshotSeries:
        with self._lock:
            hit = self._cache.get(snapshot.id)
            if hit is not None:
                self._cache.move_to_end(snapshot.id)
                return hit
        try:
            data = self._artifacts.read_owned(str(series_key(snapshot.id)), SYSTEM_OWNER, NDJSON)
        except Exception as err:  # missing object or storage outage: refuse, never guess
            reason = type(err).__name__
            raise SeriesUnreadable(f"the stored series could not be read ({reason})") from None
        parsed = parse_series(data, snapshot)
        with self._lock:
            self._cache[snapshot.id] = parsed
            while len(self._cache) > self._size:
                self._cache.popitem(last=False)
        return parsed
