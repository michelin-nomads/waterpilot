export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** An exact decimal number as a string (e.g. '1250000.5'). Parse with a decimal library, never as a binary float. */
  DecimalString: { input: string; output: string; }
  /** A calendar date (YYYY-MM-DD) in the relevant area's IANA timezone. */
  LocalDate: { input: string; output: string; }
  /** An integer amount of a currency's minor unit (e.g. paise for INR) as a string, to avoid 32-bit/53-bit integer limits. */
  MinorUnits: { input: string; output: string; }
  /** An instant in UTC, ISO-8601 with a 'Z' suffix (e.g. 2026-10-07T18:30:00Z). */
  UtcDateTime: { input: string; output: string; }
};

export type AccountClaim = {
  /** This account's previously active session, closed (one active session). */
  closedSessionId?: Maybe<Scalars['ID']['output']>;
  expiresAt: Scalars['UtcDateTime']['output'];
  id: Scalars['ID']['output'];
  status: AccountClaimStatus;
  /** The guest's active planning session, now owned by this account. */
  transferredSessionId?: Maybe<Scalars['ID']['output']>;
  version: Scalars['Int']['output'];
};

export type AccountClaimPayload = {
  claim?: Maybe<AccountClaim>;
  error?: Maybe<MutationError>;
};

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

export type AdminContext = {
  /** State, province or region. */
  admin1?: Maybe<Scalars['String']['output']>;
  /** District or county. */
  admin2?: Maybe<Scalars['String']['output']>;
  countryName?: Maybe<Scalars['String']['output']>;
  locality?: Maybe<Scalars['String']['output']>;
  sublocality?: Maybe<Scalars['String']['output']>;
};

export type AdminContextInput = {
  admin1?: InputMaybe<Scalars['String']['input']>;
  admin2?: InputMaybe<Scalars['String']['input']>;
  countryName?: InputMaybe<Scalars['String']['input']>;
  locality?: InputMaybe<Scalars['String']['input']>;
  sublocality?: InputMaybe<Scalars['String']['input']>;
};

export type AgentRun = {
  createdAt: Scalars['UtcDateTime']['output'];
  endedAt?: Maybe<Scalars['UtcDateTime']['output']>;
  /** Authenticated SSE stream for this run. */
  eventsPath: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  maxOutputTokens: Scalars['Int']['output'];
  maxToolCalls: Scalars['Int']['output'];
  sessionId: Scalars['ID']['output'];
  status: AgentRunStatus;
  stopReason?: Maybe<AgentStopReason>;
  toolCalls: Scalars['Int']['output'];
  version: Scalars['Int']['output'];
};

export type AgentRunConnection = {
  nodes: Array<AgentRun>;
  pageInfo: PageInfo;
};

export type AgentRunStatus =
  | 'COMPLETED'
  | 'FAILED'
  | 'RUNNING'
  | 'STOPPED';

export type AgentStopReason =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'DAILY_BUDGET'
  | 'ERROR'
  | 'TOKEN_BUDGET'
  | 'TOOL_BUDGET';

export type ArchiveCommunityInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
};

export type ArchiveReportInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
};

export type Area = {
  /** Reported device accuracy. */
  accuracyMeters?: Maybe<Scalars['Int']['output']>;
  admin: AdminContext;
  centroidLat: Scalars['DecimalString']['output'];
  centroidLon: Scalars['DecimalString']['output'];
  countryCode: Scalars['String']['output'];
  coverage: Coverage;
  createdAt: Scalars['UtcDateTime']['output'];
  /** ISO 4217 code for this location (CLDR), separate from interface language. */
  currency?: Maybe<Scalars['String']['output']>;
  evidence: EvidenceQuality;
  extent: ExtentKind;
  formattedAddress?: Maybe<Scalars['String']['output']>;
  /** False when only the reference point is known; no boundary is invented. */
  hasBoundary: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  origin: AreaOrigin;
  /** Provider-prefixed place id. */
  placeId?: Maybe<Scalars['String']['output']>;
  /** Device and typed-in locations: owner only. */
  private: Scalars['Boolean']['output'];
  /** True once provider content has expired (choose it again). */
  providerContentExpired: Scalars['Boolean']['output'];
  /** After this, provider content must be refreshed by choosing it again. */
  providerExpiresAt?: Maybe<Scalars['UtcDateTime']['output']>;
  /** Set for a radius you chose. */
  radiusMeters?: Maybe<Scalars['Int']['output']>;
  /** Per-capability, per-input and per-metric readiness. With sessionId (yours, for this area) it also counts the values you entered. */
  readiness: AreaReadiness;
  /** currency and/or timezone when the person corrected the inferred value. */
  regionSetByUser: Array<Scalars['String']['output']>;
  scope: GeographicScope;
  /** IANA timezone used for local dates. */
  timezone: Scalars['String']['output'];
  unitSystem: UnitSystem;
};


