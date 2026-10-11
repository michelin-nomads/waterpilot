"""GraphQL enums, generated from the domain enums so the two never drift."""

from __future__ import annotations

import strawberry

from waterlens.application.identity import AccountKind as _AccountKind
from waterlens.domain import accounts as a
from waterlens.domain import communities as c
from waterlens.domain import funding as f
from waterlens.domain import jobs as j
from waterlens.domain import location as loc
from waterlens.domain import planning as p
from waterlens.domain import readiness as rd
from waterlens.domain import reports as r
from waterlens.domain import tracking as t
from waterlens.domain import values as v
from waterlens.domain.errors import ErrorCode as _ErrorCode
from waterlens.domain.units import CanonicalUnit as _CanonicalUnit

ErrorCode = strawberry.enum(_ErrorCode, name="ErrorCode")
AccountKind = strawberry.enum(_AccountKind, name="AccountKind")
Availability = strawberry.enum(v.Availability, name="Availability")
EvidenceQuality = strawberry.enum(v.EvidenceQuality, name="EvidenceQuality")
Unit = strawberry.enum(
    v.Unit,
    name="Unit",
    description="Canonical stored units. Display units such as MLD are not stored.",
)
Capability = strawberry.enum(p.Capability, name="Capability")
PlanningMode = strawberry.enum(p.PlanningMode, name="PlanningMode")
AreaOrigin = strawberry.enum(loc.AreaOrigin, name="AreaOrigin")
GeographicScope = strawberry.enum(
    loc.GeographicScope,
    name="GeographicScope",
    description="What kind of place a location is. A point or place is not a catchment.",
)
ExtentKind = strawberry.enum(
    loc.ExtentKind,
    name="ExtentKind",
    description="What coverage checks use: a reviewed boundary, a radius you set, or the point.",
)
UnitSystem = strawberry.enum(loc.UnitSystem, name="UnitSystem")
PlanningStage = strawberry.enum(p.PlanningStage, name="PlanningStage")
SessionStatus = strawberry.enum(p.SessionStatus, name="SessionStatus")
GoalKind = strawberry.enum(p.GoalKind, name="GoalKind")
TargetMode = strawberry.enum(p.TargetMode, name="TargetMode")
Priority = strawberry.enum(p.Priority, name="Priority")
AdjustmentChange = strawberry.enum(p.AdjustmentChange, name="AdjustmentChange")
Feasibility = strawberry.enum(p.Feasibility, name="Feasibility")
WindowStatus = strawberry.enum(f.WindowStatus, name="WindowStatus")
CriterionStatus = strawberry.enum(f.CriterionStatus, name="CriterionStatus")
MatchStatus = strawberry.enum(f.MatchStatus, name="FundingMatchStatus")
ReportStatus = strawberry.enum(r.ReportStatus, name="ReportStatus")
ProposalSection = strawberry.enum(r.ProposalSection, name="ProposalSection")
ProposalStatus = strawberry.enum(r.ProposalStatus, name="ProposalStatus")
CommunityStatus = strawberry.enum(c.CommunityStatus, name="CommunityStatus")
MembershipRole = strawberry.enum(c.MembershipRole, name="MembershipRole")
ProjectStatus = strawberry.enum(t.ProjectStatus, name="ProjectStatus")
MilestoneStatus = strawberry.enum(t.MilestoneStatus, name="MilestoneStatus")
ObservationEvidence = strawberry.enum(t.ObservationEvidence, name="ObservationEvidence")
JobKind = strawberry.enum(j.JobKind, name="JobKind")
JobStatus = strawberry.enum(j.JobStatus, name="JobStatus")
AgentRunStatus = strawberry.enum(j.AgentRunStatus, name="AgentRunStatus")
AgentStopReason = strawberry.enum(j.AgentStopReason, name="AgentStopReason")
ClaimStatus = strawberry.enum(a.ClaimStatus, name="AccountClaimStatus")
ReadinessState = strawberry.enum(rd.ReadinessState, name="ReadinessState")
ReadinessInput = strawberry.enum(rd.InputId, name="ReadinessInput")
TechnicalSupport = strawberry.enum(rd.TechnicalSupport, name="TechnicalSupport")
AssessmentBasis = strawberry.enum(rd.AssessmentBasis, name="AssessmentBasis")
CanonicalUnit = strawberry.enum(
    _CanonicalUnit,
    name="CanonicalUnit",
    description="Canonical units a source variable or manual input normalizes to.",
)
