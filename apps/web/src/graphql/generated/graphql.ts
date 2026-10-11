/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
export type AccountClaimStatus =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'OPEN';

export type AccountKind =
  | 'GUEST'
  | 'PERMANENT';

export type AdjustmentChange =
  | 'ABSOLUTE'
  | 'RELATIVE';

export type AdminContextInput = {
  admin1?: string | null | undefined;
  admin2?: string | null | undefined;
  countryName?: string | null | undefined;
  locality?: string | null | undefined;
  sublocality?: string | null | undefined;
};

export type ArchiveCommunityInput = {
  expectedVersion: number;
  id: string;
};

export type ArchiveReportInput = {
  expectedVersion: number;
  id: string;
};

export type AreaOrigin =
  | 'CATALOGUE'
  | 'CUSTOM'
  | 'GEOLOCATION'
  | 'PLACE_SEARCH';

export type AssessmentBasis =
  | 'LIMITED'
  | 'SOURCED'
  | 'USER_INPUT';

export type Availability =
  | 'AVAILABLE'
  | 'PROVISIONAL'
  | 'UNAVAILABLE';

export type CancelAccountClaimInput = {
  claimId: string;
  expectedVersion: number;
};

/** Canonical units a source variable or manual input normalizes to. */
export type CanonicalUnit =
  | 'CATEGORY'
  | 'CFU_PER_100ML'
  | 'COUNT'
  | 'DAY'
  | 'INR_PAISE'
  | 'LITRE'
  | 'LITRES_PER_DAY'
  | 'METRES_BELOW_GROUND'
  | 'MG_PER_LITRE'
  | 'MICROSIEMENS_PER_CM'
  | 'MILLIMETRE'
  | 'NTU'
  | 'PH'
  | 'RATIO'
  | 'SQUARE_METRE';

export type Capability =
  | 'FLOOD_RISK'
  | 'GROUNDWATER_ABSTRACTION'
  | 'GROUNDWATER_LEVEL'
  | 'LAND_COVER'
  | 'RAINFALL'
  | 'SHARED_AQUIFER_NEIGHBOUR'
  | 'SURFACE_WATER'
  | 'UTILITY_SUPPLY'
  | 'WATER_QUALITY';

export type CommunityFilter = {
  areaId?: string | null | undefined;
  includeArchived?: boolean;
};

export type CommunityStatus =
  | 'ACTIVE'
  | 'ARCHIVED';

export type CompleteAccountClaimInput = {
  claimId: string;
  claimSecret: string;
  idempotencyKey: string;
};

export type ConfirmLocationInput = {
  accuracyMeters?: number | null | undefined;
  admin?: AdminContextInput | null | undefined;
  countryCode: string;
  /** ISO 4217 code correcting the inferred one. */
  currency?: string | null | undefined;
  /** Required: REFERENCE_POINT or USER_RADIUS, chosen by the person. */
  extent: ExtentKind;
  formattedAddress?: string | null | undefined;
  idempotencyKey: string;
  latitude: string;
  longitude: string;
  name: string;
  /** PLACE_SEARCH, GEOLOCATION or CUSTOM. */
  origin: AreaOrigin;
  placeId?: string | null | undefined;
  radiusMeters?: number | null | undefined;
  /** IANA zone correcting the inferred one. */
  timezone?: string | null | undefined;
  types?: Array<string>;
};

export type CreateCommunityInput = {
  areaId?: string | null | undefined;
  description?: string;
  idempotencyKey: string;
  name: string;
};

export type CreatePlanningSessionInput = {
  areaId?: string | null | undefined;
  communityId?: string | null | undefined;
  idempotencyKey: string;
  mode: PlanningMode;
};

export type CriterionStatus =
  | 'MET'
  | 'NEEDS_CHECK'
  | 'NOT_MET';

export type ErrorCode =
  | 'ARCHIVED'
  | 'BUDGET_EXHAUSTED'
  | 'CURRENCY_MISMATCH'
  | 'FORBIDDEN'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'INTERNAL'
  | 'NOT_FOUND'
  | 'PERMANENT_ACCOUNT_REQUIRED'
  | 'PRECONDITION_FAILED'
  | 'REAUTHENTICATION_REQUIRED'
  | 'SERVICE_UNAVAILABLE'
  | 'UNAUTHENTICATED'
  | 'UNSUPPORTED_CURRENCY'
  | 'VALIDATION_FAILED'
  | 'VERSION_CONFLICT';

export type EvidenceQuality =
  | 'PROVISIONAL'
  | 'QUARANTINED'
  | 'SYNTHETIC'
  | 'UNREVIEWED'
  | 'VALIDATED';

/** What coverage checks use: a reviewed boundary, a radius you set, or the point. */
export type ExtentKind =
  | 'REFERENCE_POINT'
  | 'REVIEWED_BOUNDARY'
  | 'USER_RADIUS';

export type Feasibility =
  | 'FEASIBLE'
  | 'NEEDS_REVIEW'
  | 'NOT_FEASIBLE';

export type FinalizeReportInput = {
  idempotencyKey: string;
  sessionId: string;
  title: string;
};

export type FundingMatchStatus =
  | 'ADDED'
  | 'CANDIDATE'
  | 'DISMISSED';

export type GenerateProposalInput = {
  idempotencyKey: string;
  reportId: string;
  sections: Array<ProposalSection>;
};

/** What kind of place a location is. A point or place is not a catchment. */
export type GeographicScope =
  | 'COUNTRY'
  | 'LOCALITY'
  | 'NEIGHBOURHOOD'
  | 'POINT'
  | 'POSTAL_CODE'
  | 'REGION'
  | 'SUBLOCALITY';

export type GoalInput = {
  budget?: MoneyInput | null | undefined;
  description?: string;
  kind: GoalKind;
  priority?: Priority | null | undefined;
  target?: GoalTargetInput | null | undefined;
  timelineDays?: number | null | undefined;
};

export type GoalKind =
  | 'CUSTOM'
  | 'IMPROVE_GROUNDWATER'
  | 'IMPROVE_WATER_QUALITY'
  | 'REDUCE_FLOOD_RISK'
  | 'REDUCE_SHORTAGE'
  | 'REDUCE_TANKER_DEPENDENCE';

export type GoalTargetInput = {
  mode: TargetMode;
  quantity: QuantityInput;
};

export type JobKind =
  | 'FUNDING_MATCH'
  | 'PROPOSAL_GENERATION';

export type JobStatus =
  | 'CANCELLED'
  | 'FAILED'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED';

export type JoinCommunityInput = {
  communityId: string;
  idempotencyKey: string;
};

export type LeaveCommunityInput = {
  communityId: string;
  /** Your membership's version. */
  expectedVersion: number;
};

export type MatchFundingInput = {
  idempotencyKey: string;
  planOptionId: string;
  sessionId: string;
};

export type MembershipRole =
  | 'COORDINATOR'
  | 'MEMBER';

export type MilestoneInput = {
  plannedOn: string;
  title: string;
};

export type MilestoneStatus =
  | 'DONE'
  | 'IN_PROGRESS'
  | 'PLANNED'
  | 'SKIPPED';

/** Money as integer minor units; currency must be supported. */
export type MoneyInput = {
  currency: string;
  minorUnits: string;
};

/** A search circle around a point the user chose. */
export type NearbyCommunitiesInput = {
  latitude: string;
  longitude: string;
  /** 100 to 50000. */
  radiusMeters: number;
};

export type ObservationEvidence =
  | 'RECORDED'
  | 'REJECTED'
  | 'VERIFIED';

export type PlanningMode =
  | 'AGENT'
  | 'TRADITIONAL';

/** Omitted fields are left unchanged; null clears a field. */
export type PlanningSessionPatch = {
  areaId?: string | null | undefined;
  goal?: GoalInput | null | undefined;
  mode?: PlanningMode | null | undefined;
  scenario?: ScenarioInput | null | undefined;
  selectedPlanOptionId?: string | null | undefined;
  stage?: PlanningStage | null | undefined;
};

export type PlanningStage =
  | 'COMPARE'
  | 'GOAL'
  | 'MAKE_IT_HAPPEN'
  | 'TRACK'
  | 'UNDERSTAND';

export type Priority =
  | 'FASTEST_BENEFIT'
  | 'LARGEST_IMPACT'
  | 'LOWEST_COST'
  | 'LOWEST_NEIGHBOUR_EFFECT';

export type ProjectStatus =
  | 'ACTIVE'
  | 'ARCHIVED'
  | 'COMPLETED';

export type ProposalSection =
  | 'ASSUMPTIONS'
  | 'BASELINE'
  | 'COSTS'
  | 'EXECUTIVE_SUMMARY'
  | 'FUNDING'
  | 'PLAN'
  | 'SOURCES';