export type AreaReadinessArgs = {
  sessionId?: InputMaybe<Scalars['ID']['input']>;
};

export type AreaConnection = {
  nodes: Array<Area>;
  pageInfo: PageInfo;
};

export type AreaOrigin =
  | 'CATALOGUE'
  | 'CUSTOM'
  | 'GEOLOCATION'
  | 'PLACE_SEARCH';

export type AreaReadiness = {
  areaId: Scalars['ID']['output'];
  /** Local date windows and ages count from. */
  asOf: Scalars['LocalDate']['output'];
  assessedAt: Scalars['UtcDateTime']['output'];
  /** USER_INPUT when no imported evidence covers this location: results can use only values you enter, labelled as entered by you. */
  basis: AssessmentBasis;
  capabilities: Array<CapabilityReadiness>;
  demo: Scalars['Boolean']['output'];
  inputs: Array<InputReadiness>;
  metrics: Array<MetricReadiness>;
  sessionId?: Maybe<Scalars['ID']['output']>;
};

export type AssessmentBasis =
  | 'LIMITED'
  | 'SOURCED'
  | 'USER_INPUT';

export type Availability =
  | 'AVAILABLE'
  | 'PROVISIONAL'
  | 'UNAVAILABLE';

export type BeginAccountClaimPayload = {
  claim?: Maybe<AccountClaim>;
  /** Returned once and never stored in clear. Keep it in memory only. */
  claimSecret?: Maybe<Scalars['String']['output']>;
  error?: Maybe<MutationError>;
};

