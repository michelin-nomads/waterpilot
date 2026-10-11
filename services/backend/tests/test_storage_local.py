"""Local object storage: create-only objects, size-checked reads, traversal safety."""

from __future__ import annotations

from pathlib import Path

import pytest

from waterlens.adapters.storage_local import LocalObjectStorage, StorageKeyError
from waterlens.application.ports import (
    ObjectConflictError,
    ObjectNotFoundError,
    ObjectTooLargeError,
)

JSON = "application/json"


def test_put_get_exists_roundtrip(tmp_path: Path) -> None:
    store = LocalObjectStorage(tmp_path)
    assert store.exists("a/b.txt") is False
    store.put("a/b.txt", b"hello", content_type=JSON)
    assert store.exists("a/b.txt") is True
    assert store.get("a/b.txt", max_bytes=5) == b"hello"


def test_objects_are_create_only(tmp_path: Path) -> None:
    store = LocalObjectStorage(tmp_path / "objects")
    store.put("k", b"same", content_type=JSON)
    store.put("k", b"same", content_type=JSON)  # a retried identical write is a no-op
    with pytest.raises(ObjectConflictError):
        store.put("k", b"different", content_type=JSON)
    assert store.get("k", max_bytes=100) == b"same"
    assert [p.name for p in (tmp_path / "objects").iterdir()] == ["k"]  # no temporary files left


def test_reads_check_size_and_existence(tmp_path: Path) -> None:
    store = LocalObjectStorage(tmp_path)
    store.put("big", b"x" * 10, content_type=JSON)
    with pytest.raises(ObjectTooLargeError):
        store.get("big", max_bytes=9)
    with pytest.raises(ObjectNotFoundError):
        store.get("missing", max_bytes=9)


def test_rejects_traversal(tmp_path: Path) -> None:
    store = LocalObjectStorage(tmp_path)
    with pytest.raises(StorageKeyError):
        store.put("../escape.txt", b"nope", content_type=JSON)
    with pytest.raises(StorageKeyError):
        store.get("/abs.txt", max_bytes=1)
    with pytest.raises(StorageKeyError):
        store.exists(".")
