"""Geohash candidates and great-circle distance for nearby discovery (ADR 0005).

A geohash prefix range is a cheap indexed *candidate* filter; it is never the answer.
Callers always apply the exact distance check, deduplicate and sort. Distance here is a
discovery filter (how far a community's reference point is), not a water metric, so a
float great-circle calculation is appropriate.
"""

from __future__ import annotations

import math
from decimal import Decimal

_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"
EARTH_RADIUS_M = 6_371_008.8
STORED_PRECISION = 9
"""Geohash length stored on records (cells of about 4.8 m x 4.8 m)."""
_METERS_PER_DEGREE_LAT = 111_320.0
MIN_RADIUS_M = 100
MAX_RADIUS_M = 50_000


def _check(lat: float, lon: float) -> None:
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        raise ValueError("latitude must be within [-90, 90] and longitude within [-180, 180]")


def encode(lat: float, lon: float, precision: int = STORED_PRECISION) -> str:
    _check(lat, lon)
    lat_lo, lat_hi, lon_lo, lon_hi = -90.0, 90.0, -180.0, 180.0
    chars: list[str] = []
    bits, value, even = 0, 0, True
    while len(chars) < precision:
        if even:
            mid = (lon_lo + lon_hi) / 2
            value = value * 2 + (lon >= mid)
            lon_lo, lon_hi = (mid, lon_hi) if lon >= mid else (lon_lo, mid)
        else:
            mid = (lat_lo + lat_hi) / 2
            value = value * 2 + (lat >= mid)
            lat_lo, lat_hi = (mid, lat_hi) if lat >= mid else (lat_lo, mid)
        even = not even
        bits += 1
        if bits == 5:
            chars.append(_BASE32[value])
            bits, value = 0, 0
    return "".join(chars)


def cell_size_degrees(precision: int) -> tuple[float, float]:
    """(height in degrees latitude, width in degrees longitude) of a cell."""
    lon_bits = math.ceil(5 * precision / 2)
    lat_bits = 5 * precision - lon_bits
    return 180.0 / 2**lat_bits, 360.0 / 2**lon_bits


def _covers(lat: float, precision: int, radius_m: float) -> bool:
    height, width = cell_size_degrees(precision)
    width_m = width * _METERS_PER_DEGREE_LAT * math.cos(math.radians(lat))
    return height * _METERS_PER_DEGREE_LAT >= radius_m and width_m >= radius_m


def precision_for_radius(lat: float, radius_m: float) -> int:
    """Longest prefix whose cells are at least ``radius_m`` tall and wide at ``lat``, so
    the 3 x 3 block around the centre cell covers the whole search circle (1 if none)."""
    best = 1
    for precision in range(1, STORED_PRECISION + 1):
        if not _covers(lat, precision, radius_m):
            break
        best = precision
    return best


def covering_cells(lat: float, lon: float, radius_m: float) -> tuple[str, ...]:
    """The centre cell and its eight neighbours (deduplicated near the antimeridian), at
    a precision chosen for the radius. Within a few tens of kilometres of a pole even
    the widest cells are too narrow (and the circle may cross the pole), so every
    longitude column of the latitude band is used instead."""
    _check(lat, lon)
    precision = precision_for_radius(lat, radius_m)
    height, width = cell_size_degrees(precision)
    if _covers(lat, precision, radius_m):
        lons = [lon - width, lon, lon + width]
    else:
        lons = [-180.0 + width * (i + 0.5) for i in range(round(360.0 / width))]
    cells: dict[str, None] = {}
    for dlat in (-height, 0.0, height):
        for cell_lon in lons:
            cell_lat = min(max(lat + dlat, -90.0), 90.0)
            cells[encode(cell_lat, ((cell_lon + 180.0) % 360.0) - 180.0, precision)] = None
    return tuple(cells)


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine great-circle distance in metres."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi, dlmb = phi2 - phi1, math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def parse_point(lat: str | Decimal, lon: str | Decimal) -> tuple[float, float]:
    point = float(Decimal(lat)), float(Decimal(lon))
    _check(*point)
    return point
