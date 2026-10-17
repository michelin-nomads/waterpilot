"""The ``Store`` contract against the in-memory adapter (the Firestore adapter runs the
same contract in ``tests/emulator/test_firestore_store.py``)."""

from __future__ import annotations

import pytest

from store_contract import StoreContract
from waterpilot.adapters.catalogue_synthetic import (
    synthetic_area_catalogue,
    synthetic_funding_catalogue,
)
from waterpilot.adapters.store_memory import MemoryStore


@pytest.fixture
def store() -> MemoryStore:
    return MemoryStore(
        areas=synthetic_area_catalogue(), funding_schemes=synthetic_funding_catalogue()
    )


class TestMemoryStore(StoreContract):
    pass
