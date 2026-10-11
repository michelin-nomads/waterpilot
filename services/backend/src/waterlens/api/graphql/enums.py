"""GraphQL enums, generated from the domain enums so the two never drift."""

from __future__ import annotations

import strawberry

from waterlens.application.identity import AccountKind as _AccountKind
from waterlens.application.services.options import SelectionStatus as _SelectionStatus
from waterlens.domain import accounts as a
from waterlens.domain import baseline as bl
from waterlens.domain import communities as c
from waterlens.domain import funding as f
from waterlens.domain import impact_records as ir
from waterlens.domain import jobs as j
from waterlens.domain import location as loc
from waterlens.domain import options as opt
from waterlens.domain import planning as p
from waterlens.domain import readiness as rd
from waterlens.domain import reports as r
from waterlens.domain import sources as src
from waterlens.domain import systems as sy
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
PlanComparisonStatus = strawberry.enum(
    opt.Status,
    name="PlanComparisonStatus",
    description="OPTIONS, or why there are none: NO_FEASIBLE_PLAN, NEEDS_INPUT, "
    "TARGET_ALREADY_MET, NOT_SUPPORTED.",
)
PlanMetric = strawberry.enum(opt.Metric, name="PlanMetric")
EffectOrigin = strawberry.enum(
    opt.EffectOrigin,
    name="EffectOrigin",
    description="Where an effect value came from: USER_ESTIMATE (your range), BASELINE "
    "(the sourced baseline value) or SCENARIO (set by the confirmed what-if). The "
    "catalogue never supplies effect values.",
)
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
ValueOrigin = strawberry.enum(
    bl.Origin,
    name="ValueOrigin",
    description="Measured, your estimate or modelled; shown distinctly wherever a value is.",
)
BaselineReason = strawberry.enum(
    bl.Reason, name="BaselineReason", description="Why a baseline value is unavailable."
)
IndicatorStatistic = strawberry.enum(bl.Statistic, name="IndicatorStatistic")
ObservationMethod = strawberry.enum(src.ObservationMethod, name="ObservationMethod")
SharedSystem = strawberry.enum(
    sy.SharedSystem,
    name="SharedSystem",
    description="A system that can carry a measure's effect beyond the site.",
)
EffectDirection = strawberry.enum(sy.EffectDirection, name="EffectDirection")
ReviewKind = strawberry.enum(sy.ReviewKind, name="ReviewKind")
Linkage = strawberry.enum(
    ir.Linkage,
    name="Linkage",
    description="Whether places share a system, from reviewed evidence only. Unknown "
    "unless a record says otherwise; being close never decides it.",
)
FindingKind = strawberry.enum(ir.FindingKind, name="FindingKind")
FindingBasis = strawberry.enum(ir.FindingBasis, name="FindingBasis")
CitationKind = strawberry.enum(ir.CitationKind, name="CitationKind")
BoundaryLevel = strawberry.enum(ir.BoundaryLevel, name="BoundaryLevel")
GroundwaterReliance = strawberry.enum(ir.GroundwaterReliance, name="GroundwaterReliance")
SelectedPlanStatus = strawberry.enum(
    _SelectionStatus,
    name="SelectedPlanStatus",
    description="Whether the chosen plan still matches a fresh assessment; only CURRENT "
    "or LEGACY can be finalized.",
)
