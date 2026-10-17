"""Deadline guarantees apply to RPC begin/read/commit and retry backoff."""

import time
from types import SimpleNamespace

import pytest
from google.api_core import exceptions as gexc

from waterpilot.adapters.conversation_firestore import FirestoreConversationStore
from waterpilot.application.deadline import DeadlineRpc, bounded
from waterpilot.domain.errors import DomainError


def test_all_rpc_calls_receive_remaining_deadline_and_no_hidden_sdk_retries():
    calls = []
    rpc = DeadlineRpc(SimpleNamespace(commit=lambda **kwargs: calls.append(kwargs)))
    with bounded(0.2):
        rpc.commit(request={"writes": []}, retry="sdk-default", timeout=60)
        assert 0 < calls[0]["timeout"] <= 0.2
        assert calls[0]["retry"] is None
    with bounded(0), pytest.raises(DomainError):
        rpc.commit(request={})
    assert len(calls) == 1


def test_firestore_contention_backoff_stops_at_deadline():
    calls = []
    client = SimpleNamespace(
        _firestore_api=SimpleNamespace(), transaction=lambda **kwargs: calls.append(kwargs)
    )
    store = FirestoreConversationStore(client)

    def conflict(_tx):
        raise gexc.Aborted("test contention")

    started = time.monotonic()
    with bounded(0.02), pytest.raises(DomainError):
        store._run(conflict)
    assert time.monotonic() - started < 0.1
    assert calls and all(c["max_attempts"] == 1 for c in calls)
