"""Strict parsers for imported source files (ADR 0008).

``parse_daily_csv`` reads a daily series: a ``date`` column of local calendar dates
plus one column per registered variable (its ``bandOrField`` or name). It rejects the
whole file on any defect instead of repairing it: unknown or missing columns, bad or
duplicate dates, non-numeric or out-of-range values. An empty cell is *missing*, never
zero. Values normalize exactly (``waterlens.domain.units``); a variable whose raw unit
has no reviewed conversion keeps its raw values and stays un-normalized.

``parse_geojson_footprint`` validates a Polygon/MultiPolygon footprint in EPSG:4326 and
returns its bounding box, the only footprint form readiness can check today.
"""

from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from waterlens.domain.sources import BBox, Variable
from waterlens.domain.units import CanonicalUnit, is_normalizable, normalize, render

MAX_ROWS = 20_000
MAX_PROBLEMS = 20
_SIGNED_UNITS = frozenset({CanonicalUnit.METRES_BELOW_GROUND})
"""Units where a negative value is physical (water above ground level)."""


class ParseRejected(ValueError):
    def __init__(self, problems: list[str]) -> None:
        super().__init__("; ".join(problems))
        self.problems = tuple(problems[:MAX_PROBLEMS])


@dataclass(frozen=True, slots=True)
class ParsedColumn:
    variable: Variable
    normalized_unit: CanonicalUnit | None
    """Set only when the raw unit has a reviewed conversion to the declared unit."""


@dataclass(slots=True)
class ParsedSeries:
    columns: tuple[ParsedColumn, ...]
    rows: list[tuple[date, dict[str, str | None]]] = field(default_factory=list)
    missing_values: int = 0
    missing_dates: int = 0

    @property
    def first(self) -> date:
        return self.rows[0][0]

    @property
    def last(self) -> date:
        return self.rows[-1][0]


def _column_name(variable: Variable) -> str:
    return variable.band_or_field or variable.name