export type ProposalStatus =
  | 'APPROVED'
  | 'DRAFTING'
  | 'FAILED'
  | 'NEEDS_REVIEW'
  | 'QUEUED';

export type QuantityInput = {
  unit: Unit;
  value: string;
};

export type ReadinessInput =
  | 'DELIVERED_SUPPLY'
  | 'FORWARD_SERIES'
  | 'INTERVENTION_COSTS'
  | 'NON_DOMESTIC_DEMAND'
  | 'OM_COSTS'
  | 'PER_CAPITA_STANDARD'
  | 'POPULATION'
  | 'TANKER_SUPPLY'
  | 'UNIT_PRICE';

export type ReadinessState =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'STALE'
  | 'UNAVAILABLE'
  | 'USER_ENTERED';

export type RecordManualInputInput = {
  asOf: string;
  idempotencyKey: string;
  input: ReadinessInput;
  /** Where the figure comes from (3-500 chars). */
  note: string;
  sessionId: string;
  /** Unit as entered, e.g. MLD; converted exactly. */
  unit: string;
  value: string;
};

export type RecordObservationInput = {
  idempotencyKey: string;
  method: string;
  metricId: string;
  note?: string;
  observedOn: string;
  projectId: string;
  quantity: QuantityInput;
};

export type ReportFilter = {
  /** Omit for your own reports. */
  communityId?: string | null | undefined;
  status?: ReportStatus | null | undefined;
};

export type ReportStatus =
  | 'ARCHIVED'
  | 'FINALIZED';

export type ScenarioAdjustmentInput = {
  change: AdjustmentChange;
  parameter: string;
  quantity: QuantityInput;
};

export type ScenarioInput = {
  adjustments?: Array<ScenarioAdjustmentInput>;
  confirmed?: boolean;
  interpretedFrom?: string | null | undefined;
};

export type SessionStatus =
  | 'ACTIVE'
  | 'CLOSED';

export type StartImplementationProjectInput = {
  idempotencyKey: string;
  milestones?: Array<MilestoneInput>;
  reportId: string;
  title: string;
};

export type TargetMode =
  | 'ABSOLUTE_LEVEL'
  | 'RELATIVE_REDUCTION';

export type TechnicalSupport =
  | 'PROVISIONAL'
  | 'SUPPORTED'
  | 'UNAVAILABLE';

/** Canonical stored units. Display units such as MLD are not stored. */
export type Unit =
  | 'CFU_PER_100ML'
  | 'COUNT'
  | 'DAY'
  | 'LITRE'
  | 'LITRES_PER_DAY'
  | 'METRES_BELOW_GROUND'
  | 'MG_PER_LITRE'
  | 'MICROSIEMENS_PER_CM'
  | 'MILLIMETRE'
  | 'NTU'
  | 'PH'
  | 'RATIO'
  | 'SQUARE_METRE';

export type UnitSystem =
  | 'METRIC'
  | 'US_CUSTOMARY';

export type UpdateMilestoneInput = {
  expectedVersion: number;
  id: string;
  status: MilestoneStatus;
};

export type UpdatePlanningSessionInput = {
  expectedVersion: number;
  id: string;
  patch: PlanningSessionPatch;
};

export type WindowStatus =
  | 'CLOSED'
  | 'OPEN'
  | 'UNKNOWN'
  | 'UPCOMING';

export type AccountClaimFieldsFragment = { id: string, version: number, status: AccountClaimStatus, expiresAt: string, transferredSessionId: string | null, closedSessionId: string | null };

export type BeginAccountClaimMutationVariables = Exact<{ [key: string]: never; }>;