export type CancelAccountClaimInput = {
  claimId: Scalars['ID']['input'];
  expectedVersion: Scalars['Int']['input'];
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

export type CapabilityReadiness = {
  capability: Capability;
  /** Counts SYNTHETIC demo data (local mode only). */
  demo: Scalars['Boolean']['output'];
  reasons: Array<Scalars['String']['output']>;
  registeredSourceIds: Array<Scalars['String']['output']>;
  requiresLocalMeasurement: Scalars['Boolean']['output'];
  requiresReviewedModel: Scalars['Boolean']['output'];
  snapshotIds: Array<Scalars['String']['output']>;
  state: ReadinessState;
  technicalSupport: TechnicalSupport;
};

export type Community = {
  archivedAt?: Maybe<Scalars['UtcDateTime']['output']>;
  area?: Maybe<Area>;
  areaId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['UtcDateTime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  memberCount: Scalars['Int']['output'];
  /** Members only. */
  members: MembershipConnection;
  name: Scalars['String']['output'];
  status: CommunityStatus;
  updatedAt: Scalars['UtcDateTime']['output'];
  version: Scalars['Int']['output'];
  /** The caller's active membership, or null. */
  viewerMembership?: Maybe<Membership>;
};


export type CommunityMembersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type CommunityConnection = {
  nodes: Array<Community>;
  pageInfo: PageInfo;
};

export type CommunityFilter = {
  areaId?: InputMaybe<Scalars['ID']['input']>;
  includeArchived?: Scalars['Boolean']['input'];
};

export type CommunityPayload = {
  community?: Maybe<Community>;
  error?: Maybe<MutationError>;
};

export type CommunityStatus =
  | 'ACTIVE'
  | 'ARCHIVED';

export type CompleteAccountClaimInput = {
  claimId: Scalars['ID']['input'];
  claimSecret: Scalars['String']['input'];
  idempotencyKey: Scalars['String']['input'];
};

export type ConfirmLocationInput = {
  accuracyMeters?: InputMaybe<Scalars['Int']['input']>;
  admin?: InputMaybe<AdminContextInput>;
  countryCode: Scalars['String']['input'];
  /** ISO 4217 code correcting the inferred one. */
  currency?: InputMaybe<Scalars['String']['input']>;
  /** Required: REFERENCE_POINT or USER_RADIUS, chosen by the person. */
  extent: ExtentKind;
  formattedAddress?: InputMaybe<Scalars['String']['input']>;
  idempotencyKey: Scalars['String']['input'];
  latitude: Scalars['DecimalString']['input'];
  longitude: Scalars['DecimalString']['input'];
  name: Scalars['String']['input'];
  /** PLACE_SEARCH, GEOLOCATION or CUSTOM. */
  origin: AreaOrigin;
  placeId?: InputMaybe<Scalars['String']['input']>;
  radiusMeters?: InputMaybe<Scalars['Int']['input']>;
  /** IANA zone correcting the inferred one. */
  timezone?: InputMaybe<Scalars['String']['input']>;
  types?: Array<Scalars['String']['input']>;
};

export type ConfirmLocationPayload = {
  area?: Maybe<Area>;
  error?: Maybe<MutationError>;
};

export type Country = {
  code: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type CountryList = {
  /** Fixed CLDR list (about 250 entries), sorted by English name. */
  countries: Array<Country>;
};

export type Coverage = {
  areaId: Scalars['ID']['output'];
  assessedAt: Scalars['UtcDateTime']['output'];
  items: Array<CoverageItem>;
};

export type CoverageItem = {
  availability: Availability;
  capability: Capability;
  evidence?: Maybe<EvidenceQuality>;
  reason?: Maybe<Scalars['String']['output']>;
  sourceIds: Array<Scalars['String']['output']>;
};

export type CreateCommunityInput = {
  areaId?: InputMaybe<Scalars['ID']['input']>;
  description?: Scalars['String']['input'];
  idempotencyKey: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type CreatePlanningSessionInput = {
  areaId?: InputMaybe<Scalars['ID']['input']>;
  communityId?: InputMaybe<Scalars['ID']['input']>;
  idempotencyKey: Scalars['String']['input'];
  mode: PlanningMode;
};

export type Criterion = {
  id: Scalars['String']['output'];
  /** True when WaterLens evaluates this criterion deterministically. */
  machineCheckable: Scalars['Boolean']['output'];
  text: Scalars['String']['output'];
};

export type CriterionResult = {
  criterionId: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  status: CriterionStatus;
};

export type CriterionStatus =
  | 'MET'
  | 'NEEDS_CHECK'
  | 'NOT_MET';

export type DayRange = {
  high: Scalars['Int']['output'];
  low: Scalars['Int']['output'];
};

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

export type FieldError = {
  /** camelCase input path, e.g. 'goal.budget'. */
  field: Scalars['String']['output'];
  message: Scalars['String']['output'];
};

export type FinalizeReportInput = {
  idempotencyKey: Scalars['String']['input'];
  sessionId: Scalars['ID']['input'];
  title: Scalars['String']['input'];
};

/** Per-criterion results for one scheme. There is deliberately no match percentage or likelihood. */
export type FundingMatch = {
  createdAt: Scalars['UtcDateTime']['output'];
  id: Scalars['ID']['output'];
  metCount: Scalars['Int']['output'];
  needsCheckCount: Scalars['Int']['output'];
  notMetCount: Scalars['Int']['output'];
  planOptionId: Scalars['ID']['output'];
  results: Array<CriterionResult>;
  rulesVersion: Scalars['String']['output'];
  scheme: FundingScheme;
  schemeId: Scalars['ID']['output'];
  sessionId: Scalars['ID']['output'];
  status: FundingMatchStatus;
  updatedAt: Scalars['UtcDateTime']['output'];
  version: Scalars['Int']['output'];
  window: WindowStatus;
};

export type FundingMatchConnection = {
  nodes: Array<FundingMatch>;
  pageInfo: PageInfo;
};

export type FundingMatchStatus =
  | 'ADDED'
  | 'CANDIDATE'
  | 'DISMISSED';

export type FundingScheme = {
  /** Exclusive end of the window. */
  closesOn?: Maybe<Scalars['LocalDate']['output']>;
  criteria: Array<Criterion>;
  currency: Scalars['String']['output'];
  evidence: EvidenceQuality;
  funder: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastVerifiedAt: Scalars['UtcDateTime']['output'];
  maxAmount?: Maybe<Money>;
  name: Scalars['String']['output'];
  opensOn?: Maybe<Scalars['LocalDate']['output']>;
  requiredDocuments: Array<Scalars['String']['output']>;
  sourceUrl: Scalars['String']['output'];
  /** Catalogue text; untrusted, render as text. */
  summary: Scalars['String']['output'];
};

export type FundingSchemeConnection = {
  nodes: Array<FundingScheme>;
  pageInfo: PageInfo;
};

export type GenerateProposalInput = {
  idempotencyKey: Scalars['String']['input'];
  reportId: Scalars['ID']['input'];
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

export type Goal = {
  budget?: Maybe<Money>;
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  kind: GoalKind;
  priority?: Maybe<Priority>;
  target?: Maybe<GoalTarget>;
  timelineDays?: Maybe<Scalars['Int']['output']>;
};

export type GoalInput = {
  budget?: InputMaybe<MoneyInput>;
  description?: Scalars['String']['input'];
  kind: GoalKind;
  priority?: InputMaybe<Priority>;
  target?: InputMaybe<GoalTargetInput>;
  timelineDays?: InputMaybe<Scalars['Int']['input']>;
};

export type GoalKind =
  | 'CUSTOM'
  | 'IMPROVE_GROUNDWATER'
  | 'IMPROVE_WATER_QUALITY'
  | 'REDUCE_FLOOD_RISK'
  | 'REDUCE_SHORTAGE'
  | 'REDUCE_TANKER_DEPENDENCE';

export type GoalTarget = {
  mode: TargetMode;
  quantity: Quantity;
};

export type GoalTargetInput = {
  mode: TargetMode;
  quantity: QuantityInput;
};

export type ImpactAssessment = {
  assumptions: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  metrics: Array<ImpactMetric>;
  neighbourEffect: MeasuredValue;
  provenance: Provenance;
};

export type ImpactMetric = {
  baseline: MeasuredValue;
  metricId: Scalars['String']['output'];
  projectedHigh: MeasuredValue;
  projectedLow: MeasuredValue;
};

export type ImplementationProject = {
  communityId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['UtcDateTime']['output'];
  id: Scalars['ID']['output'];
  milestones: MilestoneConnection;
  observations: ObservationConnection;
  reportId: Scalars['ID']['output'];
  startedAt: Scalars['UtcDateTime']['output'];
  status: ProjectStatus;
  title: Scalars['String']['output'];
  updatedAt: Scalars['UtcDateTime']['output'];
  version: Scalars['Int']['output'];
};


export type ImplementationProjectMilestonesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type ImplementationProjectObservationsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type ImplementationProjectConnection = {
  nodes: Array<ImplementationProject>;
  pageInfo: PageInfo;
};

export type ImplementationProjectPayload = {
  error?: Maybe<MutationError>;
  project?: Maybe<ImplementationProject>;
};

export type InputReadiness = {
  /** What a person can do to unblock this input. */
  action: Scalars['String']['output'];
  demo: Scalars['Boolean']['output'];
  input: ReadinessInput;
  label: Scalars['String']['output'];
  manualEntryAllowed: Scalars['Boolean']['output'];
  manualInputId?: Maybe<Scalars['ID']['output']>;
  manualValue?: Maybe<Scalars['DecimalString']['output']>;
  /** Set when the input arrives with a later build step. */
  ownerPrompt?: Maybe<Scalars['String']['output']>;
  reasons: Array<Scalars['String']['output']>;
  snapshotId?: Maybe<Scalars['String']['output']>;
  state: ReadinessState;
  unit: CanonicalUnit;
};

export type Job = {
  attempts: Scalars['Int']['output'];
  createdAt: Scalars['UtcDateTime']['output'];
  errorCode?: Maybe<ErrorCode>;
  /** Authenticated SSE stream for this job. */
  eventsPath: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  kind: JobKind;
  maxAttempts: Scalars['Int']['output'];
  stage?: Maybe<Scalars['String']['output']>;
  status: JobStatus;
  updatedAt: Scalars['UtcDateTime']['output'];
  version: Scalars['Int']['output'];
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
  communityId: Scalars['ID']['input'];
  idempotencyKey: Scalars['String']['input'];
};

export type LeaveCommunityInput = {
  communityId: Scalars['ID']['input'];
  /** Your membership's version. */
  expectedVersion: Scalars['Int']['input'];
};

export type LocationResolution = {
  candidates: Array<PlaceCandidate>;
  /** Several places match: ask which one. Nothing is chosen for the person. */
  needsClarification: Scalars['Boolean']['output'];
  /** google, fixture (local test data) or none. */
  provider: Scalars['String']['output'];
  query: Scalars['String']['output'];
  /** What to ask the person next. */
  question: Scalars['String']['output'];
};

export type ManualInput = {
  asOf: Scalars['LocalDate']['output'];
  createdAt: Scalars['UtcDateTime']['output'];
  enteredUnit: Scalars['String']['output'];
  enteredValue: Scalars['DecimalString']['output'];
  id: Scalars['ID']['output'];
  input: ReadinessInput;
  note: Scalars['String']['output'];
  sessionId: Scalars['ID']['output'];
  unit: CanonicalUnit;
  value: Scalars['DecimalString']['output'];
};

export type ManualInputPayload = {
  error?: Maybe<MutationError>;
  manualInput?: Maybe<ManualInput>;
};

export type MatchFundingInput = {
  idempotencyKey: Scalars['String']['input'];
  planOptionId: Scalars['ID']['input'];
  sessionId: Scalars['ID']['input'];
};

export type MatchFundingPayload = {
  error?: Maybe<MutationError>;
  matches?: Maybe<Array<FundingMatch>>;
};

/** A value whose absence is explicit: quantity is null when unavailable, and reason explains unavailable or provisional values. Never rendered as zero. */
export type MeasuredValue = {
  availability: Availability;
  provenance?: Maybe<Provenance>;
  quantity?: Maybe<Quantity>;
  reason?: Maybe<Scalars['String']['output']>;
};

export type Membership = {
  community: Community;
  communityId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  isViewer: Scalars['Boolean']['output'];
  joinedAt: Scalars['UtcDateTime']['output'];
  leftAt?: Maybe<Scalars['UtcDateTime']['output']>;
  role: MembershipRole;
  version: Scalars['Int']['output'];
};

export type MembershipConnection = {
  nodes: Array<Membership>;
  pageInfo: PageInfo;
};

export type MembershipPayload = {
  error?: Maybe<MutationError>;
  membership?: Maybe<Membership>;
};

export type MembershipRole =
  | 'COORDINATOR'
  | 'MEMBER';

export type MetricReadiness = {
  blockedInputs: Array<ReadinessInput>;
  demo: Scalars['Boolean']['output'];
  /** Metric id from the metrics registry. */
  metric: Scalars['String']['output'];
  reasons: Array<Scalars['String']['output']>;
  state: ReadinessState;
};

export type Milestone = {
  completedAt?: Maybe<Scalars['UtcDateTime']['output']>;
  id: Scalars['ID']['output'];
  plannedOn: Scalars['LocalDate']['output'];
  projectId: Scalars['ID']['output'];
  status: MilestoneStatus;
  title: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

export type MilestoneConnection = {
  nodes: Array<Milestone>;
  pageInfo: PageInfo;
};

export type MilestoneInput = {
  plannedOn: Scalars['LocalDate']['input'];
  title: Scalars['String']['input'];
};

export type MilestonePayload = {
  error?: Maybe<MutationError>;
  milestone?: Maybe<Milestone>;
};

export type MilestoneStatus =
  | 'DONE'
  | 'IN_PROGRESS'
  | 'PLANNED'
  | 'SKIPPED';

/** Integer minor units of an explicit ISO 4217 currency. */
export type Money = {
  /** ISO 4217 code, e.g. INR. */
  currency: Scalars['String']['output'];
  /** Minor-unit exponent (2 for INR: paise). */
  exponent: Scalars['Int']['output'];
  minorUnits: Scalars['MinorUnits']['output'];
};

/** Money as integer minor units; currency must be supported. */
export type MoneyInput = {
  currency: Scalars['String']['input'];
  minorUnits: Scalars['MinorUnits']['input'];
};

export type MoneyRange = {
  high: Money;
  low: Money;
};

export type Mutation = {
  /** Coordinators only; the community becomes read-only. */
  archiveCommunity: CommunityPayload;
  archiveReport: ReportPayload;
  /** Guests only. Starts a 10-minute, one-use claim on this guest's work and returns its secret once. A retry issues a new claim and cancels the previous one. */
  beginAccountClaim: BeginAccountClaimPayload;
  /** Guests only: cancel your open claim. */
  cancelAccountClaim: AccountClaimPayload;
  /** Signed-in accounts only, within 5 minutes of signing in. Moves the guest's active planning session to this account; nothing else is merged. */
  completeAccountClaim: AccountClaimPayload;
  /** Store a location you confirmed and return its area. Set the session's areaId afterwards with updatePlanningSession. */
  confirmLocation: ConfirmLocationPayload;
  createCommunity: CommunityPayload;
  createPlanningSession: PlanningSessionPayload;
  /** Create an immutable report from the session. */
  finalizeReport: ReportPayload;
  /** Queue a durable proposal-drafting job. */
  generateProposal: ProposalPayload;
  /** Join immediately (no approval step). */
  joinCommunity: MembershipPayload;
  leaveCommunity: MembershipPayload;
  /** Evaluate catalogue criteria for a session's plan option. */
  matchFunding: MatchFundingPayload;
  /** Record a value you know for your session's area. */
  recordManualInput: ManualInputPayload;
  recordObservation: ObservationPayload;
  startImplementationProject: ImplementationProjectPayload;
  updateMilestone: MilestonePayload;
  updatePlanningSession: PlanningSessionPayload;
};


export type MutationArchiveCommunityArgs = {
  input: ArchiveCommunityInput;
};


export type MutationArchiveReportArgs = {
  input: ArchiveReportInput;
};


export type MutationCancelAccountClaimArgs = {
  input: CancelAccountClaimInput;
};


export type MutationCompleteAccountClaimArgs = {
  input: CompleteAccountClaimInput;
};


export type MutationConfirmLocationArgs = {
  input: ConfirmLocationInput;
};


export type MutationCreateCommunityArgs = {
  input: CreateCommunityInput;
};


export type MutationCreatePlanningSessionArgs = {
  input: CreatePlanningSessionInput;
};


export type MutationFinalizeReportArgs = {
  input: FinalizeReportInput;
};


export type MutationGenerateProposalArgs = {
  input: GenerateProposalInput;
};


export type MutationJoinCommunityArgs = {
  input: JoinCommunityInput;
};


export type MutationLeaveCommunityArgs = {
  input: LeaveCommunityInput;
};


export type MutationMatchFundingArgs = {
  input: MatchFundingInput;
};


export type MutationRecordManualInputArgs = {
  input: RecordManualInputInput;
};


export type MutationRecordObservationArgs = {
  input: RecordObservationInput;
};


export type MutationStartImplementationProjectArgs = {
  input: StartImplementationProjectInput;
};


export type MutationUpdateMilestoneArgs = {
  input: UpdateMilestoneInput;
};


export type MutationUpdatePlanningSessionArgs = {
  input: UpdatePlanningSessionInput;
};

/** An expected failure of a mutation. Safe to show. */
export type MutationError = {
  code: ErrorCode;
  /** Set with VERSION_CONFLICT: the record's current version. */
  currentVersion?: Maybe<Scalars['Int']['output']>;
  fieldErrors: Array<FieldError>;
  message: Scalars['String']['output'];
  requestId: Scalars['String']['output'];
};

/** A search circle around a point the user chose. */
export type NearbyCommunitiesInput = {
  latitude: Scalars['DecimalString']['input'];
  longitude: Scalars['DecimalString']['input'];
  /** 100 to 50000. */
  radiusMeters: Scalars['Int']['input'];
};

export type NearbyCommunity = {
  community: Community;
  /** Great-circle distance to the community's reference point (its location's centroid), whole metres. Nearby is not the same as sharing a water system. */
  distanceMeters: Scalars['Int']['output'];
};

export type NearbyCommunityConnection = {
  /** True when the area is dense and not every community could be considered; a smaller radius gives a complete answer. */
  candidatesTruncated: Scalars['Boolean']['output'];
  nodes: Array<NearbyCommunity>;
  pageInfo: PageInfo;
};

export type NearbyPlaces = {
  /** At most 5, nearest first. */
  candidates: Array<PlaceCandidate>;
};

export type Observation = {
  createdAt: Scalars['UtcDateTime']['output'];
  evidence: ObservationEvidence;
  id: Scalars['ID']['output'];
  method: Scalars['String']['output'];
  metricId: Scalars['String']['output'];
  note: Scalars['String']['output'];
  observedOn: Scalars['LocalDate']['output'];
  projectId: Scalars['ID']['output'];
  quantity: Quantity;
  recordedByViewer: Scalars['Boolean']['output'];
  version: Scalars['Int']['output'];
};

export type ObservationConnection = {
  nodes: Array<Observation>;
  pageInfo: PageInfo;
};

export type ObservationEvidence =
  | 'RECORDED'
  | 'REJECTED'
  | 'VERIFIED';

export type ObservationPayload = {
  error?: Maybe<MutationError>;
  observation?: Maybe<Observation>;
};

export type PageInfo = {
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
};

export type PlaceCandidate = {
  admin: AdminContext;
  countryCode?: Maybe<Scalars['String']['output']>;
  formattedAddress?: Maybe<Scalars['String']['output']>;
  latitude: Scalars['DecimalString']['output'];
  longitude: Scalars['DecimalString']['output'];
  name: Scalars['String']['output'];
  placeId: Scalars['String']['output'];
  scope: GeographicScope;
  types: Array<Scalars['String']['output']>;
};

export type PlanOption = {
  bestFitReason?: Maybe<Scalars['String']['output']>;
  buildDays?: Maybe<DayRange>;
  cost?: Maybe<MoneyRange>;
  costBasisDate?: Maybe<Scalars['LocalDate']['output']>;
  costUnavailableReason?: Maybe<Scalars['String']['output']>;
  feasibility: Feasibility;
  firstBenefitDays?: Maybe<DayRange>;
  id: Scalars['ID']['output'];
  impact: ImpactAssessment;
  /** The session inputsRevision this option was calculated for; an option from an older revision is out of date and cannot be selected. */
  inputsRevision: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  sessionId: Scalars['ID']['output'];
  summary: Scalars['String']['output'];
};

export type PlanOptionConnection = {
  nodes: Array<PlanOption>;
  pageInfo: PageInfo;
};

export type PlanningMode =
  | 'AGENT'
  | 'TRADITIONAL';

export type PlanningSession = {
  area?: Maybe<Area>;
  areaId?: Maybe<Scalars['ID']['output']>;
  communityId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['UtcDateTime']['output'];
  goal?: Maybe<Goal>;
  id: Scalars['ID']['output'];
  /** Increases whenever location, goal or scenario actually change. Derived results (plan options, funding matches, proposal previews) are keyed by it. */
  inputsRevision: Scalars['Int']['output'];
  mode: PlanningMode;
  scenario?: Maybe<Scenario>;
  selectedPlanOptionId?: Maybe<Scalars['ID']['output']>;
  stage: PlanningStage;
  status: SessionStatus;
  updatedAt: Scalars['UtcDateTime']['output'];
  version: Scalars['Int']['output'];
};

/** Omitted fields are left unchanged; null clears a field. */
export type PlanningSessionPatch = {
  areaId?: InputMaybe<Scalars['ID']['input']>;
  goal?: InputMaybe<GoalInput>;
  mode?: InputMaybe<PlanningMode>;
  scenario?: InputMaybe<ScenarioInput>;
  selectedPlanOptionId?: InputMaybe<Scalars['ID']['input']>;
  stage?: InputMaybe<PlanningStage>;
};

export type PlanningSessionPayload = {
  error?: Maybe<MutationError>;
  session?: Maybe<PlanningSession>;
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

export type Proposal = {
  createdAt: Scalars['UtcDateTime']['output'];
  /** Authorized HTTP download; only set once the proposal is approved. */
  downloadPath?: Maybe<Scalars['String']['output']>;
  flaggedCount: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  job?: Maybe<Job>;
  jobId: Scalars['ID']['output'];
  reportId: Scalars['ID']['output'];
  sections: Array<ProposalSection>;
  status: ProposalStatus;
  updatedAt: Scalars['UtcDateTime']['output'];
  version: Scalars['Int']['output'];
};

export type ProposalConnection = {
  nodes: Array<Proposal>;
  pageInfo: PageInfo;
};

export type ProposalPayload = {
  error?: Maybe<MutationError>;
  proposal?: Maybe<Proposal>;
};

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

export type Provenance = {
  asOf: Scalars['UtcDateTime']['output'];
  engineVersion?: Maybe<Scalars['String']['output']>;
  evidence: EvidenceQuality;
  inputHash?: Maybe<Scalars['String']['output']>;
  sourceIds: Array<Scalars['String']['output']>;
};

/** An exact value in a canonical unit (rates are L/day). */
export type Quantity = {
  unit: Unit;
  value: Scalars['DecimalString']['output'];
};

export type QuantityInput = {
  unit: Unit;
  value: Scalars['DecimalString']['input'];
};

export type Query = {
  agentRun?: Maybe<AgentRun>;
  agentRuns: AgentRunConnection;
  area?: Maybe<Area>;
  communities: CommunityConnection;
  community?: Maybe<Community>;
  /** Countries (ISO 3166-1 alpha-2) with English names, from CLDR. */
  countries: CountryList;
  /** The caller's active session, for recovery. */
  currentPlanningSession?: Maybe<PlanningSession>;
  fundingMatches: FundingMatchConnection;
  fundingScheme?: Maybe<FundingScheme>;
  fundingSchemes: FundingSchemeConnection;
  implementationProject?: Maybe<ImplementationProject>;
  job?: Maybe<Job>;
  myImplementationProjects: ImplementationProjectConnection;
  myMemberships: MembershipConnection;
  /** Active communities within the radius, nearest first. */
  nearbyCommunities: NearbyCommunityConnection;
  planOptions: PlanOptionConnection;
  planningSession?: Maybe<PlanningSession>;
  proposal?: Maybe<Proposal>;
  /** Region settings a confirmation would infer for a point in a country, with how certain each is. Never derived from the interface language. */
  regionSettings: RegionSettings;
  report?: Maybe<Report>;
  reports: ReportConnection;
  /** Candidate places for free text (search or agent message). */
  resolveLocation: LocationResolution;
  /** Places near a point; empty when none is known. */
  reverseLocation: NearbyPlaces;
  searchAreas: AreaConnection;
  /** The verified caller, or null when not signed in. */
  viewer?: Maybe<Viewer>;
};


export type QueryAgentRunArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAgentRunsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  sessionId: Scalars['ID']['input'];
};


export type QueryAreaArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCommunitiesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<CommunityFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryCommunityArgs = {
  id: Scalars['ID']['input'];
};


export type QueryFundingMatchesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  planOptionId?: InputMaybe<Scalars['ID']['input']>;
  sessionId: Scalars['ID']['input'];
};


export type QueryFundingSchemeArgs = {
  id: Scalars['ID']['input'];
};


export type QueryFundingSchemesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryImplementationProjectArgs = {
  id: Scalars['ID']['input'];
};


export type QueryJobArgs = {
  id: Scalars['ID']['input'];
};


export type QueryMyImplementationProjectsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMyMembershipsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryNearbyCommunitiesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  near: NearbyCommunitiesInput;
};


export type QueryPlanOptionsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  sessionId: Scalars['ID']['input'];
};


export type QueryPlanningSessionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryProposalArgs = {
  id: Scalars['ID']['input'];
};


export type QueryRegionSettingsArgs = {
  countryCode: Scalars['String']['input'];
  latitude: Scalars['DecimalString']['input'];
  longitude: Scalars['DecimalString']['input'];
};


export type QueryReportArgs = {
  id: Scalars['ID']['input'];
};


export type QueryReportsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<ReportFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryResolveLocationArgs = {
  text: Scalars['String']['input'];
};


export type QueryReverseLocationArgs = {
  latitude: Scalars['DecimalString']['input'];
  longitude: Scalars['DecimalString']['input'];
};


export type QuerySearchAreasArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
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
  asOf: Scalars['LocalDate']['input'];
  idempotencyKey: Scalars['String']['input'];
  input: ReadinessInput;
  /** Where the figure comes from (3-500 chars). */
  note: Scalars['String']['input'];
  sessionId: Scalars['ID']['input'];
  /** Unit as entered, e.g. MLD; converted exactly. */
  unit: Scalars['String']['input'];
  value: Scalars['DecimalString']['input'];
};

export type RecordObservationInput = {
  idempotencyKey: Scalars['String']['input'];
  method: Scalars['String']['input'];
  metricId: Scalars['String']['input'];
  note?: Scalars['String']['input'];
  observedOn: Scalars['LocalDate']['input'];
  projectId: Scalars['ID']['input'];
  quantity: QuantityInput;
};

export type RegionSettings = {
  /** Null where CLDR lists no tender. */
  currency?: Maybe<Scalars['String']['output']>;
  /** False when the country has several tenders: ask the person to check. */
  currencyCertain: Scalars['Boolean']['output'];
  currencyOptions: Array<Scalars['String']['output']>;
  timezone: Scalars['String']['output'];
  /** False when the country spans several zones or the point is offshore. */
  timezoneCertain: Scalars['Boolean']['output'];
  timezoneOptions: Array<Scalars['String']['output']>;
  unitSystem: UnitSystem;
};

export type Report = {
  archivedAt?: Maybe<Scalars['UtcDateTime']['output']>;
  /** Null when the location is private to its owner. */
  area?: Maybe<Area>;
  areaId: Scalars['ID']['output'];
  communityId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['UtcDateTime']['output'];
  finalizedAt: Scalars['UtcDateTime']['output'];
  goal: Goal;
  id: Scalars['ID']['output'];
  planOptionId: Scalars['ID']['output'];
  proposals: ProposalConnection;
  sessionId: Scalars['ID']['output'];
  status: ReportStatus;
  title: Scalars['String']['output'];
  updatedAt: Scalars['UtcDateTime']['output'];
  version: Scalars['Int']['output'];
};


export type ReportProposalsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type ReportConnection = {
  nodes: Array<Report>;
  pageInfo: PageInfo;
};

export type ReportFilter = {
  /** Omit for your own reports. */
  communityId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<ReportStatus>;
};

export type ReportPayload = {
  error?: Maybe<MutationError>;
  report?: Maybe<Report>;
};

export type ReportStatus =
  | 'ARCHIVED'
  | 'FINALIZED';

export type Scenario = {
  adjustments: Array<ScenarioAdjustment>;
  confirmed: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  interpretedFrom?: Maybe<Scalars['String']['output']>;
};

export type ScenarioAdjustment = {
  change: AdjustmentChange;
  parameter: Scalars['String']['output'];
  quantity: Quantity;
};

export type ScenarioAdjustmentInput = {
  change: AdjustmentChange;
  parameter: Scalars['String']['input'];
  quantity: QuantityInput;
};

export type ScenarioInput = {
  adjustments?: Array<ScenarioAdjustmentInput>;
  confirmed?: Scalars['Boolean']['input'];
  interpretedFrom?: InputMaybe<Scalars['String']['input']>;
};

export type SessionStatus =
  | 'ACTIVE'
  | 'CLOSED';

export type StartImplementationProjectInput = {
  idempotencyKey: Scalars['String']['input'];
  milestones?: Array<MilestoneInput>;
  reportId: Scalars['ID']['input'];
  title: Scalars['String']['input'];
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
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  status: MilestoneStatus;
};

export type UpdatePlanningSessionInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  patch: PlanningSessionPatch;
};

export type Viewer = {
  kind: AccountKind;
  uid: Scalars['ID']['output'];
};

export type WindowStatus =
  | 'CLOSED'
  | 'OPEN'
  | 'UNKNOWN'
  | 'UPCOMING';