def _decode(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ParseRejected(["the file is not UTF-8 text"]) from None


def _columns(variables: tuple[Variable, ...]) -> tuple[ParsedColumn, ...]:
    out = []
    for v in variables:
        unit = v.normalized_unit
        ok = unit is not None and is_normalizable(v.raw_unit, unit)
        out.append(ParsedColumn(v, unit if ok else None))
    return tuple(out)


def _value(raw: str, column: ParsedColumn, where: str, problems: list[str]) -> str | None:
    text = raw.strip()
    if text == "":
        return None
    unit = column.normalized_unit
    if unit is CanonicalUnit.CATEGORY:
        return text
    try:
        number = Decimal(text)
    except InvalidOperation:
        problems.append(f"{where}: {text!r} is not a number")
        return None
    if not number.is_finite():
        problems.append(f"{where}: {text!r} is not a finite number")
        return None
    if unit is None:
        return render(number)
    value = normalize(number, column.variable.raw_unit, unit)
    if value < 0 and unit not in _SIGNED_UNITS:
        problems.append(f"{where}: negative value {text}")
    if unit is CanonicalUnit.RATIO and value > 1:
        problems.append(f"{where}: ratio above 1 after normalization ({text})")
    return render(value)


def parse_daily_csv(data: bytes, variables: tuple[Variable, ...]) -> ParsedSeries:
    reader = csv.reader(io.StringIO(_decode(data)))
    header = [h.strip() for h in next(reader, [])]
    columns = _columns(variables)
    wanted = {_column_name(c.variable): c for c in columns}
    problems: list[str] = []
    if "date" not in header:
        problems.append("missing the 'date' column")
    if missing := sorted(set(wanted) - set(header)):
        problems.append("missing columns: " + ", ".join(missing))
    if unknown := sorted(set(header) - set(wanted) - {"date"}):
        problems.append("columns not in the registration: " + ", ".join(unknown))
    if len(set(header)) != len(header):
        problems.append("a column name repeats")
    if problems:
        raise ParseRejected(problems)

    index = {name: header.index(name) for name in (*wanted, "date")}
    series = ParsedSeries(columns)
    seen: set[date] = set()
    for line, row in enumerate(reader, start=2):
        if not any(cell.strip() for cell in row):
            continue
        if len(series.rows) >= MAX_ROWS:
            raise ParseRejected([f"more than {MAX_ROWS} rows"])
        if len(row) != len(header):
            problems.append(f"line {line}: expected {len(header)} cells, found {len(row)}")
            continue
        try:
            day = date.fromisoformat(row[index["date"]].strip())
        except ValueError:
            problems.append(f"line {line}: date must be YYYY-MM-DD")
            continue
        if day in seen:
            problems.append(f"line {line}: date {day} repeats")
            continue
        seen.add(day)
        values = {
            c.variable.name: _value(row[index[name]], c, f"line {line} {name}", problems)
            for name, c in wanted.items()
        }
        series.missing_values += sum(1 for v in values.values() if v is None)
        series.rows.append((day, values))
        if len(problems) >= MAX_PROBLEMS:
            break
    if not series.rows and not problems:
        problems.append("the file has no data rows")
    if problems:
        raise ParseRejected(problems)
    series.rows.sort(key=lambda r: r[0])
    series.missing_dates = (series.last - series.first).days + 1 - len(series.rows)
    return series


def series_ndjson(snapshot_id: str, timezone: str, series: ParsedSeries) -> bytes:
    """The normalized series as NDJSON: a header line, then one line per date."""
    header = {
        "schema": "waterlens.series/1",
        "snapshotId": snapshot_id,
        "timezone": timezone,
        "variables": [
            {
                "name": c.variable.name,
                "rawUnit": c.variable.raw_unit,
                "unit": (c.normalized_unit or c.variable.raw_unit),
                "normalized": c.normalized_unit is not None,
            }
            for c in series.columns
        ],
    }
    lines = [json.dumps(header, ensure_ascii=False, separators=(",", ":"))]
    lines += [
        json.dumps({"date": d.isoformat(), "values": v}, separators=(",", ":"))
        for d, v in series.rows
    ]
    return ("\n".join(lines) + "\n").encode()


# --------------------------------------------------------------------------- geometry


def _ring(ring: Any, where: str, problems: list[str]) -> list[tuple[float, float]]:
    if not isinstance(ring, list) or len(ring) < 4:
        problems.append(f"{where}: a ring needs at least 4 positions")
        return []
    points: list[tuple[float, float]] = []
    for pos in ring:
        if (
            not isinstance(pos, list)
            or len(pos) < 2
            or not all(isinstance(c, int | float) and not isinstance(c, bool) for c in pos[:2])
        ):
            problems.append(f"{where}: positions must be [longitude, latitude] numbers")
            return []
        lon, lat = float(pos[0]), float(pos[1])
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            problems.append(f"{where}: position {pos[:2]} is outside EPSG:4326 bounds")
            return []
        points.append((lon, lat))
    if points[0] != points[-1]:
        problems.append(f"{where}: the ring is not closed")
    return points


def parse_geojson_footprint(data: bytes) -> BBox:
    try:
        doc = json.loads(_decode(data))
    except json.JSONDecodeError:
        raise ParseRejected(["the footprint is not valid JSON"]) from None
    if isinstance(doc, dict) and doc.get("type") == "Feature":
        doc = doc.get("geometry")
    if not isinstance(doc, dict) or doc.get("type") not in {"Polygon", "MultiPolygon"}:
        raise ParseRejected(["the footprint must be a GeoJSON Polygon or MultiPolygon"])
    if "crs" in doc:
        raise ParseRejected(["GeoJSON is always EPSG:4326 (RFC 7946); remove the 'crs' member"])
    polygons = [doc.get("coordinates")] if doc["type"] == "Polygon" else doc.get("coordinates")
    problems: list[str] = []
    points: list[tuple[float, float]] = []
    if not isinstance(polygons, list) or not polygons:
        raise ParseRejected(["the footprint has no coordinates"])
    for p, polygon in enumerate(polygons):
        if not isinstance(polygon, list) or not polygon:
            problems.append(f"polygon {p}: no rings")
            continue
        for r, ring in enumerate(polygon):
            ring_points = _ring(ring, f"polygon {p} ring {r}", problems)
            if r == 0:
                points += ring_points
    if problems or not points:
        raise ParseRejected(problems or ["the footprint has no positions"])
    lons, lats = [p[0] for p in points], [p[1] for p in points]
    if max(lons) - min(lons) > 180:
        raise ParseRejected(["footprints crossing the antimeridian are not supported"])
    return (min(lons), min(lats), max(lons), max(lats))
