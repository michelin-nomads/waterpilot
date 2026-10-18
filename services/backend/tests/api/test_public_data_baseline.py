"""Integration test for public environmental API & municipal water baseline data."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from conftest import LOCAL_OK, LoadSettings
from graphql_harness import Harness, make_harness
from waterpilot.domain.planning import Area, ExtentKind, GeographicScope, UnitSystem
from datetime import datetime, UTC
from waterpilot.domain.ids import IdKind, new_id
from waterpilot.domain.location import AreaOrigin, radius_bbox
from waterpilot.domain.values import EvidenceQuality

CREATE_SESSION = """
mutation($input: CreatePlanningSessionInput!) {
  createPlanningSession(input: $input) { session { id } error { code } }
}"""

BASELINE = """
query($id: ID!, $sessionId: ID) {
  area(id: $id) {
    baseline(sessionId: $sessionId) {
      id areaId sessionId asOf engineVersion exceedanceP windowDays demo basis
      window { start endExclusive days }
      missingEssentials missingOptional notes
      metrics {
        metric name formula unit availability exact value reason reasons origin daily asOf
        assumptions demo
        evidence { input title url asOf quality uncertainty note manualInputId snapshotId }
        supporting { key exact value unit }
      }
      indicators { indicator name capability availability reason reasons value unit }
      chart { monthly buckets { start endExclusive } series { key values } }
    }
  }
}"""


@pytest.fixture
def h(load_settings: LoadSettings, tmp_path: Path) -> Harness:
    return make_harness(load_settings(LOCAL_OK), tmp_path)


def test_public_environmental_data_populates_all_six_conditions(h: Harness) -> None:
    # 1. Register a real location area (e.g. HSR Layout, Bengaluru)
    real_area_id = new_id(IdKind.AREA)
    area = Area(
        id=real_area_id,
        name="HSR Layout, Bengaluru",
        country_code="IN",
        timezone="Asia/Kolkata",
        centroid_lat="12.9116",
        centroid_lon="77.6474",
        evidence=EvidenceQuality.VALIDATED,
        created_at=datetime.now(UTC),
        origin=AreaOrigin.CUSTOM,
        owner_uid="guest-1",
        extent=ExtentKind.USER_RADIUS,
        radius_m=1000,
        boundary_bbox=radius_bbox(12.9116, 77.6474, 1000),
        scope=GeographicScope.POINT,
        unit_system=UnitSystem.METRIC,
    )
    h.store.areas.add(area)

    # 2. Create planning session for this area
    create_res = h.gql(
        CREATE_SESSION,
        {
            "input": {
                "mode": "TRADITIONAL",
                "areaId": real_area_id,
                "idempotencyKey": "key-session-hsr-001",
            }
        },
        "t-guest",
    )
    assert create_res["data"]["createPlanningSession"]["error"] is None, create_res
    session_id = str(create_res["data"]["createPlanningSession"]["session"]["id"])

    # 3. Query baseline for the newly selected area with session
    body = h.gql(BASELINE, {"id": real_area_id, "sessionId": session_id}, "t-guest")
    assert "errors" not in body, body
    b = body["data"]["area"]["baseline"]

    # Verify all 6 conditions are available
    metrics = {m["metric"]: m for m in b["metrics"]}
    indicators = {i["capability"]: i for i in b["indicators"]}

    # 1. Water stress
    assert "water_stress" in metrics
    assert metrics["water_stress"]["availability"] == "AVAILABLE"
    assert metrics["water_stress"]["value"] == "0.78"
    assert metrics["water_stress"]["unit"] == "RATIO"

    # 2. Rainfall (Open-Meteo ERA5)
    assert "RAINFALL" in indicators
    assert indicators["RAINFALL"]["availability"] == "AVAILABLE"
    assert indicators["RAINFALL"]["value"] is not None
    assert indicators["RAINFALL"]["unit"] == "MILLIMETRE"
    rain_val = float(indicators["RAINFALL"]["value"])
    assert rain_val > 500  # realistic annual rainfall

    # 3. Reliable supply (78%)
    assert "dependable_supply_ratio" in metrics
    assert metrics["dependable_supply_ratio"]["availability"] in ("AVAILABLE", "PROVISIONAL")
    assert metrics["dependable_supply_ratio"]["value"] == "0.78"

    # 4. Water deficit (MLD)
    assert "deficit" in metrics
    assert metrics["deficit"]["availability"] in ("AVAILABLE", "PROVISIONAL")
    assert metrics["deficit"]["value"] is not None
    assert metrics["deficit"]["unit"] == "LITRES_PER_DAY"

    # 5. Shortage days
    assert "shortage_days" in metrics
    assert metrics["shortage_days"]["availability"] in ("AVAILABLE", "PROVISIONAL")
    assert metrics["shortage_days"]["value"] == "38"

    # 6. Groundwater level (CGWB)
    assert "GROUNDWATER_LEVEL" in indicators
    assert indicators["GROUNDWATER_LEVEL"]["availability"] == "AVAILABLE"
    assert indicators["GROUNDWATER_LEVEL"]["value"] is not None
    assert indicators["GROUNDWATER_LEVEL"]["unit"] == "METRES_BELOW_GROUND"
    gw_val = float(indicators["GROUNDWATER_LEVEL"]["value"])
    assert 10 <= gw_val <= 30  # realistic groundwater level for Deccan
