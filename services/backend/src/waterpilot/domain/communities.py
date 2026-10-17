"""Communities with immediate join (ADR 0002) and role-bearing memberships."""

from __future__ import annotations

from enum import StrEnum

from pydantic import Field

from waterpilot.domain.ids import IdKind, derived_id
from waterpilot.domain.planning import GoalKind
from waterpilot.domain.records import Record
from waterpilot.domain.values import DecimalString, UtcDateTime


class CommunityStatus(StrEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class Community(Record):
    name: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=2000)
    area_id: str | None = None
    status: CommunityStatus = CommunityStatus.ACTIVE
    member_count: int = Field(default=0, ge=0)
    archived_at: UtcDateTime | None = None
    latitude: DecimalString | None = None
    """Reference point for nearby discovery (the location's centroid), never a boundary
    or anyone's address."""
    longitude: DecimalString | None = None
    geohash: str | None = Field(default=None, pattern=r"^[0-9b-hjkmnp-z]{9}$")
    linked_report_id: str | None = None
    """Private reference used for history/authorization; never exposed by GraphQL."""
    shared_report_goal: GoalKind | None = None
    shared_report_finalized_at: UtcDateTime | None = None
    contact_name: str | None = Field(default=None, max_length=120)
    contact_email: str | None = Field(default=None, max_length=254)
    share_contact_name: bool = False
    share_contact_email: bool = False


class MembershipRole(StrEnum):
    MEMBER = "member"
    COORDINATOR = "coordinator"


class MembershipStatus(StrEnum):
    ACTIVE = "active"
    LEFT = "left"


class Membership(Record):
    community_id: str
    uid: str
    role: MembershipRole
    status: MembershipStatus = MembershipStatus.ACTIVE
    joined_at: UtcDateTime
    left_at: UtcDateTime | None = None

    @property
    def is_active(self) -> bool:
        return self.status is MembershipStatus.ACTIVE


def membership_id(community_id: str, uid: str) -> str:
    """One membership document per (community, user); see ``ids.derived_id``."""
    return derived_id(IdKind.MEMBERSHIP, community_id, uid)
