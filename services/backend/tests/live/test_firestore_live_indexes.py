"""Live-only: a real Firestore project serves every declared query shape.

The emulator never enforces composite indexes, so this is the only check that the
indexes in ``infra/firebase/firestore.indexes.json`` are deployed and match the adapter's
queries. It is opt-in twice over: the ``live`` marker is deselected by default, and the
tests skip unless ``WL_LIVE_FIRESTORE_PROJECT`` names a non-demo project. Each probe is a
read-only ``limit(1)`` query (at most one document read per index); nothing is written.

    WL_LIVE_FIRESTORE_PROJECT=<project> uv run pytest -m live tests/live

Credentials come from Application Default Credentials on the operator's machine; none
are read from this repository.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import pytest

from waterlens.adapters.store_firestore import pilot_client

pytestmark = pytest.mark.live

INDEXES = Path(__file__).resolve().parents[4] / "infra" / "firebase" / "firestore.indexes.json"
PROJECT = os.environ.get("WL_LIVE_FIRESTORE_PROJECT", "")


def _composite_indexes() -> list[dict[str, Any]]:
    data: dict[str, list[dict[str, Any]]] = json.loads(INDEXES.read_text(encoding="utf-8"))
    return data["indexes"]


@pytest.fixture(scope="module")
def client() -> Any:
    if not PROJECT:
        pytest.skip("set WL_LIVE_FIRESTORE_PROJECT to run live Firestore checks")
    return pilot_client(PROJECT)


@pytest.mark.parametrize(
    "index",
    _composite_indexes(),
    ids=lambda i: f"{i['collectionGroup']}:" + ",".join(f["fieldPath"] for f in i["fields"]),
)
def test_declared_index_serves_its_query(client: Any, index: dict[str, Any]) -> None:
    from google.cloud import firestore

    if any("vectorConfig" in field for field in index["fields"]):
        pytest.skip("vector retrieval requires separate authorized live verification")
    *equality, ordered = index["fields"]
    query = client.collection(index["collectionGroup"])
    for field in equality:
        query = query.where(filter=firestore.FieldFilter(field["fieldPath"], "==", "__probe__"))
    direction = (
        firestore.Query.DESCENDING
        if ordered["order"] == "DESCENDING"
        else firestore.Query.ASCENDING
    )
    list(query.order_by(ordered["fieldPath"], direction=direction).limit(1).stream())
