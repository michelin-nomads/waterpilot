"""Authorization policies, enforced in application code on every operation (the
Admin SDK bypasses Firestore security rules, so rules are not the boundary).

Private records the caller may not see are reported as ``NOT_FOUND`` so their
existence is not revealed. ``FORBIDDEN`` is used only where the caller can already
see the record (e.g. a member trying a coordinator-only action).
"""

from __future__ import annotations

from waterpilot.application.identity import Principal
from waterpilot.application.repositories import Store
from waterpilot.domain.communities import Community, Membership, MembershipRole, membership_id
from waterpilot.domain.errors import DomainError, ErrorCode, not_found
from waterpilot.domain.planning import PlanningSession
from waterpilot.domain.reports import Report
from waterpilot.domain.tracking import ImplementationProject


def active_membership(store: Store, community_id: str, uid: str) -> Membership | None:
    membership = store.memberships.get(membership_id(community_id, uid))
    if membership is None or not membership.is_active or membership.uid != uid:
        return None
    return membership


def is_coordinator(store: Store, community_id: str | None, uid: str) -> bool:
    if community_id is None:
        return False
    membership = active_membership(store, community_id, uid)
    return membership is not None and membership.role is MembershipRole.COORDINATOR


def owned_session(store: Store, session_id: str, principal: Principal) -> PlanningSession:
    session = store.sessions.get(session_id)
    if session is None or session.owner_uid != principal.uid:
        raise not_found("planning session")
    return session


def readable_report(store: Store, report_id: str, principal: Principal) -> Report:
    report = store.reports.get(report_id)
    if report is None:
        raise not_found("report")
    if report.owner_uid == principal.uid:
        return report
    if report.community_id and active_membership(store, report.community_id, principal.uid):
        return report
    raise not_found("report")


def require_report_manager(store: Store, report: Report, principal: Principal) -> None:
    """Owner, or a coordinator of the report's community."""
    if report.owner_uid == principal.uid or is_coordinator(
        store, report.community_id, principal.uid
    ):
        return
    raise DomainError(
        ErrorCode.FORBIDDEN, "only the report owner or a community coordinator can do this"
    )


def readable_project(store: Store, project_id: str, principal: Principal) -> ImplementationProject:
    project = store.projects.get(project_id)
    if project is None:
        raise not_found("implementation project")
    if project.owner_uid == principal.uid:
        return project
    if project.community_id and active_membership(store, project.community_id, principal.uid):
        return project
    raise not_found("implementation project")


def existing_community(store: Store, community_id: str) -> Community:
    community = store.communities.get(community_id)
    if community is None:
        raise not_found("community")
    return community
