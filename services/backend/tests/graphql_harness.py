"""Test harness: an app wired to an in-memory store and a fake token verifier.

``FakeVerifier`` maps fixed test tokens to principals. It exists only in tests; the
app derives identity from whatever verifier its runtime provides, so these tests
exercise the same code path as emulator or production verification.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from waterpilot.adapters.catalogue_synthetic import (
    SYNTHETIC_AREA_ID,
    synthetic_area_catalogue,
    synthetic_funding_catalogue,
)
from waterpilot.adapters.factory import ApiRuntime, build_place_search
from waterpilot.adapters.jobqueue_memory import MemoryJobQueue
from waterpilot.adapters.storage_local import LocalObjectStorage
from waterpilot.adapters.store_memory import MemoryStore
from waterpilot.api.main import create_app
from waterpilot.application.artifacts import ArtifactStore
from waterpilot.application.identity import AccountKind, IdentityVerifier, Principal
from waterpilot.application.repositories import Store
from waterpilot.application.series import ArtifactSeriesReader
from waterpilot.application.services import Deps, Services
from waterpilot.application.services.common import AiConfig
from waterpilot.config import Settings
from waterpilot.domain.accounts import ClaimPolicy
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.ids import IdKind, new_id
from waterpilot.domain.impact import ConnectivityEvidence
from waterpilot.domain.planning import DayRange, Feasibility, ImpactAssessment, PlanOption
from waterpilot.domain.values import EvidenceQuality, MeasuredValue, Money, MoneyRange, Provenance

NOW = datetime(2026, 10, 10, 6, 0, tzinfo=UTC)

STALE_SIGN_IN = NOW - timedelta(hours=2)

TOKENS: dict[str, Principal] = {
    "t-guest": Principal("guest-1", AccountKind.GUEST, "anonymous", NOW),
    "t-guest2": Principal("guest-2", AccountKind.GUEST, "anonymous", NOW),
    "t-alice": Principal("alice", AccountKind.PERMANENT, "google.com", NOW),
    "t-alice-stale": Principal("alice", AccountKind.PERMANENT, "google.com", STALE_SIGN_IN),
    "t-bob": Principal("bob", AccountKind.PERMANENT, "password", NOW),
    "t-carol": Principal("carol", AccountKind.PERMANENT, "google.com", NOW),
}


class FakeVerifier:
    def verify(self, token: str) -> Principal:
        try:
            return TOKENS[token]
        except KeyError:
            raise DomainError(ErrorCode.UNAUTHENTICATED, "invalid token") from None


@dataclass
class Harness:
    client: TestClient
    store: Any  # MemoryStore, or FirestoreStore in the emulator parity suite
    jobs: MemoryJobQueue
    storage: LocalObjectStorage
    services: Services | None = None

    def gql(
        self, query: str, variables: dict[str, Any] | None = None, token: str | None = None
    ) -> dict[str, Any]:
        headers = {"authorization": f"Bearer {token}"} if token else {}
        resp = self.client.post(
            "/graphql", json={"query": query, "variables": variables or {}}, headers=headers
        )
        assert resp.status_code == 200, resp.text
        body: dict[str, Any] = resp.json()
        return body


def make_harness(
    settings: Settings,
    tmp_path: Path,
    *,
    clock: Callable[[], datetime] = lambda: NOW,
    verifier: IdentityVerifier | None = None,
    claim_policy: ClaimPolicy | None = None,
    store: Store | None = None,
    connectivity: tuple[ConnectivityEvidence, ...] = (),
    ai: AiConfig | None = None,
) -> Harness:
    store = store or MemoryStore(
        areas=synthetic_area_catalogue(), funding_schemes=synthetic_funding_catalogue()
    )
    jobs = MemoryJobQueue()
    storage = LocalObjectStorage(tmp_path / "artifacts")
    artifacts = ArtifactStore(storage)
    services = Services.build(
        Deps(
            store=store,
            clock=clock,
            jobs=jobs,
            claim_policy=claim_policy or ClaimPolicy(),
            places=build_place_search(settings),
            series=ArtifactSeriesReader(artifacts),
            connectivity=connectivity,
            ai=ai or AiConfig(),
        )
    )
    runtime = ApiRuntime(
        services=services,
        verifier=verifier or FakeVerifier(),
        artifacts=artifacts,
    )
    app = create_app(settings, runtime=lambda: runtime, stream_poll_seconds=0.01)
    return Harness(TestClient(app), store, jobs, storage, services)


def seed_plan_option(
    store: Any,
    session_id: str,
    cost_high_paise: int,
    intervention_ids: tuple[str, ...] = (),
) -> str:
    """Insert a stored option without a comparison id, as options were stored before the
    option engine (ADR 0012); it is selectable under the inputs-revision rule."""
    session = store.sessions.get(session_id)
    option = PlanOption(
        id=new_id(IdKind.PLAN_OPTION),
        session_id=session_id,
        inputs_revision=session.inputs_revision,
        name="Rooftop harvesting",
        summary="Synthetic option for tests.",
        cost=MoneyRange(
            low=Money.from_inr_paise(cost_high_paise // 2),
            high=Money.from_inr_paise(cost_high_paise),
        ),
        build_days=DayRange(low=30, high=60),
        feasibility=Feasibility.FEASIBLE,
        cost_basis_date=date(2026, 1, 1),
        intervention_ids=intervention_ids,
        impact=ImpactAssessment(
            id=new_id(IdKind.IMPACT),
            metrics=(),
            neighbour_effect=MeasuredValue.unavailable("No shared-aquifer model for this area."),
            provenance=Provenance(evidence=EvidenceQuality.SYNTHETIC, as_of=NOW),
        ),
    )
    store.plan_options.add(option)
    return option.id


AREA_ID = SYNTHETIC_AREA_ID
