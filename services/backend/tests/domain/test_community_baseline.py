from decimal import Decimal

import pytest
from pydantic import ValidationError

from waterpilot.domain.community_baseline import CommunityBaseline, WaterSource


@pytest.mark.parametrize(
    ("method", "quantity", "multiplier", "days", "expected"),
    [
        ("daily_average", "123.45", "1", 1, "123.45"),
        ("volume_over_period", "7000", "1", 7, "1000"),
        ("tanker_deliveries", "10000", "5", 2, "25000"),
        ("pump_runtime", "1250", "5", 1, "6250"),
    ],
)
def test_supply_methods(
    method: str, quantity: str, multiplier: str, days: int, expected: str
) -> None:
    source = WaterSource(
        name="Source",
        kind="other",
        method=method,
        quantity=quantity,
        multiplier=multiplier,
        period_days=days,
        source="Owner record",
    )
    assert source.daily_litres() == Decimal(expected)


def test_unknown_is_not_zero_and_complete_requires_every_quantity() -> None:
    details = {
        "area_id": "area",
        "as_of": "2026-09-01",
        "sources": [{"name": "Borewell", "kind": "groundwater", "source": "No meter record"}],
    }
    assert CommunityBaseline.model_validate(details).supply_total() is None
    with pytest.raises(ValidationError):
        CommunityBaseline.model_validate({**details, "supply_complete": True})
