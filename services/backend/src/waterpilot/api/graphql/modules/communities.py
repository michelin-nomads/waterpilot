"""Communities and memberships. Member identities are not exposed (profiles are
Phase 05); members see roles and whether an entry is themselves."""

from __future__ import annotations

from decimal import ROUND_HALF_EVEN, Decimal

import strawberry

from waterpilot.api.graphql.context import Info, attempt, call
from waterpilot.api.graphql.loaders import load_existing
from waterpilot.api.graphql.scalars import DecimalString, UtcDateTime
from waterpilot.api.graphql.types_common import (
    Connection,
    MutationError,
    PageInfo,
    connection,
    input_data,
    page_args,
)
from waterpilot.domain import communities as dc


@strawberry.type
class Membership:
    id: strawberry.ID
    version: int
    community_id: strawberry.ID
    role: dc.MembershipRole
    is_viewer: bool
    joined_at: UtcDateTime
    left_at: UtcDateTime | None

    @staticmethod
    def of(m: dc.Membership, viewer_uid: str | None) -> Membership:
        return Membership(
            id=strawberry.ID(m.id),
            version=m.version,
            community_id=strawberry.ID(m.community_id),
            role=m.role,
            is_viewer=m.uid == viewer_uid,
            joined_at=UtcDateTime(m.joined_at),
            left_at=UtcDateTime(m.left_at) if m.left_at else None,
        )

    @strawberry.field
    async def community(self, info: Info) -> Community:
        return Community.of(
            await load_existing(info.context.loaders.community, str(self.community_id), "community")
        )


def _viewer_uid(info: Info) -> str | None:
    p = info.context.ctx.principal
    return p.uid if p else None


@strawberry.type
class SharedReportSummary:
    """A deliberately small, address-free public projection of a finalized report."""

    goal: str
    finalized_at: UtcDateTime


@strawberry.type
class CommunityArea:
    """Coarse public area and rounded map reference; never private addresses or boundaries."""

    id: strawberry.ID
    name: str
    country_code: str
    map_latitude: DecimalString
    map_longitude: DecimalString


@strawberry.type
class Community:
    id: strawberry.ID
    version: int
    name: str
    description: str
    area_id: strawberry.ID | None
    status: dc.CommunityStatus
    member_count: int
    archived_at: UtcDateTime | None
    contact_name: str | None
    contact_email: str | None
    shared_report: SharedReportSummary | None
    created_at: UtcDateTime
    updated_at: UtcDateTime

    @staticmethod
    def of(c: dc.Community) -> Community:
        return Community(
            id=strawberry.ID(c.id),
            version=c.version,
            name=c.name,
            description=c.description,
            area_id=strawberry.ID(c.area_id) if c.area_id else None,
            status=c.status,
            member_count=c.member_count,
            archived_at=UtcDateTime(c.archived_at) if c.archived_at else None,
            contact_name=c.contact_name if c.share_contact_name else None,
            contact_email=c.contact_email if c.share_contact_email else None,
            shared_report=(
                SharedReportSummary(
                    goal=c.shared_report_goal.value,
                    finalized_at=UtcDateTime(c.shared_report_finalized_at),
                )
                if c.shared_report_goal is not None and c.shared_report_finalized_at is not None
                else None
            ),
            created_at=UtcDateTime(c.created_at),
            updated_at=UtcDateTime(c.updated_at),
        )

    @strawberry.field
    async def area(self, info: Info) -> CommunityArea | None:
        if self.area_id is None:
            return None
        found = await info.context.loaders.area.load(str(self.area_id))
        if found is None or found.owner_uid is not None:
            return None
        return CommunityArea(
            id=strawberry.ID(found.id),
            name=found.name,
            country_code=found.country_code,
            map_latitude=DecimalString(
                format(
                    Decimal(found.centroid_lat).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN),
                    "f",
                )
            ),
            map_longitude=DecimalString(
                format(
                    Decimal(found.centroid_lon).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN),
                    "f",
                )
            ),
        )

    @strawberry.field(description="The caller's active membership, or null.")
    async def viewer_membership(self, info: Info) -> Membership | None:
        found = await info.context.loaders.viewer_membership.load(str(self.id))
        return Membership.of(found, _viewer_uid(info)) if found else None

    @strawberry.field(description="Members only.")
    async def members(
        self, info: Info, first: int | None = None, after: str | None = None
    ) -> Connection[Membership]:
        c, uid = info.context.services.communities, _viewer_uid(info)
        page = await call(c.members, info.context.ctx, str(self.id), page_args(first, after))
        return connection(page, lambda m: Membership.of(m, uid))


@strawberry.input
class CommunityFilter:
    area_id: strawberry.ID | None = None
    include_archived: bool = False
    archived_only: bool = False


@strawberry.input(description="A search circle around a point the user chose.")
class NearbyCommunitiesInput:
    latitude: DecimalString
    longitude: DecimalString
    radius_meters: int = strawberry.field(description="100 to 50000.")


