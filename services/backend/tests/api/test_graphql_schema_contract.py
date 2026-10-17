"""The GraphQL schema contract: committed SDL, identity rules, typed errors and
mutation safety inputs are enforced structurally, not by convention."""

from __future__ import annotations

from pathlib import Path

import pytest
from graphql import (
    GraphQLEnumType,
    GraphQLInputObjectType,
    GraphQLNonNull,
    GraphQLObjectType,
    build_schema,
)

from waterlens.api.graphql.schema import build_schema as build_app_schema
from waterlens.api.graphql.schema import schema_sdl

REPO_ROOT = Path(__file__).resolve().parents[4]
COMMITTED_SDL = REPO_ROOT / "packages" / "contracts" / "schema.graphql"

REQUIRED_TYPES = {
    "Area",
    "Coverage",
    "PlanningSession",
    "Goal",
    "Scenario",
    "PlanOption",
    "ImpactAssessment",
    "FundingScheme",
    "FundingMatch",
    "Report",
    "Proposal",
    "Community",
    "Membership",
    "ImplementationProject",
    "Milestone",
    "Observation",
    "Job",
    "AgentRun",
    "AreaReadiness",
    "ManualInput",
}

CREATES = {
    "createPlanningSession",
    "matchFunding",
    "finalizeReport",
    "generateProposal",
    "createCommunity",
    "joinCommunity",
    "startImplementationProject",
    "recordObservation",
    "recordManualInput",
    "confirmLocation",
    "completeAccountClaim",
}
VERSIONED = {
    "updatePlanningSession",
    "archiveReport",
    "leaveCommunity",
    "archiveCommunity",
    "updateMilestone",
    "cancelAccountClaim",
    "updateProjectStatus",
    "addProjectExpense",
}
# Returns a one-time secret, so a replay must not return the original result; a retry
# issues a fresh claim and cancels the previous one. Takes no client input at all.
ONE_TIME = {"beginAccountClaim"}
IDENTITY_FIELD_NAMES = {"uid", "ownerUid", "ownerId", "userId", "recordedByUid", "owner"}


@pytest.fixture(scope="module")
def sdl() -> str:
    return schema_sdl()


@pytest.fixture(scope="module")
def schema(sdl: str):  # type: ignore[no-untyped-def]
    return build_schema(sdl)


def test_committed_schema_matches_generated(sdl: str) -> None:
    assert COMMITTED_SDL.read_text(encoding="utf-8") == sdl, (
        "packages/contracts/schema.graphql is stale; run `npm run contracts`"
    )


def test_required_domain_types_exist(schema) -> None:  # type: ignore[no-untyped-def]
    missing = REQUIRED_TYPES - set(schema.type_map)
    assert not missing


def test_no_input_accepts_a_client_identity(schema) -> None:  # type: ignore[no-untyped-def]
    for name, gql_type in schema.type_map.items():
        if isinstance(gql_type, GraphQLInputObjectType):
            assert not IDENTITY_FIELD_NAMES & set(gql_type.fields), name
    for field_name, field in schema.mutation_type.fields.items():
        assert not IDENTITY_FIELD_NAMES & set(field.args), field_name
    for field_name, field in schema.query_type.fields.items():
        assert not IDENTITY_FIELD_NAMES & set(field.args), field_name


def test_records_never_expose_owner_identity(schema) -> None:  # type: ignore[no-untyped-def]
    for name, gql_type in schema.type_map.items():
        if isinstance(gql_type, GraphQLObjectType) and name != "Viewer":
            assert not IDENTITY_FIELD_NAMES & set(gql_type.fields), name


def test_every_mutation_returns_a_typed_error(schema) -> None:  # type: ignore[no-untyped-def]
    for name, field in schema.mutation_type.fields.items():
        payload = field.type.of_type if isinstance(field.type, GraphQLNonNull) else field.type
        assert isinstance(payload, GraphQLObjectType), name
        assert str(payload.fields["error"].type) == "MutationError", name
    error_type = schema.type_map["MutationError"]
    assert str(error_type.fields["code"].type) == "ErrorCode!"
    assert isinstance(schema.type_map["ErrorCode"], GraphQLEnumType)


def _input_fields(schema, mutation: str) -> dict[str, str]:  # type: ignore[no-untyped-def]
    arg = schema.mutation_type.fields[mutation].args["input"]
    input_type = arg.type.of_type
    return {k: str(v.type) for k, v in input_type.fields.items()}


@pytest.mark.parametrize("mutation", sorted(CREATES))
def test_creates_require_an_idempotency_key(schema, mutation: str) -> None:  # type: ignore[no-untyped-def]
    assert _input_fields(schema, mutation).get("idempotencyKey") == "String!"


@pytest.mark.parametrize("mutation", sorted(VERSIONED))
def test_updates_require_expected_version(schema, mutation: str) -> None:  # type: ignore[no-untyped-def]
    assert _input_fields(schema, mutation).get("expectedVersion") == "Int!"


def test_every_mutation_is_classified(schema) -> None:  # type: ignore[no-untyped-def]
    assert set(schema.mutation_type.fields) == CREATES | VERSIONED | ONE_TIME


@pytest.mark.parametrize("mutation", sorted(ONE_TIME))
def test_one_time_mutations_take_no_client_input(schema, mutation: str) -> None:  # type: ignore[no-untyped-def]
    assert not schema.mutation_type.fields[mutation].args


def test_exact_numbers_only(sdl: str, schema) -> None:  # type: ignore[no-untyped-def]
    assert "Float" not in sdl
    units = {v for v in schema.type_map["Unit"].values}
    assert "L_PER_DAY" not in units  # enum member names come from the domain
    assert "LITRES_PER_DAY" in units
    assert not {u for u in units if "MLD" in u}
    money = schema.type_map["Money"].fields
    assert str(money["minorUnits"].type) == "MinorUnits!"
    assert str(money["currency"].type) == "String!"


def test_lists_are_bounded_connections(schema) -> None:  # type: ignore[no-untyped-def]
    for name, field in schema.query_type.fields.items():
        type_name = str(field.type).rstrip("!")
        if type_name.endswith("Connection"):
            assert {"first", "after"} <= set(field.args), name
        assert not type_name.startswith("["), f"{name} returns an unbounded list"


def test_pilot_schema_disables_introspection() -> None:
    result = build_app_schema(introspection=False).execute_sync("{ __schema { types { name } } }")
    assert result.errors
    local = build_app_schema(introspection=True).execute_sync("{ __typename }")
    assert local.errors is None
