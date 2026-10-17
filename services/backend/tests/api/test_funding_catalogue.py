"""Compact importer lifecycle and admin boundary checks."""

import base64
import hashlib
from pathlib import Path

import pytest
from tests.api.test_graphql_behaviour import MATCH, ready_session
from tests.conftest import LoadSettings
from tests.graphql_harness import make_harness
from tests.test_config import LOCAL_OK

from waterpilot.adapters.catalogue_synthetic import SYNTHETIC_SCHEME_ID
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.funding import FundingScheme
from waterpilot.domain.ids import IdKind, new_id

PATH = "/v1/admin/funding-catalogue"
HEADERS = {"authorization": "Bearer t-alice"}


def test_import_status_and_match_invalidation(load_settings: LoadSettings, tmp_path: Path) -> None:
    settings = load_settings(LOCAL_OK)
    settings.funding_admin_uids = ["alice"]
    h = make_harness(settings, tmp_path)
    original = h.store.funding_schemes.get(SYNTHETIC_SCHEME_ID)
    scheme = original.model_dump(mode="json")
    session = ready_session(h, "t-alice")
    variables = {
        "input": {
            "sessionId": session["id"],
            "planOptionId": session["optionId"],
            "idempotencyKey": "catalogue-match-key-0001",
        }
    }
    assert len(h.gql(MATCH, variables, "t-alice")["data"]["matchFunding"]["matches"]) == 1
    scheme.update(
        summary="Reviewed synthetic fixture",
        permission_note="Own test fixture",
        publisher_extra={"note": "preserve me"},
    )
    raw = b'{"synthetic":true}'
    body = {
        "scheme": scheme,
        "expected_revision": 1,
        "human_reviewed": True,
        "source_document_base64": base64.b64encode(raw).decode(),
    }
    saved = h.client.post(PATH, headers=HEADERS, json=body)
    assert saved.status_code == 200, saved.text
    data = saved.json()
    assert data["revision"] == 2
    assert data["source_hash"] == hashlib.sha256(raw).hexdigest()
    assert data["unknown_metadata"]["publisher_extra"]["note"] == "preserve me"
    assert h.gql(MATCH, variables, "t-alice")["data"]["matchFunding"]["matches"] == []
    assert h.client.post(PATH, headers=HEADERS, json=body).status_code == 409
    data.update(status="active", evidence="validated", official_source=True)
    assert (
        h.client.post(
            PATH,
            headers=HEADERS,
            json={"scheme": data, "expected_revision": 2, "human_reviewed": True},
        ).status_code
        == 422
    )
    data.update(status="demo", evidence="synthetic", deadline_at="2026-10-09T00:00:00Z")
    expired = h.client.post(PATH, headers=HEADERS, json={"scheme": data, "expected_revision": 2})
    assert expired.status_code == 200, expired.text
    assert expired.json()["status"] == "expired"
    assert h.client.get(PATH, headers=HEADERS).json()[0]["status"] == "expired"
    data = expired.json()
    data.update(status="withdrawn", source_url="https://127.0.0.1/private")
    assert (
        h.client.post(
            PATH, headers=HEADERS, json={"scheme": data, "expected_revision": 3}
        ).status_code
        == 422
    )
    data["source_url"] = original.source_url
    withdrawn = h.client.post(PATH, headers=HEADERS, json={"scheme": data, "expected_revision": 3})
    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "withdrawn"
    real = original.model_dump(mode="json")
    real.update(
        id=new_id(IdKind.FUNDING_SCHEME),
        name="Official test fixture",
        status="active",
        evidence="validated",
        official_source=True,
        source_url="https://publisher.gov/scheme",
        permission_note="Test-only permitted fixture",
        deadline_timezone="UTC",
    )
    result = h.client.post(
        PATH,
        headers=HEADERS,
        json={
            "scheme": real,
            "expected_revision": 0,
            "human_reviewed": True,
            "source_document_base64": base64.b64encode(raw).decode(),
        },
    )
    assert result.status_code == 200, result.text
    assert result.json()["max_amount"] == real["max_amount"]
    assert h.services is not None
    verified_id = result.json()["id"]
    assert h.services.funding.scheme(verified_id).has_verified_source

    unverified_active = dict(real)
    unverified_active.update(
        id=new_id(IdKind.FUNDING_SCHEME),
        name="Unverified direct Firestore record",
        source_hash=hashlib.sha256(raw).hexdigest(),
        source_document_key=None,
        reviewed_by="alice",
    )
    h.store.funding_schemes.add(FundingScheme.model_validate(unverified_active))
    with pytest.raises(DomainError) as denied:
        h.services.funding.scheme(unverified_active["id"])
    assert denied.value.code is ErrorCode.NOT_FOUND


def test_funding_admin_authorization(load_settings: LoadSettings, tmp_path: Path) -> None:
    settings = load_settings(LOCAL_OK)
    settings.funding_admin_uids = ["alice"]
    h = make_harness(settings, tmp_path)
    for token, expected in [(None, 401), ("t-bob", 403), ("t-guest", 403)]:
        headers = {"authorization": f"Bearer {token}"} if token else {}
        assert h.client.get(PATH, headers=headers).status_code == expected
        assert h.client.post(PATH, headers=headers, json={}).status_code == expected
    assert h.client.get(PATH, headers=HEADERS).status_code == 200
    settings.funding_admin_uids = []
    closed = make_harness(settings, tmp_path / "closed")
    assert closed.client.get(PATH, headers=HEADERS).status_code == 403
