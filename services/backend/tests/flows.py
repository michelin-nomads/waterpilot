"""GraphQL operations shared by the in-process tests and the Auth-emulator tests.

Each helper takes a ``gql(query, variables, token)`` callable, so the same flows run
against the fake verifier and against real emulator-issued ID tokens.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from graphql_harness import AREA_ID

type Gql = Callable[[str, dict[str, Any] | None, str | None], dict[str, Any]]

ERROR = "error { code message currentVersion }"
CLAIM = "claim { id version status expiresAt transferredSessionId closedSessionId }"

CREATE_SESSION = f"""
mutation($input: CreatePlanningSessionInput!) {{
  createPlanningSession(input: $input) {{ session {{ id version status }} {ERROR} }}
}}"""

UPDATE_SESSION = f"""
mutation($input: UpdatePlanningSessionInput!) {{
  updatePlanningSession(input: $input) {{ session {{ id version }} {ERROR} }}
}}"""

CURRENT_SESSION = "{ currentPlanningSession { id version status } }"
SESSION = "query($id: ID!) { planningSession(id: $id) { id version status } }"
VIEWER = "{ viewer { uid kind } }"

FINALIZE = f"""
mutation($input: FinalizeReportInput!) {{
  finalizeReport(input: $input) {{ report {{ id sessionId }} {ERROR} }}
}}"""

REPORTS = "{ reports(first: 50) { nodes { id sessionId } } }"

BEGIN_CLAIM = f"""
mutation {{ beginAccountClaim {{ {CLAIM} claimSecret {ERROR} }} }}"""

COMPLETE_CLAIM = f"""
mutation($input: CompleteAccountClaimInput!) {{
  completeAccountClaim(input: $input) {{ {CLAIM} {ERROR} }}
}}"""

CANCEL_CLAIM = f"""
mutation($input: CancelAccountClaimInput!) {{
  cancelAccountClaim(input: $input) {{ {CLAIM} {ERROR} }}
}}"""

FUNDING_MATCHES = """
query($id: ID!) { fundingMatches(sessionId: $id, first: 50) { nodes { id } } }"""

MATCH_FUNDING = f"""
mutation($input: MatchFundingInput!) {{
  matchFunding(input: $input) {{ matches {{ id }} {ERROR} }}
}}"""

JOIN = f"""
mutation($input: JoinCommunityInput!) {{
  joinCommunity(input: $input) {{ membership {{ id }} {ERROR} }}
}}"""


def payload(body: dict[str, Any], field: str) -> dict[str, Any]:
    assert "errors" not in body, body
    result: dict[str, Any] = body["data"][field]
    return result


def create_session(gql: Gql, token: str, key: str) -> dict[str, Any]:
    out = payload(
        gql(
            CREATE_SESSION,
            {"input": {"mode": "TRADITIONAL", "areaId": AREA_ID, "idempotencyKey": key}},
            token,
        ),
        "createPlanningSession",
    )
    assert out["error"] is None, out
    return out["session"]  # type: ignore[no-any-return]


def update(gql: Gql, token: str, session: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    out = payload(
        gql(
            UPDATE_SESSION,
            {"input": {"id": session["id"], "expectedVersion": session["version"], "patch": patch}},
            token,
        ),
        "updatePlanningSession",
    )
    assert out["error"] is None, out
    return out["session"]  # type: ignore[no-any-return]


def make_ready(
    gql: Gql, token: str, session: dict[str, Any], seed: Callable[[str], str]
) -> dict[str, Any]:
    """Give a session the goal and selected plan that finalizing requires, in the real
    order: set the goal, calculate plans for it (``seed``), then select one."""
    with_goal = update(gql, token, session, {"goal": {"kind": "REDUCE_SHORTAGE"}})
    return update(gql, token, with_goal, {"selectedPlanOptionId": seed(session["id"])})


def finalize(gql: Gql, token: str, session_id: str, key: str) -> dict[str, Any]:
    return payload(
        gql(
            FINALIZE,
            {"input": {"sessionId": session_id, "title": "Plan", "idempotencyKey": key}},
            token,
        ),
        "finalizeReport",
    )


def begin_claim(gql: Gql, token: str) -> dict[str, Any]:
    return payload(gql(BEGIN_CLAIM, None, token), "beginAccountClaim")


def complete_claim(gql: Gql, token: str, claim_id: str, secret: str, key: str) -> dict[str, Any]:
    return payload(
        gql(
            COMPLETE_CLAIM,
            {"input": {"claimId": claim_id, "claimSecret": secret, "idempotencyKey": key}},
            token,
        ),
        "completeAccountClaim",
    )


def cancel_claim(gql: Gql, token: str, claim_id: str, version: int) -> dict[str, Any]:
    return payload(
        gql(CANCEL_CLAIM, {"input": {"claimId": claim_id, "expectedVersion": version}}, token),
        "cancelAccountClaim",
    )


def report_ids(gql: Gql, token: str) -> list[str]:
    nodes = payload(gql(REPORTS, None, token), "reports")["nodes"]
    return [n["id"] for n in nodes]
