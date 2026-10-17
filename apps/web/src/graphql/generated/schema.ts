export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  /** An exact decimal number as a string (e.g. '1250000.5'). Parse with a decimal library, never as a binary float. */
  DecimalString: { input: string; output: string };
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](https://ecma-international.org/wp-content/uploads/ECMA-404_2nd_edition_december_2017.pdf). */
  JSON: { input: unknown; output: unknown };
  /** A calendar date (YYYY-MM-DD) in the relevant area's IANA timezone. */
  LocalDate: { input: string; output: string };
  /** An integer amount of a currency's minor unit (e.g. paise for INR) as a string, to avoid 32-bit/53-bit integer limits. */
  MinorUnits: { input: string; output: string };
  /** An instant in UTC, ISO-8601 with a 'Z' suffix (e.g. 2026-10-07T18:30:00Z). */
  UtcDateTime: { input: string; output: string };
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

export type AccountClaimStatus = 'CANCELLED' | 'COMPLETED' | 'OPEN';

export type AccountKind = 'GUEST' | 'PERMANENT';

export type AddProjectExpenseInput = {
  amount: MoneyInput;
  description: Scalars['String']['input'];
  expectedVersion: Scalars['Int']['input'];
  projectId: Scalars['ID']['input'];
  source: Scalars['String']['input'];
  spentOn: Scalars['LocalDate']['input'];
};

export type AdjustmentChange = 'DECREASE_BY' | 'INCREASE_BY' | 'SET_TO';

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

export type AgentRunStatus = 'COMPLETED' | 'FAILED' | 'RUNNING' | 'STOPPED';

export type AgentStopReason =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'DAILY_BUDGET'
  | 'ERROR'
  | 'EXPIRED'
  | 'STEP_BUDGET'
  | 'TOKEN_BUDGET'
  | 'TOOL_BUDGET';

export type AiStatus = {
  /** Whether AI help can be offered right now. Planning works regardless. */
  available: Scalars['Boolean']['output'];
  budgetConfigured: Scalars['Boolean']['output'];
  dailyRequestLimit: Scalars['Int']['output'];
  modelId: Scalars['String']['output'];
  reason?: Maybe<AiUnavailableReason>;
  requestsRemaining: Scalars['Int']['output'];
  suggestedDailyBudgetUsd: Scalars['String']['output'];
};

export type AiUnavailableReason =
  'BUDGET_EXHAUSTED' | 'DISABLED' | 'NOT_INVITED' | 'NO_BUDGET_CONFIGURED';

export type ApplicantInformationInput = {
  applicantType?: InputMaybe<Scalars['String']['input']>;
  availableDocuments?: InputMaybe<Array<Scalars['String']['input']>>;
  providedInformation?: Array<Scalars['String']['input']>;
  requestedAmount?: InputMaybe<MoneyInput>;
};

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
  /** Baseline metrics from ready inputs only (same access rules as readiness). With sessionId it also uses the values you entered. */
  baseline: Baseline;
  /** The box used for coverage checks (a reviewed boundary's box or the box around a chosen radius); an extent, never an exact boundary. Null for a point. */
  boundaryBox?: Maybe<BoundingBox>;
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

export type AreaBaselineArgs = {
  sessionId?: InputMaybe<Scalars['ID']['input']>;
};

export type AreaReadinessArgs = {
  sessionId?: InputMaybe<Scalars['ID']['input']>;
};

export type AreaConnection = {
  nodes: Array<Area>;
  pageInfo: PageInfo;
};

export type AreaOrigin = 'CATALOGUE' | 'CUSTOM' | 'GEOLOCATION' | 'PLACE_SEARCH';

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

export type AssessmentBasis = 'LIMITED' | 'SOURCED' | 'USER_INPUT';

export type Availability = 'AVAILABLE' | 'PROVISIONAL' | 'UNAVAILABLE';

/** What is known about this area now, from ready inputs only. Deterministic from stored records: the same inputs give the same id; a new value revises it. */
export type Baseline = {
  areaId: Scalars['ID']['output'];
  asOf: Scalars['LocalDate']['output'];
  basis: AssessmentBasis;
  chart?: Maybe<BaselineChart>;
  demo: Scalars['Boolean']['output'];
  engineVersion: Scalars['String']['output'];
  exceedanceP: Scalars['DecimalString']['output'];
  id: Scalars['ID']['output'];
  indicators: Array<BaselineIndicator>;
  metrics: Array<BaselineMetric>;
  missingEssentials: Array<ReadinessInput>;
  missingOptional: Array<ReadinessInput>;
  notes: Array<Scalars['String']['output']>;
  sessionId?: Maybe<Scalars['ID']['output']>;
  window?: Maybe<DateWindow>;
  /** Nominal trailing window in days. */
  windowDays: Scalars['Int']['output'];
};

/** Daily values (window up to 31 days) or calendar-month means. */
export type BaselineChart = {
  buckets: Array<DateWindow>;
  monthly: Scalars['Boolean']['output'];
  series: Array<ChartSeries>;
};

export type BaselineIndicator = {
  availability: Availability;
  capability: Capability;
  demo: Scalars['Boolean']['output'];
  evidence: Array<EvidenceLink>;
  exact?: Maybe<Scalars['String']['output']>;
  /** Indicator id from the metrics registry. */
  indicator: Scalars['String']['output'];
  name: Scalars['String']['output'];
  observedOn?: Maybe<Scalars['LocalDate']['output']>;
  origin?: Maybe<ValueOrigin>;
  parameter?: Maybe<Scalars['String']['output']>;
  reason?: Maybe<BaselineReason>;
  reasons: Array<Scalars['String']['output']>;
  statistic: IndicatorStatistic;
  unit?: Maybe<CanonicalUnit>;
  value?: Maybe<Scalars['DecimalString']['output']>;
  variable?: Maybe<Scalars['String']['output']>;
  window?: Maybe<DateWindow>;
};

export type BaselineMetric = {
  asOf?: Maybe<Scalars['LocalDate']['output']>;
  assumptions: Array<Scalars['String']['output']>;
  availability: Availability;
  /** Computed from day-by-day values. */
  daily: Scalars['Boolean']['output'];
  demo: Scalars['Boolean']['output'];
  evidence: Array<EvidenceLink>;
  exact?: Maybe<Scalars['String']['output']>;
  formula: Scalars['String']['output'];
  /** Metric id from the metrics registry. */
  metric: Scalars['String']['output'];
  name: Scalars['String']['output'];
  origin?: Maybe<ValueOrigin>;
  /** Days in the reporting window; recordedDays below this is a partial window. */
  periodDays?: Maybe<Scalars['Int']['output']>;
  reason?: Maybe<BaselineReason>;
  reasons: Array<Scalars['String']['output']>;
  /** Days of records the value uses (null when not computed from records). */
  recordedDays?: Maybe<Scalars['Int']['output']>;
  supporting: Array<SupportingValue>;
  /** Canonical unit (L/day, ratio, day). */
  unit: CanonicalUnit;
  value?: Maybe<Scalars['DecimalString']['output']>;
};

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

export type BeginAccountClaimPayload = {
  claim?: Maybe<AccountClaim>;
  /** Returned once and never stored in clear. Keep it in memory only. */
  claimSecret?: Maybe<Scalars['String']['output']>;
  error?: Maybe<MutationError>;
};

export type BenefitTiming = 'AFTER_COMMISSIONING' | 'AFTER_RAINFALL' | 'AFTER_WET_SEASONS';

export type BoundaryLevel = 'AREA' | 'SHARED_SYSTEM' | 'SITE';

/** Where the stored extent lies, in WGS 84 degrees. */
export type BoundingBox = {
  maxLatitude: Scalars['DecimalString']['output'];
  maxLongitude: Scalars['DecimalString']['output'];
  minLatitude: Scalars['DecimalString']['output'];
  minLongitude: Scalars['DecimalString']['output'];
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

export type CatalogueStatus = 'ACTIVE' | 'DEMO' | 'DRAFT' | 'EXPIRED' | 'WITHDRAWN';

export type ChartSeries = {
  /** True when the series uses synthetic demo data. */
  demo: Scalars['Boolean']['output'];
  /** delivered_supply, demand or tanker_supply. */
  key: Scalars['String']['output'];
  /** Same origin rule as the metric cards: the weakest of the series' inputs. */
  origin?: Maybe<ValueOrigin>;
  /** L/day per bucket; null where any day in the bucket is missing. */
  values: Array<Maybe<Scalars['DecimalString']['output']>>;
};

export type CitationKind =
  'CATALOGUE' | 'COMPARISON' | 'CONNECTIVITY' | 'SITE_FACT' | 'SOURCE' | 'USER_INPUT';

export type Community = {
  archivedAt?: Maybe<Scalars['UtcDateTime']['output']>;
  area?: Maybe<CommunityArea>;
  areaId?: Maybe<Scalars['ID']['output']>;
  contactEmail?: Maybe<Scalars['String']['output']>;
  contactName?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['UtcDateTime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  memberCount: Scalars['Int']['output'];
  /** Members only. */
  members: MembershipConnection;
  name: Scalars['String']['output'];
  sharedReport?: Maybe<SharedReportSummary>;
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

export type CommunityArea = {
  countryCode: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type CommunityConnection = {
  nodes: Array<Community>;
  pageInfo: PageInfo;
};

export type CommunityFilter = {
  archivedOnly?: Scalars['Boolean']['input'];
  areaId?: InputMaybe<Scalars['ID']['input']>;
  includeArchived?: Scalars['Boolean']['input'];
};

export type CommunityPayload = {
  community?: Maybe<Community>;
  error?: Maybe<MutationError>;
};

export type CommunityStatus = 'ACTIVE' | 'ARCHIVED';

export type CommunityType = 'APARTMENT' | 'OTHER' | 'RESIDENTIAL';

/** A genuinely feasible plan: passes at your low estimates. */
export type ComparedOption = {
  buildDays?: Maybe<DayRange>;
  cost?: Maybe<MoneyRange>;
  /** Costs, avoided tanker spending, net benefit, payback and funding (ADR 0014); null when the option has no cost estimate. */
  economics?: Maybe<OptionEconomics>;
  firstBenefit: BenefitTiming;
  id: Scalars['ID']['output'];
  /** Wider-system impact, shown before you choose (ADR 0013). */
  impact: WiderImpact;
  interventionIds: Array<Scalars['String']['output']>;
  /** How far the pessimistic result is past the target, in the metric unit. */
  margin: ExactNumber;
  measures: Array<OptionMeasure>;
  name: Scalars['String']['output'];
  /** Goal metric at high estimates. */
  optimistic: ExactNumber;
  /** Goal metric at low estimates. */
  pessimistic: ExactNumber;
  rank: Scalars['Int']['output'];
  sensitivity: Array<OptionSensitivity>;
  stress: Array<OptionStress>;
  tradeoffs: Array<Scalars['String']['output']>;
  uncertainty: Array<Scalars['String']['output']>;
  /** L/day beyond the tanker deliveries it replaces, not counted. */
  uncountedHigh?: Maybe<ExactNumber>;
  waterHigh?: Maybe<ExactNumber>;
  waterLow?: Maybe<ExactNumber>;
  why: Scalars['String']['output'];
};

export type ComparisonStatus = 'COMPARABLE' | 'UNKNOWN';

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

export type CostInput = {
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
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
  contactEmail?: InputMaybe<Scalars['String']['input']>;
  contactName: Scalars['String']['input'];
  description?: Scalars['String']['input'];
  idempotencyKey: Scalars['String']['input'];
  name: Scalars['String']['input'];
  reportId: Scalars['ID']['input'];
  shareContactEmail?: Scalars['Boolean']['input'];
  shareContactName?: Scalars['Boolean']['input'];
};

export type CreatePlanningSessionInput = {
  areaId?: InputMaybe<Scalars['ID']['input']>;
  communityId?: InputMaybe<Scalars['ID']['input']>;
  idempotencyKey: Scalars['String']['input'];
  mode: PlanningMode;
};

export type Criterion = {
  id: Scalars['String']['output'];
  /** True when WaterPilot evaluates this criterion deterministically. */
  machineCheckable: Scalars['Boolean']['output'];
  text: Scalars['String']['output'];
};

export type CriterionResult = {
  criterionId: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  status: CriterionStatus;
};

export type CriterionStatus = 'MET' | 'NEEDS_CHECK' | 'NOT_MET';

/** Half-open local-date window [start, endExclusive). */
export type DateWindow = {
  days: Scalars['Int']['output'];
  endExclusive: Scalars['LocalDate']['output'];
  start: Scalars['LocalDate']['output'];
};

export type DayRange = {
  high: Scalars['Int']['output'];
  low: Scalars['Int']['output'];
};

export type DayRangeInput = {
  high: Scalars['Int']['input'];
  low: Scalars['Int']['input'];
};

export type EffectDirection = 'EITHER' | 'POSSIBLE_BENEFIT' | 'POSSIBLE_HARM';

/** Your range for one of a measure's effect inputs. */
export type EffectEstimate = {
  high: Scalars['DecimalString']['output'];
  key: Scalars['String']['output'];
  low: Scalars['DecimalString']['output'];
};

export type EffectEstimateInput = {
  high: Scalars['DecimalString']['input'];
  key: Scalars['String']['input'];
  low: Scalars['DecimalString']['input'];
};

/** Something a measure's water effect depends on. The catalogue holds only physical bounds; the value is always your estimate (or a sourced site fact). */
export type EffectInput = {
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  maximum: Scalars['DecimalString']['output'];
  minimum: Scalars['DecimalString']['output'];
  note: Scalars['String']['output'];
  /** False when a registered source can supply the value instead. */
  required: Scalars['Boolean']['output'];
  unit: Unit;
};

/** Where an effect value came from: USER_ESTIMATE (your range), BASELINE (the sourced baseline value) or SCENARIO (set by the confirmed what-if). The catalogue never supplies effect values. */
export type EffectOrigin = 'BASELINE' | 'SCENARIO' | 'USER_ESTIMATE';

export type EligibilityStatus = 'ELIGIBLE' | 'INELIGIBLE' | 'NEEDS_INFORMATION';

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

/** Where a value comes from: an imported snapshot or your entry. */
export type EvidenceLink = {
  asOf?: Maybe<Scalars['LocalDate']['output']>;
  capability?: Maybe<Capability>;
  demo: Scalars['Boolean']['output'];
  input?: Maybe<ReadinessInput>;
  manualInputId?: Maybe<Scalars['ID']['output']>;
  method?: Maybe<ObservationMethod>;
  note?: Maybe<Scalars['String']['output']>;
  publisher?: Maybe<Scalars['String']['output']>;
  /** Review status of an imported snapshot; null for a value you entered. */
  quality?: Maybe<EvidenceQuality>;
  snapshotId?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  uncertainty: Scalars['String']['output'];
  url?: Maybe<Scalars['String']['output']>;
};

export type EvidenceQuality =
  'PROVISIONAL' | 'QUARANTINED' | 'SYNTHETIC' | 'UNREVIEWED' | 'VALIDATED';

/** An exact rational and its decimal form. */
export type ExactNumber = {
  /** Integer or reduced fraction, e.g. 7/30. */
  exact: Scalars['String']['output'];
  /** Decimal string; exact when it terminates, else 28 significant digits. */
  value: Scalars['DecimalString']['output'];
};

/** What coverage checks use: a reviewed boundary, a radius you set, or the point. */
export type ExtentKind = 'REFERENCE_POINT' | 'REVIEWED_BOUNDARY' | 'USER_RADIUS';

export type Feasibility = 'FEASIBLE' | 'NEEDS_REVIEW' | 'NOT_FEASIBLE';

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

export type FindingBasis = 'DECLARED' | 'ENGINE_ESTIMATE' | 'MECHANISM' | 'SOURCED';

export type FindingKind = 'EXTERNALITY' | 'FALSE_RESILIENCE' | 'LOCAL_BENEFIT' | 'TRADEOFF';

export type FitCheck = {
  message: Scalars['String']['output'];
  outcome: GoalOutcome;
};

/** Per-criterion results for one scheme. There is deliberately no match percentage or likelihood. */
export type FundingMatch = {
  createdAt: Scalars['UtcDateTime']['output'];
  eligibility: EligibilityStatus;
  eligibilityEvidence: Array<CriterionResult>;
  id: Scalars['ID']['output'];
  metCount: Scalars['Int']['output'];
  needsCheckCount: Scalars['Int']['output'];
  notMetCount: Scalars['Int']['output'];
  planOptionId: Scalars['ID']['output'];
  rankingReason: Scalars['String']['output'];
  rankingStatus: Scalars['String']['output'];
  relevanceOrder?: Maybe<Scalars['Int']['output']>;
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

export type FundingMatchStatus = 'ADDED' | 'CANDIDATE' | 'DISMISSED';

export type FundingScheme = {
  amountRules?: Maybe<Scalars['String']['output']>;
  applicantCategories: Array<Scalars['String']['output']>;
  /** Exclusive end of the window. */
  closesOn?: Maybe<Scalars['LocalDate']['output']>;
  criteria: Array<Criterion>;
  currency: Scalars['String']['output'];
  deadlineAt?: Maybe<Scalars['UtcDateTime']['output']>;
  deadlineTimezone?: Maybe<Scalars['String']['output']>;
  eligibilityRules: Scalars['JSON']['output'];
  evidence: EvidenceQuality;
  funder: Scalars['String']['output'];
  geography: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  interventions: Array<Scalars['String']['output']>;
  lastVerifiedAt: Scalars['UtcDateTime']['output'];
  maxAmount?: Maybe<Money>;
  name: Scalars['String']['output'];
  officialSource: Scalars['Boolean']['output'];
  opensOn?: Maybe<Scalars['LocalDate']['output']>;
  permissionNote?: Maybe<Scalars['String']['output']>;
  requiredDocuments: Array<Scalars['String']['output']>;
  revision: Scalars['Int']['output'];
  sourceHash?: Maybe<Scalars['String']['output']>;
  sourceUrl: Scalars['String']['output'];
  status: CatalogueStatus;
  /** Catalogue text; untrusted, render as text. */
  summary: Scalars['String']['output'];
  unknownFields: Array<Scalars['String']['output']>;
  unknownMetadata: Scalars['JSON']['output'];
};

export type FundingSchemeConnection = {
  nodes: Array<FundingScheme>;
  pageInfo: PageInfo;
};

/** A declared source of money; only approved funding counts. */
export type FundingSource = {
  amount: Money;
  label: Scalars['String']['output'];
  note: Scalars['String']['output'];
  status: FundingStatus;
};

/** A declared source of money; only approved funding counts. */
export type FundingSourceInput = {
  amount: MoneyInput;
  label: Scalars['String']['input'];
  note?: Scalars['String']['input'];
  status: FundingStatus;
};

export type FundingStatus = 'APPROVED' | 'EXPECTED' | 'PROPOSED';

export type GenerateProposalInput = {
  applicant?: InputMaybe<ProposalApplicantInput>;
  idempotencyKey: Scalars['String']['input'];
  reportId: Scalars['ID']['input'];
  schemeId?: InputMaybe<Scalars['ID']['input']>;
  sections: Array<ProposalSection>;
};

/** What kind of place a location is. A point or place is not a catchment. */
export type GeographicScope =
  'COUNTRY' | 'LOCALITY' | 'NEIGHBOURHOOD' | 'POINT' | 'POSTAL_CODE' | 'REGION' | 'SUBLOCALITY';

export type Goal = {
  /** Further objectives checked for conflicts with the main goal. */
  also: Array<GoalKind>;
  budget?: Maybe<Money>;
  /** A custom goal's wording was confirmed. */
  confirmed: Scalars['Boolean']['output'];
  /** A contingency share you add to cost estimates; applied only when set. */
  contingencyRatio?: Maybe<Scalars['DecimalString']['output']>;
  description: Scalars['String']['output'];
  estimates: Array<MeasureEstimate>;
  /** Declared sources of money; only approved funding counts towards affordability. */
  funding: Array<FundingSource>;
  /** Planning horizon over which benefits count (separate from build time). */
  horizonDays?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  kind: GoalKind;
  preferredInterventions: Array<Scalars['String']['output']>;
  priority?: Maybe<Priority>;
  site: SiteConstraints;
  target?: Maybe<GoalTarget>;
  /** The parameter a water-quality or custom target refers to. */
  targetParameter?: Maybe<Scalars['String']['output']>;
  /** Maximum implementation time. */
  timelineDays?: Maybe<Scalars['Int']['output']>;
  /** The tanker-water price used to value avoided tanker spending (ADR 0014). */
  waterTariff?: Maybe<WaterTariff>;
};

/** Screens a goal: FEASIBLE means consistent and plannable, never that a plan will reach it. No confidence score is given. */
export type GoalAssessment = {
  baselineId?: Maybe<Scalars['String']['output']>;
  catalogueVersion: Scalars['String']['output'];
  conflicts: Array<GoalFinding>;
  constraints: Array<GoalFinding>;
  interventions: Array<InterventionFit>;
  nextSteps: Array<Scalars['String']['output']>;
  outcome: GoalOutcome;
  summary: Scalars['String']['output'];
  target: TargetCheck;
};

export type GoalCheck = {
  assessment?: Maybe<GoalAssessment>;
  /** Input that cannot be saved; when present there is no assessment. */
  errors: Array<FieldError>;
};

export type GoalFinding = {
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  /** Null for a note that does not change the outcome. */
  outcome?: Maybe<GoalOutcome>;
};

export type GoalInput = {
  also?: Array<GoalKind>;
  budget?: InputMaybe<MoneyInput>;
  confirmed?: Scalars['Boolean']['input'];
  contingencyRatio?: InputMaybe<Scalars['DecimalString']['input']>;
  description?: Scalars['String']['input'];
  estimates?: Array<MeasureEstimateInput>;
  funding?: Array<FundingSourceInput>;
  horizonDays?: InputMaybe<Scalars['Int']['input']>;
  kind: GoalKind;
  preferredInterventions?: Array<Scalars['String']['input']>;
  priority?: InputMaybe<Priority>;
  site?: InputMaybe<SiteConstraintsInput>;
  target?: InputMaybe<GoalTargetInput>;
  targetParameter?: InputMaybe<Scalars['String']['input']>;
  timelineDays?: InputMaybe<Scalars['Int']['input']>;
  waterTariff?: InputMaybe<WaterTariffInput>;
};

export type GoalKind =
  | 'CUSTOM'
  | 'IMPROVE_GROUNDWATER'
  | 'IMPROVE_WATER_QUALITY'
  | 'REDUCE_FLOOD_RISK'
  | 'REDUCE_SHORTAGE'
  | 'REDUCE_TANKER_DEPENDENCE'
  | 'REDUCE_WATER_BILLS';

export type GoalOutcome = 'FEASIBLE' | 'INFEASIBLE' | 'NOT_ASSESSABLE';

export type GoalTarget = {
  mode: TargetMode;
  quantity: Quantity;
};

export type GoalTargetInput = {
  mode: TargetMode;
  quantity: QuantityInput;
};

export type GroundwaterReliance = 'DECLARED' | 'NONE_RECORDED' | 'SOURCED' | 'UNKNOWN';

export type ImpactAssessment = {
  assumptions: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  metrics: Array<ImpactMetric>;
  neighbourEffect: MeasuredValue;
  provenance: Provenance;
  /** The wider-system assessment shown with the option when it was chosen, with its provenance; null for options stored before it existed. */
  wider?: Maybe<WiderImpact>;
};

/** What a finding or boundary rests on. */
export type ImpactCitation = {
  asOf?: Maybe<Scalars['LocalDate']['output']>;
  kind: CitationKind;
  label: Scalars['String']['output'];
  /** Catalogue entry (version:id), comparison id, site field, snapshot or connectivity record id. */
  ref: Scalars['String']['output'];
};

export type ImpactContext = {
  areaId?: Maybe<Scalars['ID']['output']>;
  areaName?: Maybe<Scalars['String']['output']>;
  boundaries: Array<InfluenceBoundary>;
  groundwater: GroundwaterReliance;
  groundwaterCitations: Array<ImpactCitation>;
  nearby: Array<NearbyPlace>;
  nearbyRadiusM: Scalars['Int']['output'];
  unavailable: Array<UnavailableAssessment>;
  waterQuality: Array<QualityReading>;
  waterQualityNote: Scalars['String']['output'];
};

export type ImpactFinding = {
  basis: FindingBasis;
  citations: Array<ImpactCitation>;
  direction?: Maybe<EffectDirection>;
  /** Stable within the assessment; cite as [F:id]. */
  id: Scalars['String']['output'];
  interventionIds: Array<Scalars['String']['output']>;
  kind: FindingKind;
  /** For a shared system: whether evidence shows this area shares it. */
  linkage?: Maybe<Linkage>;
  /** Only for a local benefit; never for effects beyond the site. */
  magnitude?: Maybe<ImpactMagnitude>;
  /** Findings a trade-off weighs. */
  related: Array<Scalars['String']['output']>;
  statement: Scalars['String']['output'];
  system?: Maybe<SharedSystem>;
  /** What is not known about it. */
  uncertainty: Scalars['String']['output'];
};

/** A goal metric at the site: baseline, then the option's result at your low and at your high estimates. Only computed metrics can carry one. */
export type ImpactMagnitude = {
  atHighEstimates: ExactNumber;
  atLowEstimates: ExactNumber;
  baseline?: Maybe<ExactNumber>;
  metricId: Scalars['String']['output'];
  unit: Unit;
};

export type ImpactMetric = {
  baseline: MeasuredValue;
  metricId: Scalars['String']['output'];
  projectedHigh: MeasuredValue;
  projectedLow: MeasuredValue;
};

/** A qualified check the plan's measures need. */
export type ImpactReview = {
  interventionIds: Array<Scalars['String']['output']>;
  kind: ReviewKind;
  /** Who does it. */
  label: Scalars['String']['output'];
  reasons: Array<Scalars['String']['output']>;
  /** True: needed before work starts. False: only in the stated case. */
  required: Scalars['Boolean']['output'];
};

export type ImplementationProject = {
  areaId: Scalars['ID']['output'];
  communityId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['UtcDateTime']['output'];
  expenses: Array<ProjectExpense>;
  id: Scalars['ID']['output'];
  milestones: MilestoneConnection;
  observations: ObservationConnection;
  reportId: Scalars['ID']['output'];
  reportVersion: Scalars['Int']['output'];
  sharedWithCommunity: Scalars['Boolean']['output'];
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

export type IndicatorStatistic = 'LATEST' | 'WINDOW_MEAN' | 'WINDOW_TOTAL';

/** A declared influence boundary. */
export type InfluenceBoundary = {
  citations: Array<ImpactCitation>;
  detail: Scalars['String']['output'];
  label: Scalars['String']['output'];
  level: BoundaryLevel;
  linkage?: Maybe<Linkage>;
  system?: Maybe<SharedSystem>;
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

export type Intervention = {
  benefitNote: Scalars['String']['output'];
  benefitTiming: BenefitTiming;
  /** Declared restrictions that rule this measure out. */
  blockedBy: Array<SiteRestriction>;
  cautions: Array<Scalars['String']['output']>;
  construction: Scalars['String']['output'];
  /** Reviewed build time; null until evidence exists. */
  constructionDays?: Maybe<DayRange>;
  /** What the cost depends on. Amounts come from a source or your estimate. */
  costInputs: Array<CostInput>;
  /** Registered sources of reviewed local costs; empty means none exist. */
  costSources: Array<Scalars['String']['output']>;
  /** Inputs the option engine needs to count this measure; empty means its water effect is not modelled and it never counts towards a target. */
  effectInputs: Array<EffectInput>;
  /** Reviewed effect model; null means the effect is not modelled. */
  effectModel?: Maybe<Scalars['String']['output']>;
  /** Registered effect evidence; empty means the effect is not evidenced. */
  evidence: Array<Scalars['String']['output']>;
  family: InterventionFamily;
  id: Scalars['String']['output'];
  maintenance: Array<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  permissions: Array<Scalars['String']['output']>;
  requires: Array<SiteRequirement>;
  scales: Array<SiteScale>;
  serves: Array<GoalKind>;
  summary: Scalars['String']['output'];
};

export type InterventionCatalogue = {
  interventions: Array<Intervention>;
  version: Scalars['String']['output'];
};

export type InterventionFamily =
  | 'DEMAND_CONSERVATION'
  | 'GREYWATER_REUSE'
  | 'LEAKAGE_REDUCTION'
  | 'RAINWATER_HARVESTING'
  | 'RECHARGE'
  | 'STORAGE'
  | 'STORMWATER';

export type InterventionFit = {
  benefit: Scalars['String']['output'];
  /** Null when no budget is set. */
  cost?: Maybe<FitCheck>;
  estimate?: Maybe<MeasureEstimate>;
  family: InterventionFamily;
  interventionId: Scalars['String']['output'];
  name: Scalars['String']['output'];
  outcome: GoalOutcome;
  preferred: Scalars['Boolean']['output'];
  /** Serves the main goal or a further one. */
  relevant: Scalars['Boolean']['output'];
  site: FitCheck;
  /** Null when no maximum implementation time is set. */
  time?: Maybe<FitCheck>;
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

export type JobKind = 'FUNDING_MATCH' | 'PROPOSAL_GENERATION';

export type JobStatus = 'CANCELLED' | 'FAILED' | 'QUEUED' | 'RUNNING' | 'SUCCEEDED';

export type JoinCommunityInput = {
  communityId: Scalars['ID']['input'];
  idempotencyKey: Scalars['String']['input'];
};

export type LeaveCommunityInput = {
  communityId: Scalars['ID']['input'];
  /** Your membership's version. */
  expectedVersion: Scalars['Int']['input'];
};

/** Whether places share a system, from reviewed evidence only. Unknown unless a record says otherwise; being close never decides it. */
export type Linkage = 'LINKED' | 'NOT_LINKED' | 'UNKNOWN';

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
  information?: InputMaybe<ApplicantInformationInput>;
  planOptionId: Scalars['ID']['input'];
  semanticQuery?: InputMaybe<Scalars['String']['input']>;
  sessionId: Scalars['ID']['input'];
};

export type MatchFundingPayload = {
  error?: Maybe<MutationError>;
  matches?: Maybe<Array<FundingMatch>>;
};

/** Your own figures for one measure: always your estimate. */
export type MeasureEstimate = {
  buildDays?: Maybe<DayRange>;
  cost?: Maybe<MoneyRange>;
  /** Your ranges for what the measure's water effect depends on (Intervention.effectInputs), in each input's unit. */
  effects: Array<EffectEstimate>;
  interventionId: Scalars['String']['output'];
  note: Scalars['String']['output'];
  /** Your yearly operating and maintenance estimate for this measure. */
  recurring?: Maybe<MoneyRange>;
};

export type MeasureEstimateInput = {
  buildDays?: InputMaybe<DayRangeInput>;
  cost?: InputMaybe<MoneyRangeInput>;
  effects?: Array<EffectEstimateInput>;
  interventionId: Scalars['String']['input'];
  note?: Scalars['String']['input'];
  recurring?: InputMaybe<MoneyRangeInput>;
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

export type MembershipRole = 'COORDINATOR' | 'MEMBER';

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
  completedOn?: Maybe<Scalars['LocalDate']['output']>;
  id: Scalars['ID']['output'];
  plannedOn: Scalars['LocalDate']['output'];
  projectId: Scalars['ID']['output'];
  responsibleIdentity?: Maybe<Scalars['String']['output']>;
  status: MilestoneStatus;
  tasks: Array<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

export type MilestoneConnection = {
  nodes: Array<Milestone>;
  pageInfo: PageInfo;
};

export type MilestoneInput = {
  plannedOn: Scalars['LocalDate']['input'];
  responsibleIdentity?: InputMaybe<Scalars['String']['input']>;
  tasks?: Array<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};

export type MilestonePayload = {
  error?: Maybe<MutationError>;
  milestone?: Maybe<Milestone>;
};

export type MilestoneStatus = 'DONE' | 'IN_PROGRESS' | 'PLANNED' | 'SKIPPED';

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

export type MoneyRangeInput = {
  high: MoneyInput;
  low: MoneyInput;
};

export type Mutation = {
  addProjectExpense: ImplementationProjectPayload;
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
  updateProjectStatus: ImplementationProjectPayload;
};

export type MutationAddProjectExpenseArgs = {
  input: AddProjectExpenseInput;
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

export type MutationUpdateProjectStatusArgs = {
  input: UpdateProjectStatusInput;
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

/** A place near the area: geography only. */
export type NearbyPlace = {
  communityId: Scalars['ID']['output'];
  distanceM: Scalars['Int']['output'];
  /** Per shared system; unknown unless one evidence record lists both areas. */
  links: Array<SystemLinkage>;
  name: Scalars['String']['output'];
};

export type NearbyPlaces = {
  /** At most 5, nearest first. */
  candidates: Array<PlaceCandidate>;
};

export type Observation = {
  areaId: Scalars['ID']['output'];
  comparison: ObservationComparison;
  coverageExpectedDays: Scalars['Int']['output'];
  coverageObservedDays: Scalars['Int']['output'];
  createdAt: Scalars['UtcDateTime']['output'];
  evidence: ObservationEvidence;
  id: Scalars['ID']['output'];
  method: Scalars['String']['output'];
  metricId: Scalars['String']['output'];
  note: Scalars['String']['output'];
  observedOn: Scalars['LocalDate']['output'];
  permittedSourceConfirmed: Scalars['Boolean']['output'];
  projectId: Scalars['ID']['output'];
  quantity: Quantity;
  recordedByViewer: Scalars['Boolean']['output'];
  source: Scalars['String']['output'];
  sourceType: ObservationSourceType;
  version: Scalars['Int']['output'];
  windowEnd?: Maybe<Scalars['LocalDate']['output']>;
  windowStart?: Maybe<Scalars['LocalDate']['output']>;
};

export type ObservationComparison = {
  forecastHigh?: Maybe<Quantity>;
  forecastLow?: Maybe<Quantity>;
  reason: Scalars['String']['output'];
  relation?: Maybe<Scalars['String']['output']>;
  status: ComparisonStatus;
};

export type ObservationConnection = {
  nodes: Array<Observation>;
  pageInfo: PageInfo;
};

export type ObservationEvidence = 'RECORDED' | 'REJECTED' | 'VERIFIED';

export type ObservationMethod =
  'ADMINISTRATIVE_RECORD' | 'IN_SITU_MEASUREMENT' | 'MODEL_OUTPUT' | 'REMOTE_SENSING' | 'SURVEY';

export type ObservationPayload = {
  error?: Maybe<MutationError>;
  observation?: Maybe<Observation>;
};

export type ObservationSourceType = 'PERMITTED_DOCUMENT' | 'USER_RECORDED';

/** A contingency share you added to the cost estimates. */
export type OptionContingency = {
  amount: MoneyRange;
  ratio: Scalars['DecimalString']['output'];
};

/** Costs, avoided tanker spending, net benefit, payback and funding (ADR 0014), from your own estimates and declared tariff; nothing is converted or invented. */
export type OptionEconomics = {
  assumptions: Array<Scalars['String']['output']>;
  avoidedReason?: Maybe<Scalars['String']['output']>;
  avoidedTankerAnnual?: Maybe<MoneyRange>;
  capex: MoneyRange;
  contingency?: Maybe<OptionContingency>;
  currency: Scalars['String']['output'];
  engineVersion: Scalars['String']['output'];
  funding: OptionFunding;
  horizon?: Maybe<OptionHorizonTotals>;
  netAnnual?: Maybe<MoneyRange>;
  notes: Array<Scalars['String']['output']>;
  payback?: Maybe<OptionPayback>;
  recurringAnnual?: Maybe<MoneyRange>;
  recurringReason?: Maybe<Scalars['String']['output']>;
  upfrontTotal: MoneyRange;
};

/** One effect value a measure line was computed from. */
export type OptionEffect = {
  high: ExactNumber;
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  low: ExactNumber;
  origin: EffectOrigin;
  unit: Unit;
};

/** Funding kept separate from cost: only approved funding counts towards affordability, and the gap is never reduced by unapproved money. */
export type OptionFunding = {
  approved: Money;
  /** Expected or proposed funding; shown, never counted as secured. */
  candidate: Money;
  fullyFunded: Scalars['Boolean']['output'];
  /** Total cost minus approved funding, never below zero. */
  gap: MoneyRange;
  lines: Array<OptionFundingLine>;
  note: Scalars['String']['output'];
  totalCost: MoneyRange;
};

/** One declared source of money for the plan. */
export type OptionFundingLine = {
  amount: Money;
  /** True when in the plan's currency; otherwise shown but never converted. */
  applicable: Scalars['Boolean']['output'];
  /** True only when approved and in the plan's currency: reduces the gap. */
  counts: Scalars['Boolean']['output'];
  label: Scalars['String']['output'];
  status: FundingStatus;
};

/** Costs and benefits totalled over the planning horizon. */
export type OptionHorizonTotals = {
  avoided?: Maybe<MoneyRange>;
  days: Scalars['Int']['output'];
  /** Avoided spending minus recurring cost minus upfront cost. */
  net?: Maybe<MoneyRange>;
  /** True only when the net is positive even at the pessimistic estimate. */
  netPositive: Scalars['Boolean']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  recurring?: Maybe<MoneyRange>;
};

export type OptionMeasure = {
  benefitTiming: BenefitTiming;
  buildDays?: Maybe<DayRange>;
  cost?: Maybe<MoneyRange>;
  /** Every effect value behind this line, with where it came from. */
  effects: Array<OptionEffect>;
  interventionId: Scalars['String']['output'];
  name: Scalars['String']['output'];
  /** Your yearly operating and maintenance estimate for this measure, if given. */
  recurring?: Maybe<MoneyRange>;
  waterHigh?: Maybe<ExactNumber>;
  /** L/day this measure saves or adds at your low estimates, after the measures before it, so lines add up without double counting. */
  waterLow?: Maybe<ExactNumber>;
};

/** When costs are recovered. Explicit about zero or negative savings and a payback beyond the planning horizon; never a negative or infinite number. */
export type OptionPayback = {
  note: Scalars['String']['output'];
  /** Fewest days to recover costs; null when even the best case never does. */
  optimisticDays?: Maybe<Scalars['Int']['output']>;
  outcome: PaybackOutcome;
  /** Most days to recover costs; null when the worst case never does. */
  pessimisticDays?: Maybe<Scalars['Int']['output']>;
};

/** Why combinations were not shown. Counts, never options. */
export type OptionRejections = {
  /** Could exceed the budget. */
  budgetUncertain: Scalars['Int']['output'];
  evaluated: Scalars['Int']['output'];
  missedTarget: Scalars['Int']['output'];
  /** Passed, but a smaller passing combination exists. */
  notMinimal: Scalars['Int']['output'];
  /** Would meet the target only with optimistic estimates. */
  onlyOptimistic: Scalars['Int']['output'];
  overBudget: Scalars['Int']['output'];
  /** Could take longer than allowed. */
  timeUncertain: Scalars['Int']['output'];
  tooSlow: Scalars['Int']['output'];
  /** The combination limit was reached. */
  truncated: Scalars['Boolean']['output'];
};

/** How far the result moves when one estimate goes low to high. */
export type OptionSensitivity = {
  interventionId: Scalars['String']['output'];
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  swing: ExactNumber;
};

/** The option at your low estimates under a documented stress. */
export type OptionStress = {
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  /** Null when the stress does not apply to this option. */
  meetsTarget?: Maybe<Scalars['Boolean']['output']>;
  value?: Maybe<ExactNumber>;
};

export type PageInfo = {
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
};

export type PaybackOutcome = 'BEYOND_HORIZON' | 'NEVER' | 'UNCERTAIN' | 'WITHIN_HORIZON';

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

/** Up to three genuinely feasible, diverse options for the saved goal under the confirmed scenario. Fewer, or none, when fewer pass; never padded. */
export type PlanComparison = {
  assumptions: Array<Scalars['String']['output']>;
  baselineId?: Maybe<Scalars['String']['output']>;
  baselineValue?: Maybe<ExactNumber>;
  catalogueVersion: Scalars['String']['output'];
  engineVersion: Scalars['String']['output'];
  excluded: Array<Scalars['String']['output']>;
  /** Hash of engine, catalogue, baseline, goal and scenario versions; any change gives a new id and new results. */
  id: Scalars['String']['output'];
  /** Influence boundaries, nearby places (geography only), groundwater reliance, water-quality readings and what is not assessed; shared by every option. */
  impactContext: ImpactContext;
  impactEngineVersion: Scalars['String']['output'];
  maxOptions: Scalars['Int']['output'];
  metric?: Maybe<PlanMetric>;
  /** Input that would let more be compared. */
  needs: Array<Scalars['String']['output']>;
  options: Array<ComparedOption>;
  /** The stable ranking rule used. */
  ranking: Scalars['String']['output'];
  rejections: OptionRejections;
  scenarioEngineVersion: Scalars['String']['output'];
  scenarioValue?: Maybe<ExactNumber>;
  status: PlanComparisonStatus;
  /** Documented stress parameters. */
  stressTests: Array<Scalars['String']['output']>;
  summary: Scalars['String']['output'];
  targetLevel?: Maybe<ExactNumber>;
  unit?: Maybe<Unit>;
};

/** OPTIONS, or why there are none: NO_FEASIBLE_PLAN, NEEDS_INPUT, TARGET_ALREADY_MET, NOT_SUPPORTED. */
export type PlanComparisonStatus =
  'NEEDS_INPUT' | 'NOT_SUPPORTED' | 'NO_FEASIBLE_PLAN' | 'OPTIONS' | 'TARGET_ALREADY_MET';

export type PlanMetric = 'SHORTAGE_DAYS' | 'TANKER_DEPENDENCE';

export type PlanOption = {
  bestFitReason?: Maybe<Scalars['String']['output']>;
  buildDays?: Maybe<DayRange>;
  /** PlanComparison.id it came from; null for options stored before the engine. */
  comparisonId?: Maybe<Scalars['String']['output']>;
  cost?: Maybe<MoneyRange>;
  costBasisDate?: Maybe<Scalars['LocalDate']['output']>;
  costUnavailableReason?: Maybe<Scalars['String']['output']>;
  /** Economics copied when this option was selected (ADR 0014); null for options stored before it existed. */
  economics?: Maybe<OptionEconomics>;
  engineVersion?: Maybe<Scalars['String']['output']>;
  feasibility: Feasibility;
  firstBenefitDays?: Maybe<DayRange>;
  id: Scalars['ID']['output'];
  impact: ImpactAssessment;
  /** The session inputsRevision this option was calculated for; an option from an older revision is out of date and cannot be selected. */
  inputsRevision: Scalars['Int']['output'];
  interventionIds: Array<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  sessionId: Scalars['ID']['output'];
  summary: Scalars['String']['output'];
};

export type PlanOptionConnection = {
  nodes: Array<PlanOption>;
  pageInfo: PageInfo;
};

export type PlanningMode = 'AGENT' | 'TRADITIONAL';

export type PlanningSession = {
  area?: Maybe<Area>;
  areaId?: Maybe<Scalars['ID']['output']>;
  communityId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['UtcDateTime']['output'];
  goal?: Maybe<Goal>;
  /** Feasibility of the saved goal for this session's location (null without a goal). Recomputed from current inputs on every read. */
  goalAssessment?: Maybe<GoalAssessment>;
  id: Scalars['ID']['output'];
  /** Increases whenever location, goal or scenario actually change, or a baseline value is recorded for the session; each also clears the selected plan. Derived results (plan options, funding matches, proposal previews) are keyed by it. */
  inputsRevision: Scalars['Int']['output'];
  mode: PlanningMode;
  /** Up to three genuinely feasible options for the saved goal under the confirmed scenario, computed deterministically from current inputs. Select one with updatePlanningSession(selectedPlanOptionId). */
  planComparison: PlanComparison;
  scenario?: Maybe<Scenario>;
  /** The saved scenario against the same baseline. */
  scenarioComparison: ScenarioComparison;
  selectedPlanOptionId?: Maybe<Scalars['ID']['output']>;
  /** Whether the chosen plan's stored assessment still matches a fresh one. IMPACT_CHANGED or NOT_CURRENT: choose again before finalizing. */
  selectedPlanStatus: SelectedPlanStatus;
  siteProfile?: Maybe<SiteProfile>;
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
  siteProfile?: InputMaybe<SiteProfileInput>;
  stage?: InputMaybe<PlanningStage>;
};

export type PlanningSessionPayload = {
  error?: Maybe<MutationError>;
  session?: Maybe<PlanningSession>;
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
  'FASTEST_BENEFIT' | 'LARGEST_IMPACT' | 'LOWEST_COST' | 'LOWEST_NEIGHBOUR_EFFECT';

export type ProjectExpense = {
  amount: Money;
  description: Scalars['String']['output'];
  source: Scalars['String']['output'];
  spentOn: Scalars['LocalDate']['output'];
};

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';

export type Proposal = {
  createdAt: Scalars['UtcDateTime']['output'];
  /** Private owner-authorized download for review. */
  downloadPath?: Maybe<Scalars['String']['output']>;
  flaggedCount: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  job?: Maybe<Job>;
  jobId: Scalars['ID']['output'];
  /** Private owner-authorized HTML preview for review. */
  previewPath?: Maybe<Scalars['String']['output']>;
  reportId: Scalars['ID']['output'];
  sections: Array<ProposalSection>;
  status: ProposalStatus;
  updatedAt: Scalars['UtcDateTime']['output'];
  version: Scalars['Int']['output'];
};

export type ProposalApplicantInput = {
  assumptions?: Array<Scalars['String']['input']>;
  category: Scalars['String']['input'];
  contactEmail?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  organization: Scalars['String']['input'];
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
  | 'SOURCES'
  | 'WIDER_IMPACT';

export type ProposalStatus = 'APPROVED' | 'DRAFTING' | 'FAILED' | 'NEEDS_REVIEW' | 'QUEUED';

export type Provenance = {
  asOf: Scalars['UtcDateTime']['output'];
  engineVersion?: Maybe<Scalars['String']['output']>;
  evidence: EvidenceQuality;
  inputHash?: Maybe<Scalars['String']['output']>;
  sourceIds: Array<Scalars['String']['output']>;
};

/** One parameter's reading with method and date; not a verdict. */
export type QualityReading = {
  citations: Array<ImpactCitation>;
  method?: Maybe<Scalars['String']['output']>;
  observedOn?: Maybe<Scalars['LocalDate']['output']>;
  parameter?: Maybe<Scalars['String']['output']>;
  unit: Unit;
  value: ExactNumber;
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
  aiStatus: AiStatus;
  area?: Maybe<Area>;
  /** Validate and screen a draft goal for a session without saving it. Uses the same rules as updatePlanningSession. */
  checkGoal: GoalCheck;
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
  /** The versioned intervention catalogue. */
  interventionCatalogue: InterventionCatalogue;
  job?: Maybe<Job>;
  myImplementationProjects: ImplementationProjectConnection;
  myMemberships: MembershipConnection;
  /** Active communities within the radius, nearest first. */
  nearbyCommunities: NearbyCommunityConnection;
  /** Plan options for the session's current inputs only. */
  planOptions: PlanOptionConnection;
  planningSession?: Maybe<PlanningSession>;
  /** Compare a scenario with the same baseline without saving it. Uses the same validation as updatePlanningSession. */
  previewScenario: ScenarioPreview;
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

export type QueryCheckGoalArgs = {
  goal: GoalInput;
  sessionId: Scalars['ID']['input'];
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

export type QueryPreviewScenarioArgs = {
  scenario: ScenarioPreviewInput;
  sessionId: Scalars['ID']['input'];
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

export type ReadinessState = 'AVAILABLE' | 'PARTIAL' | 'STALE' | 'UNAVAILABLE' | 'USER_ENTERED';

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
  areaId?: InputMaybe<Scalars['ID']['input']>;
  coverageExpectedDays: Scalars['Int']['input'];
  coverageObservedDays: Scalars['Int']['input'];
  idempotencyKey: Scalars['String']['input'];
  method: Scalars['String']['input'];
  metricId: Scalars['String']['input'];
  note?: Scalars['String']['input'];
  observedOn: Scalars['LocalDate']['input'];
  permittedSourceConfirmed?: Scalars['Boolean']['input'];
  projectId: Scalars['ID']['input'];
  quantity: QuantityInput;
  source: Scalars['String']['input'];
  sourceType?: ObservationSourceType;
  windowEnd: Scalars['LocalDate']['input'];
  windowStart: Scalars['LocalDate']['input'];
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
  /** The chosen option's economics, copied at finalization (ADR 0014); null for reports finalized before it existed. */
  economics?: Maybe<OptionEconomics>;
  finalizedAt: Scalars['UtcDateTime']['output'];
  goal: Goal;
  id: Scalars['ID']['output'];
  /** The chosen option's impact assessment, copied at finalization with its provenance; null for reports finalized before it existed. */
  impact?: Maybe<ImpactAssessment>;
  planName?: Maybe<Scalars['String']['output']>;
  planOptionId: Scalars['ID']['output'];
  proposals: ProposalConnection;
  sessionId: Scalars['ID']['output'];
  /** The community type and occupied homes you gave, copied at finalization; null when none were given. */
  siteProfile?: Maybe<SiteProfile>;
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

export type ReportStatus = 'ARCHIVED' | 'FINALIZED';

export type ReviewKind = 'HYDROGEOLOGICAL' | 'STRUCTURAL' | 'WATER_QUALITY';

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

/** The baseline and a scenario, side by side, from one baseline. */
export type ScenarioComparison = {
  baselineId?: Maybe<Scalars['String']['output']>;
  engineVersion: Scalars['String']['output'];
  notes: Array<Scalars['String']['output']>;
  rows: Array<ScenarioRow>;
  /** none, applied, or awaiting_confirmation (parsed from words, not yet confirmed; results ignore it until then). */
  status: Scalars['String']['output'];
};

export type ScenarioInput = {
  adjustments?: Array<ScenarioAdjustmentInput>;
  confirmed?: Scalars['Boolean']['input'];
  interpretedFrom?: InputMaybe<Scalars['String']['input']>;
};

export type ScenarioPreview = {
  comparison?: Maybe<ScenarioComparison>;
  /** Input that cannot be used; when present there is no comparison. */
  errors: Array<FieldError>;
};

export type ScenarioPreviewAdjustmentInput = {
  change: AdjustmentChange;
  parameter: Scalars['String']['input'];
  quantity: QuantityInput;
};

export type ScenarioPreviewInput = {
  adjustments?: Array<ScenarioPreviewAdjustmentInput>;
};

export type ScenarioRow = {
  baseline?: Maybe<ExactNumber>;
  /** scenario minus baseline. */
  change?: Maybe<ExactNumber>;
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  /** Why a value is unavailable. */
  reason?: Maybe<Scalars['String']['output']>;
  scenario?: Maybe<ExactNumber>;
  unit: Unit;
};

/** Whether the chosen plan still matches a fresh assessment; only CURRENT or LEGACY can be finalized. */
export type SelectedPlanStatus = 'CURRENT' | 'IMPACT_CHANGED' | 'LEGACY' | 'NONE' | 'NOT_CURRENT';

export type SessionStatus = 'ACTIVE' | 'CLOSED';

export type SharedReportSummary = {
  finalizedAt: Scalars['UtcDateTime']['output'];
  goal: Scalars['String']['output'];
};

/** A system that can carry a measure's effect beyond the site. */
export type SharedSystem = 'AQUIFER' | 'CATCHMENT' | 'SUPPLY_NETWORK';

/** What is known about the site; null means not known. */
export type SiteConstraints = {
  /** Whether the site pumps groundwater (a borewell or well), as you said. */
  groundwaterUse?: Maybe<Scalars['Boolean']['output']>;
  /** m2 of open or unpaved ground that could be dug or opened. */
  openGround?: Maybe<Quantity>;
  pipedSupply?: Maybe<Scalars['Boolean']['output']>;
  restrictions: Array<SiteRestriction>;
  /** m2 of roof to collect from. */
  roofArea?: Maybe<Quantity>;
  scale?: Maybe<SiteScale>;
  storageSpace?: Maybe<Scalars['Boolean']['output']>;
};

export type SiteConstraintsInput = {
  groundwaterUse?: InputMaybe<Scalars['Boolean']['input']>;
  openGround?: InputMaybe<QuantityInput>;
  pipedSupply?: InputMaybe<Scalars['Boolean']['input']>;
  restrictions?: Array<SiteRestriction>;
  roofArea?: InputMaybe<QuantityInput>;
  scale?: InputMaybe<SiteScale>;
  storageSpace?: InputMaybe<Scalars['Boolean']['input']>;
};

/** What you said about the community; null fields were not stated. */
export type SiteProfile = {
  communityType?: Maybe<CommunityType>;
  occupiedHomes?: Maybe<Scalars['Int']['output']>;
};

export type SiteProfileInput = {
  communityType?: InputMaybe<CommunityType>;
  occupiedHomes?: InputMaybe<Scalars['Int']['input']>;
};

export type SiteRequirement = 'OPEN_GROUND' | 'PIPED_SUPPLY' | 'ROOF_AREA' | 'STORAGE_SPACE';

export type SiteRestriction =
  | 'NO_EXCAVATION'
  | 'NO_GREYWATER_REUSE'
  | 'NO_PERMIT_WORKS'
  | 'NO_RECHARGE'
  | 'NO_STRUCTURAL_CHANGES';

export type SiteScale = 'BUILDING' | 'HOUSEHOLD' | 'NEIGHBOURHOOD' | 'UTILITY';

export type StartImplementationProjectInput = {
  idempotencyKey: Scalars['String']['input'];
  milestones?: Array<MilestoneInput>;
  reportId: Scalars['ID']['input'];
  shareWithCommunity?: Scalars['Boolean']['input'];
  title: Scalars['String']['input'];
};

export type SupportingValue = {
  exact: Scalars['String']['output'];
  key: Scalars['String']['output'];
  unit: CanonicalUnit;
  value: Scalars['DecimalString']['output'];
};

export type SystemLinkage = {
  evidenceIds: Array<Scalars['String']['output']>;
  linkage: Linkage;
  system: SharedSystem;
};

export type TargetCheck = {
  baseline?: Maybe<Scalars['DecimalString']['output']>;
  /** Exact rational baseline. */
  baselineExact?: Maybe<Scalars['String']['output']>;
  caveats: Array<Scalars['String']['output']>;
  message: Scalars['String']['output'];
  /** Baseline metric compared with. */
  metric?: Maybe<Scalars['String']['output']>;
  outcome: GoalOutcome;
  /** The level the target asks for (a relative target applied exactly). */
  targetLevel?: Maybe<Scalars['DecimalString']['output']>;
  unit?: Maybe<Unit>;
};

export type TargetMode = 'ABSOLUTE_LEVEL' | 'RELATIVE_REDUCTION';

export type TechnicalSupport = 'PROVISIONAL' | 'SUPPORTED' | 'UNAVAILABLE';

/** Something not assessed, and why. Never shown as zero or safe. */
export type UnavailableAssessment = {
  /** Cite as [U:key]. */
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  reason: Scalars['String']['output'];
};

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

export type UnitSystem = 'METRIC' | 'US_CUSTOMARY';

export type UpdateMilestoneInput = {
  completedOn?: InputMaybe<Scalars['LocalDate']['input']>;
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  status: MilestoneStatus;
};

export type UpdatePlanningSessionInput = {
  expectedVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  patch: PlanningSessionPatch;
};

export type UpdateProjectStatusInput = {
  expectedVersion: Scalars['Int']['input'];
  projectId: Scalars['ID']['input'];
  status: ProjectStatus;
};

/** Measured, your estimate or modelled; shown distinctly wherever a value is. */
export type ValueOrigin = 'MEASURED' | 'MODELED' | 'USER_ESTIMATE';

export type Viewer = {
  kind: AccountKind;
  uid: Scalars['ID']['output'];
};

/** The tanker-water price you pay now; your estimate, never converted. */
export type WaterTariff = {
  note: Scalars['String']['output'];
  price: Money;
  /** The volume the price buys, in litres. */
  volume: Quantity;
};

/** The tanker-water price you pay now; your estimate, never converted. */
export type WaterTariffInput = {
  note?: Scalars['String']['input'];
  price: MoneyInput;
  volume: QuantityInput;
};

/** Wider-system impact of one option: local benefits, possible effects beyond the site, false-resilience warnings, trade-offs, reviews and what is not assessed. Its id derives from everything it used. */
export type WiderImpact = {
  catalogueVersion: Scalars['String']['output'];
  comparisonId: Scalars['String']['output'];
  context: ImpactContext;
  engineVersion: Scalars['String']['output'];
  externalities: Array<ImpactFinding>;
  falseResilience: Array<ImpactFinding>;
  id: Scalars['ID']['output'];
  inputHash: Scalars['String']['output'];
  localBenefits: Array<ImpactFinding>;
  optionId: Scalars['ID']['output'];
  reviews: Array<ImpactReview>;
  tradeoffs: Array<ImpactFinding>;
};

export type WindowStatus = 'CLOSED' | 'OPEN' | 'UNKNOWN' | 'UPCOMING';
