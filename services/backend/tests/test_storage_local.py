"""Local object storage round-trip and traversal safety."""

from __future__ import annotations

from pathlib import Path

import pytest

from waterlens.adapters.storage_local import LocalObjectStorage, StorageKeyError


def test_put_get_exists_roundtrip(tmp_path: Path) -> None:
    store = LocalObjectStorage(tmp_path)
    assert store.exists("a/b.txt") is False
    store.put("a/b.txt", b"hello")
    assert store.exists("a/b.txt") is True
    assert store.get("a/b.txt") == b"hello"


def test_rejects_traversal(tmp_path: Path) -> None:
    store = LocalObjectStorage(tmp_path)
    with pytest.raises(StorageKeyError):
        store.put("../escape.txt", b"nope")
    with pytest.raises(StorageKeyError):
        store.get("/abs.txt")
