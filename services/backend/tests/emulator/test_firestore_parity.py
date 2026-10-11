"""The GraphQL behaviour suites, re-run unchanged against the **Firestore emulator**.

Every test from the listed modules that uses the ``h`` harness fixture is collected
here as well, with ``h`` built on ``FirestoreStore`` instead of the in-memory store. So
ownership, tenant isolation, archive rules, idempotency, version conflicts, claims and
pagination are proven on the real database engine, not only on the test double.
"""

from __future__ import annotations

import importlib.util
import inspect
import sys
from pathlib import Path
from types import ModuleType

import pytest
from firestore_support import new_firestore_store

from conftest import LOCAL_OK, LoadSettings
from graphql_harness import Harness, make_harness

pytestmark = pytest.mark.emulator

_API_TESTS = Path(__file__).resolve().parents[1] / "api"
SUITES = ("test_graphql_behaviour", "test_account_claims", "test_nearby_communities")


def _load(name: str) -> ModuleType:
    module_name = f"firestore_parity_{name}"
    spec = importlib.util.spec_from_file_location(module_name, _API_TESTS / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


_claims = _load("test_account_claims")
Clock = _claims.Clock
ClockVerifier = _claims.ClockVerifier

for _suite in SUITES:
    _module = _claims if _suite == "test_account_claims" else _load(_suite)
    for _name, _fn in vars(_module).items():
        if _name.startswith("test_") and "h" in inspect.signature(_fn).parameters:
            globals()[f"{_name}__{_suite.removeprefix('test_')}"] = _fn


@pytest.fixture
def clock() -> object:
    return Clock()


@pytest.fixture
def h(
    load_settings: LoadSettings,
    tmp_path: Path,
    clock: object,
    monkeypatch: pytest.MonkeyPatch,
) -> Harness:
    return make_harness(
        load_settings(LOCAL_OK),
        tmp_path,
        clock=clock,  # type: ignore[arg-type]
        verifier=ClockVerifier(clock),
        store=new_firestore_store(monkeypatch),
    )