export type BeginAccountClaimMutation = { beginAccountClaim: { claimSecret: string | null, claim: { id: string, version: number, status: AccountClaimStatus, expiresAt: string, transferredSessionId: string | null, closedSessionId: string | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type CompleteAccountClaimMutationVariables = Exact<{
  input: CompleteAccountClaimInput;
}>;


export type CompleteAccountClaimMutation = { completeAccountClaim: { claim: { id: string, version: number, status: AccountClaimStatus, expiresAt: string, transferredSessionId: string | null, closedSessionId: string | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type CancelAccountClaimMutationVariables = Exact<{
  input: CancelAccountClaimInput;
}>;


export type CancelAccountClaimMutation = { cancelAccountClaim: { claim: { id: string, version: number, status: AccountClaimStatus, expiresAt: string, transferredSessionId: string | null, closedSessionId: string | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type MutationErrorFieldsFragment = { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> };

export type MoneyFieldsFragment = { minorUnits: string, currency: string, exponent: number };

export type QuantityFieldsFragment = { value: string, unit: Unit };

export type PageInfoFieldsFragment = { hasNextPage: boolean, endCursor: string | null };

export type MembershipFieldsFragment = { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string };

export type CommunityFieldsFragment = { id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null };

export type CommunitiesQueryVariables = Exact<{
  filter?: CommunityFilter | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type CommunitiesQuery = { communities: { nodes: Array<{ id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type NearbyCommunitiesQueryVariables = Exact<{
  near: NearbyCommunitiesInput;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type NearbyCommunitiesQuery = { nearbyCommunities: { candidatesTruncated: boolean, nodes: Array<{ distanceMeters: number, community: { id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type CommunityQueryVariables = Exact<{
  id: string;
}>;


export type CommunityQuery = { community: { id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null } | null };

export type CommunityMembersQueryVariables = Exact<{
  id: string;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type CommunityMembersQuery = { community: { id: string, members: { nodes: Array<{ id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } } | null };

export type MyMembershipsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type MyMembershipsQuery = { myMemberships: { nodes: Array<{ id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string, community: { id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type CreateCommunityMutationVariables = Exact<{
  input: CreateCommunityInput;
}>;


export type CreateCommunityMutation = { createCommunity: { community: { id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type JoinCommunityMutationVariables = Exact<{
  input: JoinCommunityInput;
}>;


export type JoinCommunityMutation = { joinCommunity: { membership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type LeaveCommunityMutationVariables = Exact<{
  input: LeaveCommunityInput;
}>;


export type LeaveCommunityMutation = { leaveCommunity: { membership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type ArchiveCommunityMutationVariables = Exact<{
  input: ArchiveCommunityInput;
}>;


export type ArchiveCommunityMutation = { archiveCommunity: { community: { id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type FundingMatchFieldsFragment = { id: string, version: number, sessionId: string, planOptionId: string, metCount: number, notMetCount: number, needsCheckCount: number, window: WindowStatus, status: FundingMatchStatus, rulesVersion: string, results: Array<{ criterionId: string, status: CriterionStatus, reason: string }>, scheme: { id: string, name: string, funder: string, summary: string, currency: string, opensOn: string | null, closesOn: string | null, sourceUrl: string, lastVerifiedAt: string, evidence: EvidenceQuality, requiredDocuments: Array<string>, maxAmount: { minorUnits: string, currency: string, exponent: number } | null, criteria: Array<{ id: string, text: string, machineCheckable: boolean }> } };

export type FundingMatchesQueryVariables = Exact<{
  sessionId: string;
  planOptionId?: string | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type FundingMatchesQuery = { fundingMatches: { nodes: Array<{ id: string, version: number, sessionId: string, planOptionId: string, metCount: number, notMetCount: number, needsCheckCount: number, window: WindowStatus, status: FundingMatchStatus, rulesVersion: string, results: Array<{ criterionId: string, status: CriterionStatus, reason: string }>, scheme: { id: string, name: string, funder: string, summary: string, currency: string, opensOn: string | null, closesOn: string | null, sourceUrl: string, lastVerifiedAt: string, evidence: EvidenceQuality, requiredDocuments: Array<string>, maxAmount: { minorUnits: string, currency: string, exponent: number } | null, criteria: Array<{ id: string, text: string, machineCheckable: boolean }> } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type MatchFundingMutationVariables = Exact<{
  input: MatchFundingInput;
}>;


export type MatchFundingMutation = { matchFunding: { matches: Array<{ id: string, version: number, sessionId: string, planOptionId: string, metCount: number, notMetCount: number, needsCheckCount: number, window: WindowStatus, status: FundingMatchStatus, rulesVersion: string, results: Array<{ criterionId: string, status: CriterionStatus, reason: string }>, scheme: { id: string, name: string, funder: string, summary: string, currency: string, opensOn: string | null, closesOn: string | null, sourceUrl: string, lastVerifiedAt: string, evidence: EvidenceQuality, requiredDocuments: Array<string>, maxAmount: { minorUnits: string, currency: string, exponent: number } | null, criteria: Array<{ id: string, text: string, machineCheckable: boolean }> } }> | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type PlaceCandidateFieldsFragment = { placeId: string, name: string, formattedAddress: string | null, latitude: string, longitude: string, countryCode: string | null, scope: GeographicScope, types: Array<string>, admin: { countryName: string | null, admin1: string | null, admin2: string | null, locality: string | null, sublocality: string | null } };

export type AreaLocationFieldsFragment = { id: string, name: string, countryCode: string, timezone: string, currency: string | null, unitSystem: UnitSystem, regionSetByUser: Array<string>, evidence: EvidenceQuality, origin: AreaOrigin, scope: GeographicScope, extent: ExtentKind, radiusMeters: number | null, private: boolean, formattedAddress: string | null, accuracyMeters: number | null, hasBoundary: boolean, providerContentExpired: boolean, admin: { countryName: string | null, admin1: string | null, admin2: string | null, locality: string | null, sublocality: string | null } };

export type ResolveLocationQueryVariables = Exact<{
  text: string;
}>;


export type ResolveLocationQuery = { resolveLocation: { query: string, provider: string, needsClarification: boolean, question: string, candidates: Array<{ placeId: string, name: string, formattedAddress: string | null, latitude: string, longitude: string, countryCode: string | null, scope: GeographicScope, types: Array<string>, admin: { countryName: string | null, admin1: string | null, admin2: string | null, locality: string | null, sublocality: string | null } }> } };

export type ReverseLocationQueryVariables = Exact<{
  latitude: string;
  longitude: string;
}>;


export type ReverseLocationQuery = { reverseLocation: { candidates: Array<{ placeId: string, name: string, formattedAddress: string | null, latitude: string, longitude: string, countryCode: string | null, scope: GeographicScope, types: Array<string>, admin: { countryName: string | null, admin1: string | null, admin2: string | null, locality: string | null, sublocality: string | null } }> } };

export type RegionSettingsQueryVariables = Exact<{
  latitude: string;
  longitude: string;
  countryCode: string;
}>;


export type RegionSettingsQuery = { regionSettings: { currency: string | null, currencyOptions: Array<string>, currencyCertain: boolean, timezone: string, timezoneOptions: Array<string>, timezoneCertain: boolean, unitSystem: UnitSystem } };

export type CountriesQueryVariables = Exact<{ [key: string]: never; }>;


export type CountriesQuery = { countries: { countries: Array<{ code: string, name: string }> } };

export type AreaLocationQueryVariables = Exact<{
  id: string;
}>;


export type AreaLocationQuery = { area: { id: string, name: string, countryCode: string, timezone: string, currency: string | null, unitSystem: UnitSystem, regionSetByUser: Array<string>, evidence: EvidenceQuality, origin: AreaOrigin, scope: GeographicScope, extent: ExtentKind, radiusMeters: number | null, private: boolean, formattedAddress: string | null, accuracyMeters: number | null, hasBoundary: boolean, providerContentExpired: boolean, admin: { countryName: string | null, admin1: string | null, admin2: string | null, locality: string | null, sublocality: string | null } } | null };

export type ConfirmLocationMutationVariables = Exact<{
  input: ConfirmLocationInput;
}>;


export type ConfirmLocationMutation = { confirmLocation: { area: { id: string, name: string, countryCode: string, timezone: string, currency: string | null, unitSystem: UnitSystem, regionSetByUser: Array<string>, evidence: EvidenceQuality, origin: AreaOrigin, scope: GeographicScope, extent: ExtentKind, radiusMeters: number | null, private: boolean, formattedAddress: string | null, accuracyMeters: number | null, hasBoundary: boolean, providerContentExpired: boolean, admin: { countryName: string | null, admin1: string | null, admin2: string | null, locality: string | null, sublocality: string | null } } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type AreaFieldsFragment = { id: string, name: string, countryCode: string, timezone: string, evidence: EvidenceQuality };

export type PlanningSessionFieldsFragment = { id: string, version: number, mode: PlanningMode, stage: PlanningStage, status: SessionStatus, areaId: string | null, communityId: string | null, selectedPlanOptionId: string | null, inputsRevision: number, updatedAt: string, area: { id: string, name: string } | null, goal: { id: string, kind: GoalKind, description: string, timelineDays: number | null, priority: Priority | null, budget: { minorUnits: string, currency: string, exponent: number } | null, target: { mode: TargetMode, quantity: { value: string, unit: Unit } } | null } | null, scenario: { id: string, confirmed: boolean, interpretedFrom: string | null, adjustments: Array<{ parameter: string, change: AdjustmentChange, quantity: { value: string, unit: Unit } }> } | null };

export type ViewerQueryVariables = Exact<{ [key: string]: never; }>;


export type ViewerQuery = { viewer: { uid: string, kind: AccountKind } | null };

export type SearchAreasQueryVariables = Exact<{
  query: string;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type SearchAreasQuery = { searchAreas: { nodes: Array<{ id: string, name: string, countryCode: string, timezone: string, evidence: EvidenceQuality }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type AreaCoverageQueryVariables = Exact<{
  id: string;
}>;


export type AreaCoverageQuery = { area: { id: string, name: string, countryCode: string, timezone: string, evidence: EvidenceQuality, coverage: { assessedAt: string, items: Array<{ capability: Capability, availability: Availability, evidence: EvidenceQuality | null, reason: string | null }> } } | null };

export type CurrentPlanningSessionQueryVariables = Exact<{ [key: string]: never; }>;


export type CurrentPlanningSessionQuery = { currentPlanningSession: { id: string, version: number, mode: PlanningMode, stage: PlanningStage, status: SessionStatus, areaId: string | null, communityId: string | null, selectedPlanOptionId: string | null, inputsRevision: number, updatedAt: string, area: { id: string, name: string } | null, goal: { id: string, kind: GoalKind, description: string, timelineDays: number | null, priority: Priority | null, budget: { minorUnits: string, currency: string, exponent: number } | null, target: { mode: TargetMode, quantity: { value: string, unit: Unit } } | null } | null, scenario: { id: string, confirmed: boolean, interpretedFrom: string | null, adjustments: Array<{ parameter: string, change: AdjustmentChange, quantity: { value: string, unit: Unit } }> } | null } | null };

export type PlanningSessionQueryVariables = Exact<{
  id: string;
}>;


export type PlanningSessionQuery = { planningSession: { id: string, version: number, mode: PlanningMode, stage: PlanningStage, status: SessionStatus, areaId: string | null, communityId: string | null, selectedPlanOptionId: string | null, inputsRevision: number, updatedAt: string, area: { id: string, name: string } | null, goal: { id: string, kind: GoalKind, description: string, timelineDays: number | null, priority: Priority | null, budget: { minorUnits: string, currency: string, exponent: number } | null, target: { mode: TargetMode, quantity: { value: string, unit: Unit } } | null } | null, scenario: { id: string, confirmed: boolean, interpretedFrom: string | null, adjustments: Array<{ parameter: string, change: AdjustmentChange, quantity: { value: string, unit: Unit } }> } | null } | null };

export type PlanOptionsQueryVariables = Exact<{
  sessionId: string;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type PlanOptionsQuery = { planOptions: { nodes: Array<{ id: string, inputsRevision: number, name: string, summary: string, feasibility: Feasibility, bestFitReason: string | null, costUnavailableReason: string | null, costBasisDate: string | null, cost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, buildDays: { low: number, high: number } | null, impact: { id: string, assumptions: Array<string>, metrics: Array<{ metricId: string, baseline: { availability: Availability, reason: string | null, quantity: { value: string, unit: Unit } | null }, projectedLow: { availability: Availability, reason: string | null, quantity: { value: string, unit: Unit } | null }, projectedHigh: { availability: Availability, reason: string | null, quantity: { value: string, unit: Unit } | null } }>, neighbourEffect: { availability: Availability, reason: string | null } } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type CreatePlanningSessionMutationVariables = Exact<{
  input: CreatePlanningSessionInput;
}>;


export type CreatePlanningSessionMutation = { createPlanningSession: { session: { id: string, version: number, mode: PlanningMode, stage: PlanningStage, status: SessionStatus, areaId: string | null, communityId: string | null, selectedPlanOptionId: string | null, inputsRevision: number, updatedAt: string, area: { id: string, name: string } | null, goal: { id: string, kind: GoalKind, description: string, timelineDays: number | null, priority: Priority | null, budget: { minorUnits: string, currency: string, exponent: number } | null, target: { mode: TargetMode, quantity: { value: string, unit: Unit } } | null } | null, scenario: { id: string, confirmed: boolean, interpretedFrom: string | null, adjustments: Array<{ parameter: string, change: AdjustmentChange, quantity: { value: string, unit: Unit } }> } | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type UpdatePlanningSessionMutationVariables = Exact<{
  input: UpdatePlanningSessionInput;
}>;


export type UpdatePlanningSessionMutation = { updatePlanningSession: { session: { id: string, version: number, mode: PlanningMode, stage: PlanningStage, status: SessionStatus, areaId: string | null, communityId: string | null, selectedPlanOptionId: string | null, inputsRevision: number, updatedAt: string, area: { id: string, name: string } | null, goal: { id: string, kind: GoalKind, description: string, timelineDays: number | null, priority: Priority | null, budget: { minorUnits: string, currency: string, exponent: number } | null, target: { mode: TargetMode, quantity: { value: string, unit: Unit } } | null } | null, scenario: { id: string, confirmed: boolean, interpretedFrom: string | null, adjustments: Array<{ parameter: string, change: AdjustmentChange, quantity: { value: string, unit: Unit } }> } | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type AreaReadinessFieldsFragment = { areaId: string, sessionId: string | null, assessedAt: string, asOf: string, demo: boolean, basis: AssessmentBasis, capabilities: Array<{ capability: Capability, state: ReadinessState, reasons: Array<string>, technicalSupport: TechnicalSupport, requiresLocalMeasurement: boolean, requiresReviewedModel: boolean, registeredSourceIds: Array<string>, demo: boolean }>, inputs: Array<{ input: ReadinessInput, label: string, unit: CanonicalUnit, state: ReadinessState, reasons: Array<string>, action: string, manualEntryAllowed: boolean, ownerPrompt: string | null, manualValue: string | null, demo: boolean }>, metrics: Array<{ metric: string, state: ReadinessState, reasons: Array<string>, blockedInputs: Array<ReadinessInput>, demo: boolean }> };

export type AreaReadinessQueryVariables = Exact<{
  areaId: string;
  sessionId?: string | null | undefined;
}>;


export type AreaReadinessQuery = { area: { id: string, name: string, evidence: EvidenceQuality, readiness: { areaId: string, sessionId: string | null, assessedAt: string, asOf: string, demo: boolean, basis: AssessmentBasis, capabilities: Array<{ capability: Capability, state: ReadinessState, reasons: Array<string>, technicalSupport: TechnicalSupport, requiresLocalMeasurement: boolean, requiresReviewedModel: boolean, registeredSourceIds: Array<string>, demo: boolean }>, inputs: Array<{ input: ReadinessInput, label: string, unit: CanonicalUnit, state: ReadinessState, reasons: Array<string>, action: string, manualEntryAllowed: boolean, ownerPrompt: string | null, manualValue: string | null, demo: boolean }>, metrics: Array<{ metric: string, state: ReadinessState, reasons: Array<string>, blockedInputs: Array<ReadinessInput>, demo: boolean }> } } | null };

export type RecordManualInputMutationVariables = Exact<{
  input: RecordManualInputInput;
}>;


export type RecordManualInputMutation = { recordManualInput: { manualInput: { id: string, input: ReadinessInput, value: string, unit: CanonicalUnit, enteredValue: string, enteredUnit: string, asOf: string, note: string } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type JobFieldsFragment = { id: string, version: number, kind: JobKind, status: JobStatus, stage: string | null, attempts: number, maxAttempts: number, errorCode: ErrorCode | null, eventsPath: string, updatedAt: string };

export type ReportFieldsFragment = { id: string, version: number, title: string, status: ReportStatus, sessionId: string, communityId: string | null, areaId: string, planOptionId: string, finalizedAt: string, archivedAt: string | null };

export type ProposalFieldsFragment = { id: string, version: number, reportId: string, sections: Array<ProposalSection>, status: ProposalStatus, flaggedCount: number, downloadPath: string | null, job: { id: string, version: number, kind: JobKind, status: JobStatus, stage: string | null, attempts: number, maxAttempts: number, errorCode: ErrorCode | null, eventsPath: string, updatedAt: string } | null };

export type ReportsQueryVariables = Exact<{
  filter?: ReportFilter | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type ReportsQuery = { reports: { nodes: Array<{ id: string, version: number, title: string, status: ReportStatus, sessionId: string, communityId: string | null, areaId: string, planOptionId: string, finalizedAt: string, archivedAt: string | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type ReportQueryVariables = Exact<{
  id: string;
}>;


export type ReportQuery = { report: { id: string, version: number, title: string, status: ReportStatus, sessionId: string, communityId: string | null, areaId: string, planOptionId: string, finalizedAt: string, archivedAt: string | null, proposals: { nodes: Array<{ id: string, version: number, reportId: string, sections: Array<ProposalSection>, status: ProposalStatus, flaggedCount: number, downloadPath: string | null, job: { id: string, version: number, kind: JobKind, status: JobStatus, stage: string | null, attempts: number, maxAttempts: number, errorCode: ErrorCode | null, eventsPath: string, updatedAt: string } | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } } | null };

export type ProposalQueryVariables = Exact<{
  id: string;
}>;


export type ProposalQuery = { proposal: { id: string, version: number, reportId: string, sections: Array<ProposalSection>, status: ProposalStatus, flaggedCount: number, downloadPath: string | null, job: { id: string, version: number, kind: JobKind, status: JobStatus, stage: string | null, attempts: number, maxAttempts: number, errorCode: ErrorCode | null, eventsPath: string, updatedAt: string } | null } | null };

export type JobQueryVariables = Exact<{
  id: string;
}>;


export type JobQuery = { job: { id: string, version: number, kind: JobKind, status: JobStatus, stage: string | null, attempts: number, maxAttempts: number, errorCode: ErrorCode | null, eventsPath: string, updatedAt: string } | null };

export type FinalizeReportMutationVariables = Exact<{
  input: FinalizeReportInput;
}>;


export type FinalizeReportMutation = { finalizeReport: { report: { id: string, version: number, title: string, status: ReportStatus, sessionId: string, communityId: string | null, areaId: string, planOptionId: string, finalizedAt: string, archivedAt: string | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type ArchiveReportMutationVariables = Exact<{
  input: ArchiveReportInput;
}>;


export type ArchiveReportMutation = { archiveReport: { report: { id: string, version: number, title: string, status: ReportStatus, sessionId: string, communityId: string | null, areaId: string, planOptionId: string, finalizedAt: string, archivedAt: string | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type GenerateProposalMutationVariables = Exact<{
  input: GenerateProposalInput;
}>;


export type GenerateProposalMutation = { generateProposal: { proposal: { id: string, version: number, reportId: string, sections: Array<ProposalSection>, status: ProposalStatus, flaggedCount: number, downloadPath: string | null, job: { id: string, version: number, kind: JobKind, status: JobStatus, stage: string | null, attempts: number, maxAttempts: number, errorCode: ErrorCode | null, eventsPath: string, updatedAt: string } | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type ProjectFieldsFragment = { id: string, version: number, reportId: string, communityId: string | null, title: string, status: ProjectStatus, startedAt: string };

export type MilestoneFieldsFragment = { id: string, version: number, projectId: string, title: string, plannedOn: string, status: MilestoneStatus, completedAt: string | null };

export type ObservationFieldsFragment = { id: string, version: number, projectId: string, metricId: string, observedOn: string, method: string, note: string, evidence: ObservationEvidence, recordedByViewer: boolean, quantity: { value: string, unit: Unit } };

export type MyImplementationProjectsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type MyImplementationProjectsQuery = { myImplementationProjects: { nodes: Array<{ id: string, version: number, reportId: string, communityId: string | null, title: string, status: ProjectStatus, startedAt: string }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type ImplementationProjectQueryVariables = Exact<{
  id: string;
}>;


export type ImplementationProjectQuery = { implementationProject: { id: string, version: number, reportId: string, communityId: string | null, title: string, status: ProjectStatus, startedAt: string, milestones: { nodes: Array<{ id: string, version: number, projectId: string, title: string, plannedOn: string, status: MilestoneStatus, completedAt: string | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } } | null };

export type ObservationsQueryVariables = Exact<{
  projectId: string;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type ObservationsQuery = { implementationProject: { id: string, observations: { nodes: Array<{ id: string, version: number, projectId: string, metricId: string, observedOn: string, method: string, note: string, evidence: ObservationEvidence, recordedByViewer: boolean, quantity: { value: string, unit: Unit } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } } | null };

export type StartImplementationProjectMutationVariables = Exact<{
  input: StartImplementationProjectInput;
}>;


export type StartImplementationProjectMutation = { startImplementationProject: { project: { id: string, version: number, reportId: string, communityId: string | null, title: string, status: ProjectStatus, startedAt: string } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type UpdateMilestoneMutationVariables = Exact<{
  input: UpdateMilestoneInput;
}>;


export type UpdateMilestoneMutation = { updateMilestone: { milestone: { id: string, version: number, projectId: string, title: string, plannedOn: string, status: MilestoneStatus, completedAt: string | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type RecordObservationMutationVariables = Exact<{
  input: RecordObservationInput;
}>;


export type RecordObservationMutation = { recordObservation: { observation: { id: string, version: number, projectId: string, metricId: string, observedOn: string, method: string, note: string, evidence: ObservationEvidence, recordedByViewer: boolean, quantity: { value: string, unit: Unit } } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}
export const AccountClaimFieldsFragmentDoc = new TypedDocumentString(`
    fragment AccountClaimFields on AccountClaim {
  id
  version
  status
  expiresAt
  transferredSessionId
  closedSessionId
}
    `, {"fragmentName":"AccountClaimFields"}) as unknown as TypedDocumentString<AccountClaimFieldsFragment, unknown>;
export const MutationErrorFieldsFragmentDoc = new TypedDocumentString(`
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
    `, {"fragmentName":"MutationErrorFields"}) as unknown as TypedDocumentString<MutationErrorFieldsFragment, unknown>;
export const PageInfoFieldsFragmentDoc = new TypedDocumentString(`
    fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
    `, {"fragmentName":"PageInfoFields"}) as unknown as TypedDocumentString<PageInfoFieldsFragment, unknown>;
export const MembershipFieldsFragmentDoc = new TypedDocumentString(`
    fragment MembershipFields on Membership {
  id
  version
  communityId
  role
  isViewer
  joinedAt
}
    `, {"fragmentName":"MembershipFields"}) as unknown as TypedDocumentString<MembershipFieldsFragment, unknown>;
export const CommunityFieldsFragmentDoc = new TypedDocumentString(`
    fragment CommunityFields on Community {
  id
  version
  name
  description
  areaId
  status
  memberCount
  archivedAt
  viewerMembership {
    ...MembershipFields
  }
}
    fragment MembershipFields on Membership {
  id
  version
  communityId
  role
  isViewer
  joinedAt
}`, {"fragmentName":"CommunityFields"}) as unknown as TypedDocumentString<CommunityFieldsFragment, unknown>;
export const MoneyFieldsFragmentDoc = new TypedDocumentString(`
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
    `, {"fragmentName":"MoneyFields"}) as unknown as TypedDocumentString<MoneyFieldsFragment, unknown>;
export const FundingMatchFieldsFragmentDoc = new TypedDocumentString(`
    fragment FundingMatchFields on FundingMatch {
  id
  version
  sessionId
  planOptionId
  metCount
  notMetCount
  needsCheckCount
  window
  status
  rulesVersion
  results {
    criterionId
    status
    reason
  }
  scheme {
    id
    name
    funder
    summary
    currency
    opensOn
    closesOn
    sourceUrl
    lastVerifiedAt
    evidence
    requiredDocuments
    maxAmount {
      ...MoneyFields
    }
    criteria {
      id
      text
      machineCheckable
    }
  }
}
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}`, {"fragmentName":"FundingMatchFields"}) as unknown as TypedDocumentString<FundingMatchFieldsFragment, unknown>;
export const PlaceCandidateFieldsFragmentDoc = new TypedDocumentString(`
    fragment PlaceCandidateFields on PlaceCandidate {
  placeId
  name
  formattedAddress
  latitude
  longitude
  countryCode
  scope
  types
  admin {
    countryName
    admin1
    admin2
    locality
    sublocality
  }
}
    `, {"fragmentName":"PlaceCandidateFields"}) as unknown as TypedDocumentString<PlaceCandidateFieldsFragment, unknown>;
export const AreaLocationFieldsFragmentDoc = new TypedDocumentString(`
    fragment AreaLocationFields on Area {
  id
  name
  countryCode
  timezone
  currency
  unitSystem
  regionSetByUser
  evidence
  origin
  scope
  extent
  radiusMeters
  private
  formattedAddress
  accuracyMeters
  hasBoundary
  providerContentExpired
  admin {
    countryName
    admin1
    admin2
    locality
    sublocality
  }
}
    `, {"fragmentName":"AreaLocationFields"}) as unknown as TypedDocumentString<AreaLocationFieldsFragment, unknown>;
export const AreaFieldsFragmentDoc = new TypedDocumentString(`
    fragment AreaFields on Area {
  id
  name
  countryCode
  timezone
  evidence
}
    `, {"fragmentName":"AreaFields"}) as unknown as TypedDocumentString<AreaFieldsFragment, unknown>;
export const QuantityFieldsFragmentDoc = new TypedDocumentString(`
    fragment QuantityFields on Quantity {
  value
  unit
}
    `, {"fragmentName":"QuantityFields"}) as unknown as TypedDocumentString<QuantityFieldsFragment, unknown>;
export const PlanningSessionFieldsFragmentDoc = new TypedDocumentString(`
    fragment PlanningSessionFields on PlanningSession {
  id
  version
  mode
  stage
  status
  areaId
  communityId
  selectedPlanOptionId
  inputsRevision
  updatedAt
  area {
    id
    name
  }
  goal {
    id
    kind
    description
    timelineDays
    priority
    budget {
      ...MoneyFields
    }
    target {
      mode
      quantity {
        ...QuantityFields
      }
    }
  }
  scenario {
    id
    confirmed
    interpretedFrom
    adjustments {
      parameter
      change
      quantity {
        ...QuantityFields
      }
    }
  }
}
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment QuantityFields on Quantity {
  value
  unit
}`, {"fragmentName":"PlanningSessionFields"}) as unknown as TypedDocumentString<PlanningSessionFieldsFragment, unknown>;
export const AreaReadinessFieldsFragmentDoc = new TypedDocumentString(`
    fragment AreaReadinessFields on AreaReadiness {
  areaId
  sessionId
  assessedAt
  asOf
  demo
  basis
  capabilities {
    capability
    state
    reasons
    technicalSupport
    requiresLocalMeasurement
    requiresReviewedModel
    registeredSourceIds
    demo
  }
  inputs {
    input
    label
    unit
    state
    reasons
    action
    manualEntryAllowed
    ownerPrompt
    manualValue
    demo
  }
  metrics {
    metric
    state
    reasons
    blockedInputs
    demo
  }
}
    `, {"fragmentName":"AreaReadinessFields"}) as unknown as TypedDocumentString<AreaReadinessFieldsFragment, unknown>;
export const ReportFieldsFragmentDoc = new TypedDocumentString(`
    fragment ReportFields on Report {
  id
  version
  title
  status
  sessionId
  communityId
  areaId
  planOptionId
  finalizedAt
  archivedAt
}
    `, {"fragmentName":"ReportFields"}) as unknown as TypedDocumentString<ReportFieldsFragment, unknown>;
export const JobFieldsFragmentDoc = new TypedDocumentString(`
    fragment JobFields on Job {
  id
  version
  kind
  status
  stage
  attempts
  maxAttempts
  errorCode
  eventsPath
  updatedAt
}
    `, {"fragmentName":"JobFields"}) as unknown as TypedDocumentString<JobFieldsFragment, unknown>;
export const ProposalFieldsFragmentDoc = new TypedDocumentString(`
    fragment ProposalFields on Proposal {
  id
  version
  reportId
  sections
  status
  flaggedCount
  downloadPath
  job {
    ...JobFields
  }
}
    fragment JobFields on Job {
  id
  version
  kind
  status
  stage
  attempts
  maxAttempts
  errorCode
  eventsPath
  updatedAt
}`, {"fragmentName":"ProposalFields"}) as unknown as TypedDocumentString<ProposalFieldsFragment, unknown>;
export const ProjectFieldsFragmentDoc = new TypedDocumentString(`
    fragment ProjectFields on ImplementationProject {
  id
  version
  reportId
  communityId
  title
  status
  startedAt
}
    `, {"fragmentName":"ProjectFields"}) as unknown as TypedDocumentString<ProjectFieldsFragment, unknown>;
export const MilestoneFieldsFragmentDoc = new TypedDocumentString(`
    fragment MilestoneFields on Milestone {
  id
  version
  projectId
  title
  plannedOn
  status
  completedAt
}
    `, {"fragmentName":"MilestoneFields"}) as unknown as TypedDocumentString<MilestoneFieldsFragment, unknown>;
export const ObservationFieldsFragmentDoc = new TypedDocumentString(`
    fragment ObservationFields on Observation {
  id
  version
  projectId
  metricId
  observedOn
  method
  note
  evidence
  recordedByViewer
  quantity {
    ...QuantityFields
  }
}
    fragment QuantityFields on Quantity {
  value
  unit
}`, {"fragmentName":"ObservationFields"}) as unknown as TypedDocumentString<ObservationFieldsFragment, unknown>;
export const BeginAccountClaimDocument = new TypedDocumentString(`
    mutation BeginAccountClaim {
  beginAccountClaim {
    claim {
      ...AccountClaimFields
    }
    claimSecret
    error {
      ...MutationErrorFields
    }
  }
}
    fragment AccountClaimFields on AccountClaim {
  id
  version
  status
  expiresAt
  transferredSessionId
  closedSessionId
}
fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}`) as unknown as TypedDocumentString<BeginAccountClaimMutation, BeginAccountClaimMutationVariables>;
export const CompleteAccountClaimDocument = new TypedDocumentString(`
    mutation CompleteAccountClaim($input: CompleteAccountClaimInput!) {
  completeAccountClaim(input: $input) {
    claim {
      ...AccountClaimFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment AccountClaimFields on AccountClaim {
  id
  version
  status
  expiresAt
  transferredSessionId
  closedSessionId
}
fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}`) as unknown as TypedDocumentString<CompleteAccountClaimMutation, CompleteAccountClaimMutationVariables>;
export const CancelAccountClaimDocument = new TypedDocumentString(`
    mutation CancelAccountClaim($input: CancelAccountClaimInput!) {
  cancelAccountClaim(input: $input) {
    claim {
      ...AccountClaimFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment AccountClaimFields on AccountClaim {
  id
  version
  status
  expiresAt
  transferredSessionId
  closedSessionId
}
fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}`) as unknown as TypedDocumentString<CancelAccountClaimMutation, CancelAccountClaimMutationVariables>;
export const CommunitiesDocument = new TypedDocumentString(`
    query Communities($filter: CommunityFilter, $first: Int, $after: String) {
  communities(filter: $filter, first: $first, after: $after) {
    nodes {
      ...CommunityFields
    }
    pageInfo {
      ...PageInfoFields
    }
  }
}
    fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
fragment MembershipFields on Membership {
  id
  version
  communityId
  role
  isViewer
  joinedAt
}
fragment CommunityFields on Community {
  id
  version
  name
  description
  areaId
  status
  memberCount
  archivedAt
  viewerMembership {
    ...MembershipFields
  }
}`) as unknown as TypedDocumentString<CommunitiesQuery, CommunitiesQueryVariables>;
export const NearbyCommunitiesDocument = new TypedDocumentString(`
    query NearbyCommunities($near: NearbyCommunitiesInput!, $first: Int, $after: String) {
  nearbyCommunities(near: $near, first: $first, after: $after) {
    nodes {
      distanceMeters
      community {
        ...CommunityFields
      }
    }
    pageInfo {
      ...PageInfoFields
    }
    candidatesTruncated
  }
}
    fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
fragment MembershipFields on Membership {
  id
  version
  communityId
  role
  isViewer
  joinedAt
}
fragment CommunityFields on Community {
  id
  version
  name
  description
  areaId
  status
  memberCount
  archivedAt
  viewerMembership {
    ...MembershipFields
  }
}`) as unknown as TypedDocumentString<NearbyCommunitiesQuery, NearbyCommunitiesQueryVariables>;
export const CommunityDocument = new TypedDocumentString(`
    query Community($id: ID!) {
  community(id: $id) {
    ...CommunityFields
  }
}
    fragment MembershipFields on Membership {
  id
  version
  communityId
  role
  isViewer
  joinedAt
}
fragment CommunityFields on Community {
  id
  version
  name
  description
  areaId
  status
  memberCount
  archivedAt
  viewerMembership {
    ...MembershipFields
  }
}`) as unknown as TypedDocumentString<CommunityQuery, CommunityQueryVariables>;
export const CommunityMembersDocument = new TypedDocumentString(`
    query CommunityMembers($id: ID!, $first: Int, $after: String) {
  community(id: $id) {
    id
    members(first: $first, after: $after) {
      nodes {
        ...MembershipFields
      }
      pageInfo {
        ...PageInfoFields
      }
    }
  }
}
    fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
fragment MembershipFields on Membership {
  id
  version
  communityId
  role
  isViewer
  joinedAt
}`) as unknown as TypedDocumentString<CommunityMembersQuery, CommunityMembersQueryVariables>;
export const MyMembershipsDocument = new TypedDocumentString(`
    query MyMemberships($first: Int, $after: String) {
  myMemberships(first: $first, after: $after) {
    nodes {
      ...MembershipFields
      community {
        ...CommunityFields
      }
    }
    pageInfo {
      ...PageInfoFields
    }
  }
}
    fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
fragment MembershipFields on Membership {
  id
  version
  communityId
  role
  isViewer
  joinedAt
}
fragment CommunityFields on Community {
  id
  version
  name
  description
  areaId
  status
  memberCount
  archivedAt
  viewerMembership {
    ...MembershipFields
  }
}`) as unknown as TypedDocumentString<MyMembershipsQuery, MyMembershipsQueryVariables>;
export const CreateCommunityDocument = new TypedDocumentString(`
    mutation CreateCommunity($input: CreateCommunityInput!) {
  createCommunity(input: $input) {
    community {
      ...CommunityFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment MembershipFields on Membership {
  id
  version
  communityId
  role
  isViewer
  joinedAt
}
fragment CommunityFields on Community {
  id
  version
  name
  description
  areaId
  status
  memberCount
  archivedAt
  viewerMembership {
    ...MembershipFields
  }
}`) as unknown as TypedDocumentString<CreateCommunityMutation, CreateCommunityMutationVariables>;
export const JoinCommunityDocument = new TypedDocumentString(`
    mutation JoinCommunity($input: JoinCommunityInput!) {
  joinCommunity(input: $input) {
    membership {
      ...MembershipFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment MembershipFields on Membership {
  id
  version
  communityId
  role
  isViewer
  joinedAt
}`) as unknown as TypedDocumentString<JoinCommunityMutation, JoinCommunityMutationVariables>;
export const LeaveCommunityDocument = new TypedDocumentString(`
    mutation LeaveCommunity($input: LeaveCommunityInput!) {
  leaveCommunity(input: $input) {
    membership {
      ...MembershipFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment MembershipFields on Membership {
  id
  version
  communityId
  role
  isViewer
  joinedAt
}`) as unknown as TypedDocumentString<LeaveCommunityMutation, LeaveCommunityMutationVariables>;
export const ArchiveCommunityDocument = new TypedDocumentString(`
    mutation ArchiveCommunity($input: ArchiveCommunityInput!) {
  archiveCommunity(input: $input) {
    community {
      ...CommunityFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment MembershipFields on Membership {
  id
  version
  communityId
  role
  isViewer
  joinedAt
}
fragment CommunityFields on Community {
  id
  version
  name
  description
  areaId
  status
  memberCount
  archivedAt
  viewerMembership {
    ...MembershipFields
  }
}`) as unknown as TypedDocumentString<ArchiveCommunityMutation, ArchiveCommunityMutationVariables>;
export const FundingMatchesDocument = new TypedDocumentString(`
    query FundingMatches($sessionId: ID!, $planOptionId: ID, $first: Int, $after: String) {
  fundingMatches(
    sessionId: $sessionId
    planOptionId: $planOptionId
    first: $first
    after: $after
  ) {
    nodes {
      ...FundingMatchFields
    }
    pageInfo {
      ...PageInfoFields
    }
  }
}
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
fragment FundingMatchFields on FundingMatch {
  id
  version
  sessionId
  planOptionId
  metCount
  notMetCount
  needsCheckCount
  window
  status
  rulesVersion
  results {
    criterionId
    status
    reason
  }
  scheme {
    id
    name
    funder
    summary
    currency
    opensOn
    closesOn
    sourceUrl
    lastVerifiedAt
    evidence
    requiredDocuments
    maxAmount {
      ...MoneyFields
    }
    criteria {
      id
      text
      machineCheckable
    }
  }
}`) as unknown as TypedDocumentString<FundingMatchesQuery, FundingMatchesQueryVariables>;
export const MatchFundingDocument = new TypedDocumentString(`
    mutation MatchFunding($input: MatchFundingInput!) {
  matchFunding(input: $input) {
    matches {
      ...FundingMatchFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment FundingMatchFields on FundingMatch {
  id
  version
  sessionId
  planOptionId
  metCount
  notMetCount
  needsCheckCount
  window
  status
  rulesVersion
  results {
    criterionId
    status
    reason
  }
  scheme {
    id
    name
    funder
    summary
    currency
    opensOn
    closesOn
    sourceUrl
    lastVerifiedAt
    evidence
    requiredDocuments
    maxAmount {
      ...MoneyFields
    }
    criteria {
      id
      text
      machineCheckable
    }
  }
}`) as unknown as TypedDocumentString<MatchFundingMutation, MatchFundingMutationVariables>;
export const ResolveLocationDocument = new TypedDocumentString(`
    query ResolveLocation($text: String!) {
  resolveLocation(text: $text) {
    query
    provider
    needsClarification
    question
    candidates {
      ...PlaceCandidateFields
    }
  }
}
    fragment PlaceCandidateFields on PlaceCandidate {
  placeId
  name
  formattedAddress
  latitude
  longitude
  countryCode
  scope
  types
  admin {
    countryName
    admin1
    admin2
    locality
    sublocality
  }
}`) as unknown as TypedDocumentString<ResolveLocationQuery, ResolveLocationQueryVariables>;
export const ReverseLocationDocument = new TypedDocumentString(`
    query ReverseLocation($latitude: DecimalString!, $longitude: DecimalString!) {
  reverseLocation(latitude: $latitude, longitude: $longitude) {
    candidates {
      ...PlaceCandidateFields
    }
  }
}
    fragment PlaceCandidateFields on PlaceCandidate {
  placeId
  name
  formattedAddress
  latitude
  longitude
  countryCode
  scope
  types
  admin {
    countryName
    admin1
    admin2
    locality
    sublocality
  }
}`) as unknown as TypedDocumentString<ReverseLocationQuery, ReverseLocationQueryVariables>;
export const RegionSettingsDocument = new TypedDocumentString(`
    query RegionSettings($latitude: DecimalString!, $longitude: DecimalString!, $countryCode: String!) {
  regionSettings(
    latitude: $latitude
    longitude: $longitude
    countryCode: $countryCode
  ) {
    currency
    currencyOptions
    currencyCertain
    timezone
    timezoneOptions
    timezoneCertain
    unitSystem
  }
}
    `) as unknown as TypedDocumentString<RegionSettingsQuery, RegionSettingsQueryVariables>;
export const CountriesDocument = new TypedDocumentString(`
    query Countries {
  countries {
    countries {
      code
      name
    }
  }
}
    `) as unknown as TypedDocumentString<CountriesQuery, CountriesQueryVariables>;
export const AreaLocationDocument = new TypedDocumentString(`
    query AreaLocation($id: ID!) {
  area(id: $id) {
    ...AreaLocationFields
  }
}
    fragment AreaLocationFields on Area {
  id
  name
  countryCode
  timezone
  currency
  unitSystem
  regionSetByUser
  evidence
  origin
  scope
  extent
  radiusMeters
  private
  formattedAddress
  accuracyMeters
  hasBoundary
  providerContentExpired
  admin {
    countryName
    admin1
    admin2
    locality
    sublocality
  }
}`) as unknown as TypedDocumentString<AreaLocationQuery, AreaLocationQueryVariables>;
export const ConfirmLocationDocument = new TypedDocumentString(`
    mutation ConfirmLocation($input: ConfirmLocationInput!) {
  confirmLocation(input: $input) {
    area {
      ...AreaLocationFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment AreaLocationFields on Area {
  id
  name
  countryCode
  timezone
  currency
  unitSystem
  regionSetByUser
  evidence
  origin
  scope
  extent
  radiusMeters
  private
  formattedAddress
  accuracyMeters
  hasBoundary
  providerContentExpired
  admin {
    countryName
    admin1
    admin2
    locality
    sublocality
  }
}`) as unknown as TypedDocumentString<ConfirmLocationMutation, ConfirmLocationMutationVariables>;
export const ViewerDocument = new TypedDocumentString(`
    query Viewer {
  viewer {
    uid
    kind
  }
}
    `) as unknown as TypedDocumentString<ViewerQuery, ViewerQueryVariables>;
export const SearchAreasDocument = new TypedDocumentString(`
    query SearchAreas($query: String!, $first: Int, $after: String) {
  searchAreas(query: $query, first: $first, after: $after) {
    nodes {
      ...AreaFields
    }
    pageInfo {
      ...PageInfoFields
    }
  }
}
    fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
fragment AreaFields on Area {
  id
  name
  countryCode
  timezone
  evidence
}`) as unknown as TypedDocumentString<SearchAreasQuery, SearchAreasQueryVariables>;
export const AreaCoverageDocument = new TypedDocumentString(`
    query AreaCoverage($id: ID!) {
  area(id: $id) {
    ...AreaFields
    coverage {
      assessedAt
      items {
        capability
        availability
        evidence
        reason
      }
    }
  }
}
    fragment AreaFields on Area {
  id
  name
  countryCode
  timezone
  evidence
}`) as unknown as TypedDocumentString<AreaCoverageQuery, AreaCoverageQueryVariables>;
export const CurrentPlanningSessionDocument = new TypedDocumentString(`
    query CurrentPlanningSession {
  currentPlanningSession {
    ...PlanningSessionFields
  }
}
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment QuantityFields on Quantity {
  value
  unit
}
fragment PlanningSessionFields on PlanningSession {
  id
  version
  mode
  stage
  status
  areaId
  communityId
  selectedPlanOptionId
  inputsRevision
  updatedAt
  area {
    id
    name
  }
  goal {
    id
    kind
    description
    timelineDays
    priority
    budget {
      ...MoneyFields
    }
    target {
      mode
      quantity {
        ...QuantityFields
      }
    }
  }
  scenario {
    id
    confirmed
    interpretedFrom
    adjustments {
      parameter
      change
      quantity {
        ...QuantityFields
      }
    }
  }
}`) as unknown as TypedDocumentString<CurrentPlanningSessionQuery, CurrentPlanningSessionQueryVariables>;
export const PlanningSessionDocument = new TypedDocumentString(`
    query PlanningSession($id: ID!) {
  planningSession(id: $id) {
    ...PlanningSessionFields
  }
}
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment QuantityFields on Quantity {
  value
  unit
}
fragment PlanningSessionFields on PlanningSession {
  id
  version
  mode
  stage
  status
  areaId
  communityId
  selectedPlanOptionId
  inputsRevision
  updatedAt
  area {
    id
    name
  }
  goal {
    id
    kind
    description
    timelineDays
    priority
    budget {
      ...MoneyFields
    }
    target {
      mode
      quantity {
        ...QuantityFields
      }
    }
  }
  scenario {
    id
    confirmed
    interpretedFrom
    adjustments {
      parameter
      change
      quantity {
        ...QuantityFields
      }
    }
  }
}`) as unknown as TypedDocumentString<PlanningSessionQuery, PlanningSessionQueryVariables>;
export const PlanOptionsDocument = new TypedDocumentString(`
    query PlanOptions($sessionId: ID!, $first: Int, $after: String) {
  planOptions(sessionId: $sessionId, first: $first, after: $after) {
    nodes {
      id
      inputsRevision
      name
      summary
      feasibility
      bestFitReason
      costUnavailableReason
      costBasisDate
      cost {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      buildDays {
        low
        high
      }
      impact {
        id
        assumptions
        metrics {
          metricId
          baseline {
            availability
            reason
            quantity {
              ...QuantityFields
            }
          }
          projectedLow {
            availability
            reason
            quantity {
              ...QuantityFields
            }
          }
          projectedHigh {
            availability
            reason
            quantity {
              ...QuantityFields
            }
          }
        }
        neighbourEffect {
          availability
          reason
        }
      }
    }
    pageInfo {
      ...PageInfoFields
    }
  }
}
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment QuantityFields on Quantity {
  value
  unit
}
fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}`) as unknown as TypedDocumentString<PlanOptionsQuery, PlanOptionsQueryVariables>;
export const CreatePlanningSessionDocument = new TypedDocumentString(`
    mutation CreatePlanningSession($input: CreatePlanningSessionInput!) {
  createPlanningSession(input: $input) {
    session {
      ...PlanningSessionFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment QuantityFields on Quantity {
  value
  unit
}
fragment PlanningSessionFields on PlanningSession {
  id
  version
  mode
  stage
  status
  areaId
  communityId
  selectedPlanOptionId
  inputsRevision
  updatedAt
  area {
    id
    name
  }
  goal {
    id
    kind
    description
    timelineDays
    priority
    budget {
      ...MoneyFields
    }
    target {
      mode
      quantity {
        ...QuantityFields
      }
    }
  }
  scenario {
    id
    confirmed
    interpretedFrom
    adjustments {
      parameter
      change
      quantity {
        ...QuantityFields
      }
    }
  }
}`) as unknown as TypedDocumentString<CreatePlanningSessionMutation, CreatePlanningSessionMutationVariables>;
export const UpdatePlanningSessionDocument = new TypedDocumentString(`
    mutation UpdatePlanningSession($input: UpdatePlanningSessionInput!) {
  updatePlanningSession(input: $input) {
    session {
      ...PlanningSessionFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment QuantityFields on Quantity {
  value
  unit
}
fragment PlanningSessionFields on PlanningSession {
  id
  version
  mode
  stage
  status
  areaId
  communityId
  selectedPlanOptionId
  inputsRevision
  updatedAt
  area {
    id
    name
  }
  goal {
    id
    kind
    description
    timelineDays
    priority
    budget {
      ...MoneyFields
    }
    target {
      mode
      quantity {
        ...QuantityFields
      }
    }
  }
  scenario {
    id
    confirmed
    interpretedFrom
    adjustments {
      parameter
      change
      quantity {
        ...QuantityFields
      }
    }
  }
}`) as unknown as TypedDocumentString<UpdatePlanningSessionMutation, UpdatePlanningSessionMutationVariables>;
export const AreaReadinessDocument = new TypedDocumentString(`
    query AreaReadiness($areaId: ID!, $sessionId: ID) {
  area(id: $areaId) {
    id
    name
    evidence
    readiness(sessionId: $sessionId) {
      ...AreaReadinessFields
    }
  }
}
    fragment AreaReadinessFields on AreaReadiness {
  areaId
  sessionId
  assessedAt
  asOf
  demo
  basis
  capabilities {
    capability
    state
    reasons
    technicalSupport
    requiresLocalMeasurement
    requiresReviewedModel
    registeredSourceIds
    demo
  }
  inputs {
    input
    label
    unit
    state
    reasons
    action
    manualEntryAllowed
    ownerPrompt
    manualValue
    demo
  }
  metrics {
    metric
    state
    reasons
    blockedInputs
    demo
  }
}`) as unknown as TypedDocumentString<AreaReadinessQuery, AreaReadinessQueryVariables>;
export const RecordManualInputDocument = new TypedDocumentString(`
    mutation RecordManualInput($input: RecordManualInputInput!) {
  recordManualInput(input: $input) {
    manualInput {
      id
      input
      value
      unit
      enteredValue
      enteredUnit
      asOf
      note
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}`) as unknown as TypedDocumentString<RecordManualInputMutation, RecordManualInputMutationVariables>;
export const ReportsDocument = new TypedDocumentString(`
    query Reports($filter: ReportFilter, $first: Int, $after: String) {
  reports(filter: $filter, first: $first, after: $after) {
    nodes {
      ...ReportFields
    }
    pageInfo {
      ...PageInfoFields
    }
  }
}
    fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
fragment ReportFields on Report {
  id
  version
  title
  status
  sessionId
  communityId
  areaId
  planOptionId
  finalizedAt
  archivedAt
}`) as unknown as TypedDocumentString<ReportsQuery, ReportsQueryVariables>;
export const ReportDocument = new TypedDocumentString(`
    query Report($id: ID!) {
  report(id: $id) {
    ...ReportFields
    proposals(first: 10) {
      nodes {
        ...ProposalFields
      }
      pageInfo {
        ...PageInfoFields
      }
    }
  }
}
    fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
fragment JobFields on Job {
  id
  version
  kind
  status
  stage
  attempts
  maxAttempts
  errorCode
  eventsPath
  updatedAt
}
fragment ReportFields on Report {
  id
  version
  title
  status
  sessionId
  communityId
  areaId
  planOptionId
  finalizedAt
  archivedAt
}
fragment ProposalFields on Proposal {
  id
  version
  reportId
  sections
  status
  flaggedCount
  downloadPath
  job {
    ...JobFields
  }
}`) as unknown as TypedDocumentString<ReportQuery, ReportQueryVariables>;
export const ProposalDocument = new TypedDocumentString(`
    query Proposal($id: ID!) {
  proposal(id: $id) {
    ...ProposalFields
  }
}
    fragment JobFields on Job {
  id
  version
  kind
  status
  stage
  attempts
  maxAttempts
  errorCode
  eventsPath
  updatedAt
}
fragment ProposalFields on Proposal {
  id
  version
  reportId
  sections
  status
  flaggedCount
  downloadPath
  job {
    ...JobFields
  }
}`) as unknown as TypedDocumentString<ProposalQuery, ProposalQueryVariables>;
export const JobDocument = new TypedDocumentString(`
    query Job($id: ID!) {
  job(id: $id) {
    ...JobFields
  }
}
    fragment JobFields on Job {
  id
  version
  kind
  status
  stage
  attempts
  maxAttempts
  errorCode
  eventsPath
  updatedAt
}`) as unknown as TypedDocumentString<JobQuery, JobQueryVariables>;
export const FinalizeReportDocument = new TypedDocumentString(`
    mutation FinalizeReport($input: FinalizeReportInput!) {
  finalizeReport(input: $input) {
    report {
      ...ReportFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment ReportFields on Report {
  id
  version
  title
  status
  sessionId
  communityId
  areaId
  planOptionId
  finalizedAt
  archivedAt
}`) as unknown as TypedDocumentString<FinalizeReportMutation, FinalizeReportMutationVariables>;
export const ArchiveReportDocument = new TypedDocumentString(`
    mutation ArchiveReport($input: ArchiveReportInput!) {
  archiveReport(input: $input) {
    report {
      ...ReportFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment ReportFields on Report {
  id
  version
  title
  status
  sessionId
  communityId
  areaId
  planOptionId
  finalizedAt
  archivedAt
}`) as unknown as TypedDocumentString<ArchiveReportMutation, ArchiveReportMutationVariables>;
export const GenerateProposalDocument = new TypedDocumentString(`
    mutation GenerateProposal($input: GenerateProposalInput!) {
  generateProposal(input: $input) {
    proposal {
      ...ProposalFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment JobFields on Job {
  id
  version
  kind
  status
  stage
  attempts
  maxAttempts
  errorCode
  eventsPath
  updatedAt
}
fragment ProposalFields on Proposal {
  id
  version
  reportId
  sections
  status
  flaggedCount
  downloadPath
  job {
    ...JobFields
  }
}`) as unknown as TypedDocumentString<GenerateProposalMutation, GenerateProposalMutationVariables>;
export const MyImplementationProjectsDocument = new TypedDocumentString(`
    query MyImplementationProjects($first: Int, $after: String) {
  myImplementationProjects(first: $first, after: $after) {
    nodes {
      ...ProjectFields
    }
    pageInfo {
      ...PageInfoFields
    }
  }
}
    fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
fragment ProjectFields on ImplementationProject {
  id
  version
  reportId
  communityId
  title
  status
  startedAt
}`) as unknown as TypedDocumentString<MyImplementationProjectsQuery, MyImplementationProjectsQueryVariables>;
export const ImplementationProjectDocument = new TypedDocumentString(`
    query ImplementationProject($id: ID!) {
  implementationProject(id: $id) {
    ...ProjectFields
    milestones(first: 30) {
      nodes {
        ...MilestoneFields
      }
      pageInfo {
        ...PageInfoFields
      }
    }
  }
}
    fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
fragment ProjectFields on ImplementationProject {
  id
  version
  reportId
  communityId
  title
  status
  startedAt
}
fragment MilestoneFields on Milestone {
  id
  version
  projectId
  title
  plannedOn
  status
  completedAt
}`) as unknown as TypedDocumentString<ImplementationProjectQuery, ImplementationProjectQueryVariables>;
export const ObservationsDocument = new TypedDocumentString(`
    query Observations($projectId: ID!, $first: Int, $after: String) {
  implementationProject(id: $projectId) {
    id
    observations(first: $first, after: $after) {
      nodes {
        ...ObservationFields
      }
      pageInfo {
        ...PageInfoFields
      }
    }
  }
}
    fragment QuantityFields on Quantity {
  value
  unit
}
fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
fragment ObservationFields on Observation {
  id
  version
  projectId
  metricId
  observedOn
  method
  note
  evidence
  recordedByViewer
  quantity {
    ...QuantityFields
  }
}`) as unknown as TypedDocumentString<ObservationsQuery, ObservationsQueryVariables>;
export const StartImplementationProjectDocument = new TypedDocumentString(`
    mutation StartImplementationProject($input: StartImplementationProjectInput!) {
  startImplementationProject(input: $input) {
    project {
      ...ProjectFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment ProjectFields on ImplementationProject {
  id
  version
  reportId
  communityId
  title
  status
  startedAt
}`) as unknown as TypedDocumentString<StartImplementationProjectMutation, StartImplementationProjectMutationVariables>;
export const UpdateMilestoneDocument = new TypedDocumentString(`
    mutation UpdateMilestone($input: UpdateMilestoneInput!) {
  updateMilestone(input: $input) {
    milestone {
      ...MilestoneFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment MilestoneFields on Milestone {
  id
  version
  projectId
  title
  plannedOn
  status
  completedAt
}`) as unknown as TypedDocumentString<UpdateMilestoneMutation, UpdateMilestoneMutationVariables>;
export const RecordObservationDocument = new TypedDocumentString(`
    mutation RecordObservation($input: RecordObservationInput!) {
  recordObservation(input: $input) {
    observation {
      ...ObservationFields
    }
    error {
      ...MutationErrorFields
    }
  }
}
    fragment MutationErrorFields on MutationError {
  code
  message
  fieldErrors {
    field
    message
  }
  currentVersion
  requestId
}
fragment QuantityFields on Quantity {
  value
  unit
}
fragment ObservationFields on Observation {
  id
  version
  projectId
  metricId
  observedOn
  method
  note
  evidence
  recordedByViewer
  quantity {
    ...QuantityFields
  }
}`) as unknown as TypedDocumentString<RecordObservationMutation, RecordObservationMutationVariables>;