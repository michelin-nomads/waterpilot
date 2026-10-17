"""Geohash candidate cells and great-circle distance used by nearby discovery."""

from __future__ import annotations

import math
import random

import pytest

from waterpilot.domain import geo


def test_encode_matches_the_reference_geohash() -> None:
    assert geo.encode(57.64911, 10.40744, 11) == "u4pruydqqvj"
    assert geo.encode(0.0, 0.0) == "s00000000"
    assert len(geo.encode(-33.86, 151.21)) == geo.STORED_PRECISION


def test_cell_sizes_halve_with_each_bit() -> None:
    assert geo.cell_size_degrees(1) == (45.0, 45.0)
    height, width = geo.cell_size_degrees(9)
    assert math.isclose(height * 2**22, 180.0) and math.isclose(width * 2**23, 360.0)


def test_distance_uses_the_mean_earth_radius() -> None:
    one_degree = 2 * math.pi * geo.EARTH_RADIUS_M / 360
    assert math.isclose(geo.distance_m(0, 0, 1, 0), one_degree, rel_tol=1e-9)
    assert math.isclose(geo.distance_m(0, 179.999, 0, -179.999), one_degree * 0.002, rel_tol=1e-6)
    assert geo.distance_m(12.5, 77.6, 12.5, 77.6) == 0.0


@pytest.mark.parametrize(
    ("lat", "lon"),
    [
        (0.0, 0.0),
        (12.97, 77.59),
        (-33.86, 151.21),
        (64.1, -21.9),
        (0.5, 179.99),
        (-0.5, -179.99),
        (80.0, 30.0),
        (89.7, 10.0),
        (-89.95, -120.0),
    ],
)
@pytest.mark.parametrize("radius", [geo.MIN_RADIUS_M, 2_500, geo.MAX_RADIUS_M])
def test_covering_cells_contain_every_point_inside_the_circle(
    lat: float, lon: float, radius: int
) -> None:
    rng = random.Random(f"{lat},{lon},{radius}")
    cells = geo.covering_cells(lat, lon, radius)
    assert len(cells) <= 3 * 8
    for _ in range(400):
        bearing = rng.uniform(0, 2 * math.pi)
        reach = radius * math.sqrt(rng.random()) / geo.EARTH_RADIUS_M
        phi1, lmb1 = math.radians(lat), math.radians(lon)
        phi2 = math.asin(
            math.sin(phi1) * math.cos(reach) + math.cos(phi1) * math.sin(reach) * math.cos(bearing)
        )
        lmb2 = lmb1 + math.atan2(
            math.sin(bearing) * math.sin(reach) * math.cos(phi1),
            math.cos(reach) - math.sin(phi1) * math.sin(phi2),
        )
        point_lat = math.degrees(phi2)
        point_lon = (math.degrees(lmb2) + 540.0) % 360.0 - 180.0
        stored = geo.encode(point_lat, point_lon)
        assert any(stored.startswith(cell) for cell in cells), (point_lat, point_lon)


def test_out_of_range_points_are_rejected() -> None:
    with pytest.raises(ValueError):
        geo.encode(91, 0)
    with pytest.raises(ValueError):
        geo.parse_point("0", "180.5")
    assert geo.parse_point("12.5", "-7.25") == (12.5, -7.25)