@strawberry.type
class NearbyCommunity:
    community: Community
    distance_meters: int = strawberry.field(
        description="Great-circle distance to the community's reference point (its "
        "location's centroid), whole metres. Nearby is not the same as sharing a water "
        "system."
    )


@strawberry.type
class NearbyCommunityConnection:
    nodes: list[NearbyCommunity]
    page_info: PageInfo
    candidates_truncated: bool = strawberry.field(
        description="True when the area is dense and not every community could be "
        "considered; a smaller radius gives a complete answer."
    )


@strawberry.input
class CreateCommunityInput:
    name: str
    description: str = ""
    area_id: strawberry.ID | None = None
    report_id: strawberry.ID
    contact_name: str
    contact_email: str | None = None
    share_contact_name: bool = False
    share_contact_email: bool = False
    idempotency_key: str


@strawberry.input
class JoinCommunityInput:
    community_id: strawberry.ID
    idempotency_key: str


@strawberry.input
class LeaveCommunityInput:
    community_id: strawberry.ID
    expected_version: int = strawberry.field(description="Your membership's version.")


@strawberry.input
class ArchiveCommunityInput:
    id: strawberry.ID
    expected_version: int


@strawberry.type
class CommunityPayload:
    community: Community | None = None
    error: MutationError | None = None


@strawberry.type
class MembershipPayload:
    membership: Membership | None = None
    error: MutationError | None = None


@strawberry.type
class Query:
    @strawberry.field
    async def community(self, info: Info, id: strawberry.ID) -> Community | None:
        return Community.of(await call(info.context.services.communities.get, str(id)))

    @strawberry.field
    async def communities(
        self,
        info: Info,
        filter: CommunityFilter | None = None,
        first: int | None = None,
        after: str | None = None,
    ) -> Connection[Community]:
        f = filter or CommunityFilter()
        area = str(f.area_id) if f.area_id else None
        c = info.context.services.communities
        page = await call(
            c.browse, area, f.include_archived, f.archived_only, page_args(first, after)
        )
        return connection(page, Community.of)

    @strawberry.field(description="Active communities within the radius, nearest first.")
    async def nearby_communities(
        self,
        info: Info,
        near: NearbyCommunitiesInput,
        first: int | None = None,
        after: str | None = None,
    ) -> NearbyCommunityConnection:
        data = {
            "latitude": str(near.latitude),
            "longitude": str(near.longitude),
            "radius_m": near.radius_meters,
        }
        c = info.context.services.communities
        result = await call(c.nearby, data, page_args(first, after))
        return NearbyCommunityConnection(
            nodes=[
                NearbyCommunity(community=Community.of(n.community), distance_meters=n.distance_m)
                for n in result.page.items
            ],
            page_info=PageInfo(
                has_next_page=result.page.has_next_page, end_cursor=result.page.end_cursor
            ),
            candidates_truncated=result.candidates_truncated,
        )

    @strawberry.field
    async def my_memberships(
        self, info: Info, first: int | None = None, after: str | None = None
    ) -> Connection[Membership]:
        c, uid = info.context.services.communities, _viewer_uid(info)
        page = await call(c.my_memberships, info.context.ctx, page_args(first, after))
        return connection(page, lambda m: Membership.of(m, uid))


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def create_community(self, info: Info, input: CreateCommunityInput) -> CommunityPayload:
        c, ctx = info.context.services.communities, info.context.ctx
        return await attempt(
            info,
            lambda: CommunityPayload(
                community=Community.of(c.create(ctx, input_data(input), input.idempotency_key))
            ),
            lambda e: CommunityPayload(error=e),
        )

    @strawberry.mutation(description="Join immediately (no approval step).")
    async def join_community(self, info: Info, input: JoinCommunityInput) -> MembershipPayload:
        c, ctx, uid = info.context.services.communities, info.context.ctx, _viewer_uid(info)
        return await attempt(
            info,
            lambda: MembershipPayload(
                membership=Membership.of(
                    c.join(ctx, str(input.community_id), input.idempotency_key), uid
                )
            ),
            lambda e: MembershipPayload(error=e),
        )

    @strawberry.mutation
    async def leave_community(self, info: Info, input: LeaveCommunityInput) -> MembershipPayload:
        c, ctx, uid = info.context.services.communities, info.context.ctx, _viewer_uid(info)
        return await attempt(
            info,
            lambda: MembershipPayload(
                membership=Membership.of(
                    c.leave(ctx, str(input.community_id), input.expected_version), uid
                )
            ),
            lambda e: MembershipPayload(error=e),
        )

    @strawberry.mutation(description="Coordinators only; the community becomes read-only.")
    async def archive_community(self, info: Info, input: ArchiveCommunityInput) -> CommunityPayload:
        c, ctx = info.context.services.communities, info.context.ctx
        return await attempt(
            info,
            lambda: CommunityPayload(
                community=Community.of(c.archive(ctx, str(input.id), input.expected_version))
            ),
            lambda e: CommunityPayload(error=e),
        )
