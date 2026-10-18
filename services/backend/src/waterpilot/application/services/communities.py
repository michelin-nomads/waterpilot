"""Communities: public listing/details, nearby discovery, immediate join (ADR 0002),
leave, and coordinator-only archive. Joining requires a permanent account (provisional
policy pending the ADR 0002 open question on guests joining).

One membership document per (community, user), with a derived id, so concurrent joins
collide instead of duplicating; ``member_count`` changes in the same transaction as the
membership (ADR 0005)."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

from pydantic import Field

from waterpilot.application.idempotency import run_once
from waterpilot.application.identity import RequestContext
from waterpilot.application.pagination import (
    FilterValue,
    Page,
    PageArgs,
    Position,
    encode_cursor,
    page_query,
)
from waterpilot.application.policies import active_membership, existing_community
from waterpilot.application.services.common import Deps, build, page_of
from waterpilot.domain import geo
from waterpilot.domain.communities import (
    Community,
    CommunityStatus,
    Membership,
    MembershipRole,
    MembershipStatus,
    membership_id,
)
from waterpilot.domain.errors import DomainError, ErrorCode, not_found
from waterpilot.domain.ids import IdKind, new_id, require_id
from waterpilot.domain.values import DecimalString, Frozen

NEARBY_CANDIDATES_PER_CELL = 50
"""Indexed candidates read per geohash cell (nine cells at most per search)."""


class CreateCommunityInput(Frozen):
    name: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=2000)
    area_id: str | None = None
    report_id: str
    contact_name: str = Field(min_length=1, max_length=120)
    contact_email: str | None = Field(
        default=None, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    )
    share_contact_name: bool = False
    share_contact_email: bool = False


class JoinCommunityInput(Frozen):
    community_id: str


class LeaveCommunityInput(Frozen):
    community_id: str
    expected_version: int = Field(ge=1)


class NearbyInput(Frozen):
    latitude: DecimalString
    longitude: DecimalString
    radius_m: int = Field(ge=geo.MIN_RADIUS_M, le=geo.MAX_RADIUS_M)


@dataclass(frozen=True, slots=True)
class NearbyCommunity:
    community: Community
    distance_m: int


@dataclass(frozen=True, slots=True)
class NearbyPage:
    page: Page[NearbyCommunity]
    candidates_truncated: bool
    """True when a cell had more candidates than were read; a smaller radius or a later
    page of a more specific search can surface communities that were not considered."""


def _archived() -> DomainError:
    return DomainError(ErrorCode.ARCHIVED, "this community is archived; joining is closed")


class CommunityService:
    def __init__(self, deps: Deps) -> None:
        self._d = deps

    def get(self, community_id: str) -> Community:
        return existing_community(self._d.store, require_id(community_id, IdKind.COMMUNITY))

    def get_many(self, community_ids: list[str]) -> dict[str, Community]:
        """Batched public read for list resolvers."""
        return self._d.store.communities.get_many(community_ids)

    def browse(
        self, area_id: str | None, include_archived: bool, archived_only: bool, page: PageArgs
    ) -> Page[Community]:
        where: dict[str, FilterValue] = {}
        if area_id is not None:
            where["area_id"] = require_id(area_id, IdKind.AREA, "areaId")
        if archived_only:
            where["status"] = CommunityStatus.ARCHIVED.value
        elif not include_archived:
            where["status"] = CommunityStatus.ACTIVE.value
        return page_of(self._d.store.communities, where, page)

    def nearby(self, data: dict[str, Any], page: PageArgs) -> NearbyPage:
        """Active communities whose reference point is within the radius, nearest first.
        Geohash cells give indexed candidates; the exact distance decides."""
        query = build(NearbyInput, data)
        try:
            lat, lon = geo.parse_point(query.latitude, query.longitude)
        except ValueError as err:
            raise DomainError(ErrorCode.VALIDATION_FAILED, str(err), field="latitude") from None
        where: dict[str, FilterValue] = {
            "latitude": query.latitude,
            "longitude": query.longitude,
            "radius_m": str(query.radius_m),
        }
        bound = page.bind(where)
        found: dict[str, NearbyCommunity] = {}
        truncated = False
        for cell in geo.covering_cells(lat, lon, query.radius_m):
            candidates = self._d.store.communities.active_in_cells(cell, NEARBY_CANDIDATES_PER_CELL)
            truncated |= len(candidates) >= NEARBY_CANDIDATES_PER_CELL
            for c in candidates:
                if c.latitude is None or c.longitude is None:
                    continue
                d = geo.distance_m(lat, lon, *geo.parse_point(c.latitude, c.longitude))
                if d <= query.radius_m:
                    found[c.id] = NearbyCommunity(c, round(d))

        def position(n: NearbyCommunity) -> Position:
            return Position(f"{n.distance_m:09d}", n.community.id)

        ordered = sorted(found.values(), key=lambda n: (position(n).sort_key, n.community.id))
        if bound.after is not None:
            marker = (bound.after.sort_key, bound.after.id)
            ordered = [n for n in ordered if (position(n).sort_key, n.community.id) > marker]
        window = ordered[: bound.first]
        end = encode_cursor(position(window[-1]), bound.filter_hash) if window else None
        return NearbyPage(Page(tuple(window), len(ordered) > bound.first, end), truncated)

    def my_memberships(self, ctx: RequestContext, page: PageArgs) -> Page[Membership]:
        principal = ctx.require_principal()
        return page_of(
            self._d.store.memberships,
            {"uid": principal.uid, "status": MembershipStatus.ACTIVE.value},
            page,
        )

    def viewer_membership(self, ctx: RequestContext, community_id: str) -> Membership | None:
        if ctx.principal is None:
            return None
        return active_membership(self._d.store, community_id, ctx.principal.uid)

    def viewer_memberships(
        self, ctx: RequestContext, community_ids: list[str]
    ) -> dict[str, Membership]:
        """The caller's own active memberships for many communities, in one read."""
        if ctx.principal is None:
            return {}
        uid = ctx.principal.uid
        ids = {membership_id(c, uid): c for c in community_ids}
        found = self._d.store.memberships.get_many(list(ids))
        return {ids[i]: m for i, m in found.items() if m.is_active and m.uid == uid}

    def members(self, ctx: RequestContext, community_id: str, page: PageArgs) -> Page[Membership]:
        principal = ctx.require_principal()
        community = self.get(community_id)
        if active_membership(self._d.store, community.id, principal.uid) is None:
            raise DomainError(ErrorCode.FORBIDDEN, "only members can see the member list")
        return page_of(
            self._d.store.memberships,
            {"community_id": community.id, "status": MembershipStatus.ACTIVE.value},
            page,
        )

    def create(self, ctx: RequestContext, data: dict[str, Any], idempotency_key: str) -> Community:
        principal = ctx.require_permanent()
        payload = build(CreateCommunityInput, data)
        store, now = self._d.store, self._d.clock()
        report_id = require_id(payload.report_id, IdKind.REPORT, "reportId")
        if payload.share_contact_email and payload.contact_email is None:
            raise DomainError(
                ErrorCode.VALIDATION_FAILED,
                "provide a contact email before choosing to publish it",
                field="shareContactEmail",
            )

        def create() -> tuple[str, ...]:
            report = store.reports.get(report_id)
            if report is None or report.owner_uid != principal.uid:
                raise not_found("finalized report")
            if report.status.value != "finalized":
                raise DomainError(
                    ErrorCode.PRECONDITION_FAILED,
                    "choose one of your finalized, nonarchived reports",
                    field="reportId",
                )

            if payload.area_id is not None and payload.area_id != report.area_id:
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED,
                    "community location must match its report",
                    field="areaId",
                )
            area = store.areas.get(report.area_id)
            location: dict[str, Any] = {}
            public_area_id = None
            if area is not None and area.owner_uid is None:
                lat, lon = geo.parse_point(area.centroid_lat, area.centroid_lon)
                public_area_id = area.id
                location = {
                    "latitude": area.centroid_lat,
                    "longitude": area.centroid_lon,
                    "geohash": geo.encode(lat, lon),
                }
            elif payload.area_id is not None:
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED,
                    "a device or typed-in location stays private; choose a searched place "
                    "to share it with a community",
                    field="areaId",
                )

            community = store.communities.insert(
                Community(
                    id=new_id(IdKind.COMMUNITY),
                    name=payload.name,
                    description=payload.description,
                    area_id=public_area_id,
                    member_count=1,
                    linked_report_id=report.id,
                    shared_report_goal=report.goal.kind,
                    shared_report_finalized_at=report.finalized_at,
                    contact_name=payload.contact_name,
                    contact_email=payload.contact_email,
                    share_contact_name=payload.share_contact_name,
                    share_contact_email=payload.share_contact_email,
                    created_at=now,
                    updated_at=now,
                    **location,
                )
            )
            store.memberships.insert(
                Membership(
                    id=membership_id(community.id, principal.uid),
                    community_id=community.id,
                    uid=principal.uid,
                    role=MembershipRole.COORDINATOR,
                    joined_at=now,
                    created_at=now,
                    updated_at=now,
                )
            )
            return (community.id,)

        (community_id,) = store.transaction(
            lambda: run_once(
                store,
                uid=principal.uid,
                operation="createCommunity",
                key=idempotency_key,
                payload=payload,
                now=now,
                create=create,
            )
        )
        return self.get(community_id)

    def join(self, ctx: RequestContext, community_id: str, idempotency_key: str) -> Membership:
        principal = ctx.require_permanent()
        store, now = self._d.store, self._d.clock()
        payload = JoinCommunityInput(community_id=require_id(community_id, IdKind.COMMUNITY))
        mid = membership_id(payload.community_id, principal.uid)

        def create() -> tuple[str, ...]:
            community = existing_community(store, payload.community_id)
            existing = store.memberships.get(mid)
            if community.status is CommunityStatus.ARCHIVED:
                raise _archived()
            if existing is not None and existing.is_active:
                return (existing.id,)
            if existing is None:
                store.memberships.insert(
                    Membership(
                        id=mid,
                        community_id=community.id,
                        uid=principal.uid,
                        role=MembershipRole.MEMBER,
                        joined_at=now,
                        created_at=now,
                        updated_at=now,
                    )
                )
            else:
                store.memberships.replace(
                    existing.model_copy(
                        update={
                            "status": MembershipStatus.ACTIVE,
                            "role": MembershipRole.MEMBER,
                            "joined_at": now,
                            "left_at": None,
                            "updated_at": now,
                        }
                    ),
                    existing.version,
                )
            store.communities.replace(
                community.model_copy(
                    update={"member_count": community.member_count + 1, "updated_at": now}
                ),
                community.version,
            )
            return (mid,)

        store.transaction(
            lambda: run_once(
                store,
                uid=principal.uid,
                operation="joinCommunity",
                key=idempotency_key,
                payload=payload,
                now=now,
                create=create,
            )
        )
        membership = store.memberships.get(mid)
        if membership is None:  # pragma: no cover - written in the same transaction
            raise not_found("membership")
        return membership

    def leave(self, ctx: RequestContext, community_id: str, expected_version: int) -> Membership:
        """Leave idempotently for the expected membership version.

        The key is deterministic for this desired transition, so a lost response can be
        retried without decrementing the member count twice. A later rejoin advances the
        membership version and makes an old leave confirmation stale.
        """
        principal = ctx.require_permanent()
        store = self._d.store
        community_id = require_id(community_id, IdKind.COMMUNITY)
        payload = LeaveCommunityInput(community_id=community_id, expected_version=expected_version)
        key_digest = hashlib.sha256(
            f"{community_id}\x1f{principal.uid}\x1f{expected_version}".encode()
        ).hexdigest()
        idempotency_key = f"leave-{key_digest}"

        def leave_once() -> tuple[str, ...]:
            community = existing_community(store, community_id)
            membership = store.memberships.get(membership_id(community.id, principal.uid))
            if membership is None:
                raise not_found("membership")
            if not membership.is_active:
                return (membership.id,)
            membership.require_version(expected_version)
            if membership.role is MembershipRole.COORDINATOR and not self._other_coordinator(
                community.id, principal.uid
            ):
                raise DomainError(
                    ErrorCode.PRECONDITION_FAILED,
                    "you are the last coordinator; archive this community before leaving",
                )
            now = self._d.clock()
            left = store.memberships.replace(
                membership.model_copy(
                    update={"status": MembershipStatus.LEFT, "left_at": now, "updated_at": now}
                ),
                expected_version,
            )
            store.communities.replace(
                community.model_copy(
                    update={"member_count": max(community.member_count - 1, 0), "updated_at": now}
                ),
                community.version,
            )
            return (left.id,)

        (mid,) = store.transaction(
            lambda: run_once(
                store,
                uid=principal.uid,
                operation="leaveCommunity",
                key=idempotency_key,
                payload=payload,
                now=self._d.clock(),
                create=leave_once,
            )
        )
        membership = store.memberships.get(mid)
        if membership is None:  # pragma: no cover - committed with the idempotency record
            raise not_found("membership")
        return membership

    def archive(self, ctx: RequestContext, community_id: str, expected_version: int) -> Community:
        principal = ctx.require_permanent()
        store = self._d.store
        community_id = require_id(community_id, IdKind.COMMUNITY)

        def tx() -> Community:
            community = existing_community(store, community_id)
            membership = store.memberships.get(membership_id(community.id, principal.uid))
            if (
                membership is None
                or not membership.is_active
                or membership.role is not MembershipRole.COORDINATOR
            ):
                raise DomainError(ErrorCode.FORBIDDEN, "only coordinators can archive a community")
            community.require_version(expected_version)
            if community.status is CommunityStatus.ARCHIVED:
                raise DomainError(ErrorCode.ARCHIVED, "this community is already archived")
            now = self._d.clock()
            return store.communities.replace(
                community.model_copy(
                    update={
                        "status": CommunityStatus.ARCHIVED,
                        "archived_at": now,
                        "updated_at": now,
                    }
                ),
                expected_version,
            )

        return store.transaction(tx)

    def _other_coordinator(self, community_id: str, uid: str) -> bool:
        where: dict[str, FilterValue] = {
            "community_id": community_id,
            "role": MembershipRole.COORDINATOR.value,
            "status": MembershipStatus.ACTIVE.value,
        }
        page = self._d.store.memberships.page(where, page_query(2, None, where))
        return any(m.uid != uid for m in page.items)
