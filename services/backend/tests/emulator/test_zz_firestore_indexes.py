"""Every query the Firestore adapter ran in this emulator session has an index.

The emulator does not enforce indexes, so a missing composite index would only fail in
a real project. The adapter records each query shape it executes; this module (named
to run after the parity and store suites) checks them against
``infra/firebase/firestore.indexes.json``, and that queried fields are not exempted.
Run as part of ``npm run test:emulator``; alone it has nothing to check.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from waterpilot.adapters.store_firestore import QueryShape, observed_query_shapes

pytestmark = pytest.mark.emulator

INDEXES = Path(__file__).resolve().parents[4] / "infra" / "firebase" / "firestore.indexes.json"
MIN_SHAPES = 15


def _config() -> dict[str, list[dict[str, object]]]:
    data: dict[str, list[dict[str, object]]] = json.loads(INDEXES.read_text(encoding="utf-8"))
    return data


def _covered(shape: QueryShape, indexes: list[dict[str, object]]) -> bool:
    if not shape.equality:
        return True  # a single-field index (automatic) serves one ordered field
    wanted = [{"fieldPath": f, "order": "ASCENDING"} for f in shape.equality]
    wanted.append({"fieldPath": shape.order, "order": shape.direction})
    return any(
        index["collectionGroup"] == shape.collection and index["fields"] == wanted
        for index in indexes
    )


def test_every_observed_query_shape_has_a_composite_index() -> None:
    if len(observed_query_shapes) < MIN_SHAPES:
        pytest.skip("run with the whole emulator suite (npm run test:emulator)")
    indexes = _config()["indexes"]
    missing = sorted(
        (s.collection, s.equality, s.order)
        for s in observed_query_shapes
        if not _covered(s, indexes)
    )
    assert missing == []


def test_queried_fields_are_not_exempt_from_indexing() -> None:
    exempt = {
        (o["collectionGroup"], o["fieldPath"])
        for o in _config()["fieldOverrides"]
        if o.get("indexes") == []
    }
    queried = {(s.collection, f) for s in observed_query_shapes for f in (*s.equality, s.order)}
    assert queried & exempt == set()
