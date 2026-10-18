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

export type AddProjectExpenseInput = {
  amount: MoneyInput;
  description: string;
  expectedVersion: number;
  projectId: string;
  source: string;
  spentOn: string;
};

export type AdjustmentChange =
  | 'DECREASE_BY'
  | 'INCREASE_BY'
  | 'SET_TO';

export type AdminContextInput = {
  admin1?: string | null | undefined;
  admin2?: string | null | undefined;
  countryName?: string | null | undefined;
  locality?: string | null | undefined;
  sublocality?: string | null | undefined;
};

export type AiUnavailableReason =
  | 'BUDGET_EXHAUSTED'
  | 'DISABLED'
  | 'NOT_INVITED'
  | 'NO_BUDGET_CONFIGURED';

export type ApplicantInformationInput = {
  applicantType?: string | null | undefined;
  availableDocuments?: Array<string> | null | undefined;
  providedInformation?: Array<string>;
  requestedAmount?: MoneyInput | null | undefined;
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

/** Why a baseline value is unavailable. */
export type BaselineReason =
  | 'EMPTY_WINDOW'
  | 'INCOMPATIBLE_UNIT'
  | 'INCONSISTENT_INPUTS'
  | 'MISSING_INPUT'
  | 'MIXED_RESOLUTION'
  | 'NEEDS_DAILY_SERIES'
  | 'NEEDS_FORWARD_SERIES'
  | 'SERIES_TOO_SHORT'
  | 'UNSUPPORTED_FORMAT'
  | 'ZERO_MEAN_DEMAND'
  | 'ZERO_TOTAL_DEMAND'
  | 'ZERO_TOTAL_SUPPLY';

export type BenefitTiming =
  | 'AFTER_COMMISSIONING'
  | 'AFTER_RAINFALL'
  | 'AFTER_WET_SEASONS';

export type BoundaryLevel =
  | 'AREA'
  | 'SHARED_SYSTEM'
  | 'SITE';

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

export type CatalogueStatus =
  | 'ACTIVE'
  | 'DEMO'
  | 'DRAFT'
  | 'EXPIRED'
  | 'WITHDRAWN';

export type CitationKind =
  | 'CATALOGUE'
  | 'COMPARISON'
  | 'CONNECTIVITY'
  | 'SITE_FACT'
  | 'SOURCE'
  | 'USER_INPUT';

export type CommunityBaselineInput = {
  areaId: string;
  asOf: string;
  concern: string;
  dailyUse?: string | null | undefined;
  demandEstimated: boolean;
  demandSource: string;
  notes: string;
  residents?: number | null | undefined;
  sources: Array<WaterSourceInput>;
  supplyComplete: boolean;
};

export type CommunityFilter = {
  archivedOnly?: boolean;
  areaId?: string | null | undefined;
  includeArchived?: boolean;
};

export type CommunityStatus =
  | 'ACTIVE'
  | 'ARCHIVED';

export type CommunityType =
  | 'APARTMENT'
  | 'OTHER'
  | 'RESIDENTIAL';

export type ComparisonStatus =
  | 'COMPARABLE'
  | 'UNKNOWN';

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
  contactEmail?: string | null | undefined;
  contactName: string;
  description?: string;
  idempotencyKey: string;
  name: string;
  reportId: string;
  shareContactEmail?: boolean;
  shareContactName?: boolean;
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

export type DayRangeInput = {
  high: number;
  low: number;
};

export type EffectDirection =
  | 'EITHER'
  | 'POSSIBLE_BENEFIT'
  | 'POSSIBLE_HARM';

export type EffectEstimateInput = {
  high: string;
  key: string;
  low: string;
};

/** Where an effect value came from: USER_ESTIMATE (your range), BASELINE (the sourced baseline value) or SCENARIO (set by the confirmed what-if). The catalogue never supplies effect values. */
export type EffectOrigin =
  | 'BASELINE'
  | 'SCENARIO'
  | 'USER_ESTIMATE';

export type EligibilityStatus =
  | 'ELIGIBLE'
  | 'INELIGIBLE'
  | 'NEEDS_INFORMATION';

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

export type FindingBasis =
  | 'DECLARED'
  | 'ENGINE_ESTIMATE'
  | 'MECHANISM'
  | 'SOURCED';

export type FindingKind =
  | 'EXTERNALITY'
  | 'FALSE_RESILIENCE'
  | 'LOCAL_BENEFIT'
  | 'TRADEOFF';

export type FundingMatchStatus =
  | 'ADDED'
  | 'CANDIDATE'
  | 'DISMISSED';

/** A declared source of money; only approved funding counts. */
export type FundingSourceInput = {
  amount: MoneyInput;
  label: string;
  note?: string;
  status: FundingStatus;
};

export type FundingStatus =
  | 'APPROVED'
  | 'EXPECTED'
  | 'PROPOSED';

export type GenerateProposalInput = {
  applicant?: ProposalApplicantInput | null | undefined;
  idempotencyKey: string;
  reportId: string;
  schemeId?: string | null | undefined;
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
  also?: Array<GoalKind>;
  budget?: MoneyInput | null | undefined;
  confirmed?: boolean;
  contingencyRatio?: string | null | undefined;
  description?: string;
  estimates?: Array<MeasureEstimateInput>;
  funding?: Array<FundingSourceInput>;
  horizonDays?: number | null | undefined;
  kind: GoalKind;
  preferredInterventions?: Array<string>;
  priority?: Priority | null | undefined;
  site?: SiteConstraintsInput | null | undefined;
  target?: GoalTargetInput | null | undefined;
  targetParameter?: string | null | undefined;
  timelineDays?: number | null | undefined;
  waterTariff?: WaterTariffInput | null | undefined;
};

export type GoalKind =
  | 'CUSTOM'
  | 'IMPROVE_GROUNDWATER'
  | 'IMPROVE_WATER_QUALITY'
  | 'REDUCE_FLOOD_RISK'
  | 'REDUCE_SHORTAGE'
  | 'REDUCE_TANKER_DEPENDENCE'
  | 'REDUCE_WATER_BILLS';

export type GoalOutcome =
  | 'FEASIBLE'
  | 'INFEASIBLE'
  | 'NOT_ASSESSABLE';

export type GoalTargetInput = {
  mode: TargetMode;
  quantity: QuantityInput;
};

export type GroundwaterReliance =
  | 'DECLARED'
  | 'NONE_RECORDED'
  | 'SOURCED'
  | 'UNKNOWN';

export type IndicatorStatistic =
  | 'LATEST'
  | 'WINDOW_MEAN'
  | 'WINDOW_TOTAL';

export type InterventionFamily =
  | 'DEMAND_CONSERVATION'
  | 'GREYWATER_REUSE'
  | 'LEAKAGE_REDUCTION'
  | 'RAINWATER_HARVESTING'
  | 'RECHARGE'
  | 'STORAGE'
  | 'STORMWATER';

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

/** Whether places share a system, from reviewed evidence only. Unknown unless a record says otherwise; being close never decides it. */
export type Linkage =
  | 'LINKED'
  | 'NOT_LINKED'
  | 'UNKNOWN';

export type MatchFundingInput = {
  idempotencyKey: string;
  information?: ApplicantInformationInput | null | undefined;
  planOptionId: string;
  semanticQuery?: string | null | undefined;
  sessionId: string;
};

export type MeasureEstimateInput = {
  buildDays?: DayRangeInput | null | undefined;
  cost?: MoneyRangeInput | null | undefined;
  effects?: Array<EffectEstimateInput>;
  interventionId: string;
  note?: string;
  recurring?: MoneyRangeInput | null | undefined;
};

export type MembershipRole =
  | 'COORDINATOR'
  | 'MEMBER';

export type MilestoneInput = {
  plannedOn: string;
  responsibleIdentity?: string | null | undefined;
  tasks?: Array<string>;
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

export type MoneyRangeInput = {
  high: MoneyInput;
  low: MoneyInput;
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

export type ObservationMethod =
  | 'ADMINISTRATIVE_RECORD'
  | 'IN_SITU_MEASUREMENT'
  | 'MODEL_OUTPUT'
  | 'REMOTE_SENSING'
  | 'SURVEY';

export type ObservationSourceType =
  | 'PERMITTED_DOCUMENT'
  | 'USER_RECORDED';

export type PaybackOutcome =
  | 'BEYOND_HORIZON'
  | 'NEVER'
  | 'UNCERTAIN'
  | 'WITHIN_HORIZON';

/** OPTIONS, or why there are none: NO_FEASIBLE_PLAN, NEEDS_INPUT, TARGET_ALREADY_MET, NOT_SUPPORTED. */
export type PlanComparisonStatus =
  | 'NEEDS_INPUT'
  | 'NOT_SUPPORTED'
  | 'NO_FEASIBLE_PLAN'
  | 'OPTIONS'
  | 'TARGET_ALREADY_MET';

export type PlanMetric =
  | 'SHORTAGE_DAYS'
  | 'TANKER_DEPENDENCE';

export type PlanningMode =
  | 'AGENT'
  | 'TRADITIONAL';

/** Omitted fields are left unchanged; null clears a field. */
export type PlanningSessionPatch = {
  areaId?: string | null | undefined;
  baselineReviewed?: boolean | null | undefined;
  communityBaseline?: CommunityBaselineInput | null | undefined;
  goal?: GoalInput | null | undefined;
  mode?: PlanningMode | null | undefined;
  scenario?: ScenarioInput | null | undefined;
  selectedPlanOptionId?: string | null | undefined;
  siteProfile?: SiteProfileInput | null | undefined;
  stage?: PlanningStage | null | undefined;
};

export type PlanningStage =
  | 'BASELINE'
  | 'BASELINE_INPUTS'
  | 'BASELINE_OVERVIEW'
  | 'COMPARE'
  | 'GOAL'
  | 'MAKE_IT_HAPPEN'
  | 'REVIEW'
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

export type ProposalApplicantInput = {
  assumptions?: Array<string>;
  category: string;
  contactEmail?: string | null | undefined;
  name: string;
  organization: string;
};

export type ProposalSection =
  | 'ASSUMPTIONS'
  | 'BASELINE'
  | 'COSTS'
  | 'EXECUTIVE_SUMMARY'
  | 'FUNDING'
  | 'PLAN'
  | 'SOURCES'
  | 'WIDER_IMPACT';

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
  | 'DAILY_DEMAND'
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
  areaId?: string | null | undefined;
  coverageExpectedDays: number;
  coverageObservedDays: number;
  idempotencyKey: string;
  method: string;
  metricId: string;
  note?: string;
  observedOn: string;
  permittedSourceConfirmed?: boolean;
  projectId: string;
  quantity: QuantityInput;
  source: string;
  sourceType?: ObservationSourceType;
  windowEnd: string;
  windowStart: string;
};

export type ReportFilter = {
  /** Omit for your own reports. */
  communityId?: string | null | undefined;
  status?: ReportStatus | null | undefined;
};

export type ReportStatus =
  | 'ARCHIVED'
  | 'FINALIZED';

export type ReviewKind =
  | 'HYDROGEOLOGICAL'
  | 'STRUCTURAL'
  | 'WATER_QUALITY';

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

export type ScenarioPreviewAdjustmentInput = {
  change: AdjustmentChange;
  parameter: string;
  quantity: QuantityInput;
};

export type ScenarioPreviewInput = {
  adjustments?: Array<ScenarioPreviewAdjustmentInput>;
};

/** Whether the chosen plan still matches a fresh assessment; only CURRENT or LEGACY can be finalized. */
export type SelectedPlanStatus =
  | 'CURRENT'
  | 'IMPACT_CHANGED'
  | 'LEGACY'
  | 'NONE'
  | 'NOT_CURRENT';

export type SessionStatus =
  | 'ACTIVE'
  | 'CLOSED';

/** A system that can carry a measure's effect beyond the site. */
export type SharedSystem =
  | 'AQUIFER'
  | 'CATCHMENT'
  | 'SUPPLY_NETWORK';

export type SiteConstraintsInput = {
  groundwaterUse?: boolean | null | undefined;
  openGround?: QuantityInput | null | undefined;
  pipedSupply?: boolean | null | undefined;
  restrictions?: Array<SiteRestriction>;
  roofArea?: QuantityInput | null | undefined;
  scale?: SiteScale | null | undefined;
  storageSpace?: boolean | null | undefined;
};

export type SiteProfileInput = {
  communityType?: CommunityType | null | undefined;
  occupiedHomes?: number | null | undefined;
};

export type SiteRequirement =
  | 'OPEN_GROUND'
  | 'PIPED_SUPPLY'
  | 'ROOF_AREA'
  | 'STORAGE_SPACE';

export type SiteRestriction =
  | 'NO_EXCAVATION'
  | 'NO_GREYWATER_REUSE'
  | 'NO_PERMIT_WORKS'
  | 'NO_RECHARGE'
  | 'NO_STRUCTURAL_CHANGES';

export type SiteScale =
  | 'BUILDING'
  | 'HOUSEHOLD'
  | 'NEIGHBOURHOOD'
  | 'UTILITY';

export type StartImplementationProjectInput = {
  idempotencyKey: string;
  milestones?: Array<MilestoneInput>;
  reportId: string;
  shareWithCommunity?: boolean;
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
  completedOn?: string | null | undefined;
  expectedVersion: number;
  id: string;
  status: MilestoneStatus;
};

export type UpdatePlanningSessionInput = {
  expectedVersion: number;
  id: string;
  patch: PlanningSessionPatch;
};

export type UpdateProjectStatusInput = {
  expectedVersion: number;
  projectId: string;
  status: ProjectStatus;
};

/** Measured, your estimate or modelled; shown distinctly wherever a value is. */
export type ValueOrigin =
  | 'MEASURED'
  | 'MODELED'
  | 'USER_ESTIMATE';

export type WaterSourceInput = {
  estimated: boolean;
  kind: string;
  method: string;
  multiplier: string;
  name: string;
  periodDays: number;
  quantity?: string | null | undefined;
  source: string;
};

/** The tanker-water price you pay now; your estimate, never converted. */
export type WaterTariffInput = {
  note?: string;
  price: MoneyInput;
  volume: QuantityInput;
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

export type AiStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type AiStatusQuery = { aiStatus: { available: boolean, reason: AiUnavailableReason | null, modelId: string, requestsRemaining: number, dailyRequestLimit: number, budgetConfigured: boolean, suggestedDailyBudgetUsd: string } };

export type EvidenceLinkFieldsFragment = { input: ReadinessInput | null, capability: Capability | null, snapshotId: string | null, manualInputId: string | null, title: string, publisher: string | null, url: string | null, asOf: string | null, quality: EvidenceQuality | null, method: ObservationMethod | null, uncertainty: string, note: string | null, demo: boolean };

export type BaselineFieldsFragment = { id: string, areaId: string, sessionId: string | null, asOf: string, engineVersion: string, exceedanceP: string, windowDays: number, demo: boolean, basis: AssessmentBasis, missingEssentials: Array<ReadinessInput>, missingOptional: Array<ReadinessInput>, notes: Array<string>, window: { start: string, endExclusive: string, days: number } | null, metrics: Array<{ metric: string, name: string, formula: string, unit: CanonicalUnit, availability: Availability, exact: string | null, value: string | null, reason: BaselineReason | null, reasons: Array<string>, origin: ValueOrigin | null, daily: boolean, asOf: string | null, assumptions: Array<string>, demo: boolean, recordedDays: number | null, periodDays: number | null, evidence: Array<{ input: ReadinessInput | null, capability: Capability | null, snapshotId: string | null, manualInputId: string | null, title: string, publisher: string | null, url: string | null, asOf: string | null, quality: EvidenceQuality | null, method: ObservationMethod | null, uncertainty: string, note: string | null, demo: boolean }>, supporting: Array<{ key: string, exact: string, value: string, unit: CanonicalUnit }> }>, indicators: Array<{ indicator: string, name: string, capability: Capability, statistic: IndicatorStatistic, variable: string | null, parameter: string | null, unit: CanonicalUnit | null, availability: Availability, exact: string | null, value: string | null, observedOn: string | null, reason: BaselineReason | null, reasons: Array<string>, origin: ValueOrigin | null, demo: boolean, window: { start: string, endExclusive: string, days: number } | null, evidence: Array<{ input: ReadinessInput | null, capability: Capability | null, snapshotId: string | null, manualInputId: string | null, title: string, publisher: string | null, url: string | null, asOf: string | null, quality: EvidenceQuality | null, method: ObservationMethod | null, uncertainty: string, note: string | null, demo: boolean }> }>, chart: { monthly: boolean, buckets: Array<{ start: string, endExclusive: string, days: number }>, series: Array<{ key: string, values: Array<string | null>, origin: ValueOrigin | null, demo: boolean }> } | null };

export type AreaBaselineQueryVariables = Exact<{
  areaId: string;
  sessionId?: string | null | undefined;
}>;


export type AreaBaselineQuery = { area: { id: string, name: string, unitSystem: UnitSystem, baseline: { id: string, areaId: string, sessionId: string | null, asOf: string, engineVersion: string, exceedanceP: string, windowDays: number, demo: boolean, basis: AssessmentBasis, missingEssentials: Array<ReadinessInput>, missingOptional: Array<ReadinessInput>, notes: Array<string>, window: { start: string, endExclusive: string, days: number } | null, metrics: Array<{ metric: string, name: string, formula: string, unit: CanonicalUnit, availability: Availability, exact: string | null, value: string | null, reason: BaselineReason | null, reasons: Array<string>, origin: ValueOrigin | null, daily: boolean, asOf: string | null, assumptions: Array<string>, demo: boolean, recordedDays: number | null, periodDays: number | null, evidence: Array<{ input: ReadinessInput | null, capability: Capability | null, snapshotId: string | null, manualInputId: string | null, title: string, publisher: string | null, url: string | null, asOf: string | null, quality: EvidenceQuality | null, method: ObservationMethod | null, uncertainty: string, note: string | null, demo: boolean }>, supporting: Array<{ key: string, exact: string, value: string, unit: CanonicalUnit }> }>, indicators: Array<{ indicator: string, name: string, capability: Capability, statistic: IndicatorStatistic, variable: string | null, parameter: string | null, unit: CanonicalUnit | null, availability: Availability, exact: string | null, value: string | null, observedOn: string | null, reason: BaselineReason | null, reasons: Array<string>, origin: ValueOrigin | null, demo: boolean, window: { start: string, endExclusive: string, days: number } | null, evidence: Array<{ input: ReadinessInput | null, capability: Capability | null, snapshotId: string | null, manualInputId: string | null, title: string, publisher: string | null, url: string | null, asOf: string | null, quality: EvidenceQuality | null, method: ObservationMethod | null, uncertainty: string, note: string | null, demo: boolean }> }>, chart: { monthly: boolean, buckets: Array<{ start: string, endExclusive: string, days: number }>, series: Array<{ key: string, values: Array<string | null>, origin: ValueOrigin | null, demo: boolean }> } | null } } | null };

export type MutationErrorFieldsFragment = { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> };

export type MoneyFieldsFragment = { minorUnits: string, currency: string, exponent: number };

export type QuantityFieldsFragment = { value: string, unit: Unit };

export type PageInfoFieldsFragment = { hasNextPage: boolean, endCursor: string | null };

export type MembershipFieldsFragment = { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string };

export type CommunityFieldsFragment = { id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, contactName: string | null, contactEmail: string | null, area: { id: string, name: string, countryCode: string, mapLatitude: string, mapLongitude: string } | null, sharedReport: { goal: string, finalizedAt: string } | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null };

export type CommunitiesQueryVariables = Exact<{
  filter?: CommunityFilter | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type CommunitiesQuery = { communities: { nodes: Array<{ id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, contactName: string | null, contactEmail: string | null, area: { id: string, name: string, countryCode: string, mapLatitude: string, mapLongitude: string } | null, sharedReport: { goal: string, finalizedAt: string } | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type NearbyCommunitiesQueryVariables = Exact<{
  near: NearbyCommunitiesInput;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type NearbyCommunitiesQuery = { nearbyCommunities: { candidatesTruncated: boolean, nodes: Array<{ distanceMeters: number, community: { id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, contactName: string | null, contactEmail: string | null, area: { id: string, name: string, countryCode: string, mapLatitude: string, mapLongitude: string } | null, sharedReport: { goal: string, finalizedAt: string } | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type CommunityQueryVariables = Exact<{
  id: string;
}>;


export type CommunityQuery = { community: { id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, contactName: string | null, contactEmail: string | null, area: { id: string, name: string, countryCode: string, mapLatitude: string, mapLongitude: string } | null, sharedReport: { goal: string, finalizedAt: string } | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null } | null };

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


export type MyMembershipsQuery = { myMemberships: { nodes: Array<{ id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string, community: { id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, contactName: string | null, contactEmail: string | null, area: { id: string, name: string, countryCode: string, mapLatitude: string, mapLongitude: string } | null, sharedReport: { goal: string, finalizedAt: string } | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type CommunitySourceReportsQueryVariables = Exact<{
  filter?: ReportFilter | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type CommunitySourceReportsQuery = { reports: { nodes: Array<{ id: string, title: string, status: ReportStatus, finalizedAt: string, goal: { kind: GoalKind }, area: { id: string, name: string, private: boolean } | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type CreateCommunityMutationVariables = Exact<{
  input: CreateCommunityInput;
}>;


export type CreateCommunityMutation = { createCommunity: { community: { id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, contactName: string | null, contactEmail: string | null, area: { id: string, name: string, countryCode: string, mapLatitude: string, mapLongitude: string } | null, sharedReport: { goal: string, finalizedAt: string } | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

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


export type ArchiveCommunityMutation = { archiveCommunity: { community: { id: string, version: number, name: string, description: string, areaId: string | null, status: CommunityStatus, memberCount: number, archivedAt: string | null, contactName: string | null, contactEmail: string | null, area: { id: string, name: string, countryCode: string, mapLatitude: string, mapLongitude: string } | null, sharedReport: { goal: string, finalizedAt: string } | null, viewerMembership: { id: string, version: number, communityId: string, role: MembershipRole, isViewer: boolean, joinedAt: string } | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type FundingMatchFieldsFragment = { id: string, version: number, sessionId: string, planOptionId: string, metCount: number, notMetCount: number, needsCheckCount: number, window: WindowStatus, status: FundingMatchStatus, rulesVersion: string, eligibility: EligibilityStatus, relevanceOrder: number | null, rankingStatus: string, rankingReason: string, eligibilityEvidence: Array<{ criterionId: string, status: CriterionStatus, reason: string }>, results: Array<{ criterionId: string, status: CriterionStatus, reason: string }>, scheme: { id: string, name: string, funder: string, summary: string, currency: string, opensOn: string | null, closesOn: string | null, sourceUrl: string, lastVerifiedAt: string, deadlineAt: string | null, deadlineTimezone: string | null, sourceHash: string | null, status: CatalogueStatus, officialSource: boolean, geography: Array<string>, applicantCategories: Array<string>, interventions: Array<string>, amountRules: string | null, evidence: EvidenceQuality, requiredDocuments: Array<string>, maxAmount: { minorUnits: string, currency: string, exponent: number } | null, criteria: Array<{ id: string, text: string, machineCheckable: boolean }> } };

export type FundingMatchesQueryVariables = Exact<{
  sessionId: string;
  planOptionId?: string | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type FundingMatchesQuery = { fundingMatches: { nodes: Array<{ id: string, version: number, sessionId: string, planOptionId: string, metCount: number, notMetCount: number, needsCheckCount: number, window: WindowStatus, status: FundingMatchStatus, rulesVersion: string, eligibility: EligibilityStatus, relevanceOrder: number | null, rankingStatus: string, rankingReason: string, eligibilityEvidence: Array<{ criterionId: string, status: CriterionStatus, reason: string }>, results: Array<{ criterionId: string, status: CriterionStatus, reason: string }>, scheme: { id: string, name: string, funder: string, summary: string, currency: string, opensOn: string | null, closesOn: string | null, sourceUrl: string, lastVerifiedAt: string, deadlineAt: string | null, deadlineTimezone: string | null, sourceHash: string | null, status: CatalogueStatus, officialSource: boolean, geography: Array<string>, applicantCategories: Array<string>, interventions: Array<string>, amountRules: string | null, evidence: EvidenceQuality, requiredDocuments: Array<string>, maxAmount: { minorUnits: string, currency: string, exponent: number } | null, criteria: Array<{ id: string, text: string, machineCheckable: boolean }> } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type MatchFundingMutationVariables = Exact<{
  input: MatchFundingInput;
}>;


export type MatchFundingMutation = { matchFunding: { matches: Array<{ id: string, version: number, sessionId: string, planOptionId: string, metCount: number, notMetCount: number, needsCheckCount: number, window: WindowStatus, status: FundingMatchStatus, rulesVersion: string, eligibility: EligibilityStatus, relevanceOrder: number | null, rankingStatus: string, rankingReason: string, eligibilityEvidence: Array<{ criterionId: string, status: CriterionStatus, reason: string }>, results: Array<{ criterionId: string, status: CriterionStatus, reason: string }>, scheme: { id: string, name: string, funder: string, summary: string, currency: string, opensOn: string | null, closesOn: string | null, sourceUrl: string, lastVerifiedAt: string, deadlineAt: string | null, deadlineTimezone: string | null, sourceHash: string | null, status: CatalogueStatus, officialSource: boolean, geography: Array<string>, applicantCategories: Array<string>, interventions: Array<string>, amountRules: string | null, evidence: EvidenceQuality, requiredDocuments: Array<string>, maxAmount: { minorUnits: string, currency: string, exponent: number } | null, criteria: Array<{ id: string, text: string, machineCheckable: boolean }> } }> | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type FundingCatalogueQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type FundingCatalogueQuery = { fundingSchemes: { nodes: Array<{ id: string, name: string, funder: string, summary: string, evidence: EvidenceQuality, status: CatalogueStatus, officialSource: boolean, sourceUrl: string, lastVerifiedAt: string, amountRules: string | null, interventions: Array<string>, maxAmount: { minorUnits: string, currency: string, exponent: number } | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type GoalAssessmentFieldsFragment = { outcome: GoalOutcome, summary: string, nextSteps: Array<string>, catalogueVersion: string, baselineId: string | null, target: { outcome: GoalOutcome, message: string, metric: string | null, unit: Unit | null, baseline: string | null, targetLevel: string | null, caveats: Array<string> }, constraints: Array<{ code: string, message: string, outcome: GoalOutcome | null }>, conflicts: Array<{ code: string, message: string, outcome: GoalOutcome | null }>, interventions: Array<{ interventionId: string, name: string, family: InterventionFamily, relevant: boolean, outcome: GoalOutcome, benefit: string, preferred: boolean, site: { outcome: GoalOutcome, message: string }, cost: { outcome: GoalOutcome, message: string } | null, time: { outcome: GoalOutcome, message: string } | null }> };

export type InterventionCatalogueQueryVariables = Exact<{ [key: string]: never; }>;


export type InterventionCatalogueQuery = { interventionCatalogue: { version: string, interventions: Array<{ id: string, family: InterventionFamily, name: string, summary: string, serves: Array<GoalKind>, scales: Array<SiteScale>, requires: Array<SiteRequirement>, blockedBy: Array<SiteRestriction>, permissions: Array<string>, maintenance: Array<string>, costSources: Array<string>, construction: string, benefitTiming: BenefitTiming, benefitNote: string, evidence: Array<string>, effectModel: string | null, cautions: Array<string>, costInputs: Array<{ key: string, label: string }>, effectInputs: Array<{ key: string, label: string, unit: Unit, minimum: string, maximum: string, required: boolean, note: string }> }> } };

export type CheckGoalQueryVariables = Exact<{
  sessionId: string;
  goal: GoalInput;
}>;


export type CheckGoalQuery = { checkGoal: { errors: Array<{ field: string, message: string }>, assessment: { outcome: GoalOutcome, summary: string, nextSteps: Array<string>, catalogueVersion: string, baselineId: string | null, target: { outcome: GoalOutcome, message: string, metric: string | null, unit: Unit | null, baseline: string | null, targetLevel: string | null, caveats: Array<string> }, constraints: Array<{ code: string, message: string, outcome: GoalOutcome | null }>, conflicts: Array<{ code: string, message: string, outcome: GoalOutcome | null }>, interventions: Array<{ interventionId: string, name: string, family: InterventionFamily, relevant: boolean, outcome: GoalOutcome, benefit: string, preferred: boolean, site: { outcome: GoalOutcome, message: string }, cost: { outcome: GoalOutcome, message: string } | null, time: { outcome: GoalOutcome, message: string } | null }> } | null } };

export type GoalAssessmentQueryVariables = Exact<{
  sessionId: string;
}>;


export type GoalAssessmentQuery = { planningSession: { id: string, inputsRevision: number, goalAssessment: { outcome: GoalOutcome, summary: string, nextSteps: Array<string>, catalogueVersion: string, baselineId: string | null, target: { outcome: GoalOutcome, message: string, metric: string | null, unit: Unit | null, baseline: string | null, targetLevel: string | null, caveats: Array<string> }, constraints: Array<{ code: string, message: string, outcome: GoalOutcome | null }>, conflicts: Array<{ code: string, message: string, outcome: GoalOutcome | null }>, interventions: Array<{ interventionId: string, name: string, family: InterventionFamily, relevant: boolean, outcome: GoalOutcome, benefit: string, preferred: boolean, site: { outcome: GoalOutcome, message: string }, cost: { outcome: GoalOutcome, message: string } | null, time: { outcome: GoalOutcome, message: string } | null }> } | null } | null };

export type GoalAreaQueryVariables = Exact<{
  id: string;
}>;


export type GoalAreaQuery = { area: { id: string, name: string, currency: string | null } | null };

export type PlaceCandidateFieldsFragment = { placeId: string, name: string, formattedAddress: string | null, latitude: string, longitude: string, countryCode: string | null, scope: GeographicScope, types: Array<string>, admin: { countryName: string | null, admin1: string | null, admin2: string | null, locality: string | null, sublocality: string | null } };

export type AreaLocationFieldsFragment = { id: string, name: string, centroidLat: string, centroidLon: string, countryCode: string, timezone: string, currency: string | null, unitSystem: UnitSystem, regionSetByUser: Array<string>, evidence: EvidenceQuality, origin: AreaOrigin, scope: GeographicScope, extent: ExtentKind, radiusMeters: number | null, private: boolean, formattedAddress: string | null, accuracyMeters: number | null, hasBoundary: boolean, providerContentExpired: boolean, admin: { countryName: string | null, admin1: string | null, admin2: string | null, locality: string | null, sublocality: string | null } };

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


export type AreaLocationQuery = { area: { placeId: string | null, id: string, name: string, centroidLat: string, centroidLon: string, countryCode: string, timezone: string, currency: string | null, unitSystem: UnitSystem, regionSetByUser: Array<string>, evidence: EvidenceQuality, origin: AreaOrigin, scope: GeographicScope, extent: ExtentKind, radiusMeters: number | null, private: boolean, formattedAddress: string | null, accuracyMeters: number | null, hasBoundary: boolean, providerContentExpired: boolean, admin: { countryName: string | null, admin1: string | null, admin2: string | null, locality: string | null, sublocality: string | null } } | null };

export type ConfirmLocationMutationVariables = Exact<{
  input: ConfirmLocationInput;
}>;


export type ConfirmLocationMutation = { confirmLocation: { area: { id: string, name: string, centroidLat: string, centroidLon: string, countryCode: string, timezone: string, currency: string | null, unitSystem: UnitSystem, regionSetByUser: Array<string>, evidence: EvidenceQuality, origin: AreaOrigin, scope: GeographicScope, extent: ExtentKind, radiusMeters: number | null, private: boolean, formattedAddress: string | null, accuracyMeters: number | null, hasBoundary: boolean, providerContentExpired: boolean, admin: { countryName: string | null, admin1: string | null, admin2: string | null, locality: string | null, sublocality: string | null } } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type AreaFieldsFragment = { id: string, name: string, countryCode: string, timezone: string, evidence: EvidenceQuality };

export type PlanningSessionFieldsFragment = { id: string, version: number, mode: PlanningMode, stage: PlanningStage, baselineReviewed: boolean, status: SessionStatus, areaId: string | null, communityId: string | null, selectedPlanOptionId: string | null, inputsRevision: number, updatedAt: string, communityBaseline: { areaId: string, concern: string, notes: string, residents: number | null, dailyUse: string | null, demandEstimated: boolean, demandSource: string, asOf: string, supplyComplete: boolean, sources: Array<{ name: string, kind: string, method: string, quantity: string | null, multiplier: string, periodDays: number, estimated: boolean, source: string }> } | null, siteProfile: { communityType: CommunityType | null, occupiedHomes: number | null } | null, area: { id: string, name: string, extent: ExtentKind, radiusMeters: number | null, hasBoundary: boolean } | null, goal: { id: string, kind: GoalKind, description: string, targetParameter: string | null, timelineDays: number | null, horizonDays: number | null, priority: Priority | null, also: Array<GoalKind>, confirmed: boolean, preferredInterventions: Array<string>, contingencyRatio: string | null, waterTariff: { note: string, price: { minorUnits: string, currency: string, exponent: number }, volume: { value: string, unit: Unit } } | null, funding: Array<{ label: string, status: FundingStatus, note: string, amount: { minorUnits: string, currency: string, exponent: number } }>, budget: { minorUnits: string, currency: string, exponent: number } | null, target: { mode: TargetMode, quantity: { value: string, unit: Unit } } | null, site: { scale: SiteScale | null, storageSpace: boolean | null, pipedSupply: boolean | null, groundwaterUse: boolean | null, restrictions: Array<SiteRestriction>, roofArea: { value: string, unit: Unit } | null, openGround: { value: string, unit: Unit } | null }, estimates: Array<{ interventionId: string, note: string, cost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, recurring: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, buildDays: { low: number, high: number } | null, effects: Array<{ key: string, low: string, high: string }> }> } | null, scenario: { id: string, confirmed: boolean, interpretedFrom: string | null, adjustments: Array<{ parameter: string, change: AdjustmentChange, quantity: { value: string, unit: Unit } }> } | null };

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


export type CurrentPlanningSessionQuery = { currentPlanningSession: { id: string, version: number, mode: PlanningMode, stage: PlanningStage, baselineReviewed: boolean, status: SessionStatus, areaId: string | null, communityId: string | null, selectedPlanOptionId: string | null, inputsRevision: number, updatedAt: string, communityBaseline: { areaId: string, concern: string, notes: string, residents: number | null, dailyUse: string | null, demandEstimated: boolean, demandSource: string, asOf: string, supplyComplete: boolean, sources: Array<{ name: string, kind: string, method: string, quantity: string | null, multiplier: string, periodDays: number, estimated: boolean, source: string }> } | null, siteProfile: { communityType: CommunityType | null, occupiedHomes: number | null } | null, area: { id: string, name: string, extent: ExtentKind, radiusMeters: number | null, hasBoundary: boolean } | null, goal: { id: string, kind: GoalKind, description: string, targetParameter: string | null, timelineDays: number | null, horizonDays: number | null, priority: Priority | null, also: Array<GoalKind>, confirmed: boolean, preferredInterventions: Array<string>, contingencyRatio: string | null, waterTariff: { note: string, price: { minorUnits: string, currency: string, exponent: number }, volume: { value: string, unit: Unit } } | null, funding: Array<{ label: string, status: FundingStatus, note: string, amount: { minorUnits: string, currency: string, exponent: number } }>, budget: { minorUnits: string, currency: string, exponent: number } | null, target: { mode: TargetMode, quantity: { value: string, unit: Unit } } | null, site: { scale: SiteScale | null, storageSpace: boolean | null, pipedSupply: boolean | null, groundwaterUse: boolean | null, restrictions: Array<SiteRestriction>, roofArea: { value: string, unit: Unit } | null, openGround: { value: string, unit: Unit } | null }, estimates: Array<{ interventionId: string, note: string, cost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, recurring: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, buildDays: { low: number, high: number } | null, effects: Array<{ key: string, low: string, high: string }> }> } | null, scenario: { id: string, confirmed: boolean, interpretedFrom: string | null, adjustments: Array<{ parameter: string, change: AdjustmentChange, quantity: { value: string, unit: Unit } }> } | null } | null };

export type PlanningSessionQueryVariables = Exact<{
  id: string;
}>;


export type PlanningSessionQuery = { planningSession: { id: string, version: number, mode: PlanningMode, stage: PlanningStage, baselineReviewed: boolean, status: SessionStatus, areaId: string | null, communityId: string | null, selectedPlanOptionId: string | null, inputsRevision: number, updatedAt: string, communityBaseline: { areaId: string, concern: string, notes: string, residents: number | null, dailyUse: string | null, demandEstimated: boolean, demandSource: string, asOf: string, supplyComplete: boolean, sources: Array<{ name: string, kind: string, method: string, quantity: string | null, multiplier: string, periodDays: number, estimated: boolean, source: string }> } | null, siteProfile: { communityType: CommunityType | null, occupiedHomes: number | null } | null, area: { id: string, name: string, extent: ExtentKind, radiusMeters: number | null, hasBoundary: boolean } | null, goal: { id: string, kind: GoalKind, description: string, targetParameter: string | null, timelineDays: number | null, horizonDays: number | null, priority: Priority | null, also: Array<GoalKind>, confirmed: boolean, preferredInterventions: Array<string>, contingencyRatio: string | null, waterTariff: { note: string, price: { minorUnits: string, currency: string, exponent: number }, volume: { value: string, unit: Unit } } | null, funding: Array<{ label: string, status: FundingStatus, note: string, amount: { minorUnits: string, currency: string, exponent: number } }>, budget: { minorUnits: string, currency: string, exponent: number } | null, target: { mode: TargetMode, quantity: { value: string, unit: Unit } } | null, site: { scale: SiteScale | null, storageSpace: boolean | null, pipedSupply: boolean | null, groundwaterUse: boolean | null, restrictions: Array<SiteRestriction>, roofArea: { value: string, unit: Unit } | null, openGround: { value: string, unit: Unit } | null }, estimates: Array<{ interventionId: string, note: string, cost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, recurring: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, buildDays: { low: number, high: number } | null, effects: Array<{ key: string, low: string, high: string }> }> } | null, scenario: { id: string, confirmed: boolean, interpretedFrom: string | null, adjustments: Array<{ parameter: string, change: AdjustmentChange, quantity: { value: string, unit: Unit } }> } | null } | null };

export type PlanOptionsQueryVariables = Exact<{
  sessionId: string;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type PlanOptionsQuery = { planOptions: { nodes: Array<{ id: string, inputsRevision: number, name: string, summary: string, feasibility: Feasibility, bestFitReason: string | null, costUnavailableReason: string | null, costBasisDate: string | null, cost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, buildDays: { low: number, high: number } | null, impact: { id: string, assumptions: Array<string>, metrics: Array<{ metricId: string, baseline: { availability: Availability, reason: string | null, quantity: { value: string, unit: Unit } | null }, projectedLow: { availability: Availability, reason: string | null, quantity: { value: string, unit: Unit } | null }, projectedHigh: { availability: Availability, reason: string | null, quantity: { value: string, unit: Unit } | null } }>, neighbourEffect: { availability: Availability, reason: string | null } } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type CreatePlanningSessionMutationVariables = Exact<{
  input: CreatePlanningSessionInput;
}>;


export type CreatePlanningSessionMutation = { createPlanningSession: { session: { id: string, version: number, mode: PlanningMode, stage: PlanningStage, baselineReviewed: boolean, status: SessionStatus, areaId: string | null, communityId: string | null, selectedPlanOptionId: string | null, inputsRevision: number, updatedAt: string, communityBaseline: { areaId: string, concern: string, notes: string, residents: number | null, dailyUse: string | null, demandEstimated: boolean, demandSource: string, asOf: string, supplyComplete: boolean, sources: Array<{ name: string, kind: string, method: string, quantity: string | null, multiplier: string, periodDays: number, estimated: boolean, source: string }> } | null, siteProfile: { communityType: CommunityType | null, occupiedHomes: number | null } | null, area: { id: string, name: string, extent: ExtentKind, radiusMeters: number | null, hasBoundary: boolean } | null, goal: { id: string, kind: GoalKind, description: string, targetParameter: string | null, timelineDays: number | null, horizonDays: number | null, priority: Priority | null, also: Array<GoalKind>, confirmed: boolean, preferredInterventions: Array<string>, contingencyRatio: string | null, waterTariff: { note: string, price: { minorUnits: string, currency: string, exponent: number }, volume: { value: string, unit: Unit } } | null, funding: Array<{ label: string, status: FundingStatus, note: string, amount: { minorUnits: string, currency: string, exponent: number } }>, budget: { minorUnits: string, currency: string, exponent: number } | null, target: { mode: TargetMode, quantity: { value: string, unit: Unit } } | null, site: { scale: SiteScale | null, storageSpace: boolean | null, pipedSupply: boolean | null, groundwaterUse: boolean | null, restrictions: Array<SiteRestriction>, roofArea: { value: string, unit: Unit } | null, openGround: { value: string, unit: Unit } | null }, estimates: Array<{ interventionId: string, note: string, cost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, recurring: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, buildDays: { low: number, high: number } | null, effects: Array<{ key: string, low: string, high: string }> }> } | null, scenario: { id: string, confirmed: boolean, interpretedFrom: string | null, adjustments: Array<{ parameter: string, change: AdjustmentChange, quantity: { value: string, unit: Unit } }> } | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type UpdatePlanningSessionMutationVariables = Exact<{
  input: UpdatePlanningSessionInput;
}>;


export type UpdatePlanningSessionMutation = { updatePlanningSession: { session: { id: string, version: number, mode: PlanningMode, stage: PlanningStage, baselineReviewed: boolean, status: SessionStatus, areaId: string | null, communityId: string | null, selectedPlanOptionId: string | null, inputsRevision: number, updatedAt: string, communityBaseline: { areaId: string, concern: string, notes: string, residents: number | null, dailyUse: string | null, demandEstimated: boolean, demandSource: string, asOf: string, supplyComplete: boolean, sources: Array<{ name: string, kind: string, method: string, quantity: string | null, multiplier: string, periodDays: number, estimated: boolean, source: string }> } | null, siteProfile: { communityType: CommunityType | null, occupiedHomes: number | null } | null, area: { id: string, name: string, extent: ExtentKind, radiusMeters: number | null, hasBoundary: boolean } | null, goal: { id: string, kind: GoalKind, description: string, targetParameter: string | null, timelineDays: number | null, horizonDays: number | null, priority: Priority | null, also: Array<GoalKind>, confirmed: boolean, preferredInterventions: Array<string>, contingencyRatio: string | null, waterTariff: { note: string, price: { minorUnits: string, currency: string, exponent: number }, volume: { value: string, unit: Unit } } | null, funding: Array<{ label: string, status: FundingStatus, note: string, amount: { minorUnits: string, currency: string, exponent: number } }>, budget: { minorUnits: string, currency: string, exponent: number } | null, target: { mode: TargetMode, quantity: { value: string, unit: Unit } } | null, site: { scale: SiteScale | null, storageSpace: boolean | null, pipedSupply: boolean | null, groundwaterUse: boolean | null, restrictions: Array<SiteRestriction>, roofArea: { value: string, unit: Unit } | null, openGround: { value: string, unit: Unit } | null }, estimates: Array<{ interventionId: string, note: string, cost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, recurring: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, buildDays: { low: number, high: number } | null, effects: Array<{ key: string, low: string, high: string }> }> } | null, scenario: { id: string, confirmed: boolean, interpretedFrom: string | null, adjustments: Array<{ parameter: string, change: AdjustmentChange, quantity: { value: string, unit: Unit } }> } | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type ExactNumberFieldsFragment = { exact: string, value: string };

export type ScenarioComparisonFieldsFragment = { status: string, notes: Array<string>, baselineId: string | null, engineVersion: string, rows: Array<{ key: string, label: string, unit: Unit, reason: string | null, baseline: { exact: string, value: string } | null, scenario: { exact: string, value: string } | null, change: { exact: string, value: string } | null }> };

export type ImpactCitationFieldsFragment = { kind: CitationKind, ref: string, label: string, asOf: string | null };

export type ImpactFindingFieldsFragment = { id: string, kind: FindingKind, statement: string, basis: FindingBasis, uncertainty: string, system: SharedSystem | null, direction: EffectDirection | null, linkage: Linkage | null, interventionIds: Array<string>, related: Array<string>, magnitude: { metricId: string, unit: Unit, baseline: { exact: string, value: string } | null, atLowEstimates: { exact: string, value: string }, atHighEstimates: { exact: string, value: string } } | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> };

export type WiderImpactFieldsFragment = { id: string, engineVersion: string, catalogueVersion: string, inputHash: string, localBenefits: Array<{ id: string, kind: FindingKind, statement: string, basis: FindingBasis, uncertainty: string, system: SharedSystem | null, direction: EffectDirection | null, linkage: Linkage | null, interventionIds: Array<string>, related: Array<string>, magnitude: { metricId: string, unit: Unit, baseline: { exact: string, value: string } | null, atLowEstimates: { exact: string, value: string }, atHighEstimates: { exact: string, value: string } } | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, externalities: Array<{ id: string, kind: FindingKind, statement: string, basis: FindingBasis, uncertainty: string, system: SharedSystem | null, direction: EffectDirection | null, linkage: Linkage | null, interventionIds: Array<string>, related: Array<string>, magnitude: { metricId: string, unit: Unit, baseline: { exact: string, value: string } | null, atLowEstimates: { exact: string, value: string }, atHighEstimates: { exact: string, value: string } } | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, falseResilience: Array<{ id: string, kind: FindingKind, statement: string, basis: FindingBasis, uncertainty: string, system: SharedSystem | null, direction: EffectDirection | null, linkage: Linkage | null, interventionIds: Array<string>, related: Array<string>, magnitude: { metricId: string, unit: Unit, baseline: { exact: string, value: string } | null, atLowEstimates: { exact: string, value: string }, atHighEstimates: { exact: string, value: string } } | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, tradeoffs: Array<{ id: string, kind: FindingKind, statement: string, basis: FindingBasis, uncertainty: string, system: SharedSystem | null, direction: EffectDirection | null, linkage: Linkage | null, interventionIds: Array<string>, related: Array<string>, magnitude: { metricId: string, unit: Unit, baseline: { exact: string, value: string } | null, atLowEstimates: { exact: string, value: string }, atHighEstimates: { exact: string, value: string } } | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, reviews: Array<{ kind: ReviewKind, label: string, required: boolean, reasons: Array<string>, interventionIds: Array<string> }> };

export type ImpactContextFieldsFragment = { areaName: string | null, nearbyRadiusM: number, groundwater: GroundwaterReliance, waterQualityNote: string, groundwaterCitations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }>, boundaries: Array<{ level: BoundaryLevel, label: string, detail: string, system: SharedSystem | null, linkage: Linkage | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, nearby: Array<{ name: string, communityId: string, distanceM: number, links: Array<{ system: SharedSystem, linkage: Linkage, evidenceIds: Array<string> }> }>, waterQuality: Array<{ parameter: string | null, unit: Unit, observedOn: string | null, method: string | null, value: { exact: string, value: string }, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, unavailable: Array<{ key: string, label: string, reason: string }> };

export type EconomicsFieldsFragment = { engineVersion: string, currency: string, recurringReason: string | null, avoidedReason: string | null, assumptions: Array<string>, notes: Array<string>, capex: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, contingency: { ratio: string, amount: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } } | null, upfrontTotal: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, recurringAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, avoidedTankerAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, netAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, payback: { outcome: PaybackOutcome, optimisticDays: number | null, pessimisticDays: number | null, note: string } | null, horizon: { days: number, netPositive: boolean, reason: string | null, net: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, avoided: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, recurring: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null } | null, funding: { fullyFunded: boolean, note: string, totalCost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, approved: { minorUnits: string, currency: string, exponent: number }, candidate: { minorUnits: string, currency: string, exponent: number }, gap: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, lines: Array<{ label: string, status: FundingStatus, counts: boolean, applicable: boolean, amount: { minorUnits: string, currency: string, exponent: number } }> } };

export type ComparedOptionFieldsFragment = { id: string, rank: number, name: string, interventionIds: Array<string>, why: string, tradeoffs: Array<string>, uncertainty: Array<string>, firstBenefit: BenefitTiming, pessimistic: { exact: string, value: string }, optimistic: { exact: string, value: string }, margin: { exact: string, value: string }, waterLow: { exact: string, value: string } | null, waterHigh: { exact: string, value: string } | null, uncountedHigh: { exact: string, value: string } | null, cost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, buildDays: { low: number, high: number } | null, measures: Array<{ interventionId: string, name: string, benefitTiming: BenefitTiming, effects: Array<{ key: string, label: string, unit: Unit, origin: EffectOrigin, low: { exact: string, value: string }, high: { exact: string, value: string } }>, waterLow: { exact: string, value: string } | null, waterHigh: { exact: string, value: string } | null, cost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, recurring: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, buildDays: { low: number, high: number } | null }>, sensitivity: Array<{ interventionId: string, key: string, label: string, swing: { exact: string, value: string } }>, stress: Array<{ key: string, label: string, meetsTarget: boolean | null, value: { exact: string, value: string } | null }>, impact: { id: string, engineVersion: string, catalogueVersion: string, inputHash: string, localBenefits: Array<{ id: string, kind: FindingKind, statement: string, basis: FindingBasis, uncertainty: string, system: SharedSystem | null, direction: EffectDirection | null, linkage: Linkage | null, interventionIds: Array<string>, related: Array<string>, magnitude: { metricId: string, unit: Unit, baseline: { exact: string, value: string } | null, atLowEstimates: { exact: string, value: string }, atHighEstimates: { exact: string, value: string } } | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, externalities: Array<{ id: string, kind: FindingKind, statement: string, basis: FindingBasis, uncertainty: string, system: SharedSystem | null, direction: EffectDirection | null, linkage: Linkage | null, interventionIds: Array<string>, related: Array<string>, magnitude: { metricId: string, unit: Unit, baseline: { exact: string, value: string } | null, atLowEstimates: { exact: string, value: string }, atHighEstimates: { exact: string, value: string } } | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, falseResilience: Array<{ id: string, kind: FindingKind, statement: string, basis: FindingBasis, uncertainty: string, system: SharedSystem | null, direction: EffectDirection | null, linkage: Linkage | null, interventionIds: Array<string>, related: Array<string>, magnitude: { metricId: string, unit: Unit, baseline: { exact: string, value: string } | null, atLowEstimates: { exact: string, value: string }, atHighEstimates: { exact: string, value: string } } | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, tradeoffs: Array<{ id: string, kind: FindingKind, statement: string, basis: FindingBasis, uncertainty: string, system: SharedSystem | null, direction: EffectDirection | null, linkage: Linkage | null, interventionIds: Array<string>, related: Array<string>, magnitude: { metricId: string, unit: Unit, baseline: { exact: string, value: string } | null, atLowEstimates: { exact: string, value: string }, atHighEstimates: { exact: string, value: string } } | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, reviews: Array<{ kind: ReviewKind, label: string, required: boolean, reasons: Array<string>, interventionIds: Array<string> }> }, economics: { engineVersion: string, currency: string, recurringReason: string | null, avoidedReason: string | null, assumptions: Array<string>, notes: Array<string>, capex: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, contingency: { ratio: string, amount: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } } | null, upfrontTotal: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, recurringAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, avoidedTankerAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, netAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, payback: { outcome: PaybackOutcome, optimisticDays: number | null, pessimisticDays: number | null, note: string } | null, horizon: { days: number, netPositive: boolean, reason: string | null, net: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, avoided: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, recurring: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null } | null, funding: { fullyFunded: boolean, note: string, totalCost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, approved: { minorUnits: string, currency: string, exponent: number }, candidate: { minorUnits: string, currency: string, exponent: number }, gap: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, lines: Array<{ label: string, status: FundingStatus, counts: boolean, applicable: boolean, amount: { minorUnits: string, currency: string, exponent: number } }> } } | null };

export type PlanComparisonQueryVariables = Exact<{
  id: string;
}>;


export type PlanComparisonQuery = { planningSession: { id: string, inputsRevision: number, selectedPlanOptionId: string | null, selectedPlanStatus: SelectedPlanStatus, planComparison: { id: string, engineVersion: string, scenarioEngineVersion: string, catalogueVersion: string, baselineId: string | null, status: PlanComparisonStatus, summary: string, metric: PlanMetric | null, unit: Unit | null, needs: Array<string>, excluded: Array<string>, assumptions: Array<string>, ranking: string, maxOptions: number, stressTests: Array<string>, impactEngineVersion: string, baselineValue: { exact: string, value: string } | null, scenarioValue: { exact: string, value: string } | null, targetLevel: { exact: string, value: string } | null, rejections: { evaluated: number, onlyOptimistic: number, missedTarget: number, overBudget: number, budgetUncertain: number, tooSlow: number, timeUncertain: number, notMinimal: number, truncated: boolean }, options: Array<{ id: string, rank: number, name: string, interventionIds: Array<string>, why: string, tradeoffs: Array<string>, uncertainty: Array<string>, firstBenefit: BenefitTiming, pessimistic: { exact: string, value: string }, optimistic: { exact: string, value: string }, margin: { exact: string, value: string }, waterLow: { exact: string, value: string } | null, waterHigh: { exact: string, value: string } | null, uncountedHigh: { exact: string, value: string } | null, cost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, buildDays: { low: number, high: number } | null, measures: Array<{ interventionId: string, name: string, benefitTiming: BenefitTiming, effects: Array<{ key: string, label: string, unit: Unit, origin: EffectOrigin, low: { exact: string, value: string }, high: { exact: string, value: string } }>, waterLow: { exact: string, value: string } | null, waterHigh: { exact: string, value: string } | null, cost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, recurring: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, buildDays: { low: number, high: number } | null }>, sensitivity: Array<{ interventionId: string, key: string, label: string, swing: { exact: string, value: string } }>, stress: Array<{ key: string, label: string, meetsTarget: boolean | null, value: { exact: string, value: string } | null }>, impact: { id: string, engineVersion: string, catalogueVersion: string, inputHash: string, localBenefits: Array<{ id: string, kind: FindingKind, statement: string, basis: FindingBasis, uncertainty: string, system: SharedSystem | null, direction: EffectDirection | null, linkage: Linkage | null, interventionIds: Array<string>, related: Array<string>, magnitude: { metricId: string, unit: Unit, baseline: { exact: string, value: string } | null, atLowEstimates: { exact: string, value: string }, atHighEstimates: { exact: string, value: string } } | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, externalities: Array<{ id: string, kind: FindingKind, statement: string, basis: FindingBasis, uncertainty: string, system: SharedSystem | null, direction: EffectDirection | null, linkage: Linkage | null, interventionIds: Array<string>, related: Array<string>, magnitude: { metricId: string, unit: Unit, baseline: { exact: string, value: string } | null, atLowEstimates: { exact: string, value: string }, atHighEstimates: { exact: string, value: string } } | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, falseResilience: Array<{ id: string, kind: FindingKind, statement: string, basis: FindingBasis, uncertainty: string, system: SharedSystem | null, direction: EffectDirection | null, linkage: Linkage | null, interventionIds: Array<string>, related: Array<string>, magnitude: { metricId: string, unit: Unit, baseline: { exact: string, value: string } | null, atLowEstimates: { exact: string, value: string }, atHighEstimates: { exact: string, value: string } } | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, tradeoffs: Array<{ id: string, kind: FindingKind, statement: string, basis: FindingBasis, uncertainty: string, system: SharedSystem | null, direction: EffectDirection | null, linkage: Linkage | null, interventionIds: Array<string>, related: Array<string>, magnitude: { metricId: string, unit: Unit, baseline: { exact: string, value: string } | null, atLowEstimates: { exact: string, value: string }, atHighEstimates: { exact: string, value: string } } | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, reviews: Array<{ kind: ReviewKind, label: string, required: boolean, reasons: Array<string>, interventionIds: Array<string> }> }, economics: { engineVersion: string, currency: string, recurringReason: string | null, avoidedReason: string | null, assumptions: Array<string>, notes: Array<string>, capex: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, contingency: { ratio: string, amount: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } } | null, upfrontTotal: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, recurringAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, avoidedTankerAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, netAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, payback: { outcome: PaybackOutcome, optimisticDays: number | null, pessimisticDays: number | null, note: string } | null, horizon: { days: number, netPositive: boolean, reason: string | null, net: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, avoided: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, recurring: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null } | null, funding: { fullyFunded: boolean, note: string, totalCost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, approved: { minorUnits: string, currency: string, exponent: number }, candidate: { minorUnits: string, currency: string, exponent: number }, gap: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, lines: Array<{ label: string, status: FundingStatus, counts: boolean, applicable: boolean, amount: { minorUnits: string, currency: string, exponent: number } }> } } | null }>, impactContext: { areaName: string | null, nearbyRadiusM: number, groundwater: GroundwaterReliance, waterQualityNote: string, groundwaterCitations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }>, boundaries: Array<{ level: BoundaryLevel, label: string, detail: string, system: SharedSystem | null, linkage: Linkage | null, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, nearby: Array<{ name: string, communityId: string, distanceM: number, links: Array<{ system: SharedSystem, linkage: Linkage, evidenceIds: Array<string> }> }>, waterQuality: Array<{ parameter: string | null, unit: Unit, observedOn: string | null, method: string | null, value: { exact: string, value: string }, citations: Array<{ kind: CitationKind, ref: string, label: string, asOf: string | null }> }>, unavailable: Array<{ key: string, label: string, reason: string }> } }, scenarioComparison: { status: string, notes: Array<string>, baselineId: string | null, engineVersion: string, rows: Array<{ key: string, label: string, unit: Unit, reason: string | null, baseline: { exact: string, value: string } | null, scenario: { exact: string, value: string } | null, change: { exact: string, value: string } | null }> } } | null };

export type PreviewScenarioQueryVariables = Exact<{
  sessionId: string;
  scenario: ScenarioPreviewInput;
}>;


export type PreviewScenarioQuery = { previewScenario: { errors: Array<{ field: string, message: string }>, comparison: { status: string, notes: Array<string>, baselineId: string | null, engineVersion: string, rows: Array<{ key: string, label: string, unit: Unit, reason: string | null, baseline: { exact: string, value: string } | null, scenario: { exact: string, value: string } | null, change: { exact: string, value: string } | null }> } | null } };

export type SessionScenarioQueryVariables = Exact<{
  id: string;
}>;


export type SessionScenarioQuery = { planningSession: { id: string, inputsRevision: number, scenarioComparison: { status: string, notes: Array<string>, baselineId: string | null, engineVersion: string, rows: Array<{ key: string, label: string, unit: Unit, reason: string | null, baseline: { exact: string, value: string } | null, scenario: { exact: string, value: string } | null, change: { exact: string, value: string } | null }> } } | null };

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

export type ReportFieldsFragment = { id: string, version: number, title: string, status: ReportStatus, sessionId: string, communityId: string | null, areaId: string, planOptionId: string, planName: string | null, finalizedAt: string, archivedAt: string | null, goal: { id: string, kind: GoalKind, description: string }, economics: { engineVersion: string, currency: string, assumptions: Array<string>, notes: Array<string>, capex: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, upfrontTotal: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, recurringAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, avoidedTankerAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, netAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, funding: { fullyFunded: boolean, note: string, totalCost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, approved: { minorUnits: string, currency: string, exponent: number }, gap: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, candidate: { minorUnits: string, currency: string, exponent: number } } } | null };

export type ProposalFieldsFragment = { id: string, version: number, reportId: string, sections: Array<ProposalSection>, status: ProposalStatus, flaggedCount: number, downloadPath: string | null, previewPath: string | null, job: { id: string, version: number, kind: JobKind, status: JobStatus, stage: string | null, attempts: number, maxAttempts: number, errorCode: ErrorCode | null, eventsPath: string, updatedAt: string } | null };

export type ReportsQueryVariables = Exact<{
  filter?: ReportFilter | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type ReportsQuery = { reports: { nodes: Array<{ id: string, version: number, title: string, status: ReportStatus, sessionId: string, communityId: string | null, areaId: string, planOptionId: string, planName: string | null, finalizedAt: string, archivedAt: string | null, siteProfile: { communityType: CommunityType | null, occupiedHomes: number | null } | null, area: { id: string, name: string, countryCode: string, centroidLat: string, centroidLon: string, extent: ExtentKind, radiusMeters: number | null, admin: { locality: string | null }, boundaryBox: { minLongitude: string, minLatitude: string, maxLongitude: string, maxLatitude: string } | null } | null, goal: { id: string, kind: GoalKind, description: string }, economics: { engineVersion: string, currency: string, assumptions: Array<string>, notes: Array<string>, capex: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, upfrontTotal: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, recurringAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, avoidedTankerAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, netAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, funding: { fullyFunded: boolean, note: string, totalCost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, approved: { minorUnits: string, currency: string, exponent: number }, gap: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, candidate: { minorUnits: string, currency: string, exponent: number } } } | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type FundingSchemesQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type FundingSchemesQuery = { fundingSchemes: { nodes: Array<{ id: string, name: string, funder: string, summary: string, status: CatalogueStatus, evidence: EvidenceQuality, officialSource: boolean, sourceUrl: string, sourceHash: string | null, lastVerifiedAt: string, currency: string, deadlineAt: string | null, deadlineTimezone: string | null, requiredDocuments: Array<string>, maxAmount: { minorUnits: string, currency: string, exponent: number } | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type ReportQueryVariables = Exact<{
  id: string;
}>;


export type ReportQuery = { report: { id: string, version: number, title: string, status: ReportStatus, sessionId: string, communityId: string | null, areaId: string, planOptionId: string, planName: string | null, finalizedAt: string, archivedAt: string | null, area: { id: string, name: string, countryCode: string } | null, impact: { assumptions: Array<string>, metrics: Array<{ metricId: string, baseline: { availability: Availability, reason: string | null, quantity: { value: string, unit: Unit } | null }, projectedLow: { availability: Availability, reason: string | null, quantity: { value: string, unit: Unit } | null }, projectedHigh: { availability: Availability, reason: string | null, quantity: { value: string, unit: Unit } | null } }>, neighbourEffect: { availability: Availability, reason: string | null, quantity: { value: string, unit: Unit } | null }, provenance: { evidence: EvidenceQuality, sourceIds: Array<string>, asOf: string } } | null, proposals: { nodes: Array<{ id: string, version: number, reportId: string, sections: Array<ProposalSection>, status: ProposalStatus, flaggedCount: number, downloadPath: string | null, previewPath: string | null, job: { id: string, version: number, kind: JobKind, status: JobStatus, stage: string | null, attempts: number, maxAttempts: number, errorCode: ErrorCode | null, eventsPath: string, updatedAt: string } | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } }, goal: { id: string, kind: GoalKind, description: string }, economics: { engineVersion: string, currency: string, assumptions: Array<string>, notes: Array<string>, capex: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, upfrontTotal: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, recurringAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, avoidedTankerAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, netAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, funding: { fullyFunded: boolean, note: string, totalCost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, approved: { minorUnits: string, currency: string, exponent: number }, gap: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, candidate: { minorUnits: string, currency: string, exponent: number } } } | null } | null };

export type ProposalQueryVariables = Exact<{
  id: string;
}>;


export type ProposalQuery = { proposal: { id: string, version: number, reportId: string, sections: Array<ProposalSection>, status: ProposalStatus, flaggedCount: number, downloadPath: string | null, previewPath: string | null, job: { id: string, version: number, kind: JobKind, status: JobStatus, stage: string | null, attempts: number, maxAttempts: number, errorCode: ErrorCode | null, eventsPath: string, updatedAt: string } | null } | null };

export type JobQueryVariables = Exact<{
  id: string;
}>;


export type JobQuery = { job: { id: string, version: number, kind: JobKind, status: JobStatus, stage: string | null, attempts: number, maxAttempts: number, errorCode: ErrorCode | null, eventsPath: string, updatedAt: string } | null };

export type FinalizeReportMutationVariables = Exact<{
  input: FinalizeReportInput;
}>;


export type FinalizeReportMutation = { finalizeReport: { report: { id: string, version: number, title: string, status: ReportStatus, sessionId: string, communityId: string | null, areaId: string, planOptionId: string, planName: string | null, finalizedAt: string, archivedAt: string | null, goal: { id: string, kind: GoalKind, description: string }, economics: { engineVersion: string, currency: string, assumptions: Array<string>, notes: Array<string>, capex: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, upfrontTotal: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, recurringAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, avoidedTankerAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, netAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, funding: { fullyFunded: boolean, note: string, totalCost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, approved: { minorUnits: string, currency: string, exponent: number }, gap: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, candidate: { minorUnits: string, currency: string, exponent: number } } } | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type ArchiveReportMutationVariables = Exact<{
  input: ArchiveReportInput;
}>;


export type ArchiveReportMutation = { archiveReport: { report: { id: string, version: number, title: string, status: ReportStatus, sessionId: string, communityId: string | null, areaId: string, planOptionId: string, planName: string | null, finalizedAt: string, archivedAt: string | null, goal: { id: string, kind: GoalKind, description: string }, economics: { engineVersion: string, currency: string, assumptions: Array<string>, notes: Array<string>, capex: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, upfrontTotal: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, recurringAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, avoidedTankerAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, netAnnual: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } } | null, funding: { fullyFunded: boolean, note: string, totalCost: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, approved: { minorUnits: string, currency: string, exponent: number }, gap: { low: { minorUnits: string, currency: string, exponent: number }, high: { minorUnits: string, currency: string, exponent: number } }, candidate: { minorUnits: string, currency: string, exponent: number } } } | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type GenerateProposalMutationVariables = Exact<{
  input: GenerateProposalInput;
}>;


export type GenerateProposalMutation = { generateProposal: { proposal: { id: string, version: number, reportId: string, sections: Array<ProposalSection>, status: ProposalStatus, flaggedCount: number, downloadPath: string | null, previewPath: string | null, job: { id: string, version: number, kind: JobKind, status: JobStatus, stage: string | null, attempts: number, maxAttempts: number, errorCode: ErrorCode | null, eventsPath: string, updatedAt: string } | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type ProjectFieldsFragment = { id: string, version: number, reportId: string, reportVersion: number, areaId: string, communityId: string | null, sharedWithCommunity: boolean, title: string, status: ProjectStatus, startedAt: string, expenses: Array<{ description: string, spentOn: string, source: string, amount: { minorUnits: string, currency: string, exponent: number } }> };

export type MilestoneFieldsFragment = { id: string, version: number, projectId: string, title: string, plannedOn: string, responsibleIdentity: string | null, tasks: Array<string>, status: MilestoneStatus, completedOn: string | null, completedAt: string | null };

export type ObservationFieldsFragment = { id: string, version: number, projectId: string, metricId: string, observedOn: string, method: string, sourceType: ObservationSourceType, source: string, permittedSourceConfirmed: boolean, areaId: string, windowStart: string | null, windowEnd: string | null, coverageObservedDays: number, coverageExpectedDays: number, note: string, evidence: ObservationEvidence, recordedByViewer: boolean, comparison: { status: ComparisonStatus, reason: string, relation: string | null, forecastLow: { value: string, unit: Unit } | null, forecastHigh: { value: string, unit: Unit } | null }, quantity: { value: string, unit: Unit } };

export type MyImplementationProjectsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type MyImplementationProjectsQuery = { myImplementationProjects: { nodes: Array<{ id: string, version: number, reportId: string, reportVersion: number, areaId: string, communityId: string | null, sharedWithCommunity: boolean, title: string, status: ProjectStatus, startedAt: string, expenses: Array<{ description: string, spentOn: string, source: string, amount: { minorUnits: string, currency: string, exponent: number } }> }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type ImplementationProjectQueryVariables = Exact<{
  id: string;
}>;


export type ImplementationProjectQuery = { implementationProject: { id: string, version: number, reportId: string, reportVersion: number, areaId: string, communityId: string | null, sharedWithCommunity: boolean, title: string, status: ProjectStatus, startedAt: string, milestones: { nodes: Array<{ id: string, version: number, projectId: string, title: string, plannedOn: string, responsibleIdentity: string | null, tasks: Array<string>, status: MilestoneStatus, completedOn: string | null, completedAt: string | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } }, expenses: Array<{ description: string, spentOn: string, source: string, amount: { minorUnits: string, currency: string, exponent: number } }> } | null };

export type TrackingReportsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type TrackingReportsQuery = { reports: { nodes: Array<{ id: string, version: number, title: string, status: ReportStatus, communityId: string | null, areaId: string, finalizedAt: string, goal: { horizonDays: number | null }, impact: { metrics: Array<{ metricId: string, projectedLow: { quantity: { value: string, unit: Unit } | null }, projectedHigh: { quantity: { value: string, unit: Unit } | null } }> } | null }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type TrackingReportQueryVariables = Exact<{
  id: string;
}>;


export type TrackingReportQuery = { report: { id: string, version: number, title: string, status: ReportStatus, communityId: string | null, areaId: string, finalizedAt: string, goal: { horizonDays: number | null }, impact: { metrics: Array<{ metricId: string, projectedLow: { quantity: { value: string, unit: Unit } | null }, projectedHigh: { quantity: { value: string, unit: Unit } | null } }> } | null } | null };

export type ObservationsQueryVariables = Exact<{
  projectId: string;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type ObservationsQuery = { implementationProject: { id: string, observations: { nodes: Array<{ id: string, version: number, projectId: string, metricId: string, observedOn: string, method: string, sourceType: ObservationSourceType, source: string, permittedSourceConfirmed: boolean, areaId: string, windowStart: string | null, windowEnd: string | null, coverageObservedDays: number, coverageExpectedDays: number, note: string, evidence: ObservationEvidence, recordedByViewer: boolean, comparison: { status: ComparisonStatus, reason: string, relation: string | null, forecastLow: { value: string, unit: Unit } | null, forecastHigh: { value: string, unit: Unit } | null }, quantity: { value: string, unit: Unit } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } } | null };

export type StartImplementationProjectMutationVariables = Exact<{
  input: StartImplementationProjectInput;
}>;


export type StartImplementationProjectMutation = { startImplementationProject: { project: { id: string, version: number, reportId: string, reportVersion: number, areaId: string, communityId: string | null, sharedWithCommunity: boolean, title: string, status: ProjectStatus, startedAt: string, expenses: Array<{ description: string, spentOn: string, source: string, amount: { minorUnits: string, currency: string, exponent: number } }> } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type UpdateMilestoneMutationVariables = Exact<{
  input: UpdateMilestoneInput;
}>;


export type UpdateMilestoneMutation = { updateMilestone: { milestone: { id: string, version: number, projectId: string, title: string, plannedOn: string, responsibleIdentity: string | null, tasks: Array<string>, status: MilestoneStatus, completedOn: string | null, completedAt: string | null } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type RecordObservationMutationVariables = Exact<{
  input: RecordObservationInput;
}>;


export type RecordObservationMutation = { recordObservation: { observation: { id: string, version: number, projectId: string, metricId: string, observedOn: string, method: string, sourceType: ObservationSourceType, source: string, permittedSourceConfirmed: boolean, areaId: string, windowStart: string | null, windowEnd: string | null, coverageObservedDays: number, coverageExpectedDays: number, note: string, evidence: ObservationEvidence, recordedByViewer: boolean, comparison: { status: ComparisonStatus, reason: string, relation: string | null, forecastLow: { value: string, unit: Unit } | null, forecastHigh: { value: string, unit: Unit } | null }, quantity: { value: string, unit: Unit } } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type AddProjectExpenseMutationVariables = Exact<{
  input: AddProjectExpenseInput;
}>;


export type AddProjectExpenseMutation = { addProjectExpense: { project: { id: string, version: number, reportId: string, reportVersion: number, areaId: string, communityId: string | null, sharedWithCommunity: boolean, title: string, status: ProjectStatus, startedAt: string, expenses: Array<{ description: string, spentOn: string, source: string, amount: { minorUnits: string, currency: string, exponent: number } }> } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

export type UpdateProjectStatusMutationVariables = Exact<{
  input: UpdateProjectStatusInput;
}>;


export type UpdateProjectStatusMutation = { updateProjectStatus: { project: { id: string, version: number, reportId: string, reportVersion: number, areaId: string, communityId: string | null, sharedWithCommunity: boolean, title: string, status: ProjectStatus, startedAt: string, expenses: Array<{ description: string, spentOn: string, source: string, amount: { minorUnits: string, currency: string, exponent: number } }> } | null, error: { code: ErrorCode, message: string, currentVersion: number | null, requestId: string, fieldErrors: Array<{ field: string, message: string }> } | null } };

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
export const EvidenceLinkFieldsFragmentDoc = new TypedDocumentString(`
    fragment EvidenceLinkFields on EvidenceLink {
  input
  capability
  snapshotId
  manualInputId
  title
  publisher
  url
  asOf
  quality
  method
  uncertainty
  note
  demo
}
    `, {"fragmentName":"EvidenceLinkFields"}) as unknown as TypedDocumentString<EvidenceLinkFieldsFragment, unknown>;
export const BaselineFieldsFragmentDoc = new TypedDocumentString(`
    fragment BaselineFields on Baseline {
  id
  areaId
  sessionId
  asOf
  engineVersion
  exceedanceP
  windowDays
  demo
  basis
  window {
    start
    endExclusive
    days
  }
  missingEssentials
  missingOptional
  notes
  metrics {
    metric
    name
    formula
    unit
    availability
    exact
    value
    reason
    reasons
    origin
    daily
    asOf
    assumptions
    demo
    recordedDays
    periodDays
    evidence {
      ...EvidenceLinkFields
    }
    supporting {
      key
      exact
      value
      unit
    }
  }
  indicators {
    indicator
    name
    capability
    statistic
    variable
    parameter
    unit
    availability
    exact
    value
    observedOn
    reason
    reasons
    origin
    demo
    window {
      start
      endExclusive
      days
    }
    evidence {
      ...EvidenceLinkFields
    }
  }
  chart {
    monthly
    buckets {
      start
      endExclusive
      days
    }
    series {
      key
      values
      origin
      demo
    }
  }
}
    fragment EvidenceLinkFields on EvidenceLink {
  input
  capability
  snapshotId
  manualInputId
  title
  publisher
  url
  asOf
  quality
  method
  uncertainty
  note
  demo
}`, {"fragmentName":"BaselineFields"}) as unknown as TypedDocumentString<BaselineFieldsFragment, unknown>;
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
  contactName
  contactEmail
  area {
    id
    name
    countryCode
    mapLatitude
    mapLongitude
  }
  sharedReport {
    goal
    finalizedAt
  }
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
  eligibility
  eligibilityEvidence {
    criterionId
    status
    reason
  }
  relevanceOrder
  rankingStatus
  rankingReason
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
    deadlineAt
    deadlineTimezone
    sourceHash
    status
    officialSource
    geography
    applicantCategories
    interventions
    amountRules
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
export const GoalAssessmentFieldsFragmentDoc = new TypedDocumentString(`
    fragment GoalAssessmentFields on GoalAssessment {
  outcome
  summary
  nextSteps
  catalogueVersion
  baselineId
  target {
    outcome
    message
    metric
    unit
    baseline
    targetLevel
    caveats
  }
  constraints {
    code
    message
    outcome
  }
  conflicts {
    code
    message
    outcome
  }
  interventions {
    interventionId
    name
    family
    relevant
    outcome
    benefit
    preferred
    site {
      outcome
      message
    }
    cost {
      outcome
      message
    }
    time {
      outcome
      message
    }
  }
}
    `, {"fragmentName":"GoalAssessmentFields"}) as unknown as TypedDocumentString<GoalAssessmentFieldsFragment, unknown>;
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
  centroidLat
  centroidLon
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
  baselineReviewed
  status
  areaId
  communityId
  selectedPlanOptionId
  communityBaseline {
    areaId
    concern
    notes
    residents
    dailyUse
    demandEstimated
    demandSource
    asOf
    supplyComplete
    sources {
      name
      kind
      method
      quantity
      multiplier
      periodDays
      estimated
      source
    }
  }
  siteProfile {
    communityType
    occupiedHomes
  }
  inputsRevision
  updatedAt
  area {
    id
    name
    extent
    radiusMeters
    hasBoundary
    extent
    radiusMeters
    hasBoundary
  }
  goal {
    id
    kind
    description
    targetParameter
    timelineDays
    horizonDays
    priority
    also
    confirmed
    preferredInterventions
    waterTariff {
      price {
        ...MoneyFields
      }
      volume {
        ...QuantityFields
      }
      note
    }
    contingencyRatio
    funding {
      label
      amount {
        ...MoneyFields
      }
      status
      note
    }
    budget {
      ...MoneyFields
    }
    target {
      mode
      quantity {
        ...QuantityFields
      }
    }
    site {
      scale
      storageSpace
      pipedSupply
      groundwaterUse
      restrictions
      roofArea {
        ...QuantityFields
      }
      openGround {
        ...QuantityFields
      }
    }
    estimates {
      interventionId
      note
      cost {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      recurring {
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
      effects {
        key
        low
        high
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
export const ExactNumberFieldsFragmentDoc = new TypedDocumentString(`
    fragment ExactNumberFields on ExactNumber {
  exact
  value
}
    `, {"fragmentName":"ExactNumberFields"}) as unknown as TypedDocumentString<ExactNumberFieldsFragment, unknown>;
export const ScenarioComparisonFieldsFragmentDoc = new TypedDocumentString(`
    fragment ScenarioComparisonFields on ScenarioComparison {
  status
  notes
  baselineId
  engineVersion
  rows {
    key
    label
    unit
    reason
    baseline {
      ...ExactNumberFields
    }
    scenario {
      ...ExactNumberFields
    }
    change {
      ...ExactNumberFields
    }
  }
}
    fragment ExactNumberFields on ExactNumber {
  exact
  value
}`, {"fragmentName":"ScenarioComparisonFields"}) as unknown as TypedDocumentString<ScenarioComparisonFieldsFragment, unknown>;
export const ImpactCitationFieldsFragmentDoc = new TypedDocumentString(`
    fragment ImpactCitationFields on ImpactCitation {
  kind
  ref
  label
  asOf
}
    `, {"fragmentName":"ImpactCitationFields"}) as unknown as TypedDocumentString<ImpactCitationFieldsFragment, unknown>;
export const ImpactContextFieldsFragmentDoc = new TypedDocumentString(`
    fragment ImpactContextFields on ImpactContext {
  areaName
  nearbyRadiusM
  groundwater
  groundwaterCitations {
    ...ImpactCitationFields
  }
  waterQualityNote
  boundaries {
    level
    label
    detail
    system
    linkage
    citations {
      ...ImpactCitationFields
    }
  }
  nearby {
    name
    communityId
    distanceM
    links {
      system
      linkage
      evidenceIds
    }
  }
  waterQuality {
    parameter
    value {
      ...ExactNumberFields
    }
    unit
    observedOn
    method
    citations {
      ...ImpactCitationFields
    }
  }
  unavailable {
    key
    label
    reason
  }
}
    fragment ExactNumberFields on ExactNumber {
  exact
  value
}
fragment ImpactCitationFields on ImpactCitation {
  kind
  ref
  label
  asOf
}`, {"fragmentName":"ImpactContextFields"}) as unknown as TypedDocumentString<ImpactContextFieldsFragment, unknown>;
export const ImpactFindingFieldsFragmentDoc = new TypedDocumentString(`
    fragment ImpactFindingFields on ImpactFinding {
  id
  kind
  statement
  basis
  uncertainty
  system
  direction
  linkage
  interventionIds
  related
  magnitude {
    metricId
    unit
    baseline {
      ...ExactNumberFields
    }
    atLowEstimates {
      ...ExactNumberFields
    }
    atHighEstimates {
      ...ExactNumberFields
    }
  }
  citations {
    ...ImpactCitationFields
  }
}
    fragment ExactNumberFields on ExactNumber {
  exact
  value
}
fragment ImpactCitationFields on ImpactCitation {
  kind
  ref
  label
  asOf
}`, {"fragmentName":"ImpactFindingFields"}) as unknown as TypedDocumentString<ImpactFindingFieldsFragment, unknown>;
export const WiderImpactFieldsFragmentDoc = new TypedDocumentString(`
    fragment WiderImpactFields on WiderImpact {
  id
  engineVersion
  catalogueVersion
  inputHash
  localBenefits {
    ...ImpactFindingFields
  }
  externalities {
    ...ImpactFindingFields
  }
  falseResilience {
    ...ImpactFindingFields
  }
  tradeoffs {
    ...ImpactFindingFields
  }
  reviews {
    kind
    label
    required
    reasons
    interventionIds
  }
}
    fragment ExactNumberFields on ExactNumber {
  exact
  value
}
fragment ImpactCitationFields on ImpactCitation {
  kind
  ref
  label
  asOf
}
fragment ImpactFindingFields on ImpactFinding {
  id
  kind
  statement
  basis
  uncertainty
  system
  direction
  linkage
  interventionIds
  related
  magnitude {
    metricId
    unit
    baseline {
      ...ExactNumberFields
    }
    atLowEstimates {
      ...ExactNumberFields
    }
    atHighEstimates {
      ...ExactNumberFields
    }
  }
  citations {
    ...ImpactCitationFields
  }
}`, {"fragmentName":"WiderImpactFields"}) as unknown as TypedDocumentString<WiderImpactFieldsFragment, unknown>;
export const EconomicsFieldsFragmentDoc = new TypedDocumentString(`
    fragment EconomicsFields on OptionEconomics {
  engineVersion
  currency
  capex {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  contingency {
    ratio
    amount {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
  }
  upfrontTotal {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  recurringAnnual {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  recurringReason
  avoidedTankerAnnual {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  avoidedReason
  netAnnual {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  payback {
    outcome
    optimisticDays
    pessimisticDays
    note
  }
  horizon {
    days
    netPositive
    reason
    net {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    avoided {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    recurring {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
  }
  funding {
    totalCost {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    approved {
      ...MoneyFields
    }
    candidate {
      ...MoneyFields
    }
    fullyFunded
    gap {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    lines {
      label
      status
      counts
      applicable
      amount {
        ...MoneyFields
      }
    }
    note
  }
  assumptions
  notes
}
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}`, {"fragmentName":"EconomicsFields"}) as unknown as TypedDocumentString<EconomicsFieldsFragment, unknown>;
export const ComparedOptionFieldsFragmentDoc = new TypedDocumentString(`
    fragment ComparedOptionFields on ComparedOption {
  id
  rank
  name
  interventionIds
  why
  tradeoffs
  uncertainty
  firstBenefit
  pessimistic {
    ...ExactNumberFields
  }
  optimistic {
    ...ExactNumberFields
  }
  margin {
    ...ExactNumberFields
  }
  waterLow {
    ...ExactNumberFields
  }
  waterHigh {
    ...ExactNumberFields
  }
  uncountedHigh {
    ...ExactNumberFields
  }
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
  measures {
    interventionId
    name
    benefitTiming
    effects {
      key
      label
      unit
      origin
      low {
        ...ExactNumberFields
      }
      high {
        ...ExactNumberFields
      }
    }
    waterLow {
      ...ExactNumberFields
    }
    waterHigh {
      ...ExactNumberFields
    }
    cost {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    recurring {
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
  }
  sensitivity {
    interventionId
    key
    label
    swing {
      ...ExactNumberFields
    }
  }
  stress {
    key
    label
    meetsTarget
    value {
      ...ExactNumberFields
    }
  }
  impact {
    ...WiderImpactFields
  }
  economics {
    ...EconomicsFields
  }
}
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment ExactNumberFields on ExactNumber {
  exact
  value
}
fragment ImpactCitationFields on ImpactCitation {
  kind
  ref
  label
  asOf
}
fragment ImpactFindingFields on ImpactFinding {
  id
  kind
  statement
  basis
  uncertainty
  system
  direction
  linkage
  interventionIds
  related
  magnitude {
    metricId
    unit
    baseline {
      ...ExactNumberFields
    }
    atLowEstimates {
      ...ExactNumberFields
    }
    atHighEstimates {
      ...ExactNumberFields
    }
  }
  citations {
    ...ImpactCitationFields
  }
}
fragment WiderImpactFields on WiderImpact {
  id
  engineVersion
  catalogueVersion
  inputHash
  localBenefits {
    ...ImpactFindingFields
  }
  externalities {
    ...ImpactFindingFields
  }
  falseResilience {
    ...ImpactFindingFields
  }
  tradeoffs {
    ...ImpactFindingFields
  }
  reviews {
    kind
    label
    required
    reasons
    interventionIds
  }
}
fragment EconomicsFields on OptionEconomics {
  engineVersion
  currency
  capex {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  contingency {
    ratio
    amount {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
  }
  upfrontTotal {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  recurringAnnual {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  recurringReason
  avoidedTankerAnnual {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  avoidedReason
  netAnnual {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  payback {
    outcome
    optimisticDays
    pessimisticDays
    note
  }
  horizon {
    days
    netPositive
    reason
    net {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    avoided {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    recurring {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
  }
  funding {
    totalCost {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    approved {
      ...MoneyFields
    }
    candidate {
      ...MoneyFields
    }
    fullyFunded
    gap {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    lines {
      label
      status
      counts
      applicable
      amount {
        ...MoneyFields
      }
    }
    note
  }
  assumptions
  notes
}`, {"fragmentName":"ComparedOptionFields"}) as unknown as TypedDocumentString<ComparedOptionFieldsFragment, unknown>;
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
  planName
  goal {
    id
    kind
    description
  }
  economics {
    engineVersion
    currency
    capex {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    upfrontTotal {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    recurringAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    avoidedTankerAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    netAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    funding {
      totalCost {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      approved {
        ...MoneyFields
      }
      gap {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      candidate {
        ...MoneyFields
      }
      fullyFunded
      note
    }
    assumptions
    notes
  }
  finalizedAt
  archivedAt
}
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}`, {"fragmentName":"ReportFields"}) as unknown as TypedDocumentString<ReportFieldsFragment, unknown>;
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
  previewPath
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
  reportVersion
  areaId
  communityId
  sharedWithCommunity
  title
  status
  startedAt
  expenses {
    description
    spentOn
    source
    amount {
      ...MoneyFields
    }
  }
}
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}`, {"fragmentName":"ProjectFields"}) as unknown as TypedDocumentString<ProjectFieldsFragment, unknown>;
export const MilestoneFieldsFragmentDoc = new TypedDocumentString(`
    fragment MilestoneFields on Milestone {
  id
  version
  projectId
  title
  plannedOn
  responsibleIdentity
  tasks
  status
  completedOn
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
  sourceType
  source
  permittedSourceConfirmed
  areaId
  windowStart
  windowEnd
  coverageObservedDays
  coverageExpectedDays
  note
  evidence
  recordedByViewer
  comparison {
    status
    reason
    relation
    forecastLow {
      value
      unit
    }
    forecastHigh {
      value
      unit
    }
  }
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
export const AiStatusDocument = new TypedDocumentString(`
    query AiStatus {
  aiStatus {
    available
    reason
    modelId
    requestsRemaining
    dailyRequestLimit
    budgetConfigured
    suggestedDailyBudgetUsd
  }
}
    `) as unknown as TypedDocumentString<AiStatusQuery, AiStatusQueryVariables>;
export const AreaBaselineDocument = new TypedDocumentString(`
    query AreaBaseline($areaId: ID!, $sessionId: ID) {
  area(id: $areaId) {
    id
    name
    unitSystem
    baseline(sessionId: $sessionId) {
      ...BaselineFields
    }
  }
}
    fragment EvidenceLinkFields on EvidenceLink {
  input
  capability
  snapshotId
  manualInputId
  title
  publisher
  url
  asOf
  quality
  method
  uncertainty
  note
  demo
}
fragment BaselineFields on Baseline {
  id
  areaId
  sessionId
  asOf
  engineVersion
  exceedanceP
  windowDays
  demo
  basis
  window {
    start
    endExclusive
    days
  }
  missingEssentials
  missingOptional
  notes
  metrics {
    metric
    name
    formula
    unit
    availability
    exact
    value
    reason
    reasons
    origin
    daily
    asOf
    assumptions
    demo
    recordedDays
    periodDays
    evidence {
      ...EvidenceLinkFields
    }
    supporting {
      key
      exact
      value
      unit
    }
  }
  indicators {
    indicator
    name
    capability
    statistic
    variable
    parameter
    unit
    availability
    exact
    value
    observedOn
    reason
    reasons
    origin
    demo
    window {
      start
      endExclusive
      days
    }
    evidence {
      ...EvidenceLinkFields
    }
  }
  chart {
    monthly
    buckets {
      start
      endExclusive
      days
    }
    series {
      key
      values
      origin
      demo
    }
  }
}`) as unknown as TypedDocumentString<AreaBaselineQuery, AreaBaselineQueryVariables>;
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
  contactName
  contactEmail
  area {
    id
    name
    countryCode
    mapLatitude
    mapLongitude
  }
  sharedReport {
    goal
    finalizedAt
  }
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
  contactName
  contactEmail
  area {
    id
    name
    countryCode
    mapLatitude
    mapLongitude
  }
  sharedReport {
    goal
    finalizedAt
  }
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
  contactName
  contactEmail
  area {
    id
    name
    countryCode
    mapLatitude
    mapLongitude
  }
  sharedReport {
    goal
    finalizedAt
  }
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
  contactName
  contactEmail
  area {
    id
    name
    countryCode
    mapLatitude
    mapLongitude
  }
  sharedReport {
    goal
    finalizedAt
  }
  viewerMembership {
    ...MembershipFields
  }
}`) as unknown as TypedDocumentString<MyMembershipsQuery, MyMembershipsQueryVariables>;
export const CommunitySourceReportsDocument = new TypedDocumentString(`
    query CommunitySourceReports($filter: ReportFilter, $first: Int, $after: String) {
  reports(filter: $filter, first: $first, after: $after) {
    nodes {
      id
      title
      status
      finalizedAt
      goal {
        kind
      }
      area {
        id
        name
        private
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
}`) as unknown as TypedDocumentString<CommunitySourceReportsQuery, CommunitySourceReportsQueryVariables>;
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
  contactName
  contactEmail
  area {
    id
    name
    countryCode
    mapLatitude
    mapLongitude
  }
  sharedReport {
    goal
    finalizedAt
  }
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
  contactName
  contactEmail
  area {
    id
    name
    countryCode
    mapLatitude
    mapLongitude
  }
  sharedReport {
    goal
    finalizedAt
  }
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
  eligibility
  eligibilityEvidence {
    criterionId
    status
    reason
  }
  relevanceOrder
  rankingStatus
  rankingReason
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
    deadlineAt
    deadlineTimezone
    sourceHash
    status
    officialSource
    geography
    applicantCategories
    interventions
    amountRules
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
  eligibility
  eligibilityEvidence {
    criterionId
    status
    reason
  }
  relevanceOrder
  rankingStatus
  rankingReason
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
    deadlineAt
    deadlineTimezone
    sourceHash
    status
    officialSource
    geography
    applicantCategories
    interventions
    amountRules
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
export const FundingCatalogueDocument = new TypedDocumentString(`
    query FundingCatalogue($first: Int, $after: String) {
  fundingSchemes(first: $first, after: $after) {
    nodes {
      id
      name
      funder
      summary
      evidence
      status
      officialSource
      sourceUrl
      lastVerifiedAt
      amountRules
      interventions
      maxAmount {
        ...MoneyFields
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
fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}`) as unknown as TypedDocumentString<FundingCatalogueQuery, FundingCatalogueQueryVariables>;
export const InterventionCatalogueDocument = new TypedDocumentString(`
    query InterventionCatalogue {
  interventionCatalogue {
    version
    interventions {
      id
      family
      name
      summary
      serves
      scales
      requires
      blockedBy
      permissions
      maintenance
      costInputs {
        key
        label
      }
      costSources
      construction
      benefitTiming
      benefitNote
      evidence
      effectModel
      cautions
      effectInputs {
        key
        label
        unit
        minimum
        maximum
        required
        note
      }
    }
  }
}
    `) as unknown as TypedDocumentString<InterventionCatalogueQuery, InterventionCatalogueQueryVariables>;
export const CheckGoalDocument = new TypedDocumentString(`
    query CheckGoal($sessionId: ID!, $goal: GoalInput!) {
  checkGoal(sessionId: $sessionId, goal: $goal) {
    errors {
      field
      message
    }
    assessment {
      ...GoalAssessmentFields
    }
  }
}
    fragment GoalAssessmentFields on GoalAssessment {
  outcome
  summary
  nextSteps
  catalogueVersion
  baselineId
  target {
    outcome
    message
    metric
    unit
    baseline
    targetLevel
    caveats
  }
  constraints {
    code
    message
    outcome
  }
  conflicts {
    code
    message
    outcome
  }
  interventions {
    interventionId
    name
    family
    relevant
    outcome
    benefit
    preferred
    site {
      outcome
      message
    }
    cost {
      outcome
      message
    }
    time {
      outcome
      message
    }
  }
}`) as unknown as TypedDocumentString<CheckGoalQuery, CheckGoalQueryVariables>;
export const GoalAssessmentDocument = new TypedDocumentString(`
    query GoalAssessment($sessionId: ID!) {
  planningSession(id: $sessionId) {
    id
    inputsRevision
    goalAssessment {
      ...GoalAssessmentFields
    }
  }
}
    fragment GoalAssessmentFields on GoalAssessment {
  outcome
  summary
  nextSteps
  catalogueVersion
  baselineId
  target {
    outcome
    message
    metric
    unit
    baseline
    targetLevel
    caveats
  }
  constraints {
    code
    message
    outcome
  }
  conflicts {
    code
    message
    outcome
  }
  interventions {
    interventionId
    name
    family
    relevant
    outcome
    benefit
    preferred
    site {
      outcome
      message
    }
    cost {
      outcome
      message
    }
    time {
      outcome
      message
    }
  }
}`) as unknown as TypedDocumentString<GoalAssessmentQuery, GoalAssessmentQueryVariables>;
export const GoalAreaDocument = new TypedDocumentString(`
    query GoalArea($id: ID!) {
  area(id: $id) {
    id
    name
    currency
  }
}
    `) as unknown as TypedDocumentString<GoalAreaQuery, GoalAreaQueryVariables>;
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
    placeId
    ...AreaLocationFields
  }
}
    fragment AreaLocationFields on Area {
  id
  name
  centroidLat
  centroidLon
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
  centroidLat
  centroidLon
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
  baselineReviewed
  status
  areaId
  communityId
  selectedPlanOptionId
  communityBaseline {
    areaId
    concern
    notes
    residents
    dailyUse
    demandEstimated
    demandSource
    asOf
    supplyComplete
    sources {
      name
      kind
      method
      quantity
      multiplier
      periodDays
      estimated
      source
    }
  }
  siteProfile {
    communityType
    occupiedHomes
  }
  inputsRevision
  updatedAt
  area {
    id
    name
    extent
    radiusMeters
    hasBoundary
    extent
    radiusMeters
    hasBoundary
  }
  goal {
    id
    kind
    description
    targetParameter
    timelineDays
    horizonDays
    priority
    also
    confirmed
    preferredInterventions
    waterTariff {
      price {
        ...MoneyFields
      }
      volume {
        ...QuantityFields
      }
      note
    }
    contingencyRatio
    funding {
      label
      amount {
        ...MoneyFields
      }
      status
      note
    }
    budget {
      ...MoneyFields
    }
    target {
      mode
      quantity {
        ...QuantityFields
      }
    }
    site {
      scale
      storageSpace
      pipedSupply
      groundwaterUse
      restrictions
      roofArea {
        ...QuantityFields
      }
      openGround {
        ...QuantityFields
      }
    }
    estimates {
      interventionId
      note
      cost {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      recurring {
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
      effects {
        key
        low
        high
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
  baselineReviewed
  status
  areaId
  communityId
  selectedPlanOptionId
  communityBaseline {
    areaId
    concern
    notes
    residents
    dailyUse
    demandEstimated
    demandSource
    asOf
    supplyComplete
    sources {
      name
      kind
      method
      quantity
      multiplier
      periodDays
      estimated
      source
    }
  }
  siteProfile {
    communityType
    occupiedHomes
  }
  inputsRevision
  updatedAt
  area {
    id
    name
    extent
    radiusMeters
    hasBoundary
    extent
    radiusMeters
    hasBoundary
  }
  goal {
    id
    kind
    description
    targetParameter
    timelineDays
    horizonDays
    priority
    also
    confirmed
    preferredInterventions
    waterTariff {
      price {
        ...MoneyFields
      }
      volume {
        ...QuantityFields
      }
      note
    }
    contingencyRatio
    funding {
      label
      amount {
        ...MoneyFields
      }
      status
      note
    }
    budget {
      ...MoneyFields
    }
    target {
      mode
      quantity {
        ...QuantityFields
      }
    }
    site {
      scale
      storageSpace
      pipedSupply
      groundwaterUse
      restrictions
      roofArea {
        ...QuantityFields
      }
      openGround {
        ...QuantityFields
      }
    }
    estimates {
      interventionId
      note
      cost {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      recurring {
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
      effects {
        key
        low
        high
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
  baselineReviewed
  status
  areaId
  communityId
  selectedPlanOptionId
  communityBaseline {
    areaId
    concern
    notes
    residents
    dailyUse
    demandEstimated
    demandSource
    asOf
    supplyComplete
    sources {
      name
      kind
      method
      quantity
      multiplier
      periodDays
      estimated
      source
    }
  }
  siteProfile {
    communityType
    occupiedHomes
  }
  inputsRevision
  updatedAt
  area {
    id
    name
    extent
    radiusMeters
    hasBoundary
    extent
    radiusMeters
    hasBoundary
  }
  goal {
    id
    kind
    description
    targetParameter
    timelineDays
    horizonDays
    priority
    also
    confirmed
    preferredInterventions
    waterTariff {
      price {
        ...MoneyFields
      }
      volume {
        ...QuantityFields
      }
      note
    }
    contingencyRatio
    funding {
      label
      amount {
        ...MoneyFields
      }
      status
      note
    }
    budget {
      ...MoneyFields
    }
    target {
      mode
      quantity {
        ...QuantityFields
      }
    }
    site {
      scale
      storageSpace
      pipedSupply
      groundwaterUse
      restrictions
      roofArea {
        ...QuantityFields
      }
      openGround {
        ...QuantityFields
      }
    }
    estimates {
      interventionId
      note
      cost {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      recurring {
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
      effects {
        key
        low
        high
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
  baselineReviewed
  status
  areaId
  communityId
  selectedPlanOptionId
  communityBaseline {
    areaId
    concern
    notes
    residents
    dailyUse
    demandEstimated
    demandSource
    asOf
    supplyComplete
    sources {
      name
      kind
      method
      quantity
      multiplier
      periodDays
      estimated
      source
    }
  }
  siteProfile {
    communityType
    occupiedHomes
  }
  inputsRevision
  updatedAt
  area {
    id
    name
    extent
    radiusMeters
    hasBoundary
    extent
    radiusMeters
    hasBoundary
  }
  goal {
    id
    kind
    description
    targetParameter
    timelineDays
    horizonDays
    priority
    also
    confirmed
    preferredInterventions
    waterTariff {
      price {
        ...MoneyFields
      }
      volume {
        ...QuantityFields
      }
      note
    }
    contingencyRatio
    funding {
      label
      amount {
        ...MoneyFields
      }
      status
      note
    }
    budget {
      ...MoneyFields
    }
    target {
      mode
      quantity {
        ...QuantityFields
      }
    }
    site {
      scale
      storageSpace
      pipedSupply
      groundwaterUse
      restrictions
      roofArea {
        ...QuantityFields
      }
      openGround {
        ...QuantityFields
      }
    }
    estimates {
      interventionId
      note
      cost {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      recurring {
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
      effects {
        key
        low
        high
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
export const PlanComparisonDocument = new TypedDocumentString(`
    query PlanComparison($id: ID!) {
  planningSession(id: $id) {
    id
    inputsRevision
    selectedPlanOptionId
    selectedPlanStatus
    planComparison {
      id
      engineVersion
      scenarioEngineVersion
      catalogueVersion
      baselineId
      status
      summary
      metric
      unit
      needs
      excluded
      assumptions
      ranking
      maxOptions
      stressTests
      baselineValue {
        ...ExactNumberFields
      }
      scenarioValue {
        ...ExactNumberFields
      }
      targetLevel {
        ...ExactNumberFields
      }
      rejections {
        evaluated
        onlyOptimistic
        missedTarget
        overBudget
        budgetUncertain
        tooSlow
        timeUncertain
        notMinimal
        truncated
      }
      options {
        ...ComparedOptionFields
      }
      impactEngineVersion
      impactContext {
        ...ImpactContextFields
      }
    }
    scenarioComparison {
      ...ScenarioComparisonFields
    }
  }
}
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment ExactNumberFields on ExactNumber {
  exact
  value
}
fragment ScenarioComparisonFields on ScenarioComparison {
  status
  notes
  baselineId
  engineVersion
  rows {
    key
    label
    unit
    reason
    baseline {
      ...ExactNumberFields
    }
    scenario {
      ...ExactNumberFields
    }
    change {
      ...ExactNumberFields
    }
  }
}
fragment ImpactCitationFields on ImpactCitation {
  kind
  ref
  label
  asOf
}
fragment ImpactFindingFields on ImpactFinding {
  id
  kind
  statement
  basis
  uncertainty
  system
  direction
  linkage
  interventionIds
  related
  magnitude {
    metricId
    unit
    baseline {
      ...ExactNumberFields
    }
    atLowEstimates {
      ...ExactNumberFields
    }
    atHighEstimates {
      ...ExactNumberFields
    }
  }
  citations {
    ...ImpactCitationFields
  }
}
fragment WiderImpactFields on WiderImpact {
  id
  engineVersion
  catalogueVersion
  inputHash
  localBenefits {
    ...ImpactFindingFields
  }
  externalities {
    ...ImpactFindingFields
  }
  falseResilience {
    ...ImpactFindingFields
  }
  tradeoffs {
    ...ImpactFindingFields
  }
  reviews {
    kind
    label
    required
    reasons
    interventionIds
  }
}
fragment ImpactContextFields on ImpactContext {
  areaName
  nearbyRadiusM
  groundwater
  groundwaterCitations {
    ...ImpactCitationFields
  }
  waterQualityNote
  boundaries {
    level
    label
    detail
    system
    linkage
    citations {
      ...ImpactCitationFields
    }
  }
  nearby {
    name
    communityId
    distanceM
    links {
      system
      linkage
      evidenceIds
    }
  }
  waterQuality {
    parameter
    value {
      ...ExactNumberFields
    }
    unit
    observedOn
    method
    citations {
      ...ImpactCitationFields
    }
  }
  unavailable {
    key
    label
    reason
  }
}
fragment EconomicsFields on OptionEconomics {
  engineVersion
  currency
  capex {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  contingency {
    ratio
    amount {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
  }
  upfrontTotal {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  recurringAnnual {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  recurringReason
  avoidedTankerAnnual {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  avoidedReason
  netAnnual {
    low {
      ...MoneyFields
    }
    high {
      ...MoneyFields
    }
  }
  payback {
    outcome
    optimisticDays
    pessimisticDays
    note
  }
  horizon {
    days
    netPositive
    reason
    net {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    avoided {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    recurring {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
  }
  funding {
    totalCost {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    approved {
      ...MoneyFields
    }
    candidate {
      ...MoneyFields
    }
    fullyFunded
    gap {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    lines {
      label
      status
      counts
      applicable
      amount {
        ...MoneyFields
      }
    }
    note
  }
  assumptions
  notes
}
fragment ComparedOptionFields on ComparedOption {
  id
  rank
  name
  interventionIds
  why
  tradeoffs
  uncertainty
  firstBenefit
  pessimistic {
    ...ExactNumberFields
  }
  optimistic {
    ...ExactNumberFields
  }
  margin {
    ...ExactNumberFields
  }
  waterLow {
    ...ExactNumberFields
  }
  waterHigh {
    ...ExactNumberFields
  }
  uncountedHigh {
    ...ExactNumberFields
  }
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
  measures {
    interventionId
    name
    benefitTiming
    effects {
      key
      label
      unit
      origin
      low {
        ...ExactNumberFields
      }
      high {
        ...ExactNumberFields
      }
    }
    waterLow {
      ...ExactNumberFields
    }
    waterHigh {
      ...ExactNumberFields
    }
    cost {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    recurring {
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
  }
  sensitivity {
    interventionId
    key
    label
    swing {
      ...ExactNumberFields
    }
  }
  stress {
    key
    label
    meetsTarget
    value {
      ...ExactNumberFields
    }
  }
  impact {
    ...WiderImpactFields
  }
  economics {
    ...EconomicsFields
  }
}`) as unknown as TypedDocumentString<PlanComparisonQuery, PlanComparisonQueryVariables>;
export const PreviewScenarioDocument = new TypedDocumentString(`
    query PreviewScenario($sessionId: ID!, $scenario: ScenarioPreviewInput!) {
  previewScenario(sessionId: $sessionId, scenario: $scenario) {
    errors {
      field
      message
    }
    comparison {
      ...ScenarioComparisonFields
    }
  }
}
    fragment ExactNumberFields on ExactNumber {
  exact
  value
}
fragment ScenarioComparisonFields on ScenarioComparison {
  status
  notes
  baselineId
  engineVersion
  rows {
    key
    label
    unit
    reason
    baseline {
      ...ExactNumberFields
    }
    scenario {
      ...ExactNumberFields
    }
    change {
      ...ExactNumberFields
    }
  }
}`) as unknown as TypedDocumentString<PreviewScenarioQuery, PreviewScenarioQueryVariables>;
export const SessionScenarioDocument = new TypedDocumentString(`
    query SessionScenario($id: ID!) {
  planningSession(id: $id) {
    id
    inputsRevision
    scenarioComparison {
      ...ScenarioComparisonFields
    }
  }
}
    fragment ExactNumberFields on ExactNumber {
  exact
  value
}
fragment ScenarioComparisonFields on ScenarioComparison {
  status
  notes
  baselineId
  engineVersion
  rows {
    key
    label
    unit
    reason
    baseline {
      ...ExactNumberFields
    }
    scenario {
      ...ExactNumberFields
    }
    change {
      ...ExactNumberFields
    }
  }
}`) as unknown as TypedDocumentString<SessionScenarioQuery, SessionScenarioQueryVariables>;
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
      siteProfile {
        communityType
        occupiedHomes
      }
      area {
        id
        name
        countryCode
        centroidLat
        centroidLon
        extent
        radiusMeters
        admin {
          locality
        }
        boundaryBox {
          minLongitude
          minLatitude
          maxLongitude
          maxLatitude
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
  planName
  goal {
    id
    kind
    description
  }
  economics {
    engineVersion
    currency
    capex {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    upfrontTotal {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    recurringAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    avoidedTankerAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    netAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    funding {
      totalCost {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      approved {
        ...MoneyFields
      }
      gap {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      candidate {
        ...MoneyFields
      }
      fullyFunded
      note
    }
    assumptions
    notes
  }
  finalizedAt
  archivedAt
}`) as unknown as TypedDocumentString<ReportsQuery, ReportsQueryVariables>;
export const FundingSchemesDocument = new TypedDocumentString(`
    query FundingSchemes($first: Int, $after: String) {
  fundingSchemes(first: $first, after: $after) {
    nodes {
      id
      name
      funder
      summary
      status
      evidence
      officialSource
      sourceUrl
      sourceHash
      lastVerifiedAt
      currency
      maxAmount {
        ...MoneyFields
      }
      deadlineAt
      deadlineTimezone
      requiredDocuments
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
}`) as unknown as TypedDocumentString<FundingSchemesQuery, FundingSchemesQueryVariables>;
export const ReportDocument = new TypedDocumentString(`
    query Report($id: ID!) {
  report(id: $id) {
    ...ReportFields
    area {
      id
      name
      countryCode
    }
    impact {
      metrics {
        metricId
        baseline {
          availability
          quantity {
            value
            unit
          }
          reason
        }
        projectedLow {
          availability
          quantity {
            value
            unit
          }
          reason
        }
        projectedHigh {
          availability
          quantity {
            value
            unit
          }
          reason
        }
      }
      neighbourEffect {
        availability
        quantity {
          value
          unit
        }
        reason
      }
      assumptions
      provenance {
        evidence
        sourceIds
        asOf
      }
    }
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
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
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
  planName
  goal {
    id
    kind
    description
  }
  economics {
    engineVersion
    currency
    capex {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    upfrontTotal {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    recurringAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    avoidedTankerAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    netAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    funding {
      totalCost {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      approved {
        ...MoneyFields
      }
      gap {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      candidate {
        ...MoneyFields
      }
      fullyFunded
      note
    }
    assumptions
    notes
  }
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
  previewPath
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
  previewPath
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
fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
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
  planName
  goal {
    id
    kind
    description
  }
  economics {
    engineVersion
    currency
    capex {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    upfrontTotal {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    recurringAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    avoidedTankerAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    netAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    funding {
      totalCost {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      approved {
        ...MoneyFields
      }
      gap {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      candidate {
        ...MoneyFields
      }
      fullyFunded
      note
    }
    assumptions
    notes
  }
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
fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
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
  planName
  goal {
    id
    kind
    description
  }
  economics {
    engineVersion
    currency
    capex {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    upfrontTotal {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    recurringAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    avoidedTankerAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    netAnnual {
      low {
        ...MoneyFields
      }
      high {
        ...MoneyFields
      }
    }
    funding {
      totalCost {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      approved {
        ...MoneyFields
      }
      gap {
        low {
          ...MoneyFields
        }
        high {
          ...MoneyFields
        }
      }
      candidate {
        ...MoneyFields
      }
      fullyFunded
      note
    }
    assumptions
    notes
  }
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
  previewPath
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
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
fragment ProjectFields on ImplementationProject {
  id
  version
  reportId
  reportVersion
  areaId
  communityId
  sharedWithCommunity
  title
  status
  startedAt
  expenses {
    description
    spentOn
    source
    amount {
      ...MoneyFields
    }
  }
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
    fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment PageInfoFields on PageInfo {
  hasNextPage
  endCursor
}
fragment ProjectFields on ImplementationProject {
  id
  version
  reportId
  reportVersion
  areaId
  communityId
  sharedWithCommunity
  title
  status
  startedAt
  expenses {
    description
    spentOn
    source
    amount {
      ...MoneyFields
    }
  }
}
fragment MilestoneFields on Milestone {
  id
  version
  projectId
  title
  plannedOn
  responsibleIdentity
  tasks
  status
  completedOn
  completedAt
}`) as unknown as TypedDocumentString<ImplementationProjectQuery, ImplementationProjectQueryVariables>;
export const TrackingReportsDocument = new TypedDocumentString(`
    query TrackingReports($first: Int, $after: String) {
  reports(filter: { status: FINALIZED }, first: $first, after: $after) {
    nodes {
      id
      version
      title
      status
      communityId
      areaId
      finalizedAt
      goal {
        horizonDays
      }
      impact {
        metrics {
          metricId
          projectedLow {
            quantity {
              value
              unit
            }
          }
          projectedHigh {
            quantity {
              value
              unit
            }
          }
        }
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
}`) as unknown as TypedDocumentString<TrackingReportsQuery, TrackingReportsQueryVariables>;
export const TrackingReportDocument = new TypedDocumentString(`
    query TrackingReport($id: ID!) {
  report(id: $id) {
    id
    version
    title
    status
    communityId
    areaId
    finalizedAt
    goal {
      horizonDays
    }
    impact {
      metrics {
        metricId
        projectedLow {
          quantity {
            value
            unit
          }
        }
        projectedHigh {
          quantity {
            value
            unit
          }
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<TrackingReportQuery, TrackingReportQueryVariables>;
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
  sourceType
  source
  permittedSourceConfirmed
  areaId
  windowStart
  windowEnd
  coverageObservedDays
  coverageExpectedDays
  note
  evidence
  recordedByViewer
  comparison {
    status
    reason
    relation
    forecastLow {
      value
      unit
    }
    forecastHigh {
      value
      unit
    }
  }
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
fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment ProjectFields on ImplementationProject {
  id
  version
  reportId
  reportVersion
  areaId
  communityId
  sharedWithCommunity
  title
  status
  startedAt
  expenses {
    description
    spentOn
    source
    amount {
      ...MoneyFields
    }
  }
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
  responsibleIdentity
  tasks
  status
  completedOn
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
  sourceType
  source
  permittedSourceConfirmed
  areaId
  windowStart
  windowEnd
  coverageObservedDays
  coverageExpectedDays
  note
  evidence
  recordedByViewer
  comparison {
    status
    reason
    relation
    forecastLow {
      value
      unit
    }
    forecastHigh {
      value
      unit
    }
  }
  quantity {
    ...QuantityFields
  }
}`) as unknown as TypedDocumentString<RecordObservationMutation, RecordObservationMutationVariables>;
export const AddProjectExpenseDocument = new TypedDocumentString(`
    mutation AddProjectExpense($input: AddProjectExpenseInput!) {
  addProjectExpense(input: $input) {
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
fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment ProjectFields on ImplementationProject {
  id
  version
  reportId
  reportVersion
  areaId
  communityId
  sharedWithCommunity
  title
  status
  startedAt
  expenses {
    description
    spentOn
    source
    amount {
      ...MoneyFields
    }
  }
}`) as unknown as TypedDocumentString<AddProjectExpenseMutation, AddProjectExpenseMutationVariables>;
export const UpdateProjectStatusDocument = new TypedDocumentString(`
    mutation UpdateProjectStatus($input: UpdateProjectStatusInput!) {
  updateProjectStatus(input: $input) {
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
fragment MoneyFields on Money {
  minorUnits
  currency
  exponent
}
fragment ProjectFields on ImplementationProject {
  id
  version
  reportId
  reportVersion
  areaId
  communityId
  sharedWithCommunity
  title
  status
  startedAt
  expenses {
    description
    spentOn
    source
    amount {
      ...MoneyFields
    }
  }
}`) as unknown as TypedDocumentString<UpdateProjectStatusMutation, UpdateProjectStatusMutationVariables>;